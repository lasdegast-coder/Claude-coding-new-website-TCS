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
  const BOILER_EFF = 0.82;   // rendement bestaande ketel op bovenwaarde (EST 2009: combiketels 82,5 %)
  const OWN_KW = 0.6;        // eigen stroomverbruik per module (600 W)

  // Vulling en warmte, uit het rekenvoorbeeld realistische vullingen (11 november 2026):
  // 14,6 t droge stof per vulling van 60 m³, 85 % organische stof, 45 % daarvan
  // afgebroken, 17,5 MJ per kg afgebroken organische stof, 85 % netto nuttig.
  // Eén vulling duurt twee maanden inclusief legen en vullen. De bezoeker kiest hoeveel
  // stookmaanden per jaar hij warmte gebruikt (6 tot 12), en of de module in de overige
  // maanden doorcomposteert zonder dat de warmte benut wordt.
  const HOURS_PER_YEAR = 8760;
  const T_DS_FILL = 14.6;     // ton droge stof per vulling
  const FILL_M3 = 60;         // m³ per vulling
  const F_OS = 0.85;          // aandeel organische stof in de droge stof
  const DEG = 0.45;           // deel van de organische stof dat afbreekt
  const MJ_PER_KG = 17.5;     // warmte per kg afgebroken organische stof
  const NET = 0.85;           // netto nuttig deel van de vrijgekomen warmte
  const FILL_HOURS = HOURS_PER_YEAR / 6;
  const KWH_PER_FILL = T_DS_FILL * 1000 * F_OS * DEG * MJ_PER_KG / 3.6 * NET;
  const MONTHS_PER_FILL = 2;
  // Onder deze warmtevraag raden we een systeem af. Daarboven krijgt de klant minstens
  // één module, ook als die niet al zijn warmte kwijt kan: de reden kan ook biologisch,
  // circulair of PR zijn.
  const MIN_GAS_M3 = 3000;
  // Overig organisch materiaal levert minder warmte per vulling: we rekenen met de
  // gemeten vulling van De Boerinn, 9,7 t droge stof in 55 m³, omgerekend 10,6 t per
  // 60 m³ in plaats van 14,6 t. De verlaging schaalt mee met het aandeel eigen
  // 'overig' in de vulling; aangevoerd materiaal rekent met de normale warmte.
  const T_DS_BOERINN = 9.7 * FILL_M3 / 55;
  const VERLAGING_OVERIG = 1 - T_DS_BOERINN / T_DS_FILL;   // ongeveer 0,27
  // Tuincentrum en kas: bij advies van meer dan één module hooguit 70 % van de
  // warmtevraag dekken, om efficiëntieredenen in de praktijk; met eigen 'overig' 55 %.
  const DEKKING_MAX_KAS = 0.7;
  const DEKKING_MAX_KAS_OVERIG = 0.55;
  // Tuincentrum en kas: Thermal Compost voert hooguit de helft aan van het materiaal
  // dat de modules bij deze warmtevraag nodig hebben. Minder eigen materiaal betekent
  // dan minder modules, maar nooit minder dan één.
  const AANVOER_MAX_KAS = 0.5;
  // Tuincentrum en kas: als de bezoeker zelf geen hoeveelheid invult, vullen de eerste twee
  // modules zich met eigen materiaal (naar rato van de benutte warmte). Vanaf de derde module
  // rekenen we met 1 m³ reststroom per 1.000 m³ aardgas(-equivalent) dat daarna overblijft.
  const KAS_M3_PER_1000_GAS = 1;
  // Vermeden CO₂ door minder stoken. Aardgas: 56,2 kg CO₂/GJ x 31,65 MJ/Nm³ = 1,78 kg per m³
  // (RVO, Nederlandse energiedragerlijst januari 2026; CO2emissiefactoren.nl 1,782 kg/Nm³).
  // Stroom: 0,337 kg per kWh (CO2emissiefactoren.nl 2026, stroom onbekend). Bij 'anders'
  // is de brandstof onbekend en tellen we alleen de koolstof in de compost.
  const CO2_GAS_KG_M3 = 1.78;
  const CO2_ELEK_KG_KWH = 0.337;
  // Benutte warmte per module per jaar, afgerond op 100 kWh: 92.300 bij 8 stookmaanden, 138.400 bij 12.
  const kwhVoor = (maanden) => Math.round(KWH_PER_FILL * maanden / MONTHS_PER_FILL / 100) * 100;

  // CO₂: koolstof die in de compost wordt vastgelegd in plaats van te vervluchtigen.
  // m³ × kg droge stof per m³ × C-gehalte × C niet verdampt × C→CO₂
  // Rekenen met nat gewicht zou de uitkomst ruim drie keer te hoog maken, want het
  // koolstofgehalte geldt voor de droge stof.
  const DS_PER_M3   = T_DS_FILL * 1000 / FILL_M3;   // 243 kg droge stof per m³
  const C_SHARE     = 0.5;   // koolstofgehalte van de droge stof
  const C_RETAINED  = 1 - DEG; // deel koolstof dat niet vervluchtigt: wat niet afbreekt (0,55)
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
      warnHeat: 'Vul uw huidige warmtegebruik in voor een berekening.',
      warnModule: (min) => `Bij een warmtevraag onder ${min} raden we een systeem af.`,
      gasEq: (n) => `${n} m³ aardgas per jaar`, kwhEq: (n) => `${n} kWh per jaar`,
      warnNeg: 'Met deze invoer levert het systeem nog geen positieve jaarbesparing. Pas de hoeveelheden of aannames aan, of bespreek uw situatie met ons.',
      jaar: ' jaar', nvt: 'n.v.t.',
      grensPre: 'begrensd door uw ', grensFeed: 'reststroom', grensHeat: 'warmtevraag', grensMat: 'begrensd door beschikbaar materiaal',
      dektHeat: (p) => `dekt ${p}% van uw warmtevraag`,
      dektHeatVol: 'dekt uw volledige warmtevraag',
      dektFeed: (p) => `dekt ${p}% van uw verwerkingskosten`,
      vermeden: 'Vermeden ', vermedenProc: 'Vermeden verwerkingskosten',
      aanvoer: 'Aanvoerkosten feedstock', compost: 'Compostopbrengst',
      stroom: 'Eigen stroomverbruik', onderhoud: 'Onderhoud &amp; beheer',
      besparing: 'Jaarlijkse besparing', terugverdientijd: 'Terugverdientijd',
      investering: 'Totale investering', naJaar: (n) => `Resultaat na ${n} jaar`, systeem: 'Systeem', installatie: 'Installatie',
      modules: 'Aanbevolen modules', co2: 'Vermeden CO₂', tonJr: ' ton/jr',
      note: 'Indicatie op basis van uw invoer en de getoonde aannames. Subsidie (SDE++/ISDE) is <strong>niet</strong> meegerekend en kan de terugverdientijd verder verkorten.',
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
      warnHeat: 'Enter your current heat use to see a calculation.',
      warnModule: (min) => `Below a heat demand of ${min} we advise against a system.`,
      gasEq: (n) => `${n} m³ of natural gas per year`, kwhEq: (n) => `${n} kWh per year`,
      warnNeg: 'With this input the system does not yet produce a positive annual saving. Adjust the amounts or the assumptions, or talk your situation through with us.',
      jaar: ' years', nvt: 'n/a',
      grensPre: 'limited by your ', grensFeed: 'residual material', grensHeat: 'heat demand', grensMat: 'limited by available material',
      dektHeat: (p) => `covers ${p}% of your heat demand`,
      dektHeatVol: 'covers your entire heat demand',
      dektFeed: (p) => `covers ${p}% of your processing costs`,
      vermeden: 'Avoided ', vermedenProc: 'Avoided processing costs',
      aanvoer: 'Feedstock supply costs', compost: 'Compost revenue',
      stroom: 'Own electricity use', onderhoud: 'Maintenance &amp; management',
      besparing: 'Annual saving', terugverdientijd: 'Payback period',
      investering: 'Total investment', naJaar: (n) => `Result after ${n} years`, systeem: 'System', installatie: 'Installation',
      modules: 'Recommended modules', co2: 'Avoided CO₂', tonJr: ' tonnes/yr',
      note: 'An indication based on your input and the assumptions shown. Subsidy (SDE++/ISDE) is <strong>not</strong> included and can shorten the payback period further.',
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

  // Benutte warmte per module volgt het aantal stookmaanden, tenzij de bezoeker het zelf aanpast.
  const kwhInput = document.getElementById('a-kwh');
  let kwhTouched = false;
  if (kwhInput) kwhInput.addEventListener('input', () => { kwhTouched = true; });
  const stookmaanden = () => Math.min(12, Math.max(6, num('roi-months') || 8));
  // Doorcomposteren buiten het stookseizoen: de module draait dan het hele jaar.
  // Het vinkje zet zichzelf aan als dat financieel beter uitpakt (zie render),
  // tot de bezoeker het zelf aan- of uitzet.
  const summerEl = document.getElementById('roi-summer');
  let summerTouched = false;
  if (summerEl) ['input', 'change'].forEach((ev) => summerEl.addEventListener(ev, () => { summerTouched = true; }));
  const doorcomposteren = () => !!(summerEl && summerEl.checked) || stookmaanden() >= 12;

  // Ook het gasverbruik verschilt sterk per segment: een veehouderij stookt een
  // veelvoud van een tuincentrum. Vult het veld voor, tenzij de bezoeker het zelf aanpast.
  const GAS_PER_SEG = { vee: 65000, terrein: 20000, kas: 70000 };
  const gasInput = document.getElementById('roi-gas-m3');
  let gasTouched = false;
  if (gasInput) gasInput.addEventListener('input', () => { gasTouched = true; });

  // Gasprijs per segment: tuincentra en kassen hebben een lager tarief.
  const GAS_PRICE_PER_SEG = { vee: 1.65, terrein: 1.75, kas: 1.35 };
  const priceInput = document.getElementById('roi-gas-price');
  let priceTouched = false;
  if (priceInput) priceInput.addEventListener('input', () => { priceTouched = true; });

  // Verwerkingskosten per soort reststroom: mest 35 per m³, groen- en snoeiafval
  // meestal geen (blijft op het terrein), overig 10 cent per kg, ongeveer 45 per m³.
  const PROC_PER_TYPE = { mest: 35, groen: 0, overig: 45 };
  const procInput = document.getElementById('roi-proc');
  let procTouched = false;
  if (procInput) procInput.addEventListener('input', () => { procTouched = true; });

  // Een veld dat de rekenhulp zelf invult, krijgt die waarde ook als standaard,
  // zodat het niet telt als iets wat de bezoeker heeft aangepast.
  const vulIn = (el, waarde) => { el.value = String(waarde); el.defaultValue = el.value; };

  // Soort reststroom volgt het segment, tot de bezoeker zelf kiest.
  const TYPE_PER_SEG = { vee: 'mest', terrein: 'groen', kas: 'overig' };
  const typeInput = document.getElementById('roi-type');
  let typeTouched = false;
  // 'input' komt in de browser vóór 'change' en vóór de herberekening van het formulier
  if (typeInput) ['input', 'change'].forEach((ev) => typeInput.addEventListener(ev, () => { typeTouched = true; }));

  // Eigen reststroom per vulling van 60 m³. Mest telt voor de helft: 30 m³ mest,
  // aangevuld met 30 m³ stro, voerresten en dergelijke van het eigen erf (geen kosten).
  // Groen en overig vullen de hele vulling.
  const EIGEN_M3_PER_VULLING = { mest: 30, groen: 60, overig: 60 };
  // Het volume volgt wat de berekende modules nodig hebben, tot de bezoeker zelf invult.
  const volInput = document.getElementById('roi-volume');
  let volTouched = false;
  if (volInput) volInput.addEventListener('input', () => { volTouched = true; });

  // ---- toon/verberg velden op basis van keuzes ----
  function sync() {
    const energy = document.getElementById('roi-energy').value;
    document.querySelector('.roi-when-gas').hidden = energy !== 'gas';
    document.querySelector('.roi-when-elek').hidden = energy !== 'elek';
    document.querySelector('.roi-when-anders').hidden = energy !== 'anders';

    // benutte warmte per module volgt de stookmaanden, zolang de bezoeker het veld niet zelf invulde
    const uit = document.getElementById('roi-months-out');
    if (uit) uit.textContent = String(stookmaanden());
    const zomer = document.querySelector('.roi-when-summer');
    if (zomer) zomer.hidden = stookmaanden() >= 12;
    if (gasInput && !gasTouched) vulIn(gasInput, GAS_PER_SEG[seg()] || 20000);
    if (priceInput && !priceTouched) vulIn(priceInput, (GAS_PRICE_PER_SEG[seg()] || 1.65).toFixed(2));
    if (typeInput && !typeTouched) {
      const t = TYPE_PER_SEG[seg()] || 'geen';
      [...typeInput.options].forEach((o) => { o.selected = o.defaultSelected = (o.value === t); });
    }
    const soort = typeInput ? typeInput.value : 'geen';
    if (procInput && !procTouched && soort in PROC_PER_TYPE) vulIn(procInput, PROC_PER_TYPE[soort]);

    const type = document.getElementById('roi-type').value;
    const hasFeed = type !== 'geen';
    document.querySelector('.roi-when-has').hidden = !hasFeed;
    // verwerkingskosten gelden voor élk segment met eigen reststroom (ook tuincentrum/kas)
    document.querySelector('.roi-when-proc').hidden = !hasFeed;
  }

  // ---- berekening ----
  function calc(zomerKeuze) {
    const energy = document.getElementById('roi-energy').value;
    const type = document.getElementById('roi-type').value;
    const s = seg();
    const hasFeed = type !== 'geen';

    const maanden = stookmaanden();                      // maanden waarin de warmte benut wordt
    const door = zomerKeuze === undefined ? doorcomposteren() : (zomerKeuze || maanden >= 12);
    const draaimaanden = door ? 12 : maanden;            // maanden waarin de module composteert
    const fills = draaimaanden / MONTHS_PER_FILL;        // vullingen per jaar
    const runHours = fills * FILL_HOURS;                 // draaiuren per jaar
    const heatNormaal = kwhVoor(maanden);                // benutte kWh/jaar per module bij een normale vulling
    const modulePrice = num('a-price');
    const installCost = num('a-install');
    const maintenance = num('a-maint');
    const lifetime = num('a-life') || 15;
    const compostVal = num('a-compostval');        // compostwaarde per m³ ingangsmateriaal
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

    // 2) hoeveel modules? Zoveel als er volledig benut worden binnen de warmtevraag.
    // Is de vraag kleiner dan één module, maar minstens MIN_GAS_M3 aardgas, dan toch één
    // module die een deel van zijn warmte benut. De rest van de warmtevraag dekt de klant
    // met de bestaande installatie. De eigen reststroom begrenst het aantal niet.
    // Bij een tuincentrum of kas met meer dan één module hooguit DEKKING_MAX_KAS.
    const minDemand = MIN_GAS_M3 * GAS_KWH_M3 * BOILER_EFF;
    const m3PerModule = fills * FILL_M3;
    const eigenPerVulling = EIGEN_M3_PER_VULLING[type] || 0;
    let kasDekkingGrens = false;
    const aantalVoor = (heat) => {
      if (!(heatDemand > 0 && heat > 0)) return 0;
      const vol = Math.floor(heatDemand / heat);
      if (vol < 1) return heatDemand >= minDemand ? 1 : 0;
      if (s === 'kas' && vol > 1) {
        const max = type === 'overig' ? DEKKING_MAX_KAS_OVERIG : DEKKING_MAX_KAS;
        const n = Math.max(1, Math.floor(max * heatDemand / heat));
        if (n < vol) kasDekkingGrens = true;
        return n;
      }
      return vol;
    };
    // Eigen reststroom als de bezoeker zelf niets invult. Veehouder en terreinbeheerder:
    // wat de modules opnemen. Tuincentrum en kas: de eerste twee modules naar rato van de
    // benutte warmte, vanaf de derde 1 m³ per 1.000 m³ aardgas dat daarna overblijft.
    const gasEquivalent = heatDemand / (GAS_KWH_M3 * BOILER_EFF);
    const volumeVoor = (n, heat) => {
      if (type === 'geen') return 0;
      if (volTouched) return num('roi-volume');
      const perModule = fills * eigenPerVulling;
      if (s !== 'kas') return n * perModule;
      const gebruikt = n > 0 && heat > 0 ? Math.min(1, heatDemand / (n * heat)) : 1;
      if (n <= 2) return n * perModule * gebruikt;
      const restGas = Math.max(0, gasEquivalent - 2 * heat / (GAS_KWH_M3 * BOILER_EFF));
      return 2 * perModule + restGas * KAS_M3_PER_1000_GAS / 1000;
    };
    // Plafond op de aanvoer bij tuincentrum en kas (niet bij mest: dat vult het eigen terrein aan).
    const aanvoerPlafond = s === 'kas' && type !== 'mest';
    let materiaalGrens = false;
    const begrens = (n, vol) => {
      if (!aanvoerPlafond || n <= 1) return n;
      const maxAanvoer = AANVOER_MAX_KAS * n * m3PerModule;
      const kan = Math.max(1, Math.floor((vol + maxAanvoer) / m3PerModule));
      if (kan < n) { materiaalGrens = true; return kan; }
      return n;
    };
    // Warmte per module hangt bij 'overig' af van het aandeel eigen materiaal, en dat
    // aandeel van het aantal modules. Een paar rondes rekenen zetten dat vast.
    let heatPerModule, modules, aandeel = 0;
    if (kwhTouched) {
      heatPerModule = num('a-kwh');
      kasDekkingGrens = false; materiaalGrens = false;
      const n = aantalVoor(heatPerModule);
      modules = begrens(n, volumeVoor(n, heatPerModule));
    } else {
      const ronde = (a) => {
        const heat = Math.round(heatNormaal * (1 - VERLAGING_OVERIG * a) / 100) * 100;
        kasDekkingGrens = false; materiaalGrens = false;
        const n = aantalVoor(heat);
        const m = begrens(n, volumeVoor(n, heat));
        const volgend = type === 'overig' && m > 0
          ? Math.min(1, volumeVoor(m, heat) / (m * m3PerModule)) : a;
        return { heat, m, volgend, kd: kasDekkingGrens, mg: materiaalGrens };
      };
      aandeel = type === 'overig' ? 1 : 0;
      let uit = ronde(aandeel);
      const gezien = [uit.m];
      for (let i = 0; i < 10 && type === 'overig' && uit.m > 0; i++) {
        if (Math.abs(uit.volgend - aandeel) < 0.001) break;
        aandeel = uit.volgend;
        uit = ronde(aandeel);
        // springt het aantal heen en weer, dan kiezen we voorzichtig het kleinste
        if (gezien.length >= 2 && gezien[gezien.length - 2] === uit.m && gezien[gezien.length - 1] !== uit.m) {
          const kleinste = Math.min(uit.m, gezien[gezien.length - 1]);
          if (uit.m !== kleinste) { aandeel = uit.volgend; uit = ronde(aandeel); }
          break;
        }
        gezien.push(uit.m);
      }
      heatPerModule = uit.heat; modules = uit.m;
      kasDekkingGrens = uit.kd; materiaalGrens = uit.mg;
    }
    const eigenNodig = modules * fills * eigenPerVulling;   // eigen reststroom die de modules opnemen
    const volume = volumeVoor(modules, heatPerModule);
    // Het aantal volgt altijd uit de warmtevraag; dat tonen we, anders lijkt de
    // rekenhulp stuk als meer reststroom invullen niets verandert.
    const grens = modules < 1 ? null : (materiaalGrens ? 'mat' : (kasDekkingGrens ? T.grensFeed : T.grensHeat));

    const heatCovered = Math.min(modules * heatPerModule, heatDemand);

    // 3) jaarlijkse posten
    const vermedenEnergie = heatCovered * pricePerKwh;

    // Hoeveel materiaal gaat er doorheen? De modules worden altijd helemaal gevuld:
    // eerst met de eigen reststroom, het tekort wordt aangevoerd. Dit getal voedt de
    // verwerkings- en aanvoerkosten, de compost en de CO₂-berekening.
    const capacityM3 = modules * m3PerModule;                // wat de systemen verwerken
    const ownM3 = hasFeed ? Math.min(volume, eigenNodig) : 0;
    // tekort aan eigen reststroom wordt aangevoerd (bij mest alleen het mestdeel,
    // stro en dergelijke komen van het erf; zonder eigen materiaal de hele vulling)
    const aanvoerM3 = hasFeed ? eigenNodig - ownM3 : capacityM3;
    const processedM3 = capacityM3;

    // eigen reststroom → vermeden verwerkingskosten; tekort → aanvoerkosten.
    // Wie mest heeft vult altijd kosteloos aan met materiaal van het eigen terrein,
    // en een veehouder komt altijd kosteloos aan materiaal.
    const verwerkingLine = ownM3 * num('roi-proc');
    const aanvoerLine = (type === 'mest' || s === 'vee') ? 0 : aanvoerM3 * aanvoerCost;

    // compost volgt het materiaal dat er werkelijk doorheen gaat, niet het aantal modules
    const compostValue = processedM3 * compostVal;
    const ownElec = modules * OWN_KW * runHours * elecPriceOwn;
    const onderhoud = modules * maintenance;

    const jaarBesparing = vermedenEnergie + verwerkingLine - aanvoerLine + compostValue - ownElec - onderhoud;
    const investering = modules * (modulePrice + installCost);
    const payback = jaarBesparing > 0 ? investering / jaarBesparing : null;
    const naLevensduur = jaarBesparing * lifetime - investering;

    // CO₂ — koolstof die in de compost vastgelegd blijft i.p.v. te vervluchtigen,
    // berekend over het materiaal dat er werkelijk doorheen gaat
    // vastgelegd in de compost: droge stof volgt de vulling (bij eigen 'overig' De Boerinn)
    const aandeelOverig = type === 'overig' && processedM3 > 0 ? Math.min(1, ownM3 / processedM3) : 0;
    const dsPerM3 = DS_PER_M3 * (1 - VERLAGING_OVERIG * aandeelOverig);
    const co2Compost = processedM3 * dsPerM3 * C_SHARE * C_RETAINED * C_TO_CO2;
    // vermeden door minder stoken
    const co2Stoken = energy === 'gas' ? heatCovered / (GAS_KWH_M3 * BOILER_EFF) * CO2_GAS_KG_M3
      : (energy === 'elek' ? heatCovered * CO2_ELEK_KG_KWH : 0);
    const co2Net = co2Compost + co2Stoken;

    const dekking = heatDemand > 0 ? heatCovered / heatDemand : 0;

    return {
      s, type, hasFeed, energy, energyLabel, modules,
      vermedenEnergie, verwerkingLine, aanvoerLine, compostValue, ownElec, onderhoud,
      jaarBesparing, investering, payback, naLevensduur, lifetime, co2Net,
      heatDemand, volume, grens, minDemand, heatPerModule, heatCovered, ownM3, aanvoerM3, co2Compost, co2Stoken,
      dekking, perModule: modulePrice + installCost, modulePrice, installCost,
      processedM3, eigenNodig, feedDekking: hasFeed && volume > 0 ? Math.min(1, ownM3 / volume) : 0,
    };
  }

  /* De standaardwaarde van een aanname. De warmte per module is de uitzondering:
     die vult het formulier zelf in op basis van het gekozen segment. */
  let kwhStandaard = '';
  const standaardVan = (el) => {
    if (el.id === 'a-kwh') return kwhStandaard;
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
      kwhTouched = false;
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
    // Doorcomposteren alleen aanzetten als het over de levensduur meer oplevert.
    // De standaardstand gaat mee, zodat een automatisch vinkje niet telt als
    // iets wat de bezoeker zelf heeft aangepast.
    if (summerEl && !summerTouched && stookmaanden() < 12) {
      const zonder = calc(false), met = calc(true);
      const beter = met.modules > 0 && met.jaarBesparing > 0 && met.naLevensduur > zonder.naLevensduur;
      summerEl.checked = beter;
      summerEl.defaultChecked = beter;
    }
    const r = calc();
    if (volInput && !volTouched) {
      volInput.value = String(Math.round(r.volume));
      volInput.defaultValue = volInput.value;
    }
    if (kwhInput && !kwhTouched) {
      kwhInput.value = String(r.heatPerModule);
      kwhStandaard = kwhInput.value;
    }
    toonReset();

    const badge = '';

    let warn = '';
    if (r.heatDemand <= 0) {
      warn = `<div class="roi-warn">${T.warnHeat}</div>`;
    } else if (r.modules < 1) {
      const min = r.energy === 'gas'
        ? T.gasEq(nl0.format(MIN_GAS_M3))
        : T.kwhEq(nl0.format(Math.round(r.minDemand / 1000) * 1000));
      warn = `<div class="roi-warn">${T.warnModule(min)}</div>`;
    } else if (r.jaarBesparing <= 0) {
      warn = `<div class="roi-warn">${T.warnNeg}</div>`;
    }

    const paybackTxt = r.payback ? nl1.format(r.payback) + T.jaar : T.nvt;

    // Bij meer dan één module de verdubbeling van de investering navolgbaar maken,
    // en laten zien welk deel van de warmtevraag er gedekt wordt.
    // investering uitgesplitst in systeem en installatie, per module als het er meer zijn
    const maal = r.modules > 1 ? `${r.modules}x ` : '';
    const kort = (n) => '€' + nl0.format(Math.round(n));
    const perStuk = `<span class="roi-sub">${T.systeem}: ${maal}${kort(r.modulePrice)}</span>`
      + `<span class="roi-sub">${T.installatie}: ${maal}${kort(r.installCost)}</span>`;
    // resultaat als kleine optelsom: totale opbrengst, min investering, netto
    const som = `<dd class="roi-sum">`
      + `<span>${euro(r.jaarBesparing * r.lifetime)}</span>`
      + `<span class="roi-sum-min">${minus(r.investering)}</span>`
      + `<span class="roi-sum-line"></span>`
      + `<span>${signed(r.naLevensduur)}</span></dd>`;
    // laat zien welke van de twee grenzen het aantal bepaalt
    const grensTxt = r.grens
      ? `<span class="roi-sub">${r.grens === 'mat' ? T.grensMat : T.grensPre + r.grens}</span>` : '';
    // Elke opbrengstregel die tegen een capaciteitsgrens aanloopt legt zichzelf uit.
    // Regels die de volle vraag dekken blijven schoon.
    const dekPct = Math.round(r.dekking * 100);
    // Ook bij volledige dekking iets tonen: dat is de beste uitkomst en die
    // verdient een zin, in plaats van dat er dan juist niets staat.
    const energieSub = r.dekking > 0
      ? `<span class="roi-sub">${dekPct >= 100 ? T.dektHeatVol : T.dektHeat(dekPct)}</span>` : '';
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
    if (r.aanvoerLine > 0)
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
        <div><dt>${T.naJaar(r.lifetime)}</dt>${som}</div>
        <div><dt>${T.modules}</dt><dd>${r.modules}${grensTxt}</dd></div>
        <div><dt>${T.co2}</dt><dd>${nl1.format(Math.max(0, r.co2Net) / 1000)}${T.tonJr}</dd></div>
      </dl>
      <p class="roi-note">${T.note}${restNote}</p>
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
      if (el.type === 'radio' || el.type === 'checkbox') { if (el.checked !== el.defaultChecked) anders = true; }
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
    form.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      if (el.closest('[hidden]')) return;
      uit.push({ label: labelVan(el), waarde: el.checked ? 'ja' : 'nee', standaard: el.defaultChecked ? 'ja' : 'nee', aangepast: el.checked !== el.defaultChecked });
    });
    form.querySelectorAll('select, input[type="number"], input[type="range"]').forEach((el) => {
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

    const ML = LANG === 'en' ? {
      maanden: 'Heating months:', door: 'Composting outside the heating season:', ja: 'yes', nee: 'no',
      zelf: ' (entered by visitor)', geschat: ' (estimated by the calculator)', aannames: 'ASSUMPTIONS',
      aangepast: '  (changed, default ', grens: 'Limited by:', warmte: 'Heat used per module:', kwhJaar: ' kWh per year',
      materiaal: 'Material processed:', eigen: 'own', aanvoer: 'supplied', m3: ' m³ per year',
      posten: 'ANNUAL ITEMS', inv: 'Total investment:', resultaat: (n) => `Result after ${n} years:`,
      totaal: 'total', netto: 'net', co2: 'Avoided CO₂:', co2Stoken: 'from less heating', co2Compost: 'stored in compost',
    } : {
      maanden: 'Stookmaanden:', door: 'Doorcomposteren buiten stookseizoen:', ja: 'ja', nee: 'nee',
      zelf: ' (zelf ingevuld)', geschat: ' (door de rekenhulp ingeschat)', aannames: 'AANNAMES',
      aangepast: '  (aangepast, standaard ', grens: 'Begrensd door:', warmte: 'Benutte warmte per module:', kwhJaar: ' kWh per jaar',
      materiaal: 'Verwerkt materiaal:', eigen: 'eigen', aanvoer: 'aangevoerd', m3: ' m³ per jaar',
      posten: 'POSTEN PER JAAR', inv: 'Totale investering:', resultaat: (n) => `Resultaat na ${n} jaar:`,
      totaal: 'totaal', netto: 'netto', co2: 'Vermeden CO₂:', co2Stoken: 'door minder stoken', co2Compost: 'vastgelegd in compost',
    };
    const zomer = document.getElementById('roi-summer');
    const ton = (kg) => nl1.format(Math.max(0, kg) / 1000);
    const maal = r.modules > 1 ? `${r.modules}x ` : '';
    const grensTekst = r.grens === 'mat' ? (LANG === 'en' ? 'available material' : 'beschikbaar materiaal') : (r.grens || '');

    // Rijen als [label, waarde]; lege rij = witregel, rij met één element = kopje.
    const rijen = [
      [T.bSituatie, segTekst()],
      [T.bVerwarmt, energie],
      [T.bVerbruik, verbruik],
      [ML.maanden, String(stookmaanden())],
      [ML.door, (zomer && zomer.checked) || stookmaanden() >= 12 ? ML.ja : ML.nee],
      [T.bRest, keuzeTekst('roi-type')],
    ];
    if (r.hasFeed) {
      rijen.push([T.bHoeveel, nl0.format(Math.round(r.volume)) + T.bM3Jaar + (volTouched ? ML.zelf : ML.geschat)]);
      rijen.push([T.bProc, prijs('roi-proc') + T.bPerM3]);
    }
    rijen.push([], [ML.aannames]);
    document.querySelectorAll('.roi-assumptions input').forEach((el) => {
      const lab = el.closest('label');
      const naam = lab ? lab.childNodes[0].textContent.trim() : el.id;
      const std = standaardVan(el);
      rijen.push(['  ' + naam + ':', el.value + (el.value !== std ? ML.aangepast + std + ')' : '')]);
    });
    rijen.push(
      [], [T.bUitkomst],
      [T.bTerugverdien, r.payback ? nl1.format(r.payback) + T.jaar : T.bGeen],
      [T.bModules, String(r.modules)],
    );
    if (grensTekst) rijen.push([ML.grens, grensTekst]);
    rijen.push(
      [T.bDekking, Math.round(r.dekking * 100) + '%'],
      [ML.warmte, nl0.format(r.heatPerModule) + ML.kwhJaar],
      [ML.materiaal, nl0.format(Math.round(r.processedM3)) + ML.m3 + ` (${ML.eigen} ${nl0.format(Math.round(r.ownM3))}, ${ML.aanvoer} ${nl0.format(Math.round(r.aanvoerM3))})`],
      [], [ML.posten],
      [T.vermeden + r.energyLabel + ':', plus(r.vermedenEnergie)],
    );
    if (r.verwerkingLine > 0) rijen.push([T.vermedenProc + ':', plus(r.verwerkingLine)]);
    if (r.aanvoerLine > 0) rijen.push([T.aanvoer + ':', minus(r.aanvoerLine)]);
    rijen.push(
      [T.compost + ':', plus(r.compostValue)],
      [T.stroom.replace('&amp;', '&') + ':', minus(r.ownElec)],
      [T.onderhoud.replace('&amp;', '&') + ':', minus(r.onderhoud)],
      [T.bBesparing, euro(r.jaarBesparing)],
      [],
      [ML.inv, `${euro(r.investering)} (${T.systeem.toLowerCase()} ${maal}${euro(r.modulePrice)}, ${T.installatie.toLowerCase()} ${maal}${euro(r.installCost)})`],
      [ML.resultaat(r.lifetime), `${euro(r.jaarBesparing * r.lifetime)} ${ML.totaal}, ${minus(r.investering)}, ${ML.netto} ${signed(r.naLevensduur)}`],
      [ML.co2, `${ton(r.co2Net)}${T.bTonJaar} (${ML.co2Stoken} ${ton(r.co2Stoken)}, ${ML.co2Compost} ${ton(r.co2Compost)})`],
    );
    // Labels uitlijnen op de langste, zodat de mail in beide talen netjes oogt.
    const breed = Math.max(...rijen.filter((x) => x.length === 2).map((x) => x[0].length)) + 2;
    const regels = rijen.map((x) => (x.length === 2 ? x[0].padEnd(breed) + x[1] : (x[0] || '')));

    const kort = r.payback
      ? r.modules + (r.modules === 1 ? T.kort1 : T.kortN) + ', ' + euro(r.jaarBesparing)
        + T.kortPer + nl1.format(r.payback) + T.jaar
      : null;

    // velden en uitkomst gaan als losse gegevens mee, zodat het Apps Script er
    // kolommen van kan maken in plaats van één tekstblok
    const uitkomst = {
      'Aanbevolen modules': r.modules,
      'Begrensd door': r.grens === 'mat' ? 'beschikbaar materiaal' : (r.grens || ''),
      'Stookmaanden': stookmaanden(),
      'Doorcomposteren': (zomer && zomer.checked) || stookmaanden() >= 12 ? 'ja' : 'nee',
      'Benutte warmte per module (kWh/jaar)': r.heatPerModule,
      'Warmtedekking (%)': Math.round(r.dekking * 100),
      'Verwerkt materiaal (m³/jaar)': Math.round(r.processedM3),
      'Eigen materiaal (m³/jaar)': Math.round(r.ownM3),
      'Aangevoerd materiaal (m³/jaar)': Math.round(r.aanvoerM3),
      'Vermeden energiekosten (€)': Math.round(r.vermedenEnergie),
      'Vermeden verwerkingskosten (€)': Math.round(r.verwerkingLine),
      'Aanvoerkosten (€)': Math.round(r.aanvoerLine),
      'Compostopbrengst (€)': Math.round(r.compostValue),
      'Eigen stroomverbruik (€)': Math.round(r.ownElec),
      'Onderhoud (€)': Math.round(r.onderhoud),
      'Jaarlijkse besparing (€)': Math.round(r.jaarBesparing),
      'Totale investering (€)': Math.round(r.investering),
      'Systeem per module (€)': Math.round(r.modulePrice),
      'Installatie per module (€)': Math.round(r.installCost),
      'Terugverdientijd (jaar)': r.payback ? Number(r.payback.toFixed(1)) : '',
      'Totale opbrengst levensduur (€)': Math.round(r.jaarBesparing * r.lifetime),
      'Netto resultaat levensduur (€)': Math.round(r.naLevensduur),
      'Vermeden CO2 (ton/jaar)': Number((Math.max(0, r.co2Net) / 1000).toFixed(1)),
      'Vermeden CO2 door minder stoken (ton/jaar)': Number((Math.max(0, r.co2Stoken) / 1000).toFixed(1)),
      'CO2 vastgelegd in compost (ton/jaar)': Number((Math.max(0, r.co2Compost) / 1000).toFixed(1)),
    };

    return { kort, tekst: regels.join('\n'), velden: verzamelVelden(), uitkomst, taal: LANG };
  };
})();
