# Deploy naar 30seconds.opengekkenhuis.nl via GitHub

Deze repo is voorbereid voor deployment naar een VPS via GitHub Actions.

## DNS en VPS

Zorg dat `30seconds.opengekkenhuis.nl` als A-record naar het publieke IP-adres van je VPS wijst.

Op de VPS moet beschikbaar zijn:

- Docker
- Docker Compose plugin
- Nginx, als je de Nginx-route gebruikt
- Poort `80` en eventueel `443` open

## GitHub Secrets

Ga in GitHub naar `Settings > Secrets and variables > Actions > New repository secret`.

Voeg toe:

- `VPS_HOST`: IP-adres of hostname van de VPS
- `VPS_USER`: SSH-gebruiker, bijvoorbeeld `root` of `deploy`
- `VPS_SSH_KEY`: private SSH key waarmee GitHub Actions mag inloggen
- `VPS_PATH`: optioneel, standaard is `/var/www/30seconds`

## Deploy starten

Push naar `main` of `master`, of start handmatig:

`Actions > Deploy VPS > Run workflow`

De workflow is ingesteld voor jouw bestaande Nginx en draait:

```bash
docker compose -f docker-compose.nginx.yml up -d --build
```

De app luistert daarna alleen lokaal op `127.0.0.1:3000`. Nginx handelt het publieke verkeer voor `30seconds.opengekkenhuis.nl` af.

## Als je al Nginx draait

Gebruik dan niet de standaard `docker-compose.yml`, want die start Caddy op poort `80` en `443`.

Gebruik op de VPS deze variant:

```bash
sudo mkdir -p /var/www/30seconds
sudo chown -R $USER:$USER /var/www/30seconds
cd /var/www/30seconds
docker compose -f docker-compose.nginx.yml up -d --build
```

Deze publiceert de app alleen lokaal op:

```text
127.0.0.1:3000
```

Kopieer daarna de Nginx-config:

```bash
sudo cp deploy/nginx-30seconds.conf /etc/nginx/sites-available/30seconds.opengekkenhuis.nl
sudo ln -s /etc/nginx/sites-available/30seconds.opengekkenhuis.nl /etc/nginx/sites-enabled/30seconds.opengekkenhuis.nl
sudo nginx -t
sudo systemctl reload nginx
```

Voor HTTPS met Certbot:

```bash
sudo certbot --nginx -d 30seconds.opengekkenhuis.nl
```

## Controleren

Op de VPS:

```bash
cd /var/www/30seconds
docker compose ps
docker compose logs -f
```

In de browser:

```text
https://30seconds.opengekkenhuis.nl
```

## Belangrijk

Deze MVP gebruikt geheugenopslag. Kamers verdwijnen bij container-herstart. Voor productiegebruik met blijvende kamers is een database de volgende stap.
