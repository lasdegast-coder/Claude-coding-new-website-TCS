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
  // m³ × kg droge stof per m³ × C-gehalte × C niet verdampt × C→CO₂
  // De 218 kg is gemeten, niet geschat: een batch van 55 m³ bevat 12.000 kg droge stof.
  // Rekenen met nat gewicht zou de uitkomst ruim drie keer te hoog maken, want het
  // koolstofgehalte geldt voor de droge stof.
  const HOURS_PER_YEAR = 8760;
  const DS_PER_M3   = 218;   // gemeten droge stof per kuub (55 m³ per batch = 12.000 kg ds)
  const C_SHARE     = 0.5;   // koolstofgehalte van de droge stof
  const C_RETAINED  = 0.67;  // deel koolstof dat niet vervluchtigt
  const C_TO_CO2    = 3.67;  // koolstof → CO₂ (44/12)

  /* ---- taal ----
     De rekenhulp draait op de Nederlandse en de Engelse site vanuit hetzelfde
     bestand. De taal komt uit <html lang>, zodat er geen tweede kopie hoeft te
     bestaan die na de eerste wijziging uit de pas gaat lopen. */
  const LANG = (document.documentElement.lang || 'nl').toLowerCase().startsWith('en') ? 'en' : 'nl';
  const LOC = LANG === 'en' ? 'en-GB' : 'nl-NL';
  const T = {
    nl: {
      gas: 'aardgas', elek: 'elektriciteit', anders: 'warmtekosten',
      badge: 'Indicatie, samen vast te stellen',
      warnHeat: 'Vul uw huidige warmtegebruik in voor een berekening.',
      warnMin: (m) => `Onder ${m} m³ reststroom per jaar is een systeem niet zinvol. Vanaf ${m} m³ rekenen we het graag voor u door.`,
      warnModule: 'Met deze invoer komt er nog geen volledige module uit. Er is meer reststroom nodig. Pas de hoeveelheid aan.',
      warnNeg: 'Met deze invoer levert het systeem nog geen positieve jaarbesparing. Pas de hoeveelheden of aannames aan, of bespreek uw situatie met ons.',
      jaar: ' jaar', nvt: 'n.v.t.',
      grensPre: 'begrensd door uw ', grensFeed: 'reststroom', grensHeat: 'warmtevraag',
      dektHeat: (p) => `dekt ${p}% van uw warmtevraag`,
      dektFeed: (p) => `dekt ${p}% van uw verwerkingskosten`,
      vermeden: 'Vermeden ', vermedenProc: 'Vermeden verwerkingskosten',
      aanvoer: 'Aanvoerkosten feedstock', compost: 'Compostopbrengst',
      stroom: 'Eigen stroomverbruik', onderhoud: 'Onderhoud &amp; beheer',
      besparing: 'Jaarlijkse besparing', terugverdientijd: 'Terugverdientijd',
      investering: 'Totale investering', naJaar: (n) => `Resultaat na ${n} jaar`,
      modules: 'Aanbevolen modules', co2: 'Vermeden CO₂', tonJr: ' ton/jr',
      note: 'Indicatie op basis van uw invoer en de getoonde aannames. Subsidie (SDE++/ISDE) is <strong>niet</strong> meegerekend en kan de terugverdientijd verder verkorten.',
      noteOnzeker: ' De exacte warmteopbrengst van deze reststroom stellen we samen met u vast.',
      cta: 'Plan een gesprek over uw berekening',
      reset: 'Herstel standaardwaarden',
      bSituatie: 'Situatie:', bVerwarmt: 'Verwarmt nu met:', bVerbruik: 'Verbruik:',
      bRest: 'Eigen reststromen:', bHoeveel: 'Hoeveelheid:', bProc: 'Verwerkingskosten:',
      bAangepast: 'Zelf aangepaste aannames:', bStandaard: 'standaard',
      bUitkomst: 'UITKOMST', bGeen: 'geen positieve uitkomst',
      bGasJaar: ' m³ gas per jaar à ', bPerM3: ' per m³',
      bKwhJaar: ' kWh per jaar à ', bPerKwh: ' per kWh', bM3Jaar: ' m³ per jaar',
      bTerugverdien: 'Terugverdientijd:', bBesparing: 'Jaarlijkse besparing:',
      bInvestering: 'Totale investering:', bModules: 'Aanbevolen modules:',
      bDekking: 'Warmtedekking:', bCo2: 'Vermeden CO₂:', bTonJaar: ' ton per jaar',
      kort1: ' systeem', kortN: ' systemen', kortPer: ' per jaar, terugverdientijd ',
    },
    en: {
      gas: 'natural gas', elek: 'electricity', anders: 'heating costs',
      badge: 'Indicative, to be established together',
      warnHeat: 'Enter your current heat use to see a calculation.',
      warnMin: (m) => `Below ${m} m³ of residual material per year a system is not worthwhile. From ${m} m³ onwards we are happy to work it out for you.`,
      warnModule: 'This input does not add up to a full module yet. More residual material is needed. Adjust the amount.',
      warnNeg: 'With this input the system does not yet produce a positive annual saving. Adjust the amounts or the assumptions, or talk your situation through with us.',
      jaar: ' years', nvt: 'n/a',
      grensPre: 'limited by your ', grensFeed: 'residual material', grensHeat: 'heat demand',
      dektHeat: (p) => `covers ${p}% of your heat demand`,
      dektFeed: (p) => `covers ${p}% of your processing costs`,
      vermeden: 'Avoided ', vermedenProc: 'Avoided processing costs',
      aanvoer: 'Feedstock supply costs', compost: 'Compost revenue',
      stroom: 'Own electricity use', onderhoud: 'Maintenance &amp; management',
      besparing: 'Annual saving', terugverdientijd: 'Payback period',
      investering: 'Total investment', naJaar: (n) => `Result after ${n} years`,
      modules: 'Recommended modules', co2: 'Avoided CO₂', tonJr: ' tonnes/yr',
      note: 'An indication based on your input and the assumptions shown. Subsidy (SDE++/ISDE) is <strong>not</strong> included and can shorten the payback period further.',
      noteOnzeker: ' We establish the exact heat yield of this residual stream together with you.',
      cta: 'Book a call about your calculation',
      reset: 'Restore default values',
      bSituatie: 'Situation:', bVerwarmt: 'Currently heating with:', bVerbruik: 'Consumption:',
      bRest: 'Own residual streams:', bHoeveel: 'Amount:', bProc: 'Processing costs:',
      bAangepast: 'Assumptions you changed:', bStandaard: 'default',
      bUitkomst: 'RESULT', bGeen: 'no positive result',
      bGasJaar: ' m³ gas per year at ', bPerM3: ' per m³',
      bKwhJaar: ' kWh per year at ', bPerKwh: ' per kWh', bM3Jaar: ' m³ per year',
      bTerugverdien: 'Payback period:', bBesparing: 'Annual saving:',
      bInvestering: 'Total investment:', bModules: 'Recommended modules:',
      bDekking: 'Heat coverage:', bCo2: 'Avoided CO₂:', bTonJaar: ' tonnes per year',
      kort1: ' system', kortN: ' systems', kortPer: ' per year, payback ',
    },
  }[LANG];

  const nl0 = new Intl.NumberFormat(LOC, { maximumFractionDigits: 0 });
  const nl1 = new Intl.NumberFormat(LOC, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

  // Ook het gasverbruik verschilt sterk per segment: een veehouderij stookt een
  // veelvoud van een tuincentrum. Vult het veld voor, tenzij de bezoeker het zelf aanpast.
  const GAS_PER_SEG = { vee: 65000, terrein: 25000, kas: 25000 };
  const gasInput = document.getElementById('roi-gas-m3');
  let gasTouched = false;
  if (gasInput) gasInput.addEventListener('input', () => { gasTouched = true; });

  // ---- toon/verberg velden op basis van keuzes ----
  function sync() {
    const energy = document.getElementById('roi-energy').value;
    document.querySelector('.roi-when-gas').hidden = energy !== 'gas';
    document.querySelector('.roi-when-elek').hidden = energy !== 'elek';
    document.querySelector('.roi-when-anders').hidden = energy !== 'anders';

    // warmte per module volgt het segment, zolang de bezoeker het veld niet zelf invulde
    if (kwInput && !kwTouched) kwInput.value = KW_PER_SEG[seg()] || 45;
    if (gasInput && !gasTouched) gasInput.value = GAS_PER_SEG[seg()] || 25000;

    const type = document.getElementById('roi-type').value;
    const hasFeed = type !== 'geen';
    document.querySelector('.roi-when-has').hidden = !hasFeed;
    // verwerkingskosten gelden voor élk segment met eigen reststroom (ook tuincentrum/kas)
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
      energyLabel = T.gas;
    } else if (energy === 'elek') {
      heatDemand = num('roi-elek-kwh');
      pricePerKwh = num('roi-elek-price');
      energyLabel = T.elek;
    } else {
      heatDemand = num('roi-anders-kwh');
      pricePerKwh = num('roi-anders-price');
      energyLabel = T.anders;
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
    // Welke van de twee grenzen knelt? Zonder dat te tonen lijkt de rekenhulp
    // stuk: meer reststroom invullen verandert dan niets zichtbaars.
    const grens = modules < 1 ? null
      : (modulesFromFeed < modulesForDemand ? T.grensFeed
        : (modulesForDemand < modulesFromFeed ? T.grensHeat : null));

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
    const co2Net = processedM3 * DS_PER_M3 * C_SHARE * C_RETAINED * C_TO_CO2;

    const dekking = heatDemand > 0 ? heatCovered / heatDemand : 0;

    return {
      s, type, hasFeed, energy, energyLabel, modules,
      vermedenEnergie, verwerkingLine, aanvoerLine, compostValue, ownElec, onderhoud,
      jaarBesparing, investering, payback, naLevensduur, lifetime, co2Net,
      heatDemand, volume, minM3: MIN_M3, grens,
      dekking, perModule: modulePrice + installCost,
      processedM3, feedDekking: hasFeed && volume > 0 ? Math.min(1, processedM3 / volume) : 0,
    };
  }

  /* De standaardwaarde van een aanname. De warmte per module is de uitzondering:
     die vult het formulier zelf in op basis van het gekozen segment. */
  const standaardVan = (el) => {
    if (el.id === 'a-kw') return String(KW_PER_SEG[seg()] || el.defaultValue);
    if (el.id === 'roi-gas-m3') return String(GAS_PER_SEG[seg()] || el.defaultValue);
    return el.defaultValue;
  };

  /* Terugzetknop: alleen zichtbaar zodra de bezoeker echt iets heeft veranderd,
     zodat hij niet in de weg staat bij wie de aannames laat staan. */
  const resetKnop = document.querySelector('.roi-reset');
  if (resetKnop) {
    resetKnop.textContent = T.reset;
    resetKnop.addEventListener('click', () => {
      form.querySelectorAll('.roi-assumptions input').forEach((el) => {
        el.value = standaardVan(el);
      });
      kwTouched = false;
      render();
      resetKnop.blur();
    });
  }
  const toonReset = () => {
    if (!resetKnop) return;
    const anders = [...form.querySelectorAll('.roi-assumptions input')]
      .some((el) => el.value !== standaardVan(el));
    resetKnop.hidden = !anders;
  };

  // ---- weergave ----
  function render() {
    sync();
    toonReset();
    const r = calc();

    // Alleen bij 'overig organisch materiaal' is de warmteopbrengst echt onbekend,
    // dus daar blijven het labeltje en het voorbehoud in de voetnoot staan.
    const onzeker = r.type === 'overig';
    const badge = onzeker
      ? `<span class="roi-badge ind">${T.badge}</span>` : '';

    let warn = '';
    if (r.heatDemand <= 0) {
      warn = `<div class="roi-warn">${T.warnHeat}</div>`;
    } else if (r.hasFeed && r.volume > 0 && r.volume < r.minM3) {
      warn = `<div class="roi-warn">${T.warnMin(r.minM3)}</div>`;
    } else if (r.modules < 1) {
      warn = `<div class="roi-warn">${T.warnModule}</div>`;
    } else if (r.jaarBesparing <= 0) {
      warn = `<div class="roi-warn">${T.warnNeg}</div>`;
    }

    const paybackTxt = r.payback ? nl1.format(r.payback) + T.jaar : T.nvt;

    // Bij meer dan één module de verdubbeling van de investering navolgbaar maken,
    // en laten zien welk deel van de warmtevraag er gedekt wordt.
    const perStuk = r.modules > 1
      ? `<span class="roi-sub">${r.modules} × ${euro(r.perModule)}</span>` : '';
    // laat zien welke van de twee grenzen het aantal bepaalt
    const grensTxt = r.grens
      ? `<span class="roi-sub">${T.grensPre}${r.grens}</span>` : '';
    // Elke opbrengstregel die tegen een capaciteitsgrens aanloopt legt zichzelf uit.
    // Regels die de volle vraag dekken blijven schoon.
    const dekPct = Math.round(r.dekking * 100);
    const energieSub = r.dekking > 0 && dekPct < 100
      ? `<span class="roi-sub">${T.dektHeat(dekPct)}</span>` : '';
    const restNote = '';

    const lines = [];
    lines.push(`<li><span>${T.vermeden}${r.energyLabel}${energieSub}</span><span>${plus(r.vermedenEnergie)}</span></li>`);
    if (r.hasFeed && r.verwerkingLine > 0) {
      // laten zien welk deel van de reststroom er werkelijk doorheen gaat: de rest
      // voert de klant nog steeds af en blijft dus geld kosten
      const feedPct = Math.round(r.feedDekking * 100);
      const feedSub = feedPct < 100
        ? `<span class="roi-sub">${T.dektFeed(feedPct)}</span>` : '';
      lines.push(`<li><span>${T.vermedenProc}${feedSub}</span><span>${plus(r.verwerkingLine)}</span></li>`);
    }
    if (!r.hasFeed && r.aanvoerLine > 0)
      lines.push(`<li class="neg"><span>${T.aanvoer}</span><span>${minus(r.aanvoerLine)}</span></li>`);
    lines.push(`<li><span>${T.compost}</span><span>${plus(r.compostValue)}</span></li>`);
    lines.push(`<li class="neg"><span>${T.stroom}</span><span>${minus(r.ownElec)}</span></li>`);
    lines.push(`<li class="neg"><span>${T.onderhoud}</span><span>${minus(r.onderhoud)}</span></li>`);
    lines.push(`<li class="total"><span>${T.besparing}</span><span>${euro(r.jaarBesparing)}</span></li>`);

    out.innerHTML = `
      <div class="roi-headline">
        <span class="roi-label">${T.terugverdientijd}</span>
        <span class="roi-big">${paybackTxt}</span>
        ${badge}
      </div>
      ${warn}
      <ul class="roi-lines">${lines.join('')}</ul>
      <dl class="roi-sec">
        <div><dt>${T.investering}</dt><dd>${euro(r.investering)}${perStuk}</dd></div>
        <div><dt>${T.naJaar(r.lifetime)}</dt><dd>${signed(r.naLevensduur)}</dd></div>
        <div><dt>${T.modules}</dt><dd>${r.modules}${grensTxt}</dd></div>
        <div><dt>${T.co2}</dt><dd>${nl1.format(Math.max(0, r.co2Net) / 1000)}${T.tonJr}</dd></div>
      </dl>
      <p class="roi-note">${T.note}${restNote}${onzeker ? T.noteOnzeker : ''}</p>
      <a class="btn btn-primary btn-block" href="#contact">${T.cta}</a>
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
        uit.push(naam + ': ' + el.value + '  (' + T.bStandaard + ' ' + el.defaultValue + ')');
      }
    });
    return uit;
  };

  /* Elk veld apart, met de standaardwaarde ernaast. Daarmee kan het Apps Script
     per veld een kolom vullen en zien waar de bezoeker van onze aannames afweek.
     Velden die op dat moment verborgen zijn (bijvoorbeeld de gasvelden als iemand
     elektrisch verwarmt) slaan we over, die zeggen niets over deze aanvraag. */
  const labelVan = (el) => {
    if (el.id) {
      const l = form.querySelector('label[for="' + el.id + '"]');
      if (l) return l.textContent.trim();
    }
    const om = el.closest('label');
    if (om && om.textContent.trim()) return om.textContent.trim();
    return el.getAttribute('aria-label') || el.id || el.name || '';
  };

  const verzamelVelden = () => {
    const uit = [];
    // de situatie is een radiogroep en telt als één veld
    const segKnoppen = [...form.querySelectorAll('input[name="seg"]')];
    const gekozen = segKnoppen.find((r) => r.checked);
    const standaardSeg = segKnoppen.find((r) => r.defaultChecked) || segKnoppen[0];
    if (gekozen) {
      uit.push({
        label: T.bSituatie.replace(/:$/, ''),
        waarde: labelVan(gekozen),
        standaard: labelVan(standaardSeg),
        aangepast: gekozen !== standaardSeg,
      });
    }
    form.querySelectorAll('select, input[type="number"]').forEach((el) => {
      if (el.closest('[hidden]')) return;
      if (el.tagName === 'SELECT') {
        let i = Array.prototype.findIndex.call(el.options, (o) => o.defaultSelected);
        if (i < 0) i = 0;
        uit.push({
          label: labelVan(el),
          waarde: el.options[el.selectedIndex] ? el.options[el.selectedIndex].textContent.trim() : el.value,
          standaard: el.options[i] ? el.options[i].textContent.trim() : '',
          aangepast: el.selectedIndex !== i,
        });
      } else {
        // De warmte per module vult het formulier zelf in op basis van het gekozen
        // segment. Daar is de standaard dus niet de waarde uit de HTML maar die
        // segmentwaarde, anders lijkt het alsof de bezoeker hem heeft aangepast.
        const standaard = standaardVan(el);
        uit.push({
          label: labelVan(el),
          waarde: el.value,
          standaard: standaard,
          aangepast: el.value !== standaard,
        });
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
      ? nl0.format(num('roi-gas-m3')) + T.bGasJaar + prijs('roi-gas-price') + T.bPerM3
      : (r.energy === 'elek'
        ? nl0.format(num('roi-elek-kwh')) + T.bKwhJaar + prijs('roi-elek-price') + T.bPerKwh
        : nl0.format(num('roi-anders-kwh')) + T.bKwhJaar + prijs('roi-anders-price') + T.bPerKwh);

    // Labels uitlijnen op de langste, zodat de mail in beide talen netjes oogt.
    const labels = [T.bSituatie, T.bVerwarmt, T.bVerbruik, T.bRest, T.bHoeveel, T.bProc,
      T.bTerugverdien, T.bBesparing, T.bInvestering, T.bModules, T.bDekking, T.bCo2];
    const breed = Math.max(...labels.map((l) => l.length)) + 2;
    const rij = (label, waarde) => label.padEnd(breed) + waarde;

    const regels = [
      rij(T.bSituatie, segTekst()),
      rij(T.bVerwarmt, energie),
      rij(T.bVerbruik, verbruik),
      rij(T.bRest, keuzeTekst('roi-type')),
    ];
    if (r.hasFeed) {
      regels.push(rij(T.bHoeveel, nl0.format(r.volume) + T.bM3Jaar));
      regels.push(rij(T.bProc, prijs('roi-proc') + T.bPerM3));
    }

    const aangepast = gewijzigdeAannames();
    if (aangepast.length) {
      regels.push('', T.bAangepast);
      aangepast.forEach((a) => regels.push('  ' + a));
    }

    regels.push(
      '',
      T.bUitkomst,
      rij(T.bTerugverdien, r.payback ? nl1.format(r.payback) + T.jaar : T.bGeen),
      rij(T.bBesparing, euro(r.jaarBesparing)),
      rij(T.bInvestering, euro(r.investering)),
      rij(T.bModules, String(r.modules)),
      rij(T.bDekking, Math.round(r.dekking * 100) + '%'),
      rij(T.bCo2, nl1.format(Math.max(0, r.co2Net) / 1000) + T.bTonJaar)
    );

    const kort = r.payback
      ? r.modules + (r.modules === 1 ? T.kort1 : T.kortN) + ', ' + euro(r.jaarBesparing)
        + T.kortPer + nl1.format(r.payback) + T.jaar
      : null;

    // velden en uitkomst gaan als losse gegevens mee, zodat het Apps Script er
    // kolommen van kan maken in plaats van één tekstblok
    const uitkomst = {
      'Aanbevolen modules': r.modules,
      'Jaarlijkse besparing (€)': Math.round(r.jaarBesparing),
      'Totale investering (€)': Math.round(r.investering),
      'Terugverdientijd (jaar)': r.payback ? Number(r.payback.toFixed(1)) : '',
      'Warmtedekking (%)': Math.round(r.dekking * 100),
      'Verwerkt materiaal (m³/jaar)': Math.round(r.processedM3),
      'Vermeden CO2 (ton/jaar)': Number((Math.max(0, r.co2Net) / 1000).toFixed(1)),
      'Begrensd door': r.grens || '',
    };

    return { kort, tekst: regels.join('\n'), velden: verzamelVelden(), uitkomst, taal: LANG };
  };
})();
