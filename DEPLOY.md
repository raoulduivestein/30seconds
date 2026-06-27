# Deploy naar 30seconds.opengekkenhuis.nl via GitHub

Deze repo is voorbereid voor deployment naar een VPS via GitHub Actions.

## DNS en VPS

Zorg dat `30seconds.opengekkenhuis.nl` als A-record naar het publieke IP-adres van je VPS wijst.

Op de VPS moet beschikbaar zijn:

- Docker
- Docker Compose plugin
- Poort `80` en `443` open

## GitHub Secrets

Ga in GitHub naar `Settings > Secrets and variables > Actions > New repository secret`.

Voeg toe:

- `VPS_HOST`: IP-adres of hostname van de VPS
- `VPS_USER`: SSH-gebruiker, bijvoorbeeld `root` of `deploy`
- `VPS_SSH_KEY`: private SSH key waarmee GitHub Actions mag inloggen
- `VPS_PATH`: optioneel, standaard is `/opt/30seconds`

## Deploy starten

Push naar `main` of `master`, of start handmatig:

`Actions > Deploy VPS > Run workflow`

De workflow kopieert de app naar de VPS en draait:

```bash
docker compose up -d --build
```

Caddy regelt automatisch HTTPS voor `30seconds.opengekkenhuis.nl`.

## Controleren

Op de VPS:

```bash
cd /opt/30seconds
docker compose ps
docker compose logs -f
```

In de browser:

```text
https://30seconds.opengekkenhuis.nl
```

## Belangrijk

Deze MVP gebruikt geheugenopslag. Kamers verdwijnen bij container-herstart. Voor productiegebruik met blijvende kamers is een database de volgende stap.
