"""Bouwt de Engelse pagina's uit de Nederlandse.

Werkt op tekstknopen in plaats van op ruwe tekst, zodat witruimte en opmaak
niet meetellen bij het zoeken. Wat niet in de woordenlijst staat wordt gemeld
in plaats van stilzwijgend Nederlands gelaten.
"""
import os
import re
import sys
import json

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRATCH)
from en_shell import PAGINA, GEDEELD, paden, BASIS  # noqa: E402

OVERSLAAN = ('script', 'style', 'svg')
ATTRIBUTEN = ('alt', 'title', 'aria-label', 'placeholder', 'content', 'data-punten', 'value')


def normaliseer(t):
    return re.sub(r'\s+', ' ', t).strip()


# Wat al Engels is of onvertaald hoort te blijven. De rechterkanten van de
# gedeelde vervangingen komen er automatisch bij, zodat de melding klopt.
def _kaal(t):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', t)).strip(' <>')


AL_GOED = {_kaal(b) for _, b in GEDEELD}
AL_GOED |= {
    'Thermal Compost Systems', 'Thermal&nbsp;Compost&nbsp;Systems',
    'Thermal Compost Systems, home', 'Bekijk deze pagina in het Nederlands',
    'NL', 'EN', 'FAQ', 'Contact', 'Compost', 'Nathan van den Dool',
    'Funded by the European Union', 'Thermal Compost Solutions',
    'width=device-width, initial-scale=1', 'summary_large_image', 'website',
    'Home', 'Privacy', 'Contact', 'Menu', '1200', '630', '#1B3A2C',
}


def moet_vertaald(t):
    if t in AL_GOED:
        return False
    if not re.search(r'[a-zA-Z]{2,}', t):
        return False
    return True


def vertaal_tekstknopen(html, woorden, ontbreekt):
    delen = re.split(r'(<[^>]+>)', html)
    diep = 0
    uit = []
    for d in delen:
        if d.startswith('<'):
            m = re.match(r'</?\s*([a-zA-Z0-9-]+)', d)
            naam = (m.group(1).lower() if m else '')
            if naam in OVERSLAAN:
                if d.startswith('</'):
                    diep = max(0, diep - 1)
                elif not d.rstrip().endswith('/>'):
                    diep += 1
            uit.append(d)
            continue
        if diep or not d.strip():
            uit.append(d)
            continue
        kern = normaliseer(d)
        if kern in woorden:
            voor = d[:len(d) - len(d.lstrip())]
            na = d[len(d.rstrip()):]
            uit.append(voor + woorden[kern] + na)
        else:
            if moet_vertaald(kern):
                ontbreekt.append(kern)
            uit.append(d)
    return ''.join(uit)


def vertaal_attributen(html, woorden, ontbreekt):
    def vervang(m):
        attr, waarde = m.group(1), m.group(2)
        kern = normaliseer(waarde)
        if kern in woorden:
            return f'{attr}="{woorden[kern]}"'
        if moet_vertaald(kern) and not kern.startswith('http') and ' ' in kern:
            ontbreekt.append(kern)
        return m.group(0)
    patroon = r'\b(' + '|'.join(ATTRIBUTEN) + r')="([^"]*)"'
    return re.sub(patroon, vervang, html)


def bouw(nl_pad, woorden, titel_en, omschrijving_en):
    en_rel = PAGINA[nl_pad]
    diep = en_rel.count('/')
    doel = os.path.join(WORTEL, 'en', en_rel)
    os.makedirs(os.path.dirname(doel), exist_ok=True)

    html = open(os.path.join(WORTEL, nl_pad), encoding='utf-8').read()

    # 1) gedeelde blokken die als ruwe tekst matchen (navigatie, voettekst)
    for a, b in GEDEELD:
        html = html.replace(a, b)

    # 2) taal en verwijzingen naar de andere taal omdraaien
    html = html.replace('<html lang="nl">', '<html lang="en">')
    html = html.replace('content="nl_NL"', 'content="en_GB"')
    html = html.replace('aria-label="Switch to English">EN</a>', 'aria-label="Bekijk deze pagina in het Nederlands">NL</a>')
    html = html.replace('hreflang="en" lang="en">EN</a>', 'hreflang="nl" lang="nl">NL</a>')
    html = re.sub(r'(<a class="lang-switch" href=")[^"]*(")', r'\1__NLPAD__\2', html)
    html = html.replace('hreflang="en" lang="en"', 'hreflang="nl" lang="nl"')

    # 3) canonical en og:url naar de Engelse variant
    html = re.sub(r'(<link rel="canonical" href=")[^"]*(")', r'\g<1>' + BASIS + 'en/' + en_rel + r'\2', html)
    html = re.sub(r'(<meta property="og:url" content=")[^"]*(")', r'\g<1>' + BASIS + 'en/' + en_rel + r'\2', html)
    html = re.sub(r'(<link rel="alternate" hreflang="x-default" href=")[^"]*(")',
                  r'\g<1>' + BASIS + nl_pad + r'\2', html)

    # 4) paden. Pas hierna de taalknop invullen, anders vertaalt de padomzetting
    #    het Nederlandse doel mee naar de Engelse bestandsnaam.
    html = paden(html, diep)
    html = html.replace('__NLPAD__', ('../' * (diep + 1)) + nl_pad)

    # 5) titel en omschrijving
    html = re.sub(r'<title>.*?</title>', '<title>' + titel_en + '</title>', html, flags=re.S)
    html = re.sub(r'(<meta name="description" content=")[^"]*(")', r'\1' + omschrijving_en + r'\2', html)
    html = re.sub(r'(<meta property="og:title" content=")[^"]*(")', r'\1' + titel_en + r'\2', html)
    html = re.sub(r'(<meta property="og:description" content=")[^"]*(")', r'\1' + omschrijving_en + r'\2', html)

    # 6) tekstknopen en attributen
    ontbreekt = []
    html = vertaal_tekstknopen(html, woorden, ontbreekt)
    html = vertaal_attributen(html, woorden, ontbreekt)

    open(doel, 'w', encoding='utf-8').write(html)
    return doel, ontbreekt


if __name__ == '__main__':
    nl_pad = sys.argv[1]
    spec = json.load(open(sys.argv[2], encoding='utf-8'))
    doel, ontbreekt = bouw(nl_pad, spec['woorden'], spec['titel'], spec['omschrijving'])
    print('geschreven:', doel)
    uniek = sorted(set(ontbreekt))
    json.dump(uniek, open(os.path.join(SCRATCH, 'todo.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    if uniek:
        print(f'\nNOG {len(uniek)} ONVERTAALDE TEKSTEN (volledig in todo.json):')
        for t in uniek:
            print('  ' + t[:110])
    else:
        print('\nalles vertaald')
