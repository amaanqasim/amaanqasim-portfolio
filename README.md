# Amaan Qasim Portfolio

React + Vite serves the portfolio UI. Express provides the public portfolio read API and admin-only write/authentication APIs. SQLite stores portfolio content, the admin password hash, and server sessions. In production, Nginx serves `dist/` and proxies `/api` to the Node server.

## Local development

1. Install Node.js 22 or newer and run `npm ci`.
2. Create a private local `.env` and generate a random session secret:

   ```powershell
   Copy-Item .env.example .env
   node -e "const fs=require('fs'); const p='.env'; fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('replace-with-at-least-32-random-bytes',require('crypto').randomBytes(48).toString('base64')));"
   ```

   Keep `.env` private; it is ignored by Git.
3. In one terminal run `npm run dev:server`.
4. In another terminal run `npm run dev`, then open the Vite URL it prints.
5. Create the administrator once with `npm run admin:create`. The password is entered at the terminal and stored only as an Argon2id hash in SQLite.

The dev server proxies `/api` to Express. Admin login, all writes, and the portfolio read endpoint go to the backend. The public API exposes portfolio content only; every write and password change requires a valid server session and CSRF token. There is no public signup or browser-side fallback credential.

Use `npm run admin:reset-password` from a terminal on the server to reset the password. The Security tab can change it after asking for the current password. Make a backup with `npm run db:backup`; restore by stopping the service and replacing the SQLite file with a known-good backup, then fixing ownership and starting the service again.

## Preserve existing edited data

This repository has default portfolio content. The old app also read and wrote the Firestore document `portfolio/main` when Firebase was configured, and otherwise saved edits in browser localStorage under `amaan_portfolio_data`. No Firebase environment file or database export is present in this checkout, so the deployed edited copy cannot be inferred from this repository.

Before switching a previously configured copy, export the Firestore document `portfolio/main` as JSON from Firebase Console or the Firestore export tools. For a browser-local copy, open the browser's developer tools on the old site, read `localStorage.getItem('amaan_portfolio_data')`, and save the returned JSON as a file. Treat those exports as private while they contain contact details. Import either complete portfolio JSON file after creating the new SQLite database:

```powershell
npm run portfolio:import -- .\portfolio-export.json
```

The import validates the portfolio shape, asks you to type `IMPORT`, and replaces the current SQLite portfolio document. Back up first. The legacy source files contained a default password and recovery key in client code; this migration removes those credentials. If the old recovery key or password was ever used elsewhere, change it there too.

## Checks

```powershell
npm run build
npm run lint
```

## EC2 deployment preparation

Do not enable admin login over plain HTTP. The production server requires `SESSION_SECURE_COOKIE=true`, so its session cookie is only sent over HTTPS. We will use the domain-based certificate workflow and will not assume the usual domain workflow can cover the bare IP. The temporary IP Nginx example is for a public read-only preview, with admin login disabled until HTTPS is ready.

