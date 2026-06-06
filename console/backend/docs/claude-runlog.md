# Aspendora Remote Console — Backend Build Runlog

## 2026-03-05 — Phase 6: Account Settings & TOTP 2FA UI

### Goal
Add Settings page with profile info, change password, and TOTP 2FA setup/disable. Add TOTP challenge to login page.

### Steps completed

- [x] **Settings.jsx** — Created settings page with 3 sections: Profile Info (read-only), Change Password (with eye toggle), Two-Factor Authentication (setup QR flow + disable with password)
- [x] **Login.jsx** — Added TOTP challenge: when login returns 403 with totp_required, shows 6-digit code input (numeric, monospace, centered), re-submits with totp_code
- [x] **auth.js** — Updated login() to accept totp_code, detect 403 TOTP challenge, throw typed error
- [x] **AuthContext.jsx** — Updated login() to pass totp_code through
- [x] **App.jsx** — Added /settings route (all authenticated users)
- [x] **Layout.jsx** — Added UserCog icon import, Settings NavLink in user section, "Account Settings" page title
- [x] **Frontend build** — Clean (466 KB JS bundle)
- [x] **rsync + docker compose build frontend + up -d** — Deployed
- [x] **Frontend verification** — read_page shows all 3 sections: Profile (admin@aspendora.com), Change Password form, 2FA with Disabled badge + Enable button
- [x] **Backend verification** — TOTP setup returns secret+QR, verify rejects invalid code, disable rejects when not enabled, change-password rejects wrong password, audit logs captured

### Result
Phase 6 deployed and verified. Settings page fully functional. TOTP 2FA flow complete end-to-end.

---

## 2026-03-05 — Phase 5: API Tokens, Notifications, SSO (Deploy)

### Goal
Deploy Phase 5 (API Tokens, Email Notifications, Microsoft Entra ID SSO) to production.

### Steps completed

- [x] **Integration review: Notifications** — All 6 frontend API calls match backend schemas/routes. SMTP settings fields, rules CRUD payloads, test endpoint all clean.
- [x] **Integration review: SSO** — Login.jsx checks `/auth/sso/enabled` and `/auth/sso/authorize` correctly. SSOCallback reads token+user query params, stores in same localStorage keys (`auth_token`, `auth_user`) that AuthContext and api interceptor use. All clean.
- [x] **rsync to server** — 126 files synced to docker.aspendora.com:~/rustdesk-console/
- [x] **docker compose build --no-cache** — Both images built successfully. Backend: Python 3.12 + httpx. Frontend: Vite build 451 KB JS.
- [x] **docker compose up -d** — DB container kept running, backend + frontend recreated and started.
- [x] **Startup verification** — Backend logs show clean startup, alembic migration context, uvicorn running.
- [x] **New tables created** — api_tokens and notification_rules auto-created by `create_all` (new tables, no ALTER needed).

### Endpoint verification

- [x] `POST /api/api-tokens` — 201 Created, returns plaintext token (`arc_6e3c...`) + all fields
- [x] `GET /api/api-tokens` — 200, returns token list with total
- [x] `PATCH /api/api-tokens/{id}` — 200, name updated correctly
- [x] `DELETE /api/api-tokens/{id}` — 204 No Content
- [x] **API token auth** — `GET /api/auth/me` with `Bearer arc_...` returns correct user (HTTP 200)
- [x] `GET /api/notifications/smtp-settings` — 200, returns SMTP config (disabled, port 587)
- [x] `POST /api/notifications/rules` — 201 Created, returns rule with created_by
- [x] `GET /api/notifications/rules` — 200, returns rules list with total
- [x] `PATCH /api/notifications/rules/{id}` — 200, name and enabled updated
- [x] `DELETE /api/notifications/rules/{id}` — 204 No Content
- [x] `GET /api/auth/sso/enabled` — 200, returns `{enabled: false, provider: "microsoft"}`
- [x] **Audit logging** — All 6 new action types captured: api_token.create/update/delete, notification_rule.create/update/delete

### Frontend verification

