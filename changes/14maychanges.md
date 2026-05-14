# May 14 Changes — branch `features/swapnil-v2.8`

---

## Summary

Today's work was one large vertical slice: **Stripe payments end-to-end**. This replaced the manual-only billing path (bKash / bank wire) for card-paying users and added the full infrastructure to support it — from backend models, a Stripe config system, a webhook processor, and a refund lifecycle, through to a suite of four new billing modals, three new user-facing pages, a Forgot Password flow, and an Admin Refunds page. Additionally, the `video_ad` service was completed to wire the "Publish + Boost in one click" Meta flow introduced on May 12.

---

## Backend

### New files

#### `accounts/services/stripe_config.py`
**What:** Centralised accessor for every Stripe key and Price ID the system needs (publishable key, secret key, webhook secret, 6 plan price IDs, 4 top-up price IDs, flexible diamond rate).

**Why:** Keys must be rotatable from the Admin Panel without a server restart. Rather than scatter `settings.STRIPE_*` reads across the codebase, this module wraps a single resolution rule: check `SiteConfiguration` (DB row, editable in admin), then fall back to `settings.STRIPE_*` (env-backed via django-decouple), then return empty string. Every other Stripe file calls `stripe_config.secret_key()` etc., so a single admin save takes effect on the very next request.

Includes `describe_for_admin()` and `update_from_admin()` so the Admin Panel Stripe Settings page can read and write config without knowing the underlying DB keys or env-var names.

---

#### `accounts/services/stripe_service.py`
**What:** The entire Stripe business logic layer. Handles customer creation, Checkout Session creation (subscriptions + one-time top-ups), embedded PaymentIntent creation (card-on-file first-time flow), off-session charges (saved-card repeat flow), 3DS fallback, subscription cancellation, payment method management, and a webhook event dispatcher.

**Why:** The manual billing system (bKash / bank / card scan) required admin approval before a plan activated. That was intentional for manual transfers, but card payments can be confirmed automatically and instantly. Stripe is the industry standard for that. This service is the authoritative Stripe layer so nothing else needs to know about the Stripe SDK directly.

**Architecture decision — two charge paths:**
- **Checkout Session (redirect)**: Simpler integration, Stripe-hosted page, best for subscriptions. Created via `create_plan_checkout_session` and `create_topup_checkout_session`. Frontend redirects to the Stripe URL; on return the webhook fires `checkout.session.completed`.
- **PaymentIntent (embedded)**: Frontend renders Stripe's `<PaymentElement />` inline. Used for the flexible top-up modal (`BuyDiamondsModal`). On first purchase, `setup_future_usage='off_session'` saves the card. On repeat purchase, `charge_off_session()` confirms instantly with no UI. If the bank demands 3DS, a Checkout fallback URL is returned so Stripe handles SCA.

**Webhook dispatcher:** `handle_event()` verifies the Stripe-Signature header, then checks `StripeWebhookEvent.objects.get_or_create(stripe_event_id=...)` for idempotency. A duplicate event short-circuits before any handler runs. Handled event types:

| Event | Handler |
|---|---|
| `checkout.session.completed` | Route by `metadata.purpose` → apply plan or grant diamonds |
| `customer.subscription.*` | Sync local `StripeSubscription` mirror |
| `invoice.paid` | Extend `plan_end_date` on renewal (no re-grant of diamonds) |
| `invoice.payment_failed` | Mark subscription `past_due` |
| `payment_intent.succeeded` | Route by purpose → topup / boost / misc |
| `payment_method.attached` | Mirror card locally; set as default if first card |
| `payment_method.detached` | Delete local row |
| `charge.refunded` | Flip `PaymentRequest.refund_status` → `'refunded'` |
| `refund.updated` failed | Flip `refund_status` → `'failed'` |

**Plan purchase flow:**
1. `profile.set_plan(plan, duration_months)` — updates plan, dates, limits
2. `grant_plan_diamonds_on_upgrade(user, previous_plan, new_plan, cycle_start_date)` — idempotent per cycle, rank-up only
3. `PaymentRequest.objects.create(status='approved', payment_provider='stripe', ...)` — revenue ledger row
4. Any pending manual `PaymentRequest` rows for the same user are cancelled to avoid confusion when a user submitted a bKash claim and then switched to Stripe

