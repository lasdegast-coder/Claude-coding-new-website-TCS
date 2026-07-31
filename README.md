# Thermal Compost Systems — website

Premium, statische one-page website gericht op **leadgeneratie** (contactformulier).
Gebouwd met pure HTML/CSS/JS — geen build-stap, geen dependencies. Werkt op elk device.

## Bestanden
```
index.html        # alle content & structuur (Nederlands)
styles.css        # ontwerpsysteem, layout, animaties
script.js         # scroll-reveals, count-up, menu, FAQ, formvalidatie
serve.py          # lokale previewserver (alleen voor ontwikkeling)
assets/
  README.md       # welke foto's waar staan + hoe vervangen
  photos/         # geoptimaliseerde web-foto's
.claude/launch.json
```

## Lokaal bekijken
```bash
python3 serve.py
# open http://127.0.0.1:8123
```
Of open simpelweg `index.html` in de browser (foto's en fonts laden gewoon).

## Online zetten (hosting)
Het is een statische site, dus elke statische host werkt — sleep de map naar
**Netlify Drop**, **Vercel**, **Cloudflare Pages** of zet de bestanden op je eigen webhosting.
`serve.py`, `.claude/` en de README's hoeven niet mee.

## Ontwerp
- **Stijl:** organic/biophilic, premium & zakelijk
- **Kleur:** diep bosgroen + warme ember-accent op crème (compost + warmte)
- **Typografie:** Fraunces (koppen) + Inter (tekst), via Google Fonts
- **Animaties:** scroll-reveals, count-up cijfers, geanimeerd proces — `transform`/`opacity`
  voor 60fps, met respect voor `prefers-reduced-motion`
- **Toegankelijkheid:** WCAG-contrast, focus-states, skip-link, semantische labels,
  toetsenbordnavigatie, alt-teksten

## Praktijkvoorbeeld-pagina's
De map `praktijkvoorbeelden/` bevat drie case-pagina's (`kassen.html`, `veehouder.html`,
`landgoed.html`), bereikbaar via de knop "Bekijk dit praktijkvoorbeeld" in de modals.
Alles wat nog ingevuld moet worden, staat **oranje gestippeld** (`.ph`): casenaam,
resultaat-zin, introductie, de vier kerncijfers, de resultaat-tekst en de klantquote.
Zoek in de HTML op `class="ph"` om alle in te vullen plekken te vinden.

Onder "Het resultaat" staat een **fotogalerij** van drie foto's die uitklappen naar een
lightbox (klik, met vorige/volgende, Esc/klik-buiten om te sluiten). Standaard staan er drie
systeemfoto's; per case te vervangen door de `src` én `data-full` in het `.gallery`-blok aan
te passen naar een andere foto in `assets/photos/`.

## Over ons-pagina
`team.html` (in de hoofdmap, menu-label **"Over ons"**) is **alleen bereikbaar via de bovenbalk**
(niet in de footer). Twee delen: (1) een tekst over het bedrijf met een foto ernaast, en (2)
het team als **beeldtegels**: fotozone boven, donkere balk eronder met
naam, functie en LinkedIn/e-mail. Namen en functies staan ingevuld; alleen Marco's functie en
de intro zijn nog `.ph`-placeholder. Een teamlid toevoegen/verwijderen: kopieer of verwijder een
`<article class="team-card">`. Een echte foto plaatsen: vervang binnen `.team-photo` het
`<div class="team-photo--ph">…</div>` door `<img src="assets/photos/team-naam.jpg" alt="Naam" />`.
De LinkedIn-links staan nog op `#` — vul per teamlid de juiste URL in.

## Nog te doen (placeholders)
1. **Case-content invullen** — echte cijfers, resultaat-teksten en klantquotes op de drie
   `praktijkvoorbeelden/*.html` pagina's (alle `.ph`-markeringen). Voeg per case eventueel
   een echte klantfoto toe voor het quote-blok.
2. **Formulier koppelen** — `script.js` simuleert nu het versturen. Koppel het aan een
   echte mailservice (bijv. [Formspree](https://formspree.io), Netlify Forms, of je eigen backend).
   Zoek in `script.js` op `Simulate async submit`.
3. **Logo** — ✅ geplaatst (`assets/logo.png`, transparant). Staat in de header op alle pagina's;
   valt automatisch terug op tekst als het bestand ontbreekt. De footer gebruikt bewust de
   tekst-versie (donkere achtergrond).
4. **Teamleden invullen** — namen, functies, foto's en LinkedIn/e-mail op `team.html` (`.ph`-markeringen).
5. **LinkedIn-URL** invullen (contact + footer + teamkaarten).
6. **Telefoon/e-mail** verifiëren (overgenomen uit de oude site).

> Bij het aanpassen van `styles.css` of `script.js`: hoog het `?v=` nummer in de `<link>`/
> `<script>`-verwijzingen op (in `index.html`, `team.html` én de drie case-pagina's), zodat browsers de
> nieuwe versie ophalen in plaats van een gecachte.

> De originele (zware) foto's staan nog los in de hoofdmap; die kun je verwijderen —
> geoptimaliseerde versies staan in `assets/photos/`.

## Voor de lancering

Afvinken voordat de site op thermalcompostsystems.nl live gaat:

- [ ] **`robots.txt` openzetten.** Staat nu op `Disallow: /` zodat de reviewversie niet in
      Google komt. Vervang dat door `Allow: /`. Zonder deze stap wordt de site nooit gevonden.
- [ ] **Contactformulier aansluiten.** Het Apps Script publiceren volgens
      `formulier-backend/INSTRUCTIES.md` en de web-app-URL invullen bij `ENDPOINT` in `script.js`.
      Zolang die leeg is, toont het formulier de mailoptie in plaats van te versturen.
- [ ] **Invulplekken weghalen.** Zoek op `class="ph"`: de quote van Bob Duindam
      (praktijkvoorbeelden/landgoed.html), de compostanalyse (compost.html) en de functie
      van Marco (team.html).
- [ ] **`sitemap.xml` bijwerken** als er pagina's bij zijn gekomen.