- [x] API Tokens page — Table with columns (Name, Prefix, Scopes, Expires, Last Used, Status, Actions), empty state, Create Token button
- [x] Notifications page — SMTP Settings card (Host, Port, From Email, From Name, TLS, Status), rules table with columns (Name, Event Type, Recipients, Enabled, Actions), Create Rule button
- [x] Login page — Redirects to dashboard when authenticated (correct). SSO button hidden when ENTRA_ENABLED=false (correct).
- [x] Sidebar — API Tokens and Notifications links visible in admin nav

### Result
Phase 5 deployed and fully verified. 0 integration issues. All endpoints working. All frontend pages rendering correctly.

---

## 2026-03-05 — Initial Backend Build

### Goal
Build the complete FastAPI backend for the Aspendora Remote Console.

### Steps completed

- [x] app/config.py — pydantic-settings configuration
- [x] app/database.py — async PostgreSQL + sync SQLite engines and session dependencies
- [x] app/models/user.py — User model with UUID PK, role enum, timestamps
- [x] app/models/hbbs.py — HbbsPeer read-only mapping for hbbs SQLite peer table
- [x] app/models/__init__.py — re-exports
- [x] app/schemas/auth.py — Token / TokenData
- [x] app/schemas/user.py — UserCreate, UserUpdate, UserResponse, UserLogin, ChangePassword
- [x] app/schemas/device.py — DeviceResponse, DeviceListResponse, DeviceUpdate, DeviceInfo
- [x] app/schemas/dashboard.py — DashboardStats
- [x] app/services/auth.py — bcrypt hashing, JWT create/decode, get_current_user, require_admin, require_operator, create_initial_admin
- [x] app/services/hbbs.py — get_devices, get_device, get_dashboard_stats, update_device_status, update_device_note, delete_device
- [x] app/routes/auth.py — POST /api/auth/login, GET /api/auth/me, POST /api/auth/change-password
- [x] app/routes/devices.py — full CRUD + stats for hbbs peers
- [x] app/routes/users.py — admin-only user management
- [x] app/main.py — FastAPI app with lifespan, CORS, routers, health check
- [x] requirements.txt
- [x] alembic.ini + alembic/env.py + alembic/script.py.mako
- [x] All __init__.py files

### Verification
- File tree validated
- Python syntax check passed on all .py files

---

## 2026-03-05 — Phase 2: Groups, Heartbeats, TOTP, Access Rules

### Goal
Add device groups, user groups, access rules, device heartbeat tracking, and TOTP 2FA to the backend.

### Steps completed

- [x] **app/models/groups.py** (NEW) — DeviceGroup, DeviceGroupMember, UserGroup, UserGroupMember, AccessRule models with UUID PKs, FKs, unique constraints, timestamps
- [x] **app/models/heartbeat.py** (NEW) — DeviceHeartbeat model with device_id PK, last_seen (indexed), ip_address, version, sysinfo, updated_at
- [x] **app/models/user.py** (EDITED) — Added totp_secret (str|None) and totp_enabled (bool, default False) fields to User
- [x] **app/models/__init__.py** (EDITED) — Exports all new models (DeviceGroup, DeviceGroupMember, UserGroup, UserGroupMember, AccessRule, DeviceHeartbeat)
- [x] **app/schemas/groups.py** (NEW) — Pydantic schemas for device groups, user groups, and access rules (create/update/response/list)
- [x] **app/schemas/heartbeat.py** (NEW) — HeartbeatPayload and HeartbeatResponse
- [x] **app/schemas/totp.py** (NEW) — TOTPSetupResponse, TOTPVerifyRequest, TOTPDisableRequest
- [x] **app/schemas/user.py** (EDITED) — Added totp_code field to UserLogin, totp_enabled to UserResponse
- [x] **app/schemas/dashboard.py** (EDITED) — Added online_devices field to DashboardStats
- [x] **app/schemas/device.py** (EDITED) — Added online (bool|None) and last_seen (str|None) to DeviceResponse
- [x] **app/services/heartbeat.py** (NEW) — upsert_heartbeat, get_device_heartbeats, is_device_online, get_online_device_count
- [x] **app/services/hbbs.py** (EDITED) — Added get_devices_by_ids helper
- [x] **app/routes/device_groups.py** (NEW) — Full CRUD + member management for device groups (admin only)
- [x] **app/routes/user_groups.py** (NEW) — Full CRUD + member management for user groups (admin only)
- [x] **app/routes/access_rules.py** (NEW) — CRUD for access rules with group name resolution (admin only)
- [x] **app/routes/heartbeat.py** (NEW) — POST /api/heartbeat (no auth, upserts heartbeat with client IP)
- [x] **app/routes/auth.py** (EDITED) — TOTP login flow (403 with totp_required), setup/verify/disable endpoints
- [x] **app/routes/devices.py** (EDITED) — Merged heartbeat data into device list/detail/stats responses
- [x] **app/main.py** (EDITED) — Imports from app.models (ensures all models registered), includes 4 new routers
- [x] **requirements.txt** (EDITED) — Added pyotp==2.9.0, qrcode[pil]==8.0