Deployment files are in `deploy/`. Inspect the existing EC2 applications, ports, Nginx configuration, disk, and firewall before installing or replacing anything. Preserve existing sites. Do not change AWS security group rules without explicit approval. Point DNS `A` records for the apex (`@`) and optional `www` name to `51.20.1.164`. Do not add an `AAAA` record unless IPv6 has been confirmed on the instance. With Cloudflare DNS, leave the records DNS-only while issuing the certificate. The initial HTTP Nginx file blocks admin and write APIs while Certbot validates the domain. After DNS is active and port 80 reaches this machine, install/run Certbot following its [Ubuntu Nginx instructions](https://certbot.eff.org/instructions?os=ubuntufocal&ws=nginx), request the certificate for both names with `sudo certbot certonly --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN`, then switch to `nginx-domain-https.conf` and replace `YOUR_DOMAIN` there too. Run `sudo nginx -t`, `sudo systemctl reload nginx`, and `sudo certbot renew --dry-run`. The final Nginx config redirects HTTP to HTTPS and proxies the app only over HTTPS. For an IP-only preview use `nginx-ip-temporary.conf`; it blocks admin and write APIs, so never enter admin credentials there.

### Windows Terminal: connect to the existing instance

```powershell
ssh -i "C:\Users\amaan\Desktop\Key VM1.pem" ubuntu@51.20.1.164
```

Never paste or upload the private key. On EC2, first inspect the machine without changing it:

```bash
hostnamectl
df -h
free -h
sudo ss -tulpn
systemctl --no-pager --type=service --state=running
sudo nginx -t
sudo ufw status verbose
```

Check the EC2 security group in the AWS Console separately. For a public HTTPS deployment it should allow inbound TCP 80 and 443. Restrict TCP 22 to your current public IP `/32` if practical; do not expose port 3001. Do not add an inbound SQLite/database rule.

### Ubuntu commands after the machine and domain are confirmed

The following is a deployment outline, not run against your instance. Review the current sites and ports first. Use a deployment checkout under `/var/www/amaan-portfolio`, a dedicated service account, `/var/lib/amaan-portfolio` for the database, and `/etc/amaan-portfolio/portfolio.env` for server secrets. Keep that env file mode `0600`, owned by root, and the database directory writable only by the service account.

Install a supported Node.js LTS release using an Ubuntu-appropriate trusted package source, then build the project locally and copy the reviewed release to EC2. Do not copy `.env`, `node_modules`, `.git`, a local database, or the SSH private key.

From Windows Terminal, create an archive from the reviewed workspace and copy it to the temporary directory on EC2. The `.gitignore` excludes the release archive from Git:

```powershell
tar -czf portfolio-release.tar.gz --exclude=.git --exclude=node_modules --exclude=server/data --exclude=.env .
scp -i "C:\Users\amaan\Desktop\Key VM1.pem" .\portfolio-release.tar.gz ubuntu@51.20.1.164:/tmp/portfolio-release.tar.gz
```

After first inspecting the machine, extract into a versioned or dedicated release directory, install only production dependencies, and build locally before copying if the archive does not include `dist/`:

```bash
sudo mkdir -p /var/www/amaan-portfolio
sudo tar -xzf /tmp/portfolio-release.tar.gz -C /var/www/amaan-portfolio
cd /var/www/amaan-portfolio
npm ci --omit=dev
```

The archive includes `dist/` when it exists. Inspect the resulting files before switching any existing Nginx site configuration.

After copying and reviewing files on EC2:

```bash
sudo useradd --system --home /var/lib/amaan-portfolio --shell /usr/sbin/nologin portfolio
sudo install -d -o portfolio -g portfolio -m 0750 /var/lib/amaan-portfolio
sudo install -d -o root -g root -m 0750 /etc/amaan-portfolio
sudo install -m 0640 deploy/portfolio.service /etc/systemd/system/portfolio.service
sudo install -m 0644 deploy/nginx-domain.conf /etc/nginx/sites-available/amaan-portfolio
sudo ln -s /etc/nginx/sites-available/amaan-portfolio /etc/nginx/sites-enabled/amaan-portfolio
sudo nginx -t
```

Create `/etc/amaan-portfolio/portfolio.env` in an editor on EC2 with `NODE_ENV=production`, `PORT=3001`, `DATABASE_PATH=/var/lib/amaan-portfolio/portfolio.sqlite`, `SESSION_SECURE_COOKIE=true`, `TRUST_PROXY=true`, and a newly generated random `SESSION_SECRET` (for example, generate it with `openssl rand -hex 32`). Set the file owner to `root:root` and mode to `0600`. Install production dependencies in the reviewed release. Create the initial account without putting its password in shell history:

```bash
sudo bash -c 'set -a; . /etc/amaan-portfolio/portfolio.env; set +a; exec sudo --preserve-env=NODE_ENV,SESSION_SECRET,PORT,DATABASE_PATH,SESSION_SECURE_COOKIE,TRUST_PROXY -u portfolio npm run admin:create'
```

Then enable and start the systemd service. Verify `/api/health`, login, cookie flags, writes, and restart persistence before switching DNS or announcing the site.

The Ubuntu release currently has a systemd `ExecStart` at `/usr/bin/node`; adjust it only if the selected Node.js installation uses a different path. `nginx-domain.conf` is the HTTP setup needed for certificate validation; `nginx-domain-https.conf` is the final TLS config after certificate issuance. Use the official Certbot instructions for the installed Ubuntu release. Keep the backend bound to loopback.

Back up SQLite with `npm run db:backup` on EC2 or `sqlite3 /var/lib/amaan-portfolio/portfolio.sqlite '.backup /safe/backup/path/portfolio.sqlite'` while the service is running. Keep copies off the web root with restricted permissions. No paid backup service is configured.
