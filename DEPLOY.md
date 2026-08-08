# Deploying to sharjahbook.com (148.66.157.129, Ubuntu 22.04, Singapore)

These steps assume you're SSH'd into the server as a user with sudo access.
Run them in order the first time; later updates only need the last section.

## 1. Point the domain at the server

In GoDaddy's DNS management for sharjahbook.com, add/update:
- A record: `@`   → `148.66.157.129`
- A record: `www` → `148.66.157.129`

DNS can take up to a few hours to propagate. You can move on to the next
steps while it does.

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # or log out and back in
```

## 3. Install Nginx and Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

## 4. Get the project onto the server

Once this is in a git repository (recommended next step — see note at the
bottom), clone it. Until then, copy the `majlis/` folder up via `scp`:

```bash
scp -r majlis/ your_user@148.66.157.129:~/majlis
```

## 5. Configure environment variables

```bash
cd ~/majlis
cp .env.example .env
nano .env   # set DB_PASSWORD to a long random value
```

## 6. Start the app and database

```bash
docker compose up -d --build
docker compose logs -f app   # watch it start, Ctrl+C to stop watching
```

Confirm it's running locally on the server:

```bash
curl http://127.0.0.1:3000/api/health
# should return {"status":"ok","books_in_catalog":0}
```

## 7. Wire up Nginx

```bash
sudo cp nginx/majlis.conf /etc/nginx/sites-available/majlis.conf
sudo ln -s /etc/nginx/sites-available/majlis.conf /etc/nginx/sites-enabled/
sudo nginx -t          # should say "syntax is ok" / "test is successful"
sudo systemctl reload nginx
```

At this point, http://sharjahbook.com should load the placeholder page
(once DNS has propagated).

## 8. Enable HTTPS

```bash
sudo certbot --nginx -d sharjahbook.com -d www.sharjahbook.com
```

Certbot edits `majlis.conf` automatically to add the SSL block and sets up
auto-renewal. Follow its prompts (email address, agree to terms).

## 9. Verify

- https://sharjahbook.com loads the placeholder page
- https://sharjahbook.com/api/health returns `{"status":"ok", ...}`

---

## Updating the app later

```bash
cd ~/majlis
git pull                       # once we're using git
docker compose up -d --build   # rebuilds and restarts just the app
```

## Recommended next step

Put this project in a git repository (GitHub, private) before doing much
more — it makes every future deploy a `git pull` instead of a manual file
copy, and gives us real version history as we build out staff tools and
the photograph-to-add feature.
