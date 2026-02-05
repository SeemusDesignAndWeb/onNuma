# Hub custom domains (multi-org)

Each organisation can have its own Hub URL (e.g. `https://hub.egcc.co.uk`). Users visit that URL to log in and use the Hub; the app resolves the organisation from the request host and scopes all data to that org.

## Multi-org admin subdomain (e.g. admin.onnuma.com)

You can serve the **Multi-org** area (organisation management) on its own subdomain so that `admin.yourdomain.com` shows the Multi-org dashboard at the root, without `/multi-org` in the URL.

1. **Set the domain in env**  
   Add to `.env` (and your host’s env, e.g. Railway):
   ```bash
   MULTI_ORG_ADMIN_DOMAIN=admin.onnuma.com
   ```
   Use the hostname only (no `https://` or port). For local testing you can use e.g. `admin.onnuma.local` and add it to `/etc/hosts`.

2. **DNS**  
   Point the subdomain (e.g. `admin.onnuma.com`) at your app. For Railway, add it as a custom domain in the project; the app will receive requests with `Host: admin.onnuma.com`.

3. **Behaviour**  
   When a request’s host matches `MULTI_ORG_ADMIN_DOMAIN`:
   - `admin.onnuma.com/` → Multi-org dashboard (same as `/multi-org`)
   - `admin.onnuma.com/auth/login` → Multi-org login
   - `admin.onnuma.com/organisations` → Organisations list  
   All links and redirects stay on the admin subdomain (e.g. `/auth/logout`, `/organisations/new`).  
   The main site (e.g. `onnuma.com`) stays unchanged and can host the front-facing website.

4. **If you get 404 on admin.yourdomain.com/auth/login**  
   - **Set the env var in production**: `MULTI_ORG_ADMIN_DOMAIN` must be set on the server (e.g. in Railway → your service → Variables). If it’s missing, the app won’t rewrite `/auth/login` to `/multi-org/auth/login`, so no route matches and you get 404.  
   - **Host header**: The app checks `Host` and `X-Forwarded-Host` (for proxies). Ensure your host forwards the original host; when you add the custom domain, that’s usually automatic.

## Where to set the Hub domain in MultiOrg

1. Log in to **MultiOrg** at `/multi-org` (e.g. `http://localhost:5173/multi-org`).
2. Open **Organisations** (click “Organisations” or go to `/multi-org/organisations`).
3. Either:
   - **Edit an existing org**: click **Edit** on the organisation row, or open `/multi-org/organisations/[id]` for that org.
   - **Create a new org**: click “Add organisation” or go to `/multi-org/organisations/new`.
4. On the organisation form you’ll see a **Hub domain** field (under “Contact name”). Enter the hostname only, e.g. `hub.egcc.local` or `hub.egcc.co.uk` (no `https://` or port).
5. Save the form. The hostname must be unique across all organisations.

The `/etc/hosts` and DNS steps are done on your Mac or in your DNS provider — not in the MultiOrg dashboard.

---

## Local development (Mac)

To test custom hub domains on your Mac without DNS or Railway:

1. **Pick a local hostname**  
   Use something that won’t conflict with real domains, e.g. `hub.egcc.local` or `hub.egcc.test`.

2. **Edit `/etc/hosts`**  
   Add a line so that hostname points to your machine:
   ```text
   127.0.0.1   hub.egcc.local
   ```
   To edit (needs admin):
   ```bash
   sudo nano /etc/hosts
   ```
   Save and exit (Ctrl+O, Enter, Ctrl+X in nano).

3. **Set the org’s Hub domain in MultiOrg**  
   In MultiOrg → Organisations → [Edit org], set **Hub domain** to the same hostname (e.g. `hub.egcc.local`). No port — the app strips the port when matching.

