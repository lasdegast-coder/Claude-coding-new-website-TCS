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
  const M2_PER_MODULE = 30;  // ruimtebeslag per module
  const OWN_KW = 1;          // eigen stroomverbruik per module
  const HEAT_PER_TON = { mest: 250, groen: 400, overig: 200 }; // kWh warmte per ton, per type
  const CO2 = { gasM3: 1.884, elecKwh: 0.35, andersKwh: 0.25 }; // kg CO₂

  const nl0 = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
  const nl1 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const euro = (n) => '€ ' + nl0.format(Math.round(n));
  const plus = (n) => '+ ' + euro(n);
  const minus = (n) => '– ' + euro(Math.abs(n));
  const signed = (n) => (n >= 0 ? '+ ' : '– ') + euro(Math.abs(n));

  const num = (id) => { const v = parseFloat(document.getElementById(id).value); return isFinite(v) && v > 0 ? v : 0; };
  const seg = () => (form.querySelector('input[name="seg"]:checked') || {}).value || 'kas';

  // ---- toon/verberg velden op basis van keuzes ----
  function sync() {
    const energy = document.getElementById('roi-energy').value;
    document.querySelector('.roi-when-gas').hidden = energy !== 'gas';
    document.querySelector('.roi-when-elek').hidden = energy !== 'elek';
    document.querySelector('.roi-when-anders').hidden = energy !== 'anders';

    const type = document.getElementById('roi-type').value;
    document.querySelector('.roi-when-has').hidden = type === 'geen';

    const s = seg();
    document.querySelector('.roi-when-proc').hidden = !(s === 'vee' || s === 'terrein');
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
    const compostTon = num('a-compost');
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

    // 2) hoeveel modules?
    const space = num('roi-space');
    const modulesForDemand = heatDemand > 0 && heatPerModule > 0 ? Math.ceil(heatDemand / heatPerModule) : 1;
    const modulesFromSpace = space > 0 ? Math.floor(space / M2_PER_MODULE) : Infinity;
    let modulesFromFeed = Infinity;
    if (hasFeed) {
      const feedEnergy = num('roi-tons') * HEAT_PER_TON[type];
      modulesFromFeed = heatPerModule > 0 ? Math.floor(feedEnergy / heatPerModule) : 0;
    }
    const modules = Math.max(0, Math.min(modulesForDemand, modulesFromSpace, modulesFromFeed));

    const heatCovered = Math.min(modules * heatPerModule, heatDemand);
    const coverage = heatDemand > 0 ? heatCovered / heatDemand : 0;

    // 3) jaarlijkse posten
    const vermedenEnergie = heatCovered * pricePerKwh;

    let verwerkingLine = 0, aanvoerLine = 0;
    if (hasFeed) {
      if (s === 'vee' || s === 'terrein') {
        const tonsPerModule = HEAT_PER_TON[type] > 0 ? heatPerModule / HEAT_PER_TON[type] : 0;
        const tonsProcessed = Math.min(num('roi-tons'), modules * tonsPerModule);
        verwerkingLine = tonsProcessed * num('roi-proc');
      }
    } else {
      // geen eigen feedstock → materiaal moet worden aangevoerd (kostenpost)
      const tonsNeeded = modules * (heatPerModule / HEAT_PER_TON.mest);
      aanvoerLine = tonsNeeded * aanvoerCost;
    }

    const compostValue = modules * compostTon * compostVal;
    const ownElec = modules * OWN_KW * runHours * elecPriceOwn;
    const onderhoud = modules * maintenance;

    const jaarBesparing = vermedenEnergie + verwerkingLine - aanvoerLine + compostValue - ownElec - onderhoud;
    const investering = modules * (modulePrice + installCost);
    const payback = jaarBesparing > 0 ? investering / jaarBesparing : null;
    const naLevensduur = jaarBesparing * lifetime - investering;

    // CO₂
    let co2Avoided = 0;
    if (energy === 'gas') co2Avoided = (heatCovered / (GAS_KWH_M3 * BOILER_EFF)) * CO2.gasM3;
    else if (energy === 'elek') co2Avoided = heatCovered * CO2.elecKwh;
    else co2Avoided = heatCovered * CO2.andersKwh;
    const co2Net = co2Avoided - modules * OWN_KW * runHours * CO2.elecKwh; // eigen stroom eraf

    return {
      s, type, hasFeed, energy, energyLabel, modules, coverage,
      vermedenEnergie, verwerkingLine, aanvoerLine, compostValue, ownElec, onderhoud,
      jaarBesparing, investering, payback, naLevensduur, lifetime, co2Net,
      heatDemand,
    };
  }

  // ---- weergave ----
  function render() {
    sync();
    const r = calc();

    const hard = r.type === 'mest';
    const badge = r.type === 'mest'
      ? '<span class="roi-badge hard">Gevalideerd voor mest</span>'
      : (r.hasFeed
        ? '<span class="roi-badge ind">Indicatie — samen vast te stellen</span>'
        : '<span class="roi-badge ind">Indicatie</span>');

    let warn = '';
    if (r.heatDemand <= 0) {
      warn = '<div class="roi-warn">Vul uw huidige warmtegebruik in voor een berekening.</div>';
    } else if (r.modules < 1) {
      warn = '<div class="roi-warn">Met deze invoer past er nog geen volledige module — er is minimaal 30 m² en voldoende reststroom nodig. Pas de ruimte of hoeveelheid aan.</div>';
    } else if (r.jaarBesparing <= 0) {
      warn = '<div class="roi-warn">Met deze invoer levert het systeem nog geen positieve jaarbesparing. Pas de hoeveelheden of aannames aan, of bespreek uw situatie met ons.</div>';
    }

    const paybackTxt = r.payback ? nl1.format(r.payback) + ' jaar' : 'n.v.t.';

    const lines = [];
    lines.push(`<li><span>Vermeden ${r.energyLabel}</span><span>${plus(r.vermedenEnergie)}</span></li>`);
    if (r.hasFeed && r.verwerkingLine > 0)
      lines.push(`<li><span>Vermeden verwerkingskosten</span><span>${plus(r.verwerkingLine)}</span></li>`);
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
        <div><dt>Totale investering</dt><dd>${euro(r.investering)}</dd></div>
        <div><dt>Resultaat na ${r.lifetime} jaar</dt><dd>${signed(r.naLevensduur)}</dd></div>
        <div><dt>Aanbevolen modules</dt><dd>${r.modules} · ${Math.round(r.coverage * 100)}% dekking</dd></div>
        <div><dt>Vermeden CO₂</dt><dd>${nl1.format(Math.max(0, r.co2Net) / 1000)} ton/jr</dd></div>
      </dl>
      <p class="roi-note">Indicatie op basis van uw invoer en de getoonde aannames. Subsidie (SDE++/ISDE) is <strong>niet</strong> meegerekend en kan de terugverdientijd verder verkorten.${hard ? '' : ' De exacte warmteopbrengst van deze reststroom stellen we samen met u vast.'}</p>
      <a class="btn btn-primary btn-block" href="#contact">Plan een gesprek over uw berekening</a>
    `;
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  render();
})();
