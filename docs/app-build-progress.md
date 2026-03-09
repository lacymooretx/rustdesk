# Aspendora Remote Console — Build Progress

## Overview
Custom web management console for our self-hosted RustDesk server at rd.aspendora.com.
Replaces RustDesk Server Pro's paid console with our own implementation.

## Architecture Decision
- **Backend**: Python (FastAPI) — fast to build, good SQLite support, already used in other Aspendora projects
- **Frontend**: React + Tailwind CSS — modern, component-based, matches other Aspendora apps
- **Database**: PostgreSQL (new console data) + read from hbbs SQLite (device registry)
- **Deployment**: Docker on docker.aspendora.com, nginx reverse proxy at rd.aspendora.com
- **Auth**: Microsoft Entra ID SSO (existing Aspendora pattern) + local admin fallback

## Phased Build Plan

### Phase 1: Core Dashboard + Device Management (MVP)
- [x] FastAPI backend with PostgreSQL (async SQLAlchemy + asyncpg)
- [x] Auth: JWT local auth with bcrypt + role-based access (admin/operator/viewer)
- [x] Read hbbs SQLite DB for device list (sync SQLAlchemy, read-only mount)
- [x] Dashboard: device count, enabled/disabled status (stats cards)
- [x] Device table: search, sort, paginate, view details (ID, hostname, username, OS, status, created_at)
- [x] Device actions: enable/disable, edit notes, delete (role-gated)
- [ ] Client heartbeat API (port 21121) for online status + sysinfo (deferred to Phase 2)
- [x] React frontend with sidebar navigation (dark sidebar, Tailwind CSS, lucide icons)
- [x] User management CRUD (admin only) — brought forward from Phase 2
- [x] Docker deployment config (docker-compose, Dockerfiles, nginx proxy)
- [x] Integration verified: frontend build clean, all Python files compile
- [x] Deployed to docker.aspendora.com at rd.aspendora.com (3 containers running)
- [x] End-to-end verified: login, dashboard, API health, device stats

### Phase 2: Groups, Access Control, Heartbeat, TOTP
- [x] Device groups: CRUD + member management (add/remove devices)
- [x] User groups: CRUD + member management (add/remove users)
- [x] Access rules: user group -> device group -> permission (view/control/full)
- [x] Heartbeat API: POST /api/heartbeat (no auth, records client IP, version, sysinfo)
- [x] Online status: 5-minute threshold, merged into device list + detail + dashboard stats
- [x] Dashboard: 4th "Online" stats card with Wifi icon
- [x] Devices: Online column (green/gray dot) + Last Seen column
- [x] Device detail: Online status indicator + relative time for Last Seen
- [x] TOTP 2FA backend: setup (QR code), verify, disable endpoints
- [x] TOTP login flow: backend returns 403 with totp_required flag (frontend UI deferred)
- [x] All new pages: Device Groups, Device Group Detail, User Groups, User Group Detail, Access Rules
- [x] Sidebar navigation updated with new admin-only links
- [x] Integration review: 0 mismatches found (all API contracts match)
- [x] Deployed to docker.aspendora.com, all endpoints verified
- [x] Fixed: users table schema migration (added totp_secret, totp_enabled columns)
- [x] Fixed: admin password hash regenerated for current bcrypt version

### Phase 3: Audit Logging + Connection Tracking
- [x] Audit middleware: auto-logs all POST/PATCH/DELETE with 2xx to audit_logs table
- [x] Audit log viewer: filterable by action type, resource type, date range, search
- [x] Connection events API: POST /api/connections/event (no auth, from clients)
- [x] Connection log viewer: filterable by device, event type, date range, paginated
- [x] Active sessions tab: shows connect events with no disconnect (24h window, auto-refresh 30s)
- [x] File transfer support: file_name, file_size, file_direction fields in connection events
- [x] Auto-duration calculation: disconnect events auto-compute duration from matching connect
- [x] Sidebar updated with Audit Logs (FileText) and Connections (Link2) nav items
- [x] Deployed and verified: audit logging captures real actions, connection events work end-to-end

