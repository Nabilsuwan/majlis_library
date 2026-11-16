# Moving Majlis Library to the QNAP NAS

Target: QNAP TS-873A (QuTS hero, 32 GB RAM) at **192.168.1.192**

| What | Address (office network or Tailscale) |
|---|---|
| Library site | http://192.168.1.192:3000 |
| Staff login | http://192.168.1.192:3000/staff/login |
| n8n | http://192.168.1.192:5678 |
| Cover images | `/share/Majlis/covers` |
| Nightly backups (2:00 AM, kept 30 days) | `/share/Majlis/backups` |

The database is **not** reachable from the network, only from the containers.

---

## A. Before the office day (can be done from home)

- [ ] **Create the shared folder:** Control Panel → Privilege → Shared Folders → Create → name it **`Majlis`**
- [ ] **Copy 3 values from Vercel** (project → Settings → Environment Variables) and keep them somewhere private:
  - `DATABASE_URL` (the Neon database)
  - `SESSION_SECRET`
  - `ANTHROPIC_API_KEY`
- [ ] Container Station installed ✅ · time zone set to Dubai ✅ · 2-step login on ✅

---

## B. Office day (about 45 minutes)

### 1. Tailscale on the NAS
- [ ] On an office computer, open **http://192.168.1.192:8080** and log in
- [ ] Open the **Tailscale** app → **Log in** → sign in → approve the NAS
- [ ] Install Tailscale on your laptop/phone with the same account

### 2. Turn on SSH
- [ ] Control Panel → Network & File Services → Telnet/SSH → tick **Allow SSH connection** → Apply

### 3. Connect from the Mac (Terminal app)
```sh
ssh YOUR_NAS_USERNAME@192.168.1.192
```

### 4. Download the project
```sh
cd /share/Majlis
docker run --rm -v /share/Majlis:/w alpine/git clone -b qnap-migration \
  https://github.com/Nabilsuwan/majlis_library.git /w/majlis_library
cd /share/Majlis/majlis_library
```

### 5. Create the settings file
```sh
sh migrate/setup-env.sh
```
Paste `SESSION_SECRET` and `ANTHROPIC_API_KEY` when asked. Save the
`N8N_ENCRYPTION_KEY` it prints somewhere safe.

### 6. Start everything (first build takes 5–10 minutes)
```sh
docker compose up -d --build
docker compose ps        # db, app, backup, n8n should all be "running"
```
(If `docker compose` is not found, try `docker-compose` instead.)

### 7. Copy the database from Neon
⚠️ From this moment, **stop adding books on the old Vercel site.**
```sh
sh migrate/migrate-db.sh 'PASTE_THE_NEON_DATABASE_URL_HERE'
```
Check that the counts it prints (books, authors, publishers…) match the live site.

### 8. Copy the cover images from Vercel
```sh
docker compose exec app node scripts/migrate-covers.mjs
```
It should say `0 failed`. Safe to run again if anything fails.

### 9. Test
- [ ] Open **http://192.168.1.192:3000**: books and covers show
- [ ] Log in at `/staff/login` with your usual email and password
- [ ] Add one test book with **تصوير** (photo) and check that it reads the cover
- [ ] `ls /share/Majlis/backups`: a `majlis-<date>.dump` file exists
- [ ] Open **http://192.168.1.192:5678** and create the n8n owner account
- [ ] From your phone on **mobile data** with Tailscale on, open `http://<NAS Tailscale name>:3000`

### 10. Connect n8n to Ollama on the Mac mini (optional, same day or later)
On the Mac mini (Terminal):
```sh
launchctl setenv OLLAMA_HOST 0.0.0.0
```
Then quit and reopen Ollama. In n8n, use `http://<Mac mini IP>:11434` as the Ollama URL.
Give the Mac mini a fixed IP in the router/DHCP so this address doesn't change.

### 11. Security (do at the office, so you can't lock yourself out)
- [ ] App Center → install **QuFirewall** → allow only `192.168.1.0/24` (office) and `100.64.0.0/10` (Tailscale), deny everything else
- [ ] Ask whoever manages the router: *"Please turn off UPnP and remove any port forwarding to 192.168.1.192."*

---

## C. After migration: security clean-up

- [ ] Turn off unused services: **FTP, TFTP, AFP, NFS** (Control Panel → Network & File Services)
- [ ] **Network Access Protection** on (Control Panel → Security): block after 5 failed logins
- [ ] Run **Security Counselor** and fix what it flags
- [ ] Once Tailscale works from outside: **disable myQNAPcloud Link**
- [ ] After ~2 weeks of the NAS running fine: pause the Vercel project and the Neon database. Keep the final Neon export in `/share/Majlis/backups`.

---

## Everyday operations

| Task | Command (in `/share/Majlis/majlis_library`) |
|---|---|
| Update to new code | `docker run --rm -v /share/Majlis:/w alpine/git -C /w/majlis_library pull` then `docker compose up -d --build` |
| See logs | `docker compose logs -f app` |
| Backup log | `docker compose logs backup` |
| Restart all | `docker compose restart` |
| Restore a backup | `docker compose exec -T db pg_restore --clean --no-owner -U majlis -d majlis < /share/Majlis/backups/majlis-YYYY-MM-DD.dump` |

Extra safety: schedule **ZFS snapshots** of the `Majlis` shared folder
(Storage & Snapshots → Snapshot → Schedule, e.g. daily, keep 14).
