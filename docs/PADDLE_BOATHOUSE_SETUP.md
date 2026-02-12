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

### Tiered pricing

Paddle Billing does not have a built-in tiered/volume pricing option on a single price. Instead, OnNuma uses **two separate prices per plan** with different quantity ranges:

| Tier | Seats | Env variable (Professional) | Env variable (Enterprise) |
|------|-------|-----------------------------|---------------------------|
| 1 | 1 – 300 | `PADDLE_PRICE_ID_PROFESSIONAL` | `PADDLE_PRICE_ID_ENTERPRISE` |
| 2 | 301+ | `PADDLE_PRICE_ID_PROFESSIONAL_TIER2` | `PADDLE_PRICE_ID_ENTERPRISE_TIER2` |

The app automatically selects the correct price ID based on the current seat count. When the count crosses the 300-seat boundary (in either direction), the subscription is updated to the appropriate price.

The threshold is defined as `SEAT_TIER_THRESHOLD` (300) in `src/lib/crm/server/paddle.js`.

### Code locations

| File | Role |
|------|------|
| `src/lib/crm/server/paddle.js` | Shared utility: `getAdminSeatCount()`, `syncSubscriptionQuantity()`, `getPriceIdForPlan()`, `getPaddleBaseUrl()` |
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

The app maps Paddle price IDs to plan tiers. Each plan has **two prices** — one for 1–300 seats and one for 301+ seats:

| Variable | Description |
|----------|-------------|
| `PADDLE_PRICE_ID_PROFESSIONAL` | Price ID for Professional **tier 1** (1–300 seats). |
| `PADDLE_PRICE_ID_PROFESSIONAL_TIER2` | Price ID for Professional **tier 2** (301+ seats, higher per-seat rate). |
| `PADDLE_PRICE_ID_ENTERPRISE` | Price ID for Enterprise **tier 1** (1–300 seats). |
| `PADDLE_PRICE_ID_ENTERPRISE_TIER2` | Price ID for Enterprise **tier 2** (301+ seats, higher per-seat rate). |

> Tier 2 variables are optional. If not set, the tier 1 price is used for all seat counts.

### Boathouse

| Variable | Description |
|----------|-------------|
| `BOATHOUSE_PORTAL_ID` | Your Boathouse portal ID from the Boathouse dashboard. |
| `BOATHOUSE_SECRET` | Secret for the portal from the Boathouse dashboard. |

---

## Paddle Dashboard Setup (Step-by-Step)

### 1. Create Products and Per-Seat Prices

Paddle Billing doesn't have a built-in tiered pricing mode on a single price. To achieve tiered per-seat pricing, create **two prices per plan** — one for the lower tier and one for the higher tier. The app selects the correct price automatically.

1. Go to **Paddle Dashboard → Catalog → Products**.
2. Create a product (e.g. "OnNuma Hub Professional").

#### Professional — Tier 1 Price (1–300 seats)

| Setting | Value |
|---------|-------|
| Name | Professional (per seat, 1–300) |
| Price | Your lower per-seat rate (e.g. **£1.00 / month**) |
| Billing period | Monthly (or Annual) |
| Quantity → Minimum | 1 |
| Quantity → Maximum | 300 |

#### Professional — Tier 2 Price (301+ seats)

Add a second price on the same product:

| Setting | Value |
|---------|-------|
| Name | Professional (per seat, 301+) |
| Price | Your higher per-seat rate (e.g. **£2.00 / month**) |
| Billing period | Monthly (or Annual) |
| Quantity → Minimum | 301 |
| Quantity → Maximum | 999999 |

3. Copy both **price IDs** and set them in your environment:
   ```
   PADDLE_PRICE_ID_PROFESSIONAL=pri_01h...        # tier 1 (1–300)
   PADDLE_PRICE_ID_PROFESSIONAL_TIER2=pri_01h...   # tier 2 (301+)
   ```

4. **Repeat for Enterprise** — create an "OnNuma Hub Enterprise" product with the same two-tier pattern and set `PADDLE_PRICE_ID_ENTERPRISE` and `PADDLE_PRICE_ID_ENTERPRISE_TIER2`.

> **How it works:** Paddle charges per-unit × quantity. The app counts admin users, picks the correct price ID based on whether the count is ≤ 300 or > 300, and sends that price ID with the quantity. If the seat count crosses the 300 boundary, the app automatically switches the subscription to the other price.

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
│  picks price tier    │──────► Paddle creates transaction
│  sends quantity: N   │        with N × tier unit price
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
| Price doesn't change at 301 seats | Ensure `PADDLE_PRICE_ID_PROFESSIONAL_TIER2` (and/or `_ENTERPRISE_TIER2`) is set. Without it the app falls back to the tier 1 price for all counts. |
| Webhook doesn't recognise tier 2 price | The webhook checks all four price ID env vars. Make sure the tier 2 IDs match exactly what's in Paddle. |