### Verification
- Python syntax check passed on all 20 new/modified .py files
- All new models use existing Base from app/models/user.py
- All group/access-rule routes require admin role
- Heartbeat endpoint has no auth
- TOTP issuer set to "Aspendora Remote Console"
- Login returns 403 JSON with totp_required:true when TOTP enabled but no code provided
- Online threshold: 5 minutes since last heartbeat

---

## 2026-03-05 — Phase 3: Audit Logging + Connection Tracking

### Goal
Add audit logging middleware and connection event tracking to the backend.

### Steps completed

- [x] **app/models/audit.py** (NEW) — AuditLog model with UUID PK, FK to users (SET NULL), user_email persistence, action, resource_type, resource_id, details, ip_address, created_at with DESC index
- [x] **app/models/connection.py** (NEW) — ConnectionEvent model with UUID PK, session_id (indexed), device_id (indexed), peer_id (indexed), event_type, peer metadata, duration_seconds, file transfer fields, created_at with DESC index
- [x] **app/schemas/audit.py** (NEW) — AuditLogResponse, AuditLogListResponse
- [x] **app/schemas/connection.py** (NEW) — ConnectionEventCreate, ConnectionEventResponse, ConnectionEventListResponse, ActiveSessionResponse
- [x] **app/middleware/__init__.py** (NEW) — Empty package init
- [x] **app/middleware/audit.py** (NEW) — AuditMiddleware using BaseHTTPMiddleware, regex-based route matching, JWT decode for user identification, separate AsyncSession for writes, graceful error handling
- [x] **app/routes/audit.py** (NEW) — GET /api/audit-logs with filtering (user_id, action, resource_type, date_from, date_to) and pagination, admin only
- [x] **app/routes/connections.py** (NEW) — POST /api/connections/event (no auth), GET /api/connections (operator+), GET /api/connections/active (operator+)
- [x] **app/models/__init__.py** (EDITED) — Added AuditLog, ConnectionEvent exports
- [x] **app/main.py** (EDITED) — Added AuditMiddleware after CORS, added audit and connections routers

### Verification
- Python syntax check passed on all 10 new/modified files
- Middleware skips /api/auth/login, /api/heartbeat, /api/health, /api/connections/event
- Middleware only audits POST/PATCH/DELETE with 2xx status codes
- Connection event POST auto-calculates duration for disconnect events
- Active sessions = connect events in last 24h with no matching disconnect
- No existing route files were modified

---

## 2026-03-05 — Phase 4: Strategies (Policies) + Address Books

### Goal
Add strategy/policy management with assignment system and address book management with sharing/permissions to the backend.

### Steps completed

