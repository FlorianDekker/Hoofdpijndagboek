# Hoofdpijndagboek

Eenvoudig hoofdpijndagboek als webapp voor de iPhone. Live op https://floriandekker.github.io/Hoofdpijndagboek/

- **Dag**: hoofdpijn ja/nee; per aanval begin/eind, ernst (1-10), plek, soort en bijverschijnselen; leefstijl (slaap, stress, cafeïne, alcohol, water, schermtijd, maaltijden, beweging, weer) en een notitie.
- **Kalender**: maandoverzicht, gekleurd naar ernst.
- **Inzichten**: hoofdpijndagen per maand en per factor het percentage hoofdpijndagen met en zonder die factor.
- **Voor de arts**: overzicht over een zelfgekozen periode om af te drukken of als PDF te bewaren, export naar CSV, back-up en terugzetten.

Alle gegevens blijven in `localStorage` op het toestel; er is geen server.

## Installeren op iPhone

Open de link in Safari → deelknop → *Zet op beginscherm*.

## Ontwikkelen

Geen build-stap: `python -m http.server` in deze map en open http://localhost:8000.
Bij een nieuwe versie `VERSIE` in `sw.js` ophogen en de `?v=` in `index.html` gelijk trekken, anders blijft de oude versie uit de cache komen.
