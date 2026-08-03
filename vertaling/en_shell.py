"""Gedeelde omzetting NL -> EN: paden, taal, navigatie, voettekst, formulier.

Wordt gebruikt door bouw_en.py. Alles wat op elke pagina hetzelfde is staat hier,
zodat een wijziging in de navigatie maar op één plek hoeft.
"""

BASIS = 'https://thermalcompostsystems.nl/'

# Nederlandse bestandsnaam -> Engelse, relatief vanaf de wortel van elke taalmap
PAGINA = {
    'index.html': 'index.html',
    'het-systeem.html': 'system.html',
    'compost.html': 'compost.html',
    'nieuws.html': 'news.html',
    'team.html': 'about.html',
    'privacy.html': 'privacy.html',
    'praktijkvoorbeelden/kassen.html': 'case-studies/greenhouses.html',
    'praktijkvoorbeelden/veehouder.html': 'case-studies/dairy-farm.html',
    'praktijkvoorbeelden/landgoed.html': 'case-studies/estate.html',
}

# ---- navigatie en voettekst, identiek op elke pagina ----
NAV = [
    ('aria-label="Hoofdnavigatie"', 'aria-label="Main navigation"'),
    ('aria-label="Thermal Compost Systems, home"', 'aria-label="Thermal Compost Systems, home"'),
    ('>Naar hoofdinhoud<', '>Skip to main content<'),
    ('aria-label="Kruimelpad"', 'aria-label="Breadcrumb"'),
    ('aria-label="Menu openen"', 'aria-label="Open menu"'),
    ('>\n            Het systeem\n', '>\n            The system\n'),
    ('>Het systeem</a>', '>The system</a>'),
    ('>Techniek</a>', '>Technology</a>'),
    ('>Compost</a>', '>Compost</a>'),
    ('>\n            Voor wie\n', '>\n            Who it is for\n'),
    ('>Voor wie</a>', '>Who it is for</a>'),
    ('>Tuincentra &amp; kassen</a>', '>Garden centres &amp; greenhouses</a>'),
    ('>Veehouders</a>', '>Dairy &amp; livestock farms</a>'),
    ('>Vastgoed &amp; landgoederen</a>', '>Property &amp; estates</a>'),
    ('>Bereken</a>', '>Calculate</a>'),
    ('>Bereken uw besparing</a>', '>Calculate your saving</a>'),
    ('>Nieuws</a>', '>News</a>'),
    ('>Over ons</a>', '>About us</a>'),
    ('>Plan een gesprek</a>', '>Book a call</a>'),
    ('>Home</a>', '>Home</a>'),
    ('>Praktijkvoorbeelden</a>', '>Case studies</a>'),
]

VOETTEKST = [
    ('>Warmte uit compost. Compost uit afval.<', '>Heat from compost. Compost from waste.<'),
    ('>Voordelen</a>', '>Benefits</a>'),
    ('>Privacy</a>', '>Privacy</a>'),
    ('''Dit project wordt mede mogelijk gemaakt door het Europees Landbouwfonds voor
         Plattelandsontwikkeling: Europa investeert in zijn platteland. Samen werken we aan
         duurzame energie uit compost en circulaire landbouwpraktijken.''',
     '''This project is co-funded by the European Agricultural Fund for Rural
         Development: Europe investing in rural areas. Together we work on renewable
         energy from compost and circular farming practices.'''),
    ('Thermal Compost Systems. Alle rechten voorbehouden.',
     'Thermal Compost Systems. All rights reserved.'),
    ('Thermal Compost Systems is een handelsnaam van Thermal Compost Solutions',
     'Thermal Compost Systems is a trading name of Thermal Compost Solutions'),
    ('aria-label="Venster sluiten"', 'aria-label="Close window"'),
    ('aria-label="Sluiten"', 'aria-label="Close"'),
    ('aria-label="Vergrote foto"', 'aria-label="Enlarged photo"'),
]

GEDEELD = NAV + VOETTEKST


def paden(html, diep):
    """Zet relatieve verwijzingen om voor een pagina die `diep` mappen onder /en/ staat.

    diep = 0 voor /en/index.html, diep = 1 voor /en/case-studies/xxx.html
    De Nederlandse bronpagina's staan zelf op diepte 0 of 1 binnen de wortel, dus
    we normaliseren eerst naar wortel-relatief en bouwen daarna opnieuw op.
    """
    import re
    op = '../' * (diep + 1)          # vanuit /en/<diep> terug naar de wortel
    binnen = '../' * diep            # binnen /en/ naar de taalwortel

    # 1) alles wat naar een bestand in de wortel wijst
    for bestand in ('styles.css', 'script.js', 'roi.js', 'scene-model.js', 'favicon.ico'):
        html = re.sub(r'(?<=["\'])(?:\.\./)?' + re.escape(bestand), op + bestand, html)
    html = re.sub(r'(?<=["\'])(?:\.\./)?assets/', op + 'assets/', html)

    # 2) verwijzingen naar andere pagina's -> Engelse tegenhangers binnen /en/
    for nl, en in sorted(PAGINA.items(), key=lambda kv: -len(kv[0])):
        nl_kaal = nl.split('/')[-1]
        html = re.sub(r'(?<=["\'])(?:\.\./)?' + re.escape(nl), binnen + en, html)
        if '/' not in nl:
            html = re.sub(r'(?<=["\'])(?:\.\./)?' + re.escape(nl_kaal) + r'(?=[#"\'])',
                          binnen + en, html)
    return html
