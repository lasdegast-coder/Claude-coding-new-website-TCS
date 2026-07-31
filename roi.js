/* =================================================================
   ROI / besparingscalculator — Thermal Compost Systems
   Alles wordt intern omgerekend naar kWh warmtevraag, zodat de
   berekening identiek is ongeacht de gekozen energiedrager.
   Aannames staan als voorbeeldwaarden in het formulier en zijn
   voor de bezoeker aanpasbaar (geen black box).
   ================================================================= */
(function () {
  const form = document.getElementById('roi-form');
  const out = document.getElementById('roi-results');
  if (!form || !out) return;

  // ---- vaste (niet-zichtbare) omreken-aannames ----
  const GAS_KWH_M3 = 9.77;   // calorische waarde aardgas
  const BOILER_EFF = 0.90;   // rendement bestaande ketel
  const OWN_KW = 1;          // eigen stroomverbruik per module
  // Vuistregel Thermal Compost: één systeem verwerkt 55 m³ per maand = 660 m³/jaar.
  // Vanaf 660 m³ komt er een tweede systeem bij, vanaf 1320 een derde, enz.
  // Onder 55 m³ per jaar is een systeem niet zinvol.
  const M3_PER_MONTH = 55;
  const M3_PER_MODULE = M3_PER_MONTH * 12;   // 660 m³/jaar
  const MIN_M3 = 55;
  // Ondergrens voor de warmtedekking waarop we het aantal systemen baseren.
  const COVERAGE_MIN = 0.85;

  // CO₂: koolstof die in de compost wordt vastgelegd in plaats van te vervluchtigen.
  // systemen × maanden × m³/maand × kg/m³ × C-gehalte × C niet verdampt × C→CO₂
  const HOURS_PER_YEAR = 8760;
  const KG_PER_M3   = 700;   // gewicht reststroom per kuub
  const C_SHARE     = 0.5;   // koolstofgehalte
  const C_RETAINED  = 0.67;  // deel koolstof dat niet vervluchtigt
  const C_TO_CO2    = 3.67;  // koolstof → CO₂ (44/12)

  const nl0 = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
  const nl1 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const euro = (n) => '€ ' + nl0.format(Math.round(n));
  const plus = (n) => '+ ' + euro(n);
  const minus = (n) => '– ' + euro(Math.abs(n));
  const signed = (n) => (n >= 0 ? '+ ' : '– ') + euro(Math.abs(n));

  const num = (id) => { const v = parseFloat(document.getElementById(id).value); return isFinite(v) && v > 0 ? v : 0; };
  const seg = () => (form.querySelector('input[name="seg"]:checked') || {}).value || 'kas';

  // Warmte per module verschilt per segment: kassen hebben minder mest, dus
  // een lagere warmteafgifte. Vult het veld voor, tenzij de bezoeker het zelf aanpast.
  const KW_PER_SEG = { vee: 45, terrein: 35, kas: 30 };
  const kwInput = document.getElementById('a-kw');
  let kwTouched = false;
  if (kwInput) kwInput.addEventListener('input', () => { kwTouched = true; });

  // ---- toon/verberg velden op basis van keuzes ----
  function sync() {
    const energy = document.getElementById('roi-energy').value;
    document.querySelector('.roi-when-gas').hidden = energy !== 'gas';
    document.querySelector('.roi-when-elek').hidden = energy !== 'elek';
    document.querySelector('.roi-when-anders').hidden = energy !== 'anders';

    // warmte per module volgt het segment, zolang de bezoeker het veld niet zelf invulde
    if (kwInput && !kwTouched) kwInput.value = KW_PER_SEG[seg()] || 45;

    const type = document.getElementById('roi-type').value;
    const hasFeed = type !== 'geen';
    document.querySelector('.roi-when-has').hidden = !hasFeed;
    // verwerkingskosten gelden voor élk segment met eigen reststroom (ook kas/tuincentrum)
    document.querySelector('.roi-when-proc').hidden = !hasFeed;
  }

  // ---- berekening ----
  function calc() {
    const energy = document.getElementById('roi-energy').value;
    const type = document.getElementById('roi-type').value;
    const s = seg();
    const hasFeed = type !== 'geen';

    const runHours = num('a-hours');
    const kw = num('a-kw');
    const heatPerModule = kw * runHours;                 // kWh/jaar per module
    const modulePrice = num('a-price');
    const installCost = num('a-install');
    const maintenance = num('a-maint');
    const lifetime = num('a-life') || 15;
    const compostShare = num('a-compost') / 100;   // deel van het verwerkte materiaal dat compost wordt
    const compostVal = num('a-compostval');
    const elecPriceOwn = num('a-elec');
    const aanvoerCost = num('a-aanvoer');

    // 1) huidige warmtevraag → kWh/jaar + prijs per kWh
    let heatDemand = 0, energyLabel = 'warmtekosten', pricePerKwh = 0;
    if (energy === 'gas') {
      heatDemand = num('roi-gas-m3') * GAS_KWH_M3 * BOILER_EFF;
      pricePerKwh = num('roi-gas-price') / (GAS_KWH_M3 * BOILER_EFF);
      energyLabel = 'aardgas';
    } else if (energy === 'elek') {
      heatDemand = num('roi-elek-kwh');
      pricePerKwh = num('roi-elek-price');
      energyLabel = 'elektriciteit';
    } else {
      heatDemand = num('roi-anders-kwh');
      pricePerKwh = num('roi-anders-price');
      energyLabel = 'warmtekosten';
    }

    // 2) hoeveel modules? (begrensd door warmtevraag en beschikbare reststroom)
    // We adviseren het kleinste aantal dat minstens COVERAGE_MIN van de warmtevraag
    // dekt. Anders komt er een hele module bij om de laatste procenten te halen,
    // wat de investering verdubbelt terwijl die module grotendeels leegloopt.
    // De rest dekt de klant met de bestaande installatie.
    const modulesForDemand = heatDemand > 0 && heatPerModule > 0
      ? Math.max(1, Math.ceil(COVERAGE_MIN * heatDemand / heatPerModule))
      : 1;
    // beschikbare reststroom → aantal systemen (660 m³ per stap, minimaal 55 m³)
    const volume = num('roi-volume');
    let modulesFromFeed = Infinity;
    if (hasFeed) {
      modulesFromFeed = volume < MIN_M3 ? 0 : Math.floor(volume / M3_PER_MODULE) + 1;
    }
    const modules = Math.max(0, Math.min(modulesForDemand, modulesFromFeed));

    const heatCovered = Math.min(modules * heatPerModule, heatDemand);

    // 3) jaarlijkse posten
    const vermedenEnergie = heatCovered * pricePerKwh;

    // Hoeveel materiaal gaat er werkelijk doorheen? De capaciteit van de systemen,
    // begrensd door wat de klant zelf aan reststroom heeft. Dit getal voedt zowel
    // de verwerkings-/aanvoerkosten als de CO₂-berekening.
    const monthsRun = runHours * 12 / HOURS_PER_YEAR;        // draaiuren → maanden
    const capacityM3 = modules * M3_PER_MONTH * monthsRun;   // wat de systemen aankunnen
    const processedM3 = hasFeed ? Math.min(volume, capacityM3) : capacityM3;

    let verwerkingLine = 0, aanvoerLine = 0;
    if (hasFeed) {
      verwerkingLine = processedM3 * num('roi-proc');
    } else {
      // geen eigen feedstock → materiaal moet worden aangevoerd (kostenpost)
      aanvoerLine = processedM3 * aanvoerCost;
    }

    // compost volgt het materiaal dat er werkelijk doorheen gaat, niet het aantal modules
    const compostM3 = processedM3 * compostShare;
    const compostValue = compostM3 * compostVal;
    const ownElec = modules * OWN_KW * runHours * elecPriceOwn;
    const onderhoud = modules * maintenance;

    const jaarBesparing = vermedenEnergie + verwerkingLine - aanvoerLine + compostValue - ownElec - onderhoud;
    const investering = modules * (modulePrice + installCost);
    const payback = jaarBesparing > 0 ? investering / jaarBesparing : null;
    const naLevensduur = jaarBesparing * lifetime - investering;

    // CO₂ — koolstof die in de compost vastgelegd blijft i.p.v. te vervluchtigen,
    // berekend over het materiaal dat er werkelijk doorheen gaat
    const co2Net = processedM3 * KG_PER_M3 * C_SHARE * C_RETAINED * C_TO_CO2;

    const dekking = heatDemand > 0 ? heatCovered / heatDemand : 0;

    return {
      s, type, hasFeed, energy, energyLabel, modules,
      vermedenEnergie, verwerkingLine, aanvoerLine, compostValue, ownElec, onderhoud,
      jaarBesparing, investering, payback, naLevensduur, lifetime, co2Net,
      heatDemand, volume, minM3: MIN_M3,
      dekking, perModule: modulePrice + installCost,
      processedM3, feedDekking: hasFeed && volume > 0 ? Math.min(1, processedM3 / volume) : 0,
    };
  }

  // ---- weergave ----
  function render() {
    sync();
    const r = calc();

    // Alleen bij 'overig organisch materiaal' is de warmteopbrengst echt onbekend,
    // dus daar blijven het labeltje en het voorbehoud in de voetnoot staan.
    const onzeker = r.type === 'overig';
    const badge = onzeker
      ? '<span class="roi-badge ind">Indicatie, samen vast te stellen</span>' : '';

    let warn = '';
    if (r.heatDemand <= 0) {
      warn = '<div class="roi-warn">Vul uw huidige warmtegebruik in voor een berekening.</div>';
    } else if (r.hasFeed && r.volume > 0 && r.volume < r.minM3) {
      warn = `<div class="roi-warn">Onder ${r.minM3} m³ reststroom per jaar is een systeem niet zinvol. Vanaf ${r.minM3} m³ rekenen we het graag voor u door.</div>`;
    } else if (r.modules < 1) {
      warn = '<div class="roi-warn">Met deze invoer komt er nog geen volledige module uit. Er is meer reststroom nodig. Pas de hoeveelheid aan.</div>';
    } else if (r.jaarBesparing <= 0) {
      warn = '<div class="roi-warn">Met deze invoer levert het systeem nog geen positieve jaarbesparing. Pas de hoeveelheden of aannames aan, of bespreek uw situatie met ons.</div>';
    }

    const paybackTxt = r.payback ? nl1.format(r.payback) + ' jaar' : 'n.v.t.';

    // Bij meer dan één module de verdubbeling van de investering navolgbaar maken,
    // en laten zien welk deel van de warmtevraag er gedekt wordt.
    const perStuk = r.modules > 1
      ? `<span class="roi-sub">${r.modules} × ${euro(r.perModule)}</span>` : '';
    // Elke opbrengstregel die tegen een capaciteitsgrens aanloopt legt zichzelf uit.
    // Regels die de volle vraag dekken blijven schoon.
    const dekPct = Math.round(r.dekking * 100);
    const energieSub = r.dekking > 0 && dekPct < 100
      ? `<span class="roi-sub">dekt ${dekPct}% van uw warmtevraag</span>` : '';
    const restNote = '';

    const lines = [];
    lines.push(`<li><span>Vermeden ${r.energyLabel}${energieSub}</span><span>${plus(r.vermedenEnergie)}</span></li>`);
    if (r.hasFeed && r.verwerkingLine > 0) {
      // laten zien welk deel van de reststroom er werkelijk doorheen gaat: de rest
      // voert de klant nog steeds af en blijft dus geld kosten
      const feedPct = Math.round(r.feedDekking * 100);
      const feedSub = feedPct < 100
        ? `<span class="roi-sub">dekt ${feedPct}% van uw verwerkingskosten</span>` : '';
      lines.push(`<li><span>Vermeden verwerkingskosten${feedSub}</span><span>${plus(r.verwerkingLine)}</span></li>`);
    }
    if (!r.hasFeed && r.aanvoerLine > 0)
      lines.push(`<li class="neg"><span>Aanvoerkosten feedstock</span><span>${minus(r.aanvoerLine)}</span></li>`);
    lines.push(`<li><span>Compostopbrengst</span><span>${plus(r.compostValue)}</span></li>`);
    lines.push(`<li class="neg"><span>Eigen stroomverbruik</span><span>${minus(r.ownElec)}</span></li>`);
    lines.push(`<li class="neg"><span>Onderhoud &amp; beheer</span><span>${minus(r.onderhoud)}</span></li>`);
    lines.push(`<li class="total"><span>Jaarlijkse besparing</span><span>${euro(r.jaarBesparing)}</span></li>`);

    out.innerHTML = `
      <div class="roi-headline">
        <span class="roi-label">Terugverdientijd</span>
        <span class="roi-big">${paybackTxt}</span>
        ${badge}
      </div>
      ${warn}
      <ul class="roi-lines">${lines.join('')}</ul>
      <dl class="roi-sec">
        <div><dt>Totale investering</dt><dd>${euro(r.investering)}${perStuk}</dd></div>
        <div><dt>Resultaat na ${r.lifetime} jaar</dt><dd>${signed(r.naLevensduur)}</dd></div>
        <div><dt>Aanbevolen modules</dt><dd>${r.modules}</dd></div>
        <div><dt>Vermeden CO₂</dt><dd>${nl1.format(Math.max(0, r.co2Net) / 1000)} ton/jr</dd></div>
      </dl>
      <p class="roi-note">Indicatie op basis van uw invoer en de getoonde aannames. Subsidie (SDE++/ISDE) is <strong>niet</strong> meegerekend en kan de terugverdientijd verder verkorten.${restNote}${onzeker ? ' De exacte warmteopbrengst van deze reststroom stellen we samen met u vast.' : ''}</p>
      <a class="btn btn-primary btn-block" href="#contact">Plan een gesprek over uw berekening</a>
    `;
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  render();

  /* -----------------------------------------------------------------
     Doorgeven aan het contactformulier.
     We houden bij of de bezoeker de rekenhulp echt heeft aangeraakt.
     Zo niet, dan sturen we niets mee: anders lijkt elke aanvraag op de
     voorbeeldsituatie die standaard in de velden staat.
     ----------------------------------------------------------------- */
  // Bewust zonder vlaggetje dat op een gebeurtenis wordt gezet: de volgorde
  // waarin scripts hun luisteraars aanhaken is dan bepalend. We kijken gewoon
  // of er iets afwijkt van de waarden die in de HTML staan.
  const isAangeraakt = () => {
    let anders = false;
    form.querySelectorAll('input, select').forEach((el) => {
      if (anders) return;
      if (el.type === 'radio') { if (el.checked !== el.defaultChecked) anders = true; }
      else if (el.tagName === 'SELECT') {
        let standaard = Array.prototype.findIndex.call(el.options, (o) => o.defaultSelected);
        if (standaard < 0) standaard = 0;
        if (el.selectedIndex !== standaard) anders = true;
      } else if (el.value !== el.defaultValue) anders = true;
    });
    return anders;
  };

  const keuzeTekst = (id) => {
    const el = document.getElementById(id);
    if (!el) return '';
    const opt = el.options ? el.options[el.selectedIndex] : null;
    return opt ? opt.textContent.trim() : el.value;
  };
  const segTekst = () => {
    const gekozen = form.querySelector('input[name="seg"]:checked');
    const lab = gekozen && gekozen.closest('label');
    return lab ? lab.textContent.trim() : '';
  };
  // Aannames die de bezoeker zelf heeft aangepast: dat vertelt waar hij twijfelt.
  const gewijzigdeAannames = () => {
    const uit = [];
    document.querySelectorAll('.roi-assumptions input').forEach((el) => {
      if (el.value !== el.defaultValue) {
        const lab = el.closest('label');
        const naam = lab ? lab.childNodes[0].textContent.trim() : el.id;
        uit.push(naam + ': ' + el.value + '  (standaard ' + el.defaultValue + ')');
      }
    });
    return uit;
  };

  window.tcsBerekening = function () {
    if (!isAangeraakt()) return null;
    const r = calc();
    const energie = keuzeTekst('roi-energy');
    const nl2 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const prijs = (id) => '€ ' + nl2.format(num(id));
    const verbruik = r.energy === 'gas'
      ? nl0.format(num('roi-gas-m3')) + ' m³ gas per jaar à ' + prijs('roi-gas-price') + ' per m³'
      : (r.energy === 'elek'
        ? nl0.format(num('roi-elek-kwh')) + ' kWh per jaar à ' + prijs('roi-elek-price') + ' per kWh'
        : nl0.format(num('roi-anders-kwh')) + ' kWh per jaar à ' + prijs('roi-anders-price') + ' per kWh');

    const regels = [
      'Situatie:            ' + segTekst(),
      'Verwarmt nu met:     ' + energie,
      'Verbruik:            ' + verbruik,
      'Eigen reststromen:   ' + keuzeTekst('roi-type'),
    ];
    if (r.hasFeed) {
      regels.push('Hoeveelheid:         ' + nl0.format(r.volume) + ' m³ per jaar');
      regels.push('Verwerkingskosten:   ' + prijs('roi-proc') + ' per m³');
    }

    const aangepast = gewijzigdeAannames();
    if (aangepast.length) {
      regels.push('', 'Zelf aangepaste aannames:');
      aangepast.forEach((a) => regels.push('  ' + a));
    }

    regels.push(
      '',
      'UITKOMST',
      'Terugverdientijd:    ' + (r.payback ? nl1.format(r.payback) + ' jaar' : 'geen positieve uitkomst'),
      'Jaarlijkse besparing: ' + euro(r.jaarBesparing),
      'Totale investering:  ' + euro(r.investering),
      'Aanbevolen modules:  ' + r.modules,
      'Warmtedekking:       ' + Math.round(r.dekking * 100) + '%',
      'Vermeden CO₂:        ' + nl1.format(Math.max(0, r.co2Net) / 1000) + ' ton per jaar'
    );

    const kort = r.payback
      ? r.modules + (r.modules === 1 ? ' systeem' : ' systemen') + ', ' + euro(r.jaarBesparing)
        + ' per jaar, terugverdientijd ' + nl1.format(r.payback) + ' jaar'
      : null;

    return { kort, tekst: regels.join('\n') };
  };
})();
