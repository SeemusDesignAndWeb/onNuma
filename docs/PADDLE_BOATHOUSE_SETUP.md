# Paddle and Boathouse setup

This document describes the environment variables and dashboard setup required for subscription billing with Paddle (payments) and Boathouse (billing portal and pricing UX).

## Environment variables

Add these to your `.env` (and to Railway or your production env). Do not commit real secrets.

### Paddle

| Variable | Description |
|----------|-------------|
| `PADDLE_API_KEY` | Server-side API key for creating checkouts and API calls. From Paddle Dashboard → Developer Tools → Authentication. |
| `PADDLE_WEBHOOK_SECRET` | Endpoint secret for the notification destination used to verify webhook signatures. From Paddle Dashboard → Developer Tools → Notifications → your webhook → Secret key. |
| `PADDLE_ENVIRONMENT` | `sandbox` or `production`. Use `sandbox` for testing; API base URL is chosen automatically. |

### Boathouse

| Variable | Description |
|----------|-------------|
| `BOATHOUSE_PORTAL_ID` | Your Boathouse portal ID from the Boathouse dashboard. |
| `BOATHOUSE_SECRET` | Secret for the portal from the Boathouse dashboard. |

### Price IDs (Paddle)

The app maps Paddle price IDs to plan tiers. Configure these so the webhook can set the correct plan:

| Variable | Description |
|----------|-------------|
| `PADDLE_PRICE_ID_PROFESSIONAL` | Paddle price ID for the Professional plan (e.g. `pri_xxxx`). |
| `PADDLE_PRICE_ID_ENTERPRISE` | Paddle price ID for the Enterprise plan (e.g. `pri_xxxx`). |

If these are not set, checkout and webhook logic can still run but plan mapping may need to be done by product/price name or a config file.

## Paddle Dashboard setup

1. **Products and prices**  
   Create two products (or one product with two prices) for **Professional** and **Enterprise**. Note the **price IDs** (e.g. `pri_01h...`) and set `PADDLE_PRICE_ID_PROFESSIONAL` and `PADDLE_PRICE_ID_ENTERPRISE`.

2. **Notification destination (webhook)**  
   - Go to **Developer Tools → Notifications**.  
   - Create a new destination, type **URL**.  
   - URL: `https://your-domain.com/api/webhooks/paddle` (use your real app URL).  
   - Subscribe to at least:  
     - `subscription.created`  
     - `subscription.activated`  
     - `subscription.updated`  
     - `subscription.canceled`  
     - `subscription.past_due`  
   - Copy the **Secret key** and set it as `PADDLE_WEBHOOK_SECRET`.

3. **API key**  
   Create an API key with permissions needed for **Transactions** (create transaction) and optionally **Customers**. Set it as `PADDLE_API_KEY`.

4. **Checkout success URL**  
   In Paddle Checkout settings (or default payment link), set the success return URL to `https://your-domain.com/hub/settings?billing=success` so users land back on Settings with a success message.

## Boathouse setup

1. Sign up at [Boathouse](https://www.boathouse.co/) and connect your Paddle account (API key).  
2. Create a portal and configure products/pricing to match your Paddle products.  
3. In the Boathouse dashboard, get the **Portal ID** and **Secret** and set `BOATHOUSE_PORTAL_ID` and `BOATHOUSE_SECRET`.

## Webhook URL summary

- **Paddle webhook:** `POST https://<your-app-domain>/api/webhooks/paddle`  
  Paddle will send subscription (and optionally transaction) events here. The app verifies the `Paddle-Signature` header and updates the organisation’s subscription state and plan.

## Optional: public pricing page

For a public pricing page you can call the Boathouse API (with a generic or logged-in user email) to get `pricingTableHtml` and embed it. Add Paddle.js as per Boathouse docs for checkout to work from the pricing table.