### Phase 4: Strategies + Address Books
- [x] Strategy CRUD: name, description, settings (JSON), admin-only
- [x] Strategy settings editor: toggle switches + text fields grouped by section (Connections, Permissions, Security, Display, Server)
- [x] Strategy assignments: assign strategies to devices, users, or device groups with priority
- [x] Effective strategy endpoint: merges all applicable strategies by priority for a device
- [x] Address books: personal (per-user) and shared (admin-created) with access control
- [x] Address book entries: device_id, alias, tags (comma-separated), CRUD with write permission check
- [x] Address book permissions: user group -> book -> read/write (admin manages, group-based access)
- [x] Strategies page: CRUD table with settings editor modal (wide), edit/delete
- [x] Strategy detail page: settings display grid, assignments table with add/remove
- [x] Address books page: "My Address Book" section + "Shared Address Books" card grid
- [x] Address book detail page: entries table (device, alias, tags), permissions table (shared, admin)
- [x] Sidebar: Strategies (admin, Settings2 icon), Address Books (all users, BookOpen icon)
- [x] Audit middleware: 13 new route patterns for strategies and address books
- [x] Integration review: 2 mismatches found and fixed (entries in book detail, tags as string)
- [x] Deployed and verified: all CRUD endpoints, assignments, effective strategy, audit logging

### Phase 5: API Tokens, Notifications, SSO
- [x] API Tokens: CRUD (admin-only), `arc_` prefix + SHA-256 hash storage, scopes, expiry
- [x] API Token auth: integrated into `get_current_user`, supports all endpoints transparently
- [x] Email notifications: SMTP service, notification rules (event-type based), test email
- [x] SMTP settings: read-only display (configured via env vars), never exposes password
- [x] Microsoft Entra ID SSO: OAuth2 authorization code flow, auto-provision users as viewer
- [x] SSO login: "Sign in with Microsoft" button (conditionally shown when ENTRA_ENABLED=true)
- [x] SSO callback: exchanges code for token, fetches MS Graph profile, creates JWT, redirects
- [x] Frontend: API Tokens page (CRUD table, create modal, plaintext-once dialog, edit/revoke)
- [x] Frontend: Notifications page (SMTP settings card, rules CRUD table, test email button)
- [x] Frontend: Login SSO button + SSOCallback page
- [x] Audit middleware: 7 new patterns (api_token CRUD, notification_rule CRUD + test)
- [x] Integration review: 0 mismatches found (all 3 features clean)
- [x] Deployed and verified: all CRUD endpoints, API token auth, audit logging, frontend pages

### Phase 6: Account Settings & TOTP 2FA UI
- [x] Settings page: profile info (read-only), change password (with show/hide toggle), 2FA section
- [x] TOTP setup flow: click enable → QR code displayed → enter 6-digit code → verify & enable
- [x] TOTP disable flow: click disable → enter current password → confirm
- [x] TOTP login challenge: when login returns 403 with `totp_required`, shows authenticator code input
- [x] Auth service: `login()` passes totp_code, detects 403 TOTP challenge, throws typed error
- [x] Sidebar: Settings link (UserCog icon) in user section at bottom, available to all users
- [x] Route: /settings (all authenticated users)
- [x] Deployed and verified: all endpoints working, frontend page renders correctly