**Top-up flow:**
1. `recharge_diamonds(user, amount)` — adds to diamond wallet
2. `PaymentRequest.objects.create(purpose='topup', diamonds_topped_up=N, ...)` — revenue row
3. Idempotency keyed on `stripe_payment_intent_id` — the same PI processed twice is a no-op

---

#### `accounts/services/refund_service.py`
**What:** Full refund lifecycle: user request → admin approve/reject → Stripe call → webhook confirmation.

**Why:** Users needed a self-serve refund path for Stripe payments. Manual (bKash/bank) refunds are out-of-scope and need direct admin contact. This service is deliberately separated from `stripe_service.py` because the refund business rules (90-day window, ownership check, minimum 10-char reason) are domain logic, not Stripe mechanics.

**Lifecycle (stored in `PaymentRequest.refund_status`):**
```
'' → 'requested' → 'processing' → 'refunded'  (happy path)
                 ↘ 'rejected'                   (admin rejects)
                 ↘ 'failed'                     (Stripe call fails or refund.updated webhook reports failure)
```

`request_refund()` validates eligibility (Stripe-only, `status='approved'`, within 90-day window, reason ≥ 10 chars), then sets `refund_status='requested'` and emails the admin.

`approve_refund()` calls `stripe.Refund.create(payment_intent=...)`, sets status to `'processing'`, stores the Stripe refund ID. The webhook later flips it to `'refunded'`.

`reject_refund()` requires `admin_notes` (shown to user in email), sets `refund_status='rejected'`.

Diamonds and plan are NOT auto-adjusted on refund — admin does that manually. This is a deliberate product decision.

---

#### `accounts/services/boost_service.py`
**What:** Ad-boost budget reservation and release against the diamond wallet.

**Why:** When a user boosts a post, the cost is in USD (daily budget × days). But internally the platform uses diamonds. This service converts USD → diamonds at the admin-configured `diamonds_per_dollar()` rate (rounds up), deducts the wallet atomically, and records both a `DiamondTransaction` and a `PaymentRequest` (with `payment_provider='internal_wallet'`). If the Meta/Google API later rejects the campaign, the frontend calls `release_reservation(reservation_id)` to credit the diamonds back. Idempotency is keyed on a client-supplied UUID so double-clicks don't double-charge.

---

#### `api/stripe_views.py`
**What:** All Stripe HTTP endpoints, mounted at `/api/v1/billing/stripe/` and `/api/v1/billing/`.

**Why these endpoints exist:**

| Endpoint | Why |
|---|---|
| `POST /stripe/checkout/` | Creates a redirect Checkout Session for plan subscriptions |
| `POST /stripe/topup/` | Creates a redirect Checkout Session for catalog top-ups |
| `POST /stripe/webhook/` | Receives Stripe webhook events. No auth; signature-verified. Returns 200 broadly so Stripe doesn't retry on non-signature errors; returns 500 only for genuine handler failures so Stripe retries those |
| `POST /stripe/cancel/` | Cancels the user's subscription. Default `immediate=False` = keep access until period end |
| `GET /stripe/session/<session_id>/` | Polled by the success page to check whether the webhook has landed (before showing "plan activated") |
| `GET /stripe/topup-catalog/` | Returns the static SKU catalog for the BuyDiamonds page |
| `POST /stripe/charge/` | Creates a PaymentIntent (client_secret returned to frontend for embedded PaymentElement). Used for first-time card entry |
| `POST /stripe/charge-saved/` | Off-session charge on the user's default saved card. Returns 3DS fallback URL if bank demands SCA |
| `POST /stripe/subscribe/` | Embedded subscription flow — creates draft Subscription with `default_incomplete` and returns client_secret for the initial invoice PaymentIntent |
| `GET /stripe/payment-methods/` | Lists saved cards (local mirror, with Stripe fallback) |
| `POST /stripe/payment-methods/<pm>/default/` | Set a card as default |
| `DELETE /stripe/payment-methods/<pm>/` | Detach and remove a card |
| `GET /stripe/has-card/` | Lightweight check so the frontend can pick one-click vs full card entry flow |
| `GET /stripe/diamond-rate/` | Returns admin-configured rate + bounds for the BuyDiamonds live preview |
| `GET /billing/payments/` | User's paginated payment history with refund eligibility flags |
| `POST /billing/refunds/request/` | User-initiated refund request |
| `POST /billing/boost/reserve/` | Deduct diamond wallet for a boost; returns `insufficient_funds` if short |
| `POST /billing/boost/release/` | Credit diamonds back when a boost campaign fails |

