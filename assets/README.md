# Assets

Foto's die nu live op de site staan (geoptimaliseerd, web-formaat):

| Bestand | Gebruikt in | Originele bron |
|---|---|---|
| `photos/founder-systeem.jpg` | Hero | Nathan met systeem.jpg |
| `photos/modulair-verplaatsbaar.jpg` | Sectie "Het systeem" (hoofdfoto) | modulair verplaatsbaar systeem.JPG |
| `photos/systeem-techniek.jpg` | Sectie "Het systeem" (inzet) | plaatsing container bij HIC.JPG |
| `photos/kas.jpg` | Voor wie — Kassen & tuincentra | shot van kas.JPG |
| `photos/veehouder.jpg` | Voor wie — Veehouders | Hans boerinn.jpg |
| `photos/landschap.jpg` | Voor wie — Pandeigenaren & landgoederen | landschap de Boerinn.JPG |
| `photos/contact-denise.webp` | Contact — aanspreekpunt | Denise_huykes.jpg.webp |

## Een foto vervangen
1. Zet de nieuwe foto in `assets/photos/` met dezelfde bestandsnaam (of pas het `src` in `index.html` aan).
2. Houd het bestand klein (max ~250 KB, breedte ~1200–1800px). Comprimeer desnoods met:
   `sips -Z 1400 -s format jpeg -s formatOptions 64 nieuwe-foto.jpg`

## Logo toevoegen
In `index.html` staat het logo nu als inline SVG-symbool (op twee plekken: header en footer,
gemarkeerd met `<!-- LOGO ... -->`). Vervang dat blok door:
`<img src="assets/logo.svg" alt="Thermal Compost Systems" height="32">`

## Nog te vervangen placeholders
- **Testimonial** (sectie "Bewijs"): echte klantquote + naam/functie invullen.
- **LinkedIn-link** (contact + footer): juiste profiel-URL invullen.
- **Telefoon/e-mail**: gecontroleerd overgenomen uit de oude site — verifieer nog even.