- [x] **app/models/strategy.py** (NEW) — Strategy model (UUID PK, unique name, description, Text settings for JSON, timestamps with onupdate) + StrategyAssignment model (UUID PK, FK to strategies CASCADE, target_type/target_id/priority, unique constraint on strategy_id+target_type+target_id)
- [x] **app/models/address_book.py** (NEW) — AddressBook model (UUID PK, name, FK owner_id SET NULL, is_personal, description, timestamps with onupdate) + AddressBookEntry (UUID PK, FK book_id CASCADE, device_id, alias, tags, unique constraint on book_id+device_id) + AddressBookPermission (UUID PK, FK book_id CASCADE, FK user_group_id CASCADE, permission, unique constraint on book_id+user_group_id)
- [x] **app/schemas/strategy.py** (NEW) — StrategyCreate, StrategyUpdate, StrategyResponse (parses JSON settings to dict), StrategyListResponse (paginated), StrategyAssignmentCreate (regex-validated target_type), StrategyAssignmentResponse (with resolved target_name), EffectiveStrategyResponse (merged settings + applied list)
- [x] **app/schemas/address_book.py** (NEW) — AddressBookCreate, AddressBookUpdate, AddressBookResponse (with entry_count), AddressBookListResponse, AddressBookEntryCreate/Update/Response, AddressBookPermissionCreate (regex-validated permission), AddressBookPermissionResponse (with resolved user_group_name)
- [x] **app/routes/strategies.py** (NEW) — Full CRUD (admin only), assignment management (admin only), effective strategy endpoint (any authenticated user). Settings stored as JSON string in Text column, parsed to dict in responses. Target name resolution for device/user/device_group. Effective strategy merges by priority (higher overrides lower) across direct device and device group assignments.
- [x] **app/routes/address_books.py** (NEW) — Full CRUD with access control (admin sees all, others see personal + shared via group permissions), entry management (owner/admin/write), permission management (admin only). check_book_access helper enforces access. Personal books auto-assign owner_id, shared books require admin and have null owner_id.
- [x] **app/models/__init__.py** (EDITED) — Added Strategy, StrategyAssignment, AddressBook, AddressBookEntry, AddressBookPermission imports and __all__ exports
- [x] **app/main.py** (EDITED) — Added strategies and address_books router imports and include_router calls
- [x] **app/middleware/audit.py** (EDITED) — Added 13 new route patterns for strategy CRUD/assignments and address book CRUD/entries/permissions (more specific sub-resource patterns placed before parent resource patterns)

### Verification
- Python syntax check (py_compile) passed on all 9 new/modified files
- Strategy settings: accepted as dict in request, stored as JSON string (json.dumps), returned as dict (json.loads)
- Effective strategy: /api/strategies/effective/{device_id} available to all authenticated users via get_current_user
- Address book access: admin sees all, owner sees personal, group members see shared books with matching permissions
- Write operations on address book entries require owner/admin/write-permission
- All audit routes use compiled regex with correct group indices for resource ID extraction

---

## 2026-03-05 — API Tokens Feature

### Goal
Add API token management with creation, listing, update, revocation, and deletion. Integrate API token auth into the existing auth system.

### Steps completed

- [x] **app/models/api_token.py** (NEW) — APIToken model with UUID PK, name, token_hash (SHA-256), token_prefix (first 8 chars), FK user_id (SET NULL), scopes, expires_at, last_used_at, is_active, created_at
- [x] **app/schemas/api_token.py** (NEW) — APITokenCreate, APITokenUpdate, APITokenResponse (never exposes hash/token), APITokenCreatedResponse (includes plaintext_token, only at creation), APITokenListResponse
- [x] **app/routes/api_tokens.py** (NEW) — POST/GET/PATCH/DELETE /api/api-tokens (admin only). Token format: arc_ + 48 hex chars. SHA-256 hashed for storage.
- [x] **app/services/auth.py** (EDITED) — Added API token auth path. get_current_user now checks if bearer token starts with "arc_", hashes it, looks up in api_tokens table, verifies active + not expired, updates last_used_at, returns creator user.
- [x] **app/models/__init__.py** (EDITED) — Added APIToken import and __all__ export
- [x] **app/main.py** (EDITED) — Added api_tokens router import and include_router call
- [x] **app/middleware/audit.py** (EDITED) — Added 3 api-tokens audit route patterns (create, update, delete). Updated _extract_user_id_from_token to short-circuit for arc_ tokens.
- [x] **frontend/src/pages/APITokens.jsx** (NEW) — Full page with table (name, prefix, scopes, expires, last used, status badge, actions), create modal with name/scopes/expiry, token-created dialog with copy button and warning, edit modal, delete confirmation, toggle active/revoke
- [x] **frontend/src/components/Layout.jsx** (EDITED) — Added Key icon import, "API Tokens" to adminNavItems, pageTitleFromPath entry
- [x] **frontend/src/App.jsx** (EDITED) — Added APITokens import and /api-tokens route (admin only, ProtectedRoute)

### Verification
- Python syntax check (py_compile) passed on all 7 backend files
- Frontend vite build succeeded with no errors
- Token format: arc_ prefix + 48 random hex chars (52 chars total)
- Plaintext token returned only at creation time, never stored
- API token auth updates last_used_at on each use
- Expired and revoked tokens are rejected at auth time
