# RustDesk Server Deployment Runlog

## 2026-03-05 — Initial Server Deployment

### Step 1: Fork RustDesk Client Repo
- **Goal**: Fork rustdesk/rustdesk to lacymooretx account
- **What**: `gh repo fork rustdesk/rustdesk --clone=true`
- **Result**: Forked to https://github.com/lacymooretx/rustdesk, cloned to /Users/lacy/code/rustdesk
- **Files**: Local clone with origin (fork) and upstream (rustdesk/rustdesk) remotes

### Step 2: Infrastructure Inventory
- **Goal**: Understand existing docker.aspendora.com setup before deploying
- **What**: SSH'd to server, ran `docker ps -a`, `docker volume ls`, `docker network ls`, `ss -tlnp`
- **Result**: Server at 149.28.251.164, nginx-proxy on 80/443, ~50 containers, ports 21115-21119 available
- **Key findings**: Apps in /opt/docker/, nginx configs in /opt/docker/nginx/conf.d/, SSL via certbot

### Step 3: Create DNS Record
- **Goal**: Point rd.aspendora.com to server
- **What**: Cloudflare API — created A record for `rd` → `149.28.251.164` (DNS-only, NOT proxied)
- **Why DNS-only**: RustDesk needs direct TCP/UDP on ports 21115-21119, Cloudflare proxy only handles HTTP(S)
- **Result**: Record ID `875c05ec80ca2745caf0ba909253b7ce`, zone `a06c2491527a5d50b5e85a572886b589`

### Step 4: SSL Certificate
- **Goal**: Get Let's Encrypt cert for rd.aspendora.com
- **What**: Added temp nginx HTTP config for ACME challenge, then ran certbot
- **Result**: Cert at /etc/letsencrypt/live/rd.aspendora.com/, expires 2026-06-03, auto-renews

### Step 5: Deploy RustDesk Server
- **Goal**: Run hbbs + hbbr containers
- **What**: Created /opt/docker/rustdesk/docker-compose.yml, `docker compose up -d`
- **Result**: Both containers running
- **Public Key**: `H81NU8YkQerS+ZYgMuCqfzwDC40EIBopeIJdBvb+NX0=`
- **Ports exposed**: 21115 (TCP), 21116 (TCP+UDP), 21117 (TCP), 21118 (TCP), 21119 (TCP)

### Step 6: Nginx HTTPS Config
- **Goal**: Serve rd.aspendora.com over HTTPS with WebSocket proxy
- **What**: Wrote /opt/docker/nginx/conf.d/rd.aspendora.com.conf, reloaded nginx
- **Result**: HTTPS working, verified from server

### Verification
- [x] DNS resolves: `dig @8.8.8.8 rd.aspendora.com` → 149.28.251.164
- [x] hbbs running and listening on 21115, 21116, 21118
- [x] hbbr running and listening on 21117, 21119
- [x] HTTPS at https://rd.aspendora.com/ returns server info
- [x] SSL cert valid until 2026-06-03

---

## 2026-03-05 — Hardcode Server Config into Client Fork

### Step 7: Initialize Submodules
- **Goal**: Get hbb_common submodule for editing
- **What**: `git submodule update --init --recursive`
- **Result**: libs/hbb_common checked out at 48c37de

### Step 8: Hardcode Server in hbb_common/src/config.rs
- **Goal**: Bake rd.aspendora.com and public key into client builds
- **What**: Edited three constants in `libs/hbb_common/src/config.rs`:
  1. `RENDEZVOUS_SERVERS` → `["rd.aspendora.com"]` (was `["rs-ny.rustdesk.com"]`)
  2. `RS_PUB_KEY` → `"H81NU8YkQerS+ZYgMuCqfzwDC40EIBopeIJdBvb+NX0="` (was RustDesk's default key)
  3. `PROD_RENDEZVOUS_SERVER` → `"rd.aspendora.com"` (was empty string)
- **Why**: Clients built from this fork will auto-connect to our server with no manual config needed
- **Files changed**: `libs/hbb_common/src/config.rs` (lines 59, 109, 110)
- **Verified**: No other files reference the old defaults (grep confirmed)

### Verification
- [x] `RENDEZVOUS_SERVERS` points to rd.aspendora.com
- [x] `RS_PUB_KEY` matches server's generated key
- [x] `PROD_RENDEZVOUS_SERVER` set to rd.aspendora.com
- [x] No other references to old rs-ny.rustdesk.com or old public key in codebase

---

## RustDesk Client Configuration

To connect clients to this server, set:
- **ID Server**: `rd.aspendora.com`
- **Relay Server**: `rd.aspendora.com`
- **Key**: `H81NU8YkQerS+ZYgMuCqfzwDC40EIBopeIJdBvb+NX0=`

## Next Steps
- [ ] Build custom client binaries (Windows/macOS) from this fork
- [ ] Set up CI/CD (GitHub Actions) for automated builds
- [ ] Deploy clients to managed endpoints via ImmyBot
- [ ] Optional: Rebrand app name from "RustDesk" to Aspendora branding