4. **Run the app and open the custom host**  
   Start the dev server (`npm run dev`), then in the browser go to:
   ```text
   http://hub.egcc.local:5173/hub
   ```
   (Use the port your dev server uses, e.g. 5173 for Vite.) The app will see `Host: hub.egcc.local:5173`, match `hub.egcc.local` to the org, and serve that org’s Hub.

5. **Multiple orgs locally**  
   Add more lines to `/etc/hosts` and more Hub domains in MultiOrg, e.g.:
   ```text
   127.0.0.1   hub.egcc.local
   127.0.0.1   hub.otherchurch.local
   ```
   Then use `http://hub.egcc.local:5173/hub` and `http://hub.otherchurch.local:5173/hub` to hit each org.

**Without a custom host** (e.g. `http://localhost:5173/hub`), the app uses the default org from “Set as Hub” in MultiOrg, not a hub domain.

---

## Setup (production)

1. **Organisation hub domain**  
   In MultiOrg → Organisations → [Edit org], set **Hub domain** (e.g. `hub.egcc.co.uk`). It must be a valid hostname and unique across organisations.

2. **DNS**  
   Point the host (e.g. `hub.egcc.co.uk`) to your app. For Railway, add a custom domain in the project settings and set a CNAME (or A/AAAA) as Railway instructs.

3. **Railway**  
   In the Railway project, add the domain (e.g. `hub.egcc.co.uk`) as a custom domain so the service receives requests with `Host: hub.egcc.co.uk`. The app then matches that host to the organisation and serves that org’s Hub.

## How it works

- **Resolution**  
  On each request to `/hub` or `/signup/*`, the app reads the `Host` header, normalises it (lowercase, no port), and looks up an organisation whose `hubDomain` (stored in `organisations.ndjson`) matches. If there is a match, that organisation is used for the whole request and cannot be overridden.

- **Security**
  - Organisation is determined **only** from the request host, matched against the server-side list of `hubDomain` values. Query parameters and cookies are **not** used to choose the organisation when the host matches a hub domain.
  - When the host matches a hub domain, the current org is fixed for that request; there is no way for the client to switch to another org on that host.
  - Session cookies are origin-bound. A session created at `hub.egcc.co.uk` does not apply to `hub.otherchurch.org` or the main app URL.
  - To avoid domain spoofing, ensure your deployment (e.g. Railway) sets the `Host` header from the actual request (which it does when you add a custom domain). Do not forward a client-supplied Host from an untrusted proxy without validation.

- **Default URL**  
  When the request host does **not** match any organisation’s `hubDomain`, the app uses the default org from Hub settings (the one chosen via “Set as Hub” in MultiOrg). That allows the main app URL (e.g. `yourapp.railway.app`) to work for a single “current” org.

## Security summary

- **No mimicking**: Org is derived only from the request host against a server-side allowlist (`hubDomain` per org). Clients cannot pass an org id or cookie to access a different org’s Hub.
- **No override**: On a custom hub domain, the org is fixed for the request; `hub_settings.currentOrganisationId` and URL params are ignored for org resolution.
- **Origin-bound sessions**: Hub login at one host does not grant access on another host.

## Files

- `src/lib/crm/server/hubDomain.js` – host normalisation, `hubDomain` validation, resolve org from host; `MULTI_ORG_ADMIN_DOMAIN` check and `getMultiOrgPublicPath()` for admin subdomain.
- `src/lib/crm/server/requestOrg.js` – request-scoped org (AsyncLocalStorage) so `getCurrentOrganisationId()` uses the domain’s org.
- `src/hooks.server.js` – `multiOrgAdminDomainHandle`: when host is `MULTI_ORG_ADMIN_DOMAIN`, rewrites `/` and `/auth/*`, `/organisations/*` to `/multi-org/*`.
- `src/lib/crm/server/hook-plugin.js` – for `/hub` and `/signup`, resolves org from host; for `/multi-org`, uses public path for redirects when on admin subdomain.
- Organisation `hubDomain` is stored in `data/organisations.ndjson` and edited in MultiOrg (organisation create/edit).
