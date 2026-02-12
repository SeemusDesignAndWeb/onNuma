# Paddle and Boathouse Setup – Per-Seat Pricing

This document describes how to set up subscription billing with **Paddle** (payments) and **Boathouse** (billing portal). OnNuma uses **per-seat (per-admin-user) pricing** — the subscription quantity automatically tracks the number of admin users in the Hub.

---

## How Per-Seat Pricing Works

| Event | What happens |
|-------|--------------|
| **New checkout** | The app counts the current admin users and sends that number as the `quantity` to Paddle when creating the transaction. |
| **Admin added** | After the new admin is created, the app calls Paddle's Update Subscription API to increase the quantity. Paddle prorates the charge immediately. |
| **Admin removed** | After the admin is deleted, the app calls Paddle's Update Subscription API to decrease the quantity. Paddle prorates the credit immediately. |
| **Paddle webhook** | When Paddle sends a subscription event (created, updated, etc.) the app reads the `quantity` from the payload and stores it on the organisation record as `paddleSeatQuantity`. |

The quantity is always **at least 1** (even if no admins exist yet).

### Code locations

| File | Role |
|------|------|
| `src/lib/crm/server/paddle.js` | Shared utility: `getAdminSeatCount()`, `syncSubscriptionQuantity()`, `getPaddleBaseUrl()` |
| `src/routes/hub/api/checkout/+server.js` | Creates a Paddle checkout transaction with `quantity = adminCount` |
| `src/routes/hub/users/new/+page.server.js` | Calls `syncSubscriptionQuantity()` after creating an admin |
| `src/routes/hub/users/[id]/+page.server.js` | Calls `syncSubscriptionQuantity()` after deleting an admin |
| `src/routes/api/webhooks/paddle/+server.js` | Receives Paddle webhook events and stores `paddleSeatQuantity` |

---

## Environment Variables

Add these to your `.env` (and to Railway or your production environment). **Do not commit real secrets.**

### Paddle

| Variable | Description |
|----------|-------------|
| `PADDLE_API_KEY` | Server-side API key for creating checkouts and updating subscriptions. From Paddle Dashboard → Developer Tools → Authentication. |
| `PADDLE_WEBHOOK_SECRET` | Endpoint secret used to verify webhook signatures. From Paddle Dashboard → Developer Tools → Notifications → your webhook → Secret key. |
| `PADDLE_ENVIRONMENT` | `sandbox` or `production`. Use `sandbox` for testing; the API base URL is chosen automatically. |

### Price IDs (Paddle)

The app maps Paddle price IDs to plan tiers. These **must** be set for checkout and webhook plan-mapping to work correctly:

| Variable | Description |
|----------|-------------|
| `PADDLE_PRICE_ID_PROFESSIONAL` | Paddle price ID for the **Professional** plan (e.g. `pri_01hxxxxxx`). |
| `PADDLE_PRICE_ID_ENTERPRISE` | Paddle price ID for the **Enterprise** plan (e.g. `pri_01hxxxxxx`). |

### Boathouse

| Variable | Description |
|----------|-------------|
| `BOATHOUSE_PORTAL_ID` | Your Boathouse portal ID from the Boathouse dashboard. |
| `BOATHOUSE_SECRET` | Secret for the portal from the Boathouse dashboard. |

---

## Paddle Dashboard Setup (Step-by-Step)

### 1. Create Products and Per-Seat Prices

1. Go to **Paddle Dashboard → Catalog → Products**.
2. Create **one product** (e.g. "OnNuma Hub") — or two separate products if you prefer.
3. For each plan tier, add a **price** on the product:

#### Professional Price

| Setting | Value |
|---------|-------|
| Name | Professional (per seat) |
| Price | Your monthly per-seat price (e.g. **£5.00 / month**) |
| Billing period | Monthly (or Annual — your choice) |
| Quantity | **Enable quantity** — this is critical for per-seat billing |

#### Enterprise Price

| Setting | Value |
|---------|-------|
| Name | Enterprise (per seat) |
| Price | Your monthly per-seat price (e.g. **£10.00 / month**) |
| Billing period | Monthly (or Annual — your choice) |
| Quantity | **Enable quantity** |

4. Copy the **price IDs** (they look like `pri_01hxxxxxx`) and set them in your environment:
   ```
   PADDLE_PRICE_ID_PROFESSIONAL=pri_01h...
   PADDLE_PRICE_ID_ENTERPRISE=pri_01h...
   ```

> **Important:** The prices must be set as **per-unit** prices (not flat-rate). Paddle will multiply the unit price by the quantity your app sends. For example, if the Professional price is £5/month and the app sends `quantity: 3`, Paddle will charge £15/month.

### 2. Create an API Key

1. Go to **Developer Tools → Authentication**.
2. Click **Generate API Key**.
3. The key needs permissions for:
   - **Transactions** — create (for checkout)
   - **Subscriptions** — read and update (for seat quantity sync)
   - **Customers** — read (optional, for lookup)
4. Copy the key and set it as `PADDLE_API_KEY`.

### 3. Set Up the Webhook (Notification Destination)

1. Go to **Developer Tools → Notifications**.
2. Click **Create destination** → type **URL**.
3. Set the URL to:
   ```
   https://your-domain.com/api/webhooks/paddle
   ```
   Replace `your-domain.com` with your actual production domain.
4. Subscribe to these events (minimum):
   - `subscription.created`
   - `subscription.activated`
   - `subscription.updated`
   - `subscription.canceled`
   - `subscription.past_due`
   - `subscription.paused` (optional)
   - `subscription.resumed` (optional)
   - `subscription.trialing` (optional)
5. Copy the **Secret key** and set it as `PADDLE_WEBHOOK_SECRET`.

