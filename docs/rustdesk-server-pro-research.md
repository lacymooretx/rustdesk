# RustDesk Server Pro - Comprehensive Feature Research

**Date:** 2026-03-05
**Purpose:** Complete catalog of RustDesk Server Pro features, web console capabilities, API surface, and community alternatives.

---

## Table of Contents

1. [Pricing Tiers](#1-pricing-tiers)
2. [Web Console Overview](#2-web-console-overview)
3. [Console Pages & Navigation](#3-console-pages--navigation)
4. [Authentication & Identity](#4-authentication--identity)
5. [User Management](#5-user-management)
6. [Device Management](#6-device-management)
7. [Groups & ACL](#7-groups--acl)
8. [Admin Roles (RBAC)](#8-admin-roles-rbac)
9. [Control Roles](#9-control-roles)
10. [Strategies (Policy Engine)](#10-strategies-policy-engine)
11. [Address Books](#11-address-books)
12. [Audit & Logging](#12-audit--logging)
13. [Custom Client Generator](#13-custom-client-generator)
14. [Web Client](#14-web-client)
15. [Relay Server Management](#15-relay-server-management)
16. [Settings & Configuration](#16-settings--configuration)
17. [Client Advanced Settings (Strategy-Pushable)](#17-client-advanced-settings-strategy-pushable)
18. [API Surface](#18-api-surface)
19. [Release History & Changelog](#19-release-history--changelog)
20. [Community / Open-Source Alternatives](#20-community--open-source-alternatives)

---

## 1. Pricing Tiers

| Plan | Price | Users | Devices | Key Differentiators |
|------|-------|-------|---------|---------------------|
| **Free** | $0/mo | - | - | Online status only, community support |
| **Individual** | $9.90/mo (annual) | 1 | 20 | Unlimited concurrent connections, 2FA, web console, address book, audit log, change ID, access control, centralized settings, distributed relay servers |
| **Basic** | $19.90/mo (annual) | 10 | 100 | Everything in Individual + OIDC SSO, LDAP, cross-group access, custom client generator |
| **Customized** | $19.90/mo base | +$1/user | +$0.10/device | Everything in Basic, scales with usage |
| **Customized V2** | $19.90/mo base | +$1/user | +$0.10/device, +$20/connection | Limited concurrent connections, unlimited concurrent sessions (tabs/windows) |

---

## 2. Web Console Overview

- **Port:** 21114 (HTTP) or HTTPS via reverse proxy (Nginx/IIS)
- **Default credentials:** `admin` / `test1234`
- **Technology:** Integrated into the hbbs server binary
- **Access URL:** `http://<server-ip>:21114` or `https://rustdesk.yourdomain.com`

---

## 3. Console Pages & Navigation

The web console left-hand navigation includes these primary sections:

| Page | Description |
|------|-------------|
| **Dashboard/Home** | Overview, device statistics (online count, etc.) |
| **Devices** | Browse, search, filter all registered devices |
| **Users** | User account management |
| **User Groups** | Group hierarchy and membership |
| **Device Groups** | Device grouping for ACL and policies |
| **Logs / Audit** | Connection logs, file transfer logs, console audit logs, alarm logs |
| **Address Books** | Shared address book management |
| **Strategies** | Client settings sync policies |
| **Admin Roles** | RBAC role definitions and assignments |
| **Control Roles** | Session-level permission profiles |
| **Custom Clients** | Branded client generator |
| **Settings** | Server configuration (relay, license, SMTP, OIDC, LDAP, 2FA, etc.) |
| **Account/Profile** | Personal settings (top-right menu: password, email, 2FA) |

---

## 4. Authentication & Identity

### Two-Factor Authentication (2FA)
- **Email verification:** Login codes sent via configured SMTP
- **TOTP:** Supports Authy, Microsoft Authenticator, Google Authenticator
- 6 backup codes generated on TOTP enable
- TOTP overrides email verification when enabled
- Enforced 2FA with forced logout capability (v1.6.7+)
- Configurable 2FA issuer name (v1.7.6+)
- Trusted devices option to skip 2FA
- Admin can manage/reset user 2FA

### OIDC (OpenID Connect)
- Supported providers: Google, Okta, Facebook, Azure, GitHub, GitLab, Keycloak, ADFS, authentik
- Group mapping support (Okta, Azure, Keycloak, GitLab) (v1.6.7+)
- Auto user creation on first login
- OIDC 2FA redirect support

### LDAP
- Configurable host, port, Base DN, scope (one/sub), Bind DN/password
- Filter support (e.g., `(objectClass=person)`)
- Username attribute mapping (uid, cn, sAMAccountName for AD)
- StartTLS support
- TLS certificate verification toggle
- Auto user creation on first login
- Limitation: No group-based access mapping yet; no migration from local users to LDAP

### SMTP Email Configuration
- Gmail and standard SMTP support
- Port 587 recommended
- TLS with plain text fallback (v1.7.0+)
- OAuth2/XOAuth2 SMTP support (v1.7.6+)

---

## 5. User Management

- Create, modify, delete user accounts
- Enable/disable accounts
- Set administrator privilege
- Assign to user groups
- Assign strategies
- Assign control roles
- Assign admin roles
- Edit email, password, notes
- Manage 2FA per user
- Force logout
- Invite users (email invitation)
- Login verification merged into status column (v1.6.8+)
- Batch operations via "More" menu

---

## 6. Device Management

- Browse all connected devices with search/filter/sort
- View device details (CPU, hostname, memory, OS, username, version)
- Assign devices to users
- Assign devices to device groups
- Assign strategies to devices
- Enable/disable devices
- Delete devices (must disable first)
- Edit device info/notes
- Change device ID
- Device name sync option (v1.7.3+)
- Batch device group assignment
- One-click connection via `rustdesk://` URI
- Sortable tables (v1.5.0+)
- Token-based device assignment via CLI (`--user_name`, `--strategy_name`, `--device_group_name`)

---

## 7. Groups & ACL

### User Groups
- Create, edit, delete user groups
- Cross-group access control: explicitly allow which groups can access each other
- Group membership management

### Device Groups (v1.5.0+)
- Each device can belong to one device group
- ACL based on device groups (restrict which users/groups can access which device groups)
- Strategy assignment per device group
- Device group tokens and expanded user token API (v1.7.2+)
- Cannot delete device group if devices are assigned (v1.5.2+)

### ACL Hierarchy
- **User-level ACL:** Per-user access permissions
- **User Group ACL:** Group-to-group access rules
- **Device Group ACL:** Device group access restrictions
- Combined for granular, multi-dimensional access control

---

## 8. Admin Roles (RBAC)

Introduced in v1.7.3 with granular permissions. Only full administrators can create/edit admin roles.

### Three Role Types
| Type | Scope |
|------|-------|
| **Global** | All resources across the entire team |
| **Individual** | Only the user's own devices and audit logs |
| **Group Scoped** | Users and devices within specified groups |

### Permission Categories (Global roles)

**User Management (12+ permissions):**
- View, Create, Invite, Delete
- Enable/Disable
- Edit Email, Edit Password, Edit Note
- Manage 2FA, Force Logout
- Update Group, Update Strategy, Update Control Role

**Device Management (7 permissions):**
- View, Enable/Disable, Delete
- Edit Info, Assign to User
- Update Group, Update Strategy

**Resource Administration (10 permissions):**
- User Groups: View, Edit
- Device Groups: View, Edit, Update Strategy
- Audit Logs: View, Edit
- Strategies: View, Edit
- Control Roles: View, Edit
- Custom Clients: View, Edit

### Permission Rules
1. **Edit includes view** - editing a resource automatically grants view permission
2. **Edit excludes assignment** - editing resources doesn't grant assignment rights
3. **View excludes members** - viewing a group doesn't show its members

### Multiple Roles
Users can hold multiple roles; permissions are combined (union).

---

## 9. Control Roles

Control what a connecting user can do during an active remote session. Distinct from access control (can you connect?) and strategies (device-side settings).

### Built-In Roles
- **Not Logged** - applies to unauthenticated users (cannot be manually assigned)
- **Default** - applies to authenticated users without an explicit role

### 12 Configurable Permissions
Each can be: **Use Client Settings** | **Enable** | **Disable**

1. Keyboard/Mouse
2. Remote Printer
3. Clipboard
4. File Transfer
5. Audio
6. Camera
7. Terminal
8. TCP Tunnel
9. Remote Restart
10. Recording Session
11. Block User Input
12. Remote Configuration Modification

### Scoped Access Levels (v1.7.3+)
- View-Only
- Full Control
- File Transfer
- Camera
- Audio
- TCP Tunnel
- Recording
- Terminal

### Requirements
- Controlled device: RustDesk 1.4.5+ (Android not supported)
- Controlling device: No version restriction

---

## 10. Strategies (Policy Engine)

Bulk-push client security/configuration settings to devices.

### Strategy Priority (highest to lowest)
1. **Device Strategy** - assigned directly to a device
2. **User Strategy** - assigned to a user (applies to their devices)
3. **Device Group Strategy** - assigned to a device group

### Management
- Create, enable/disable, rename, duplicate, delete strategies
- Assign to: specific devices, users, or device groups
- Monitor active device count per strategy
- Sync within 30 seconds of modification
- Timestamp-based comparison for update detection

### Pushable Settings
All settings from the [Client Advanced Settings](#17-client-advanced-settings-strategy-pushable) section can be pushed via strategies, including security, display, general, and network settings.

---

## 11. Address Books

- Create shared address books
- Granular sharing permissions: read-only, read-write, admin (per group or per user)
- Personal address books
- Peer management: add, update, delete peers within address books
- Tag management within address books
- Batch peer tag assignment (v1.7.0+)
- Batch peer/device/user note editing (v1.7.0+)
- Preset address book parameters (Pro >= 1.6.0, custom2 license):
  - `preset-address-book-name`
  - `preset-address-book-tag`
  - `preset-address-book-alias` (v1.4.3+)
  - `preset-address-book-password` (v1.4.3+)
  - `preset-address-book-note` (v1.4.3+)
- Allow/disallow non-admin address book sharing (configurable)
- No peer alias length restriction (v1.7.6+)
- Sync address book with recent sessions

---

## 12. Audit & Logging

### Log Types
- **Connection audit logs** - track remote control sessions (who connected to whom, when, duration)
- **File transfer logs** - track files transferred between clients (direction, path)
- **Console audit logs** - admin actions in the web console
- **Alarm logs** - security events (e.g., IPv6 prefix attempts, v1.6.7+)

### Audit Fields
- Connection ID, session ID, UUID
- Source/destination device IDs
- IP addresses
- Timestamps (start, end, duration column added v1.7.2+)
- Action type (Remote control=0, File transfer=1, TCP tunnel=2)
- Notes

### Capabilities
- View, filter, sort, export logs
- RBAC-controlled access to audit logs
- Duration column (v1.7.2+)

---

## 13. Custom Client Generator

Available in Basic plan and above.

### Customizable Elements
- Application name
- Icon
- Logo (light and dark theme options requested but may not be fully supported)
- Preset configuration (server address, key, etc.)
- Preset settings
- Branding

### Platform Support
- Windows x64
- Windows x86/32-bit (v1.6.8+)
- macOS Arm64 / x64
- Linux
- Android Arm64

### Features
- Generate branded executables from the web console
- Pre-configure server connection details
- Embed preset strategies/settings
- MSI installer support (with known branding issues reported)

---

## 14. Web Client

- Self-hosted web client accessible at `https://yourserver/web`
- Web Client V2 (preview since Oct 2024):
  - Improved decoding capabilities
  - International keyboard support
  - Text and image clipboard support
  - File transfer
  - Feature parity with desktop client (within browser limitations)
- Requires WebSocket Secure (WSS) on ports 21118/21119
- Web client version updates tracked per release (1.4.3, 1.4.4, etc.)
- Available to paying subscribers

---

## 15. Relay Server Management

- Configure multiple relay servers with geographic settings
- Automatic relay selection based on proximity
- Distributed relay infrastructure
- Explicit relay configuration when hbbr is on a different machine or non-default port
- Server performance: ~1000 concurrent relay connections per 1 CPU core / 1GB RAM
- Public ID server benchmark: 1M+ endpoints on 2 CPU / 4GB system

---

## 16. Settings & Configuration

### Server Settings (accessible from Settings page)
- **License management** - add/modify license keys
- **Relay server configuration** - add multiple relay servers
- **SMTP configuration** - email server settings for notifications/2FA
- **OIDC configuration** - SSO identity provider setup
- **LDAP configuration** - directory service integration
- **2FA enforcement** - global 2FA policy
- **HTTPS configuration** - automatic HTTPS on port 21114 (v1.6.7+)
- **API tokens** - generate tokens for programmatic access (read/write for user/device/audit/ab)

### Required Ports
| Port | Protocol | Purpose |
|------|----------|---------|
| 21114 | TCP | Web console / REST API |
| 21115 | TCP | NAT type test |
| 21116 | TCP+UDP | ID/Rendezvous server (UDP), relay (TCP) |
| 21117 | TCP | Relay |
| 21118 | TCP | WebSocket for web client |
| 21119 | TCP | WebSocket for web client |

---

## 17. Client Advanced Settings (Strategy-Pushable)

These settings can be configured per-client or pushed centrally via strategies. There are 100+ configurable settings across these categories:

### Security Settings
- `access-mode` (custom/full/view)
- `enable-keyboard`, `enable-clipboard`, `enable-file-transfer`, `enable-camera`, `enable-terminal`
- `enable-remote-printer`, `enable-audio`, `enable-tunnel`, `enable-remote-restart`
- `enable-record-session`, `enable-block-input`, `allow-remote-config-modification`
- `enable-lan-discovery`, `direct-server`, `direct-access-port`
- `whitelist` (IP whitelist)
- `allow-auto-disconnect`, `auto-disconnect-timeout`
- `allow-only-conn-window-open`
- `approve-mode` (password/click/password-click)
- `verification-method` (temporary/permanent/both passwords)
- `temporary-password-length` (6/8/10)
- `one-way-clipboard-redirection`, `one-way-file-transfer`
- `allow-logon-screen-password`
- `disable-change-permanent-password`, `disable-change-id`, `disable-unlock-pin`

### General Settings
- `theme` (dark/light/system)
- `lang` (20+ languages)
- `allow-auto-record-incoming`, `allow-auto-record-outgoing`
- `video-save-directory`
- `allow-auto-update`
- `enable-abr` (adaptive bitrate)
- `enable-hwcodec` (hardware encoding)
- `peer-card-ui-type`, `peer-sorting`
- `sync-ab-with-recent-sessions`

### Display/Session Settings
- `view-only`, `show-monitors-toolbar`, `collapse-toolbar`
- `show-remote-cursor`, `follow-remote-cursor`, `follow-remote-window`
- `zoom-cursor`, `show-quality-monitor`
- `disable-audio`, `enable-file-copy-paste`, `disable-clipboard`
- `lock-after-session-end`, `privacy-mode`
- `i444` (true color), `reverse-mouse-wheel`, `swap-left-right-mouse`
- `displays-as-individual-windows`, `use-all-my-displays-for-the-remote-session`
- `view-style`, `scroll-style`, `image-quality`, `custom-image-quality`, `custom-fps`
- `codec-preference` (auto/vp8/vp9/av1/h264/h265)

### Network Settings
- `proxy-url`, `proxy-username`, `proxy-password`
- `relay-server`
- `allow-websocket`, `disable-udp`
- `enable-udp-punch`, `enable-ipv6-punch`
- `allow-insecure-tls-fallback`

### UI Hiding/Lockdown
- `hide-security-settings`, `hide-network-settings`, `hide-server-settings`
- `hide-proxy-settings`, `hide-websocket-settings`, `hide-remote-printer-settings`
- `hide-username-on-card`, `hide-help-cards`, `hide-tray`
- `disable-group-panel`, `disable-discovery-panel`

### Preset/Assignment
- `preset-user-name`, `preset-strategy-name`
- `preset-device-group-name`, `preset-device-username`, `preset-device-name`
- `preset-note`, `display-name`
- `register-device` (Pro v1.6.0+)

---

## 18. API Surface

### Architecture
- **Port 21114:** Server management REST API (web console backend), JWT/API-key authentication
- **Port 21121:** RustDesk Client API (login, heartbeat, sysinfo, audit reporting)
- **Interactive docs:** Rapidoc at `/api/doc` (in sctgdesk implementation; official Pro may differ)

### Client API Endpoints (`/api/*`)

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | `/api/login` | No | User authentication |
| POST | `/api/system/heartbeat` | Yes | Device heartbeat (id, uuid, ver, conns) |
| POST | `/api/system/sysinfo` | Yes | Report device system info (cpu, hostname, memory, os) |
| POST | `/api/audit` | No | Log audit events (connection, file transfer, tunnel) |

### Admin/Console API Endpoints (`/admin/*`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/admin/auth/login` | Admin authentication |
| GET | `/admin/auth/captcha` | Login CAPTCHA |
| GET | `/admin/users/list` | List all users (paginated) |
| POST | `/admin/users/add` | Create user |
| POST | `/admin/users/edit` | Modify user |
| POST | `/admin/users/delete` | Delete user |
| POST | `/admin/users/totp` | Configure user 2FA |
| GET | `/admin/sessions/list` | View active sessions |
| POST | `/admin/sessions/terminate` | Force logout session |
| GET | `/admin/audit/list` | View audit logs |
| GET | `/admin/audit/file-transfer-list` | View file transfer logs |
| GET | `/admin/email/templates/list` | View email templates |
| POST | `/admin/email/templates/add` | Create email template |
| POST | `/admin/email/templates/edit` | Modify email template |
| GET | `/admin/email/logs/list` | View email sending history |

### API Token Permissions
Tokens support read/write access scoped to:
- Users
- Devices
- Audit logs
- Address books (ab)

### CLI Management
Python CLI scripts available for programmatic control of:
- Users, groups, devices
- Address books
- Strategies
- Audit logs

---

## 19. Release History & Changelog

### v1.7.6 (2026-03-05, pre-release)
- Avatar and display name on controlled side
- OIDC config persistence hardening and token exchange fixes
- SMTP OAuth2/XOAuth2 support
- No address book peer alias length restrictions
- IPv4-mapped IPv6 address comparison fix
- Configurable 2FA issuer name
- Private key backup on update

### v1.7.5 (2026-01-18)
- Account page updates when 2FA enabled
- 2FA verification skip for strategy/control role updates

### v1.7.4 (2026-01-17)
- Fix: admin reading all users/groups for address book share rules

### v1.7.3 (2026-01-14)
- **Admin Console Roles** (granular RBAC)
- **Device Control Roles** with scoped access
- Device name sync option
- OIDC improvements (2FA redirect, scope refactoring, ADFS fixes)

### v1.7.2 (2025-11-19)
- Custom client for Windows x86
- Device group tokens and expanded user token API
- Custom web client capability
- Audit duration column
- Web client upgraded to 1.4.4

### v1.7.1 (2025-10-17)
- Preset info only updates if missing/empty
- Web client 1.4.3

### v1.7.0 (2025-10-16)
- SMTP TLS with plain text fallback
- Batch address book peer tag setting
- Batch peer/device/user note functionality

### v1.6.9 (2025-10-13)
- Fix: custom client Windows 32-bit edit page

### v1.6.8 (2025-10-11)
- Windows 32-bit custom client support
- Keycloak and GitLab group mapping
- UI consolidation (login verification merged into status column)
- Command menu reorganization

### v1.6.7 (2025-10-06)
- Enforced 2FA with forced logout
- OIDC group mapping (Okta/Azure)
- IPv6 prefix attempt alarm logging
- Automatic HTTPS 21114 configuration
- Duplicate column display fix

### v1.5.0 (2025-02)
- **Device groups** and device group ACL
- **User-grained ACL**
- Strategy on device group
- Sortable tables
- OIDC improvements

### v1.5.2
- Fix: deleting device group now properly unassigns devices
- Prevent deletion of device groups in use

---

## 20. Community / Open-Source Alternatives

### BetterDesk Console (UNITRONIX/Rustdesk-FreeConsole)
- **URL:** https://github.com/UNITRONIX/Rustdesk-FreeConsole
- **Stack:** Node.js / Express.js
- **Features:**
  - Dashboard with real-time stats (total/active/inactive/banned devices)
  - Live hardware monitoring (CPU, RAM, disk with history charts)
  - Device management (search, filter, sort, notes, ban/unban, change ID)
  - One-click desktop connection via `rustdesk://` URI
  - TOTP-based 2FA
  - RBAC with Admin, Operator, Viewer roles
  - CSRF protection
  - Full address book storage
  - WebSocket real-time status
  - i18n (English, Polish)
  - Full PostgreSQL backend
  - Multi-instance sync via PostgreSQL LISTEN/NOTIFY
  - Single binary (replaces hbbs + hbbr)
  - Built-in REST API with JWT and API key auth

### sctgdesk-api-server (sctg-development)
- **URL:** https://github.com/sctg-development/sctgdesk-api-server
- **Stack:** Rust / Rocket framework
- **License:** AGPL-3.0
- **Features:**
  - OpenAPI documentation via Rapidoc at `/api/doc`
  - Vue.js web console at `/ui`
  - Address book management with granular permissions
  - OAuth2 authentication (GitHub, Dex)
  - S3 integration for client downloads
  - Compatible with RustDesk Server/Pro SQLite3 databases
  - Standalone or integrated as a crate
- **Status:** Under development, not production-ready

### rustdesk-api-server-pro (lantongxue)
- **URL:** https://github.com/lantongxue/rustdesk-api-server-pro
- **Stack:** Go backend, TypeScript/Vue frontend
- **Features:**
  - Statistics/dashboard panel
  - User management
  - 2FA and email verification
  - Session management and monitoring
  - Audit logging
  - i18n support
  - SQLite (default) or MySQL
  - Docker deployment
- **Status:** 255+ stars, active development

---

## Summary of All Console Capabilities

### Core Management
1. User CRUD with full lifecycle management
2. Device browsing, filtering, assignment, enable/disable/delete
3. User group creation with cross-group access rules
4. Device group creation with ACL policies
5. Address book management with sharing and permissions
6. Strategy (policy) engine for centralized client configuration

### Security & Access Control
7. Multi-dimensional ACL (user-level, user-group, device-group)
8. Admin roles with granular RBAC (Global, Individual, Group-scoped)
9. Control roles for session-level permissions (12 permission types)
10. 2FA (TOTP + email) with enforcement and trusted devices
11. OIDC SSO with major identity providers
12. LDAP/AD integration
13. IP whitelisting
14. Connection approval modes (password, click, both)

### Monitoring & Compliance
15. Connection audit logs
16. File transfer logs
17. Console action audit trail
18. Alarm logging (security events)
19. Session monitoring and forced logout

### Deployment & Branding
20. Custom client generator (Windows x64/x86, macOS, Linux, Android)
21. Web client (V2) with file transfer and clipboard
22. Multiple relay server configuration
23. WebSocket support
24. HTTPS auto-configuration

### API & Automation
25. REST API on port 21114 (JWT/API-key auth)
26. Client API on port 21121 (heartbeat, sysinfo, audit)
27. API tokens with scoped permissions
28. CLI management tools (Python scripts)
29. Token-based device assignment via RustDesk executable

### Configuration
30. 100+ pushable client settings via strategies
31. Security, display, general, network, and UI lockdown options
32. SMTP email configuration with OAuth2 support
33. License management
34. Server-level settings management

---

## Sources

- https://rustdesk.com/pricing.html
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/console/
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/admin-role/
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/control-role/
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/strategy/ (inferred from docs)
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/2fa/
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/oidc/
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/ldap/
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/faq/
- https://rustdesk.com/docs/en/self-host/client-configuration/advanced-settings/
- https://rustdesk.com/blog/2025/02/enhanced-acl-in-rustdesk-server-pro-1-5-0/
- https://rustdesk.com/blog/2024/10/rustdesk-web-client-v2-preview/
- https://github.com/rustdesk/rustdesk-server-pro/releases
- https://github.com/UNITRONIX/Rustdesk-FreeConsole
- https://github.com/sctg-development/sctgdesk-api-server
- https://github.com/lantongxue/rustdesk-api-server-pro
- https://deepwiki.com/lantongxue/rustdesk-api-server-pro/11-api-reference
