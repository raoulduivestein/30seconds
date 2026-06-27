# 30 Seconds Clubhouse

Nederlandstalige webapp om 30 Seconds live te spelen terwijl iedereen in een Clubhouse-room praat. Clubhouse blijft de audio regelen; deze app regelt kamer, spelers, teams, timer, kaarten en score.

## Lokaal starten

Vereist: Node.js 20 of nieuwer.

```bash
npm start
```

Open daarna `http://localhost:3000`.

Er zijn geen verplichte environment variables. Optioneel:

```bash
PORT=3000
```

## Wat werkt in versie 1

- Host maakt een kamer met korte code en deelbare link.
- Spelers melden zich aan via link of kamercode.
- Dubbele namen krijgen automatisch een nummer.
- Host ziet spelers direct via realtime Server-Sent Events.
- Host maakt teams automatisch.
- Host start, pauzeert en beeindigt het spel.
- Host start een beurt, ziet een kaart met 5 Nederlandse begrippen en bedient de timer.
- Host markeert woorden als goed, fout, overgeslagen of teruggezet.
- Score en rondehistorie worden bijgehouden.
- Spelers zien beurtstatus, timer en score realtime.
- Kaarten zijn verborgen voor spelers, tenzij ze later als omschrijver worden gebruikt.
- Toegankelijkheidsmenu met tekstgrootte, contrast, screenreaderstand, timer-aankondigingen, geluid/trillen en eenvoudige weergave.
- Toetsenbordbediening voor host: spatie, G, F, O, N, P, S en H.

## Wat nog niet werkt

- Handmatig slepen van spelers tussen teams.
- Persistente database; de huidige versie gebruikt geheugen en is bedoeld als lokaal werkende MVP.
- Echte WebSockets; realtime loopt via Server-Sent Events, wat voor versie 1 vergelijkbaar gedrag geeft.
- Meerdere hosts en moderatorrollen.
- Eigen kaartensets beheren via een beheerscherm.

## Belangrijke bestanden

- `server.js`: HTTP-server, API-routes en realtime events.
- `src/gameCore.js`: spelregels, validatie, teams, score en kamerlogica.
- `src/types.ts`: TypeScript-types voor de domeinmodellen.
- `data/cards.js`: seeddata met 200 actieve kaarten.
- `public/app.js`: Nederlandstalige client-app.
- `public/styles.css`: toegankelijke responsive styling en contrastmodi.
- `test/gameCore.test.js`: testscenario's voor de kernlogica.

## Kaarten toevoegen

Voeg kaarten toe in `data/cards.js`. Een kaart heeft deze vorm:

```js
{
  id: "kaart-201",
  categorie: "Nederlandse cultuur",
  category: "Nederlandse cultuur",
  difficulty: "normaal",
  moeilijkheidsgraad: "normaal",
  words: ["Koningsdag", "Stroopwafel", "Fietspad", "Molens", "Grachten"],
  woorden: ["Koningsdag", "Stroopwafel", "Fietspad", "Molens", "Grachten"],
  status: "actief"
}
```

## Host-uitleg

1. Start een Clubhouse-room.
2. Open de app en kies `Nieuw spel starten`.
3. Deel de link of code in de Clubhouse-chat.
4. Wacht tot spelers zich aanmelden.
5. Maak teams automatisch.
6. Start het spel.
7. Start per team een beurt.
8. Markeer elk woord als `Goed`, `Fout` of `Overslaan`.
9. Ga naar de volgende beurt tot de rondes of eindscore zijn bereikt.

## Speler-uitleg

1. Blijf in Clubhouse voor de audio.
2. Open de link van de host.
3. Vul je naam in.
4. Kies eventueel grote tekst of superduidelijke modus.
5. Kijk op je scherm voor team, timer en score.

## Toegankelijkheidschecklist

- Semantische HTML met duidelijke koppen.
- Grote knoppen van minimaal 56 px hoog.
- Duidelijke focusrand voor toetsenbordgebruik.
- Hoog contrast, zwart/geel en zwart/wit.
- Tekstgrootte normaal, groot en extra groot.
- Live-regions voor status, score, timer en beurtwissels.
- Kleur wordt gecombineerd met tekstlabels.
- Geen drukke achtergrond en geen verplichte animaties.
- Hostacties zijn met toetsenbord te bedienen.

## Testen

```bash
npm test
```

De tests controleren kamer aanmaken, speler aanmelden, dubbele namen, teams maken, fout bij starten zonder teams, timer, punten, overslaan, strafpunten, eindscore, hostbeveiliging en kaartafscherming.

## Deployen

Deze MVP draait als eenvoudige Node-app. Deploy naar een platform dat Node 20 ondersteunt, bijvoorbeeld Render, Fly.io, Railway of een VPS.

Belangrijk voor productie:

- Vervang de in-memory store door PostgreSQL, SQLite, Supabase of Firebase.
- Zet automatische opruiming aan voor kamers ouder dan 24 of 48 uur.
- Gebruik HTTPS.
- Bewaar host-tokens server-side en roteer ze per kamer.
- Overweeg WebSockets als er veel kamers tegelijk actief zijn.
