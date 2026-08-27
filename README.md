# Thermal Compost Systems — website

Tweetalige statische website gericht op **leadgeneratie** via het contactformulier.
Pure HTML/CSS/JS, geen build-stap en geen dependencies. Live op thermalcompostsystems.nl
via GitHub Pages.

## Bestanden
```
index.html                # homepage (Nederlands)
het-systeem.html          # techniek, met het 3D-model
compost.html              # de compost en wat je erin stuurt
nieuws.html  team.html  privacy.html
praktijkvoorbeelden/      # kassen, veehouder, landgoed
en/                       # de Engelse site, zelfde structuur
styles.css                # ontwerpsysteem, layout, animaties
script.js                 # menu, reveals, FAQ, contactformulier (tweetalig)
roi.js                    # de rekenhulp (tweetalig)
scene-model.js  model.dae # het draaiende 3D-model
formulier-backend/        # Apps Script dat het formulier verwerkt
vertaling/                # scripts waarmee de Engelse pagina's zijn gemaakt
CNAME  sitemap.xml  robots.txt
serve.py                  # lokale previewserver, alleen voor ontwikkeling
assets/photos/            # geoptimaliseerde web-foto's
```

## Lokaal bekijken
```bash
python3 serve.py
# open http://127.0.0.1:8123
```
Of open simpelweg `index.html` in de browser (foto's en fonts laden gewoon).

## Online zetten
De site staat op **GitHub Pages**, in de repo `Claude-coding-new-website-TCS`. Pushen naar
`main` is publiceren. Het bestand `CNAME` vertelt GitHub dat de repo op
thermalcompostsystems.nl hoort te staan, en de DNS wijst al naar GitHub.

Bij het aanpassen van `styles.css`, `script.js`, `roi.js` of `scene-model.js`: hoog het
`?v=` nummer op in **alle** HTML-bestanden, ook die in `en/` en `praktijkvoorbeelden/`.
Anders blijven browsers de oude versie gebruiken.

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
Alle content is ingevuld, er staan geen placeholders meer in.

Onder "Het resultaat" staat een **fotogalerij** van drie foto's die uitklappen naar een
lightbox (klik, met vorige/volgende, Esc/klik-buiten om te sluiten). Standaard staan er drie
systeemfoto's; per case te vervangen door de `src` én `data-full` in het `.gallery`-blok aan
te passen naar een andere foto in `assets/photos/`.

## Over ons-pagina
`team.html` (in de hoofdmap, menu-label **"Over ons"**) is **alleen bereikbaar via de bovenbalk**
(niet in de footer). Twee delen: (1) een tekst over het bedrijf met een foto ernaast, en (2)
het team als **beeldtegels**: fotozone boven, donkere balk eronder met
naam, functie en e-mail. Namen, functies en foto's staan ingevuld. Een teamlid
toevoegen of verwijderen: kopieer of verwijder een
`<article class="team-card">`. Een echte foto plaatsen: vervang binnen `.team-photo` het
`<div class="team-photo--ph">…</div>` door `<img src="assets/photos/team-naam.jpg" alt="Naam" />`.
Persoonlijke LinkedIn-links staan er niet in, alleen die van het bedrijf in de voettekst.

## Nog open

De site staat live en werkt. Dit is wat er nog ligt, met wie het kan oplossen.

**Cijfers die we van jullie nodig hebben**

1. **Cyclusduur in de rekenhulp.** De tool rekent met 55 m3 per systeem per maand, dus
   met een cyclus van precies een maand. Op de techniekpagina staat dat de cyclus
   instelbaar is van een tot zes maanden, en bij De Boerinn kwamen we uit op ongeveer
   120 m3 per jaar. Duurt een cyclus in de praktijk langer dan een maand, dan rekent de
   tool de verwerkingscapaciteit te hoog en adviseert hij te weinig systemen. Zodra de
   praktijkwaarde bekend is: cyclusduur als aanname toevoegen en de stap van 660 m3
   gelijktrekken met de werkelijke jaarcapaciteit (nu 495 m3 bij 6570 draaiuren).
2. **Gewicht van een kuub eindcompost.** De 32 ton CO2 op de veehouderpagina rust op
   een aanname van 500 kg per m3. Bij 400 kg wordt het 40 ton, bij 600 kg 27 ton.
3. **Lease-optie in de rekenhulp.** Nodig: prijs per maand, looptijd, of onderhoud
   erbij zit, en wat er aan het eind van de looptijd gebeurt.

**Aanleveren**

4. **Logo's van de nieuwsbronnen**, als die erbij moeten. Die halen we niet zelf van
   de sites van die partijen.

**Nalezen**

5. **De Engelse teksten.** Die zijn in een keer geschreven en niet per stuk goedgekeurd.
   Vooral de homepage en de compostpagina zijn het nalezen waard.
6. **De cv-leiding.** Op de homepage staat bij Nodig "30 m2 ruimte en een stopcontact",
   terwijl op de over-ons-pagina staat dat de cv-leiding en een buitenstopcontact de
   vereiste aansluitingen zijn. Als de cv-aansluiting bij plaatsing hoort en niet iets
   is wat de klant vooraf moet hebben, klopt het zo. Zo niet, trek die twee gelijk.

## Engelse versie

De Engelse site staat in `en/`, met Engelse bestandsnamen (`system.html`, `news.html`,
`about.html`, `case-studies/…`). De taalknop rechtsboven springt naar dezelfde pagina in
de andere taal. Welke pagina bij welke hoort staat in `vertaling/en_shell.py` en
in de `<link rel="alternate" hreflang>` regels bovenaan elke pagina.

`roi.js` en `script.js` bedienen beide talen vanuit één bestand. Ze lezen `<html lang>`
en pakken de bijbehorende teksten uit de tabel bovenin. Een tekst toevoegen betekent dus
een regel in `T` (roi.js) of `S` (script.js), in beide talen.

Let op bij het wijzigen van een tekst: doe het op de Nederlandse pagina **en** op de
Engelse tegenhanger. Ze staan los van elkaar.

## Voor de lancering

Afvinken voordat de site op thermalcompostsystems.nl live gaat:

- [x] **`robots.txt` openzetten.** Staat op `Allow: /`, zoekmachines mogen de site indexeren.
- [x] **Contactformulier aangesloten.** Het Apps Script draait in de eigen Workspace en de
      web-app-URL staat in `ENDPOINT` in `script.js`. Getest op 3 augustus 2026: aanvraag,
      bevestiging aan de aanvrager en een regel in het blad kwamen alle drie binnen.
      Let op: na een lange stille periode kan de eerste aanvraag tot een halve minuut duren
      omdat Google het script dan opnieuw moet opstarten. Daarna is het een paar seconden.
- [x] **Invulplekken weghalen.** Alle plekken met `class="ph"` zijn weg. De quote van
      Bob Duindam is helemaal uit landgoed.html verwijderd.
- [x] **`sitemap.xml` bijwerken.** Bevat nu alle 18 paginas, Nederlands en Engels.
