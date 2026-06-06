# Entra ID (Azure AD) OIDC/SSO for RustDesk Server Pro

> Researched: 2026-03-07
> Sources: Official RustDesk docs, GitHub discussions, Authelia/authentik integration docs

## Prerequisites

- RustDesk Server Pro (not OSS) with a valid license
- Admin access to the RustDesk Pro web console
- Admin access to Microsoft Entra ID (Azure AD) portal
- RustDesk Pro web console must be accessible via **HTTPS** or **http://localhost** (Azure requirement for redirect URIs)

---

## Part 1: Azure / Entra ID App Registration

### Step 1: Create the App Registration

1. Sign in to the [Azure Portal](https://portal.azure.com)
2. Search for and select **Microsoft Entra ID**
3. In the left menu, select **App registrations** > **New registration**
4. Fill in:
   - **Name**: `Aspendora Remote` (or any descriptive name)
   - **Supported account types**: Choose based on your needs:
     - "Accounts in this organizational directory only" (single tenant - most common for MSP)
     - "Accounts in any organizational directory" (multi-tenant)
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://<your-rustdesk-pro-console>/api/oidc/callback`
     - Example: `https://rd.aspendora.com:21114/api/oidc/callback`
5. Click **Register**

### Step 2: Note the Application Credentials

From the app's **Overview** page, copy:
- **Application (client) ID** — this is your OIDC Client ID
- **Directory (tenant) ID** — needed for the Issuer URL

### Step 3: Create a Client Secret

1. Go to **Certificates & secrets** > **Client secrets** > **New client secret**
2. Add a description (e.g., "RustDesk Pro OIDC")
3. Choose an expiration period
4. Click **Add**
5. **IMMEDIATELY copy the secret Value** (it is shown only once)

### Step 4: Enable ID Tokens

1. Go to **Authentication** in the left menu
2. Under **Implicit grant and hybrid flows**, check:
   - **ID tokens (used for implicit and hybrid flows)**
3. Click **Save**

### Step 5: API Permissions (verify defaults)

The app registration should already have the default permission:
- **Microsoft Graph > User.Read** (Delegated)

This is sufficient. RustDesk uses the standard OIDC scopes (`openid`, `profile`, `email`) which do not require additional API permissions.

### Step 6: Token Configuration (Optional - for Group Claims)

If you want to map Azure AD groups to RustDesk groups (supported in RustDesk Pro 1.6.7+):

1. Go to **Token configuration** > **Add groups claim**
2. Select the group types to include (e.g., "Security groups")
3. For the **ID** token, choose "Group ID" as the claim format
4. Click **Add**

**Note on group mapping behavior** (as of v1.6.7):
- RustDesk reads group names from the OIDC ID token claim
- If multiple groups are present, it uses the **last** group in the list
- If the group name doesn't match an existing RustDesk group, it **auto-creates** one
- Azure may order groups unpredictably, so keep group assignments simple

---

## Part 2: RustDesk Server Pro Web Console Configuration

### Step 1: Access OIDC Settings

1. Sign in to the RustDesk Pro web console as admin
2. Navigate to **Settings** > **OIDC**
3. Note the **Callback URL** displayed (it is auto-generated and not editable)
   - Format: `<protocol>://<host>:<port>/api/oidc/callback`
   - The `api/oidc/callback` path is fixed
   - The protocol/host/port is derived from how you accessed the web console

### Step 2: Add New Auth Provider

1. Click **"+ New Auth Provider"**
2. In the popup, select **custom** as the Auth Type and click **OK**

### Step 3: Configure the Provider Fields

| Field | Value |
|-------|-------|
| **Name** | `Azure` or `Entra ID` (display name on the login button) |
| **Client ID** | The Application (client) ID from Azure Step 2 |
| **Client Secret** | The secret Value from Azure Step 3 |
| **Issuer** | `https://login.microsoftonline.com/<TENANT-ID>/v2.0` |

Replace `<TENANT-ID>` with your actual Directory (tenant) ID from Azure.

### Optional Fields

| Field | Value / Notes |
|-------|---------------|
| **Scopes** | Leave empty to use defaults (`openid,profile,email`), or explicitly set `openid,profile,email` |
| **Authorization Endpoint** | Usually auto-discovered from Issuer; if needed: `https://login.microsoftonline.com/<TENANT-ID>/oauth2/v2.0/authorize` |
| **Token Endpoint** | Usually auto-discovered from Issuer; if needed: `https://login.microsoftonline.com/<TENANT-ID>/oauth2/v2.0/token` |
| **Userinfo Endpoint** | Usually auto-discovered; if needed: `https://graph.microsoft.com/oidc/userinfo` |
| **JWKS Endpoint** | Usually auto-discovered; if needed: `https://login.microsoftonline.com/<TENANT-ID>/discovery/v2.0/keys` |

**Note**: RustDesk Pro supports OIDC discovery, so with a valid Issuer URL it should auto-discover all endpoints. You typically only need to fill in Client ID, Client Secret, and Issuer.

### Step 4: Save and Test

1. Save the configuration
2. Log out of the web console
3. The login page should now show a button for your OIDC provider (e.g., "Azure" or "Entra ID")
4. Click the button to test the SSO flow
5. You should be redirected to Microsoft's login page and back to RustDesk

---

## Part 3: Important Details and Gotchas

### Callback URL / Redirect URI

- The path is always `/api/oidc/callback` (non-configurable)
- Azure requires the redirect URI to use `https://` or `http://localhost`
- If your RustDesk Pro console is behind a reverse proxy with HTTPS, use that HTTPS URL
- Make sure the Callback URL shown in RustDesk matches EXACTLY what you put in Azure's Redirect URI

### User Provisioning

- Users are **auto-created** on first OIDC login
- New users have no permissions by default; an admin must grant access
- RustDesk Pro can automatically fetch the user's avatar from the OIDC provider (for new users only)

### OIDC Token Requirements

RustDesk expects the ID token to contain:
- `sub` (subject identifier)
- `email` (user's email address)
- `preferred_username` (display name)

These are standard OIDC claims included with the `openid`, `email`, and `profile` scopes.

### OIDC Protocol Details

- **Response Type**: `code` (Authorization Code flow)
- **Grant Type**: `authorization_code`
- **Token Endpoint Auth Method**: `client_secret_basic`
- **PKCE**: Not required (but may be supported)

### Client App Login

- If a user is already logged in via the RustDesk Pro web console, the desktop/mobile client can auto-login
- Users see an OIDC login option in the RustDesk client app

### Common Issues

1. **"Failed to verify ID token, Signature verification failed"**
   - Can happen after RustDesk Pro upgrades
   - Check container logs: `grep 'Failed to verify ID token'`
   - May be caused by Azure key rotation; restarting the RustDesk Pro container can help

2. **"failed to request the auth url"**
   - Usually means the Issuer URL is incorrect or unreachable from the server
   - Verify the tenant ID in the Issuer URL
   - Ensure the server can reach `login.microsoftonline.com` on port 443

3. **Redirect URI mismatch**
   - Ensure the Callback URL in RustDesk (shown in the OIDC settings page) exactly matches the Redirect URI in Azure
   - Watch for http vs https mismatches

---

## Part 4: Group Mapping (RustDesk Pro 1.6.7+)

As of version 1.6.7, RustDesk Pro supports OIDC group claims from Azure/Entra ID:

1. Configure group claims in Azure (see Part 1, Step 6)
2. Groups from the ID token are read by RustDesk
3. If a matching RustDesk group exists, the user is assigned to it
4. If no matching group exists, one is auto-created

**Current limitations**:
- Only the **last** group in the token claim list is used (no multi-group support)
- Group names must match between Azure and RustDesk (no custom name mapping yet)
- Azure may order groups unpredictably per user

**Workaround**: Create a dedicated security group in Azure specifically for RustDesk (e.g., "RustDesk-Users") and assign users to it, rather than relying on existing complex group memberships.

---

## Quick Reference: All Values at a Glance

```
Azure App Registration:
  Name:               Aspendora Remote
  Redirect URI:       https://<rustdesk-console>/api/oidc/callback
  Supported Accounts: Single tenant (recommended for MSP)
  ID Tokens:          Enabled (implicit grant)
  API Permissions:    Microsoft Graph > User.Read (default)

RustDesk Pro OIDC Settings:
  Auth Type:          custom
  Name:               Entra ID
  Client ID:          <Application (client) ID from Azure>
  Client Secret:      <Client secret Value from Azure>
  Issuer:             https://login.microsoftonline.com/<TENANT-ID>/v2.0
  Scopes:             openid,profile,email (default)
  Callback URL:       https://<rustdesk-console>/api/oidc/callback (auto-generated)
```