### Phase 7: Custom Client Features
- [x] Heartbeat wiring — port 21114 nginx proxy to console backend (client auto-derives URL)
- [x] /api/sysinfo endpoint — accepts native client sysinfo upload (hostname, OS, CPU, memory)
- [x] Aspendora branding — 53 icon files replaced across all platforms (red roofline on dark navy)
- [x] Hardcoded "RustDesk" string fixed in tabbar widget (uses dynamic app name)
- [x] Web remote access — Connect button on device list + detail pages (rustdesk:// URI scheme)
- [x] Auto-update — backend version check + download redirect endpoints, client update checks enabled for custom clients
- [x] DigiCert code signing — Windows exe/dll/msi signed (certsync + signtool PATH fix)
- [x] First client deployment — 3E-ADMINPC installed, service running, connected to server
- [x] Vultr firewall fix — port 21114 opened, heartbeats flowing, device online in console
- [ ] Fix service name space bug — `sc create` fails with spaces in app name, workaround: use `New-Service` in installer
- [ ] Control roles (session-level permissions)
- [ ] LDAP integration

---

## Current Status
**Phase**: Phase 7 — IN PROGRESS (branding, heartbeat, web access, auto-update, code signing, Vultr firewall done; service name space bug found)
**Last Updated**: 2026-03-09

### Phase 6 Deliverables

**Frontend** (`console/frontend/`):
- Settings page: 3 sections — Profile Info (email, username, full name, role badge), Change Password (current/new/confirm with eye toggle), Two-Factor Authentication (enable/disable with QR code flow)
- TOTP setup: calls POST /auth/totp/setup → displays QR code image + manual entry key with copy button → 6-digit code input → calls POST /auth/totp/verify → reloads user data
- TOTP disable: password confirmation → calls POST /auth/totp/disable → reloads user data
- Login TOTP challenge: detects `totp_required` error from auth service → shows "Authenticator Code" input field (numeric, 6 digits, monospace, centered) → re-submits with totp_code
- Auth service: `login(email, password, totp_code)` — catches 403 with `totp_required`, throws typed error for Login.jsx to handle
- AuthContext: passes totp_code through to auth service
- Layout: Settings link (UserCog icon) in user area below nav, page title "Account Settings"
- App.jsx: /settings route (all authenticated users, not admin-only)

### Phase 5 Deliverables

**Backend** (`console/backend/`):
- APIToken model: UUID PK, name, token_hash (SHA-256), token_prefix (first 8 chars), user_id FK (SET NULL), scopes (str), expires_at, last_used_at, is_active, created_at
- NotificationRule model: UUID PK, name, event_type (enum: new_device/device_offline/connection_started/connection_ended/new_user), enabled, recipients (comma-sep), created_by FK, timestamps
- API token routes: POST (create, returns plaintext once), GET (list), PATCH (update), DELETE — all admin-only
- Token format: `arc_` + 48 hex chars, SHA-256 hashed for storage, prefix stored for display
- Auth service: `get_current_user` detects `arc_` prefix, hashes, looks up api_tokens table, verifies active + not expired, updates last_used_at, returns creator's User
- Notification routes: GET smtp-settings, GET/POST/PATCH/DELETE rules, POST test/{rule_id} — all admin-only
- Email service: send_email (SMTP), send_notification (event-type lookup), HTML email templates
- SSO routes: GET /sso/enabled (public), GET /sso/authorize (returns MS authorize URL), GET /sso/callback (code exchange, user provision, JWT redirect)
- Config: SMTP settings (8 env vars), Entra ID settings (5 env vars), all disabled by default
- Audit middleware: 7 new patterns for api_token and notification_rule operations

**Frontend** (`console/frontend/`):
- API Tokens page: CRUD table (name, monospace prefix, scopes, expiry, last used, status badge), create modal (name/scopes/expiry), token-created dialog with copy + "only shown once" warning, edit modal with revoke toggle, delete confirmation
- Notifications page: SMTP settings card (read-only, env-configured), notification rules CRUD table with event type badges, create/edit modals (name/event_type/recipients/enabled toggle), test email button, delete confirmation
- Login page: SSO section with "Sign in with Microsoft" button + 4-color logo, conditionally shown when /sso/enabled returns true, OR divider
- SSOCallback page: reads token+user from query params, stores in localStorage, redirects to dashboard
- Layout: Key icon for API Tokens, Bell icon for Notifications in admin nav
- App.jsx: 3 new routes (/api-tokens admin, /sso-callback public, /notifications admin)

### Phase 4 Deliverables

**Backend** (`console/backend/`):
- Strategy model: name (unique), description, settings (Text/JSON), timestamps
- StrategyAssignment model: strategy_id FK (CASCADE), target_type (device/user/device_group), target_id, priority, UniqueConstraint
- AddressBook model: name, owner_id FK (SET NULL, nullable), is_personal, description, timestamps
- AddressBookEntry model: book_id FK (CASCADE), device_id, alias, tags (String), UniqueConstraint on book+device
- AddressBookPermission model: book_id FK (CASCADE), user_group_id FK (CASCADE), permission (read/write), UniqueConstraint
- Strategy routes: CRUD (admin), assignment CRUD (admin), effective strategy (all auth users, merges by priority)
- Address book routes: CRUD with access control (admin sees all, users see personal + permitted shared), entry CRUD (write permission), permission CRUD (admin)
- check_book_access helper: admin bypass, owner for personal, group permission check for shared
- Effective strategy: collects device + device_group assignments, sorts by priority, merges settings (higher overrides)
- Audit middleware: 13 new patterns covering strategy/assignment and address_book/entry/permission operations

**Frontend** (`console/frontend/`):
- Strategies page: CRUD table, wide create/edit modals with SettingsEditor (toggle switches + text inputs), delete confirmation
- StrategyDetail page: settings display grid (5 sections), assignments table with add modal (device input / user dropdown / device group dropdown), priority field
- AddressBooks page: two sections (My Address Book with lock empty state, Shared Address Books card grid), create modals for personal/shared
- AddressBookDetail page: book info header with edit, entries table (device ID, alias, tag badges), permissions table (shared + admin only), add entry/edit entry/add permission modals
- Layout: Settings2 icon for Strategies (admin), BookOpen icon for Address Books (all users)
- App.jsx: 4 new routes (/strategies, /strategies/:id, /address-books, /address-books/:id)

### Phase 3 Deliverables

**Backend** (`console/backend/`):
- AuditLog model with user_email persistence, action/resource indexing
- ConnectionEvent model with session correlation, file transfer fields
- AuditMiddleware: regex-based path matching, JWT decode, async log write (non-blocking)
- Audit routes: GET /api/audit-logs with q, action (prefix LIKE), resource_type, date range filters
- Connection routes: POST /api/connections/event (no auth), GET /api/connections (operator+), GET /api/connections/active (operator+)
- Active sessions: subquery excludes disconnected sessions within 24h window
- Auto-duration: disconnect events auto-compute from matching connect timestamp

**Frontend** (`console/frontend/`):
- AuditLogs page: search, action type dropdown, resource type dropdown, date range, paginated table with color-coded action badges
- Connections page: two-tab layout (Connection Log + Active Sessions)
- Connection Log tab: search by device ID, event type filter, date range, duration/file transfer display
- Active Sessions tab: auto-refresh 30s, relative time, computed duration, session count
- Layout: 2 new admin nav items (Audit Logs with FileText, Connections with Link2)

### Phase 2 Deliverables

**Backend** (`console/backend/`):
- Device groups routes: CRUD + add/remove/list members (admin-only)
- User groups routes: CRUD + add/remove/list members (admin-only)
- Access rules routes: CRUD with group name resolution (admin-only)
- Heartbeat route: POST /api/heartbeat (no auth, upsert to device_heartbeats table)
- Heartbeat service: upsert, batch lookup, online check, online count (5-min threshold)
- TOTP endpoints: /totp/setup (QR code), /totp/verify, /totp/disable
- Models: DeviceGroup, DeviceGroupMember, UserGroup, UserGroupMember, AccessRule, DeviceHeartbeat
- User model: added totp_secret and totp_enabled fields
- Devices routes: merged heartbeat data (online, last_seen) into all device responses
- Dashboard stats: added online_devices count

**Frontend** (`console/frontend/`):
- Device Groups page: table with CRUD modals
- Device Group Detail: group info, members table with online indicators, add device (search)
- User Groups page: table with CRUD modals
- User Group Detail: group info, members table with role badges, add user (dropdown)
- Access Rules page: rules table with permission badges, create/edit/delete modals
- Dashboard: 4th "Online" stats card (emerald/Wifi)
- Devices: Online column (green/gray dot) + Last Seen column
- Device Detail: Online status indicator + relative time display
- Layout: 3 new admin nav items (Device Groups, User Groups, Access Rules)
- Badge: yellow, blue variants used for roles/permissions
- StatsCard: emerald color variant for online count

### Phase 1 Deliverables

**Backend** (`console/backend/`):
- FastAPI app with lifespan (auto-creates tables, seeds admin on startup)
- JWT auth: login, me, change-password endpoints
- Device endpoints: list (search/sort/paginate), detail, update, delete, stats
- User CRUD: list, create, update, delete (admin-only)
- hbbs SQLite reader: parses peer table + info JSON
- Alembic migration setup
- Default admin: admin@aspendora.com / admin (must_change_password=True)

**Frontend** (`console/frontend/`):
- React + Vite + Tailwind CSS v4
- Login page with dark theme
- Dashboard with 3 stats cards + recent devices table
- Devices page: search, sortable columns, pagination, toggle/delete actions
- Device detail: full info, notes editor, enable/disable toggle
- Users page (admin only): full CRUD with modals
- Reusable components: Table, Modal, Badge, StatsCard, Layout
- Auth context with ProtectedRoute + admin gating

**Docker** (`console/`):
- docker-compose.yml: PostgreSQL + backend + frontend (3 services)
- Backend Dockerfile: Python 3.12 + alembic migrate + uvicorn
- Frontend Dockerfile: multi-stage Node build + nginx serve
- Frontend nginx: API proxy to backend + SPA fallback
- Host nginx config for rd.aspendora.com SSL proxy
- External volume mount for hbbs SQLite (read-only)
- Isolated networking: backend/db on internal, frontend on internal + proxy-network