### 4. Configure Checkout Settings

In **Checkout → Settings** (or on the default payment link):
- Set the **Success URL** to:
  ```
  https://your-domain.com/hub/settings?billing=success
  ```
  This returns users to the Hub Settings page with a success indicator after payment.

### 5. Test in Sandbox

1. Set `PADDLE_ENVIRONMENT=sandbox` in your `.env`.
2. Use Paddle's sandbox test card numbers to complete a checkout.
3. Verify:
   - The checkout transaction has the correct `quantity` (matching your admin count).
   - After checkout, the webhook fires and the organisation record is updated with `paddleSubscriptionId`, `subscriptionPlan`, and `paddleSeatQuantity`.
   - Adding or removing an admin triggers a subscription update in Paddle (check the Paddle Dashboard → Subscriptions to see the quantity change).

---

## Boathouse Setup

Boathouse provides a billing portal where customers can manage their payment method, view invoices, and cancel.

1. Sign up at [Boathouse](https://www.boathouse.co/) and connect your Paddle account.
2. Create a portal and configure products/pricing to match your Paddle products.
3. In the Boathouse dashboard, copy the **Portal ID** and **Secret**.
4. Set them in your environment:
   ```
   BOATHOUSE_PORTAL_ID=...
   BOATHOUSE_SECRET=...
   ```

---

## Webhook URL Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/paddle` | POST | Receives subscription events from Paddle. Verifies the `Paddle-Signature` header and updates the organisation's plan, status, and seat quantity. |

---

## Per-Seat Quantity Flow (Technical Detail)

```
┌──────────────────────┐
│   Admin subscribes   │
│   (Hub Settings)     │
└──────────┬───────────┘
           │ GET /hub/api/checkout?plan=professional
           ▼
┌──────────────────────┐
│  Checkout API        │
│  counts admins → N   │
│  sends quantity: N   │──────► Paddle creates transaction
│  to Paddle           │        with N × unit price
└──────────────────────┘
           │
           ▼ (user pays in Paddle Checkout)
┌──────────────────────┐
│  Paddle fires        │
│  subscription.created│──────► POST /api/webhooks/paddle
│  webhook             │        stores plan + paddleSeatQuantity
└──────────────────────┘

┌──────────────────────┐
│  Admin added in Hub  │
│  /hub/users/new      │
└──────────┬───────────┘
           │ after createAdmin()
           ▼
┌──────────────────────┐
│  syncSubscription    │
│  Quantity()          │──────► PATCH /subscriptions/{id}
│  counts admins → N+1 │        quantity: N+1
│  updates Paddle      │        proration_billing_mode:
└──────────────────────┘          prorated_immediately
           │
           ▼
┌──────────────────────┐
│  Paddle fires        │
│  subscription.updated│──────► Webhook stores new quantity
└──────────────────────┘

┌──────────────────────┐
│  Admin removed       │
│  /hub/users/[id]     │
└──────────┬───────────┘
           │ after remove('admins', id)
           ▼
┌──────────────────────┐
│  syncSubscription    │
│  Quantity()          │──────► PATCH /subscriptions/{id}
│  counts admins → N-1 │        quantity: N-1
└──────────────────────┘
```

---

## Proration

When the seat count changes mid-billing-cycle, the app tells Paddle to prorate immediately (`proration_billing_mode: "prorated_immediately"`). This means:

- **Adding a seat** → the customer is charged a prorated amount for the remainder of the current billing period right away.
- **Removing a seat** → the customer receives a prorated credit applied to their next invoice.

If you prefer a different proration strategy, update the `proration_billing_mode` value in `src/lib/crm/server/paddle.js`. Paddle supports:

| Mode | Behaviour |
|------|-----------|
| `prorated_immediately` | Charge/credit now (default in OnNuma) |
| `prorated_next_billing_period` | Adjust on the next renewal |
| `full_immediately` | Charge the full new amount now |
| `full_next_billing_period` | Charge the full new amount at next renewal |
| `do_not_bill` | No charge — just update the quantity |

---

## Organisation Record Fields

After Paddle integration is active, the organisation document will contain:

| Field | Type | Description |
|-------|------|-------------|
| `paddleCustomerId` | string | Paddle customer ID |
| `paddleSubscriptionId` | string | Paddle subscription ID |
| `subscriptionStatus` | string | e.g. `active`, `canceled`, `past_due` |
| `subscriptionPlan` | string | `professional` or `enterprise` (null if free) |
| `currentPeriodEnd` | string (ISO) | Next billing date |
| `cancelAtPeriodEnd` | boolean | Whether the subscription cancels at period end |
| `paddleSeatQuantity` | number | Current seat quantity as reported by Paddle |
| `areaPermissions` | string[] | Hub areas unlocked by the plan |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Checkout shows quantity 1 | Check that `getAdminSeatCount()` in `paddle.js` is reading the admins collection correctly. |
| Quantity doesn't update when adding/removing admins | Verify the organisation has a `paddleSubscriptionId` and `subscriptionPlan` set. The sync is skipped if there's no active subscription. |
| Webhook returns 401 | Check `PADDLE_WEBHOOK_SECRET` matches the secret in Paddle Dashboard → Notifications → your destination. |
| Webhook doesn't fire | Ensure the webhook URL is publicly accessible. Paddle cannot reach `localhost`. Use ngrok or a staging deployment for testing. |
| "Billing not configured" in Hub | Set `PADDLE_API_KEY` and at least one of `PADDLE_PRICE_ID_PROFESSIONAL` or `PADDLE_PRICE_ID_ENTERPRISE`. |
| Proration charges seem wrong | Check the `proration_billing_mode` in `paddle.js`. Change it if your preferred behaviour differs. |