`_resolve_charge_request()` is a shared helper that normalises four request shapes (SKU top-up, flex top-up with amount_usd, boost, misc) into `(amount_cents, purpose, metadata)`. The metadata is written into the PaymentIntent so the webhook handler can act on it without a database lookup.

---

#### `ads/services/video_ad.py`
**What:** The "Publish + Boost video in one click" orchestration service, called by the `RunVideoAdModal` / `RunVideoAdView` added on May 12.

**Why:** Uploading a video to a Facebook Page and then immediately boosting it involves 5 serial steps with different failure modes. Keeping this in a dedicated service (rather than inline in the view) lets each step be logged, each failure be surfaced with a typed `VideoAdError(step=...)`, and the whole flow re-tested in isolation.

**Steps:**
1. `_upload_video_to_page(page_id, page_token, description, path)` — POST to `/{page}/videos`. Returns `{video_id, post_id}`.
2. `_wait_for_video_ready(video_id, page_token)` — Polls `/{video_id}?fields=status` every 5s until `video_status='ready'`. Boosting will fail if attempted before the video finishes encoding. Times out after 3 minutes (configurable via `max_wait_sec`).
3. If `post_id` is missing from the upload response (Meta doesn't always return it), a second GET to `/{video_id}?fields=post_id` is attempted. Falls back to using `video_id` directly.
4. Creates a local `Post` row (`format_type='reel'`, `status='posted'`, `facebook_post_id=fb_post_id`) so the video ad appears in MyPosts alongside organic content.
5. Calls `meta_ads.boost_post()` — reuses the same hardened 4-step boost chain with all three required params (is_adset_budget_sharing_enabled, destination_type, promoted_object).
6. Creates an `AdCampaign` row so it appears in the ad account's campaign list.

---

### New migrations

| Migration | What it adds |
|---|---|
| `0020` | `StripeCustomer` (user ↔ stripe_customer_id), `StripeSubscription` (tracks plan/cycle/period/status), `StripeWebhookEvent` (idempotency log with processing_status, error) |
| `0021` | `StripePaymentMethod` (card brand/last4/expiry/funding/is_default mirror) |
| `0022` | `EmailOTP.purpose` field — allows OTPs to be typed (`'login'` vs `'password_reset'`) so the same OTP model serves both registration verification and the new forgot-password flow |
| `0023` | Renames the EmailOTP index to include purpose in the compound key |

---

### Model additions (accounts/models.py)

**`StripeCustomer`:** One row per user. Stores `stripe_customer_id` and `default_payment_method_id`. Ensures we never create duplicate Stripe customers across retries.

**`StripeSubscription`:** Mirrors the remote Stripe Subscription object locally so we can answer "does this user have an active sub?" without a Stripe API call on every request. Updated by webhooks.

**`StripeWebhookEvent`:** One row per event ID (`stripe.event.id`). `get_or_create` on this row is the idempotency guard. `processing_status` ∈ `{ok, ignored, error}` and `error` field make it auditable.

**`StripePaymentMethod`:** Local mirror of the card. Needed so `has_card_on_file()` and the "one-click" flow work without a Stripe API call on the quick-pay confirm screen.

**`PaymentRequest` additions:** New Stripe-specific fields: `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_invoice_id`, `stripe_refund_id`, `refund_status`, `refund_reason`, `refund_amount_usd`, `refund_admin_notes`, `refund_requested_at`, `refund_processed_at`, `refund_reviewed_at`, `refund_reviewed_by`, `diamonds_topped_up`, `plan_applied_at`, `payment_provider` field extended to include `'stripe'` and `'internal_wallet'`.

---

## Frontend

### New components

#### `components/billing/BillingChoiceModal.tsx`
**What:** The gateway modal shown when a user clicks "Upgrade" on UpgradePage. Has two tabs: "Pay by card" (Stripe) and "bKash / Bank" (existing manual PaymentModal).

**Why:** Existing users who know the manual payment flow shouldn't see it disappear. New users should see Stripe first because it's instant. The tab switcher preserves both paths without needing two separate upgrade buttons.

**How it works:** On open, probes `stripeService.hasCardOnFile()` so it can show "Visa ····4242 — Saved card" if the user already has a card. When the user clicks Subscribe, it opens `CardEntryModal` with `kind='subscription'`, which calls `POST /stripe/subscribe/` and renders `<PaymentElement />` inline for card collection.

---

#### `components/billing/BuyDiamondsModal.tsx`
**What:** Flexible diamond top-up modal. User types any USD amount; live preview shows exactly how many diamonds they'll get (fetched from `/stripe/diamond-rate/`). Quick-pick buttons ($5, $10, $25, $50, $100) set the amount directly with inline diamond count.

**Why:** Fixed SKU packs (1k/5k/10k/25k diamonds) are available via Checkout redirect, but many users want smaller or intermediate amounts. The flex flow enables any amount between $1 and $10,000 with the diamonds calculated server-side at the admin-configured rate. The admin can change the rate (e.g., run a promo at 150 💎/$1) and all in-progress sessions see the new rate on next load.

**How it works:** On open, parallel-fetches `getDiamondRate()` and `hasCardOnFile()`. If a saved card exists → clicking Buy opens `QuickPayModal` (1-click confirm). If no card → opens `CardEntryModal` (full PaymentElement). After either path, calls `onSuccess()` and closes.

---

#### `components/billing/CardEntryModal.tsx`
**What:** Stripe embedded card entry. Renders `<PaymentElement />` from `@stripe/react-stripe-js` using the dark theme. Handles five charge kinds: `topup` (SKU), `topup-flex` (USD amount), `boost`, `misc`, and `subscription` (creates a Subscription rather than a PaymentIntent).

**Why:** Stripe's hosted Checkout page redirects the user away from the app. The embedded PaymentElement keeps the user in-context, feels native, and allows inline success feedback. After payment, `setup_future_usage='off_session'` ensures the card is saved for future one-click purchases — this eliminates friction on repeat top-ups.

**How it works:** On mount, calls the appropriate backend endpoint to get a `client_secret` (either `POST /stripe/charge/` or `POST /stripe/subscribe/`). Loads `stripe.js` once (singleton cached across mounts). On submit, calls `stripe.confirmPayment({ redirect: 'if_required' })` — no redirect if payment succeeds inline. Refreshes `useAuthStore` + `useDiamondStore` after success so the plan badge and diamond counter update without a page reload.

---

#### `components/billing/QuickPayModal.tsx`
**What:** Minimal confirm modal for saved-card charges. Shows the card brand, last 4 digits, expiry, and the amount being charged. Single "Charge $X" button.

**Why:** Users who have already entered a card should not have to go through the full PaymentElement flow again. The confirm modal reduces friction for repeat top-ups to a single click. If the bank demands 3DS on the off-session charge, the backend returns `needs_3ds=true` with a Checkout fallback URL and the modal does `window.location.assign(url)` to redirect just for that SCA step.

---

### New pages

#### `pages/BuyDiamondsPage.tsx`
Route: `/billing/diamonds` (or similar). Landing page that explains what diamonds are used for and immediately opens `BuyDiamondsModal`. Has a "Payment history" link and redirects to dashboard on success.

#### `pages/PaymentHistoryPage.tsx`
Route: `/settings/payments`. Shows the user's paginated payment history (20 per page) as a table with date, description (plan, top-up, boost), amount, status, and refund status badges. Eligible stripe payments within the 90-day window get a "Request refund" button that opens an inline modal for the reason. The window policy is fetched from the API so it stays in sync with `REFUND_WINDOW_DAYS` in `refund_service.py`.

#### `pages/PaymentMethodsPage.tsx`
Shows saved cards with brand, last 4, expiry. Supports setting a default and detaching a card. Wraps `GET /stripe/payment-methods/`, `POST .../default/`, `DELETE .../<pm>/`.

#### `pages/SuccessPage.tsx`
Stripe's `STRIPE_SUCCESS_URL` redirect target. Polls `GET /stripe/session/<session_id>/` every 2 seconds until the webhook has confirmed the payment and written the `PaymentRequest` row (up to ~15 seconds). On success, shows what was activated (plan name or diamond count) and links to dashboard.

#### `pages/CancelPage.tsx`
Stripe's `STRIPE_CANCEL_URL` redirect target. Shown when the user abandons the Checkout page. Simple message with "Back to plans" link.

#### `pages/ForgotPasswordPage.tsx`
Three-step flow reusing the existing `EmailOTP` infrastructure:
1. **Email step:** User enters email → `POST /auth/forgot-password/` → backend creates OTP with `purpose='password_reset'` and emails it.
2. **Reset step:** User enters 6-digit code + new password + confirm password → `POST /auth/forgot-password/verify/` → backend validates OTP, sets password. 60s countdown with Resend button (enabled after expiry). Show/hide password toggles on both password fields. Shake animation on error (same `Alert` component style as the auth modal).
3. **Done step:** Shows success animation and username reminder, auto-redirects to `/login` after 1.8 seconds.

**Why this exists:** The earlier auth flow only had OTP-based registration. Forgot Password was missing — users who forgot their password had no self-serve recovery path.

#### `pages/admin/AdminRefundsPage.tsx`
Admin-only page at `/admin-panel/refunds`. Shows all refund requests from all users with status filter tabs (All / Requested / Processing / Refunded / Rejected / Failed). "Requested" is the default filter so admins land directly on the action queue. Each row has Approve and Reject buttons that open a confirmation modal. Approving calls `POST /admin/refunds/<id>/approve/` which triggers the Stripe refund API server-side. Rejecting requires a reason that is emailed to the user.

---

### Modified pages / components

**`UpgradePage.tsx`:** The "Get started" / "Upgrade" CTA now opens `BillingChoiceModal` instead of `PaymentModal` directly, adding the Stripe tab.

**`LoginPage.tsx`:** Added "Forgot password?" link below the password field that navigates to `/forgot-password`.

**`SettingsPage.tsx`:** Added a Billing section with links to Payment Methods and Payment History pages.

**`ConnectAccountsPage.tsx`:** When the user opens the Boost modal and the diamond wallet is short, the page now surfaces the "Top up diamonds" shortfall message and links to `BuyDiamondsPage`.

**`AdminNavbar.tsx` / `AdminSidebar.tsx`:** Added "Refunds" menu item pointing to `/admin-panel/refunds`.

---

## New services

### `services/stripeService.ts`
Typed wrappers for all Stripe-related endpoints. Key types:

- `SavedCard` — `{id, brand, last4, exp_month, exp_year, funding, is_default}`
- `DiamondRateResponse` — `{diamonds_per_dollar, min_usd, max_usd}`
- `ChargeRequest` — discriminated union: `{sku}` | `{purpose, amount_usd, metadata?}`
- `PaymentHistoryItem` — full row including refund fields and `can_request_refund`
- `PaymentHistoryResponse` — paginated wrapper with `refund_window_days`

Methods: `hasCardOnFile()`, `getDiamondRate()`, `createChargeIntent()`, `chargeSavedCard()`, `createSubscription()`, `getPaymentHistory()`, `requestRefund()`, `listPaymentMethods()`, `setDefaultPaymentMethod()`, `removePaymentMethod()`.

---

## File summary

| File | Status | Description |
|---|---|---|
| `accounts/services/stripe_config.py` | New | DB-first Stripe key accessor |
| `accounts/services/stripe_service.py` | New | Full Stripe business logic + webhook dispatcher |
| `accounts/services/refund_service.py` | New | Refund lifecycle: request → approve/reject → Stripe |
| `accounts/services/boost_service.py` | New | Diamond wallet reservation for ad boosts |
| `api/stripe_views.py` | New | All Stripe + billing HTTP endpoints |
| `ads/services/video_ad.py` | New | Publish + Boost video flow (5-step orchestration) |
| `accounts/migrations/0020_*` | New | StripeCustomer, StripeSubscription, StripeWebhookEvent |
| `accounts/migrations/0021_*` | New | StripePaymentMethod |
| `accounts/migrations/0022_*` | New | EmailOTP.purpose field |
| `accounts/migrations/0023_*` | New | EmailOTP index rename |
| `accounts/models.py` | Modified | Stripe model definitions + PaymentRequest Stripe fields |
| `api/urls.py` | Modified | New billing/stripe/* and billing/payments/ routes |
| `api/admin_views.py` | Modified | Admin refund list/approve/reject views |
| `api/views.py` | Modified | Forgot-password endpoints (request, resend, verify) |
| `socialsync/settings.py` | Modified | STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL, STRIPE_API_VERSION |
| `requirements.txt` | Modified | Added `stripe` SDK |
| `frontend/package.json` | Modified | Added `@stripe/stripe-js`, `@stripe/react-stripe-js` |
| `frontend/src/components/billing/BillingChoiceModal.tsx` | New | Stripe vs manual tab switcher |
| `frontend/src/components/billing/BuyDiamondsModal.tsx` | New | Flexible diamond top-up with live preview |
| `frontend/src/components/billing/CardEntryModal.tsx` | New | Embedded PaymentElement card entry |
| `frontend/src/components/billing/QuickPayModal.tsx` | New | One-click confirm for saved-card charges |
| `frontend/src/pages/BuyDiamondsPage.tsx` | New | /billing/diamonds landing page |
| `frontend/src/pages/PaymentHistoryPage.tsx` | New | User payment history + refund request |
| `frontend/src/pages/PaymentMethodsPage.tsx` | New | Saved card management |
| `frontend/src/pages/SuccessPage.tsx` | New | Stripe success redirect + webhook polling |
| `frontend/src/pages/CancelPage.tsx` | New | Stripe cancel redirect |
| `frontend/src/pages/ForgotPasswordPage.tsx` | New | 3-step OTP-based password reset |
| `frontend/src/pages/admin/AdminRefundsPage.tsx` | New | Admin refund queue with approve/reject |
| `frontend/src/services/stripeService.ts` | New | Typed API wrappers for all Stripe endpoints |
| `frontend/src/pages/LoginPage.tsx` | Modified | "Forgot password?" link added |
| `frontend/src/pages/UpgradePage.tsx` | Modified | BillingChoiceModal replaces PaymentModal |
| `frontend/src/pages/SettingsPage.tsx` | Modified | Billing section with payment method + history links |
| `frontend/src/pages/ConnectAccountsPage.tsx` | Modified | Boost shortfall → top-up link |
| `frontend/src/components/admin/AdminNavbar.tsx` | Modified | Refunds menu item |
| `frontend/src/components/admin/AdminSidebar.tsx` | Modified | Refunds menu item |
| `frontend/src/App.tsx` | Modified | New billing routes wired in |

---

## Out of scope today

- Dunning emails on failed subscription renewal (`invoice.payment_failed` logs the failure but does not send a "payment failed, please update card" email — noted as TODO in stripe_service.py)
- Admin dashboard analytics for Stripe revenue vs manual revenue blending (AdminFinancePage already handles PaymentRequest rows regardless of payment_provider; Stripe rows appear automatically)
- Subscription metered billing / usage-based pricing
- Google Ads payment path (boost_service.py is provider-agnostic; Google integration is a future sprint)
