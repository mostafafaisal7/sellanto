# Sellanto - Changes Summary (7 May 2026) — pushed to `features/swapnil-v2.6`

This document summarizes the work shipped on May 7, 2026 — building on the previous day's Upgrade Plan flow. Today's focus: a real **manual-verification billing pipeline** (bKash/Nagad/Bank/Card) with admin one-click approve-via-email, an **Admin Finance / Accounting dashboard** with FX-converted USD ledger, a user-facing **Diamond Analytics page** with forecast + plan history, and a polished **auth error UX**. Branch pushed to `features/swapnil-v2.6`.

---

## 1. Frontend Design — What Was Built

### 1.1 Payment Modal (`frontend/src/components/billing/PaymentModal.tsx`) — *new*
A unified billing modal that opens when a user clicks any paid plan on the Upgrade page.

- **Method tab strip** — bKash / Nagad / Rocket / Bank / Card / PayPal / Crypto / Other. Tabs auto-collapse to only show methods admin has configured.
- **Payout-account card** — coral-bordered gradient panel showing where to send money. Displays display name, account holder, account number with **copy-to-clipboard** button (✓ tick on copy), and admin-written instructions.
- **Form** — amount (with currency dropdown for BDT/USD/EUR/GBP/INR/PKR/AED/SGD/MYR/AUD/CAD), context-aware reference label (TrxID for mobile money, SWIFT for bank, last-4 for card, tx hash for crypto), payer name/phone/email, free-form notes.
- **MVP disclaimer** — "Payments verified manually within an hour during business hours."
- **Success view** — request ID, amount, method, reference, and **expected diamonds on approval** highlighted in coral.

### 1.2 Diamond Analytics Page (`frontend/src/pages/DiamondAnalyticsPage.tsx`) — *new*
Personal analytics dashboard for the user's diamond wallet, route `/analytics/diamond`.

- **Header KPIs** — current balance, total recharged, total spent, days remaining (forecast).
- **Usage timeseries chart** — Recharts area chart with daily / weekly / monthly toggle.
- **Feature breakdown** — colored bar chart per feature key (captions / images / video / brand DNA / messenger / etc.) with brand-aligned palette.
- **Plan history timeline** — past plan grants with dates and diamond amounts.
- **Forecast card** — projected depletion date based on rolling-window avg daily spend.
- Wired into the **Diamond Badge** in the navbar — clicking the 💎 counter now opens this page (replaced the static tooltip with a clickable button).

### 1.3 Admin Payments Page (`frontend/src/pages/admin/AdminPaymentsPage.tsx`) — *new*
Admin panel for the manual verification queue, route `/admin-panel/payments`.

- **Two sections**: "Requests" (verification queue) + "Accounts" (manage payout destinations).
- **Status tabs** — Pending / Approved / Rejected / All with live counts in badges.
- **Request rows** — user info, plan + cycle, amount in USD + local currency, method, reference, payer details, status badge.
- **Approve / Reject modals** — admin can attach a note that gets emailed to the user.
- **Accounts CRUD** — add/edit/delete payout accounts with method, display name, account number, holder name, currency, free-form instructions, sort order, and active toggle.

### 1.4 Admin Finance Page (`frontend/src/pages/admin/AdminFinancePage.tsx`) — *new*
Double-sided ledger dashboard for revenue + expenses, route `/admin-panel/finance`.

- **4 KPI cards** — Revenue (USD), Expenses (USD), Net Profit (positive/negative badge), and total transaction counts.
- **Monthly bar chart** — side-by-side revenue vs expense bars per month using Recharts.
- **Expense-by-category breakdown** — color-coded bars (server/openai/gemini/claude/marketing/payroll/etc.) with category-specific colors.
- **Recent revenue feed** — last 8 approved payments with FX-converted USD amount + rate used.
- **Expense CRUD** — add/edit/delete entries with category, amount in USD, description, date.
- Date-range filter (`from`/`to`) plus rolling-window (`months=12`) fallback.

### 1.5 Auth UX Polish (`AuthModal.tsx`, `LoginPage.tsx`)
Replaced the flat red error box with a **shaking gradient alert card**:

- **Smart error title** — derives "Wrong credentials" / "Awaiting approval" / "Connection issue" / "Account already exists" / "Something went wrong" from the error message.
- **Animated entrance** — fade-in + scale + horizontal shake (framer-motion `x: [0, -8, 8, -5, 5, 0]`) so wrong-password errors are visually obvious.
- **Dismiss button** — small × icon with hover state.
- **Critical bug fix in `services/api.ts`** — auth endpoints (`/auth/login/`, `/auth/register/`, `/auth/refresh/`) now bypass the 401-refresh-token interceptor. Previously a wrong password silently triggered a refresh, then a redirect to `/login` — user never saw "wrong credentials." Fixed by short-circuiting `isAuthEndpoint(originalRequest.url)`.

### 1.6 Sidebar Updates
- **User Sidebar** (`components/layout/Sidebar.tsx`) — added "**Diamond Analytics**" entry with `ChartBarSquareIcon` in the Settings group; the dead "Upgrade Now" gradient card now navigates to `/upgrade` on click.
- **Admin Sidebar** (`components/admin/AdminSidebar.tsx`) — added "**Payments**" (CreditCardIcon) and "**Finance**" (ScaleIcon) main-nav entries between Users and Global API Keys.

### 1.7 Upgrade Page Wiring (`frontend/src/pages/UpgradePage.tsx`)
- Paid plans (Pro / Business) now route through the new **`PaymentModal`** instead of the direct upgrade endpoint.
- The legacy "Confirm" modal is now shown **only** for the Free downgrade path.
- After a successful payment-or-downgrade, refreshes both `useAuthStore` and `useDiamondStore` so the sidebar plan badge + navbar 💎 counter update immediately.
- Success modal now shows **diamonds granted** from the upgrade (`DiamondGrantResult`).
- FAQ updated — "Pay via bKash, Nagad, bank transfer, or card. Submit your transaction reference and our billing team verifies within an hour."

### 1.8 Magic History Inline Edit (`frontend/src/pages/magic/MagicHistoryPage.tsx`)
Magic history posts can now be **edited in place** instead of recreating from scratch.

- **Inline caption editor** — pencil icon turns the caption into a textarea; AI regenerate button re-calls `captionService` per platform/tone.
- **Schedule editing** — change date + time on a scheduled post (locked once schedule time has passed).
- **Publish-now uses `postService.update`** — the old flow re-downloaded media + recreated the post; new flow flips status to `scheduled` with a 1-min ahead time on the same post id.

### 1.9 Magic Video Result Local Caption Builder (`frontend/src/pages/magic/VideoResultScreen.tsx`)
Added a **local caption fallback** so users get post-ready text even if the AI caption service is rate-limited. Detects niche (digital marketing / real estate / fitness / etc.), extracts keywords, builds platform-specific copy (Twitter punchy / LinkedIn long-form / Instagram emoji-heavy) with auto-generated hashtags.

---

## 2. APIs — How They Work in Backend

### 2.1 Payment / Billing API (user-facing)

| Method | Endpoint | View | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/payments/methods/` | `PayoutMethodsView` | Return active payout accounts (bKash/Nagad/Bank/etc.) for the PaymentModal tab strip. Public-safe fields only — no `sort_order`/timestamps. |
| `POST` | `/api/v1/payments/submit/` | `SubmitPaymentView` | Create a `PaymentRequest` row, fire admin notification email with one-click approve/reject buttons. |
| `GET` | `/api/v1/payments/my-requests/` | `MyPaymentRequestsView` | User's last 50 payment requests with current status. |
| `GET` | `/api/v1/payments/action/<token>/` | `payment_action_by_token` | One-click approve/reject from the admin email — no login, signed token proves authenticity, expires in 7 days. |

**How `submit/` works in backend:**
1. Validates `plan` (must be starter/pro/business/enterprise — free is blocked because free needs no payment) and `billing_cycle` (`monthly` or `yearly`).
2. Looks up the plan price server-side via `lookup_plan_price_usd(plan, billing_cycle)` — never trusts `amount_usd` from client.
3. Resolves optional `payout_account_id` to an active `AdminPayoutAccount`; rejects if invalid.
4. Builds `request_base_url = f'{request.scheme}://{request.get_host()}'` so the email's approve/reject links route back to the same host (works in localhost AND production seamlessly).
5. Calls `payment_service.submit_payment_request(...)` which:
   - Creates the `PaymentRequest` row in a transaction (status='pending').
   - Outside the txn, builds an HTML + text email with **two big colored buttons** (green Approve / red Reject), each carrying a URL like `/api/v1/payments/action/<signed_token>/`.
   - Sends via SMTP to `ADMIN_NOTIFICATION_EMAIL` setting. Email failures are logged but never crash the HTTP request.
6. Returns the request, expected diamonds, and a friendly "queued for verification" message.

**How one-click email approval works:**
- Token is `TimestampSigner(salt='sellanto.payment-action').sign(f'{payment_id}:{action}')` — only Django (with `SECRET_KEY`) can mint valid tokens.
- `payment_action_by_token` view: `verify_action_token(token)` → returns `(payment_id, action)` or `None` for tampered/expired tokens.
- Calls `approve_payment_request(...)` which **switches the user's plan**, grants diamonds, and sends a confirmation email. Idempotent — clicking the same link twice is a no-op.
- Renders a standalone HTML success page (no template file — inline so it works even if `TEMPLATES` isn't fully configured).

### 2.2 Payment Approval Internals (`accounts/services/payment_service.py`)

**`approve_payment_request(request_obj, admin_user, admin_notes='')`** flow:
1. **Idempotency guard** — if status is already `approved`, return early with `already_approved=True`.
2. **FX conversion outside the txn** — `convert_to_usd(amount_local, local_currency)` returns `(revenue_usd, fx_rate, source)`. Done before the txn so a slow/failed FX call doesn't lock the row.
3. Inside `transaction.atomic()`:
   - `profile.set_plan(request_obj.plan, duration_months=12 if yearly else 1)` — flips the user's tier.
   - `grant_plan_diamonds_on_upgrade(...)` — only grants if `new_rank > previous_rank` (rank table: free=0, starter=1, pro=2, business=3, enterprise=4). Idempotent per cycle.
   - Persists `revenue_usd`, `fx_rate_used`, `diamonds_granted`, `reviewed_by`, `reviewed_at`, `plan_applied_at`.
4. Sends user confirmation email (best-effort, non-fatal).

### 2.3 Admin Payment API

| Method | Endpoint | View | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/payments/?status=pending` | `AdminPaymentRequestListView` | Last 100 requests + per-status counts for tab badges. |
| `POST` | `/api/v1/admin/payments/<id>/approve/` | `AdminPaymentApproveView` | Switch plan + grant diamonds, with optional `admin_notes`. |
| `POST` | `/api/v1/admin/payments/<id>/reject/` | `AdminPaymentRejectView` | Mark rejected, email user with the reason. |
| `GET / POST` | `/api/v1/admin/payout-accounts/` | `AdminPayoutAccountListView` | List + create payout destinations. |
| `PUT / DELETE` | `/api/v1/admin/payout-accounts/<id>/` | `AdminPayoutAccountDetailView` | Update / delete a payout account. |

All admin endpoints use a custom `_require_admin(request)` helper that returns a `403` Response if the user isn't `is_staff` or `is_superuser`.

### 2.4 FX Service (`accounts/services/fx_service.py`) — *new*

Resolves any local currency → USD with a 4-tier fallback chain:

1. **Cache** — `accounts.FxRate` table, refreshed at most every 24h per pair.
2. **Frankfurter API** (`api.frankfurter.app`) — ECB-sourced, free, no key. Limited coverage (no BDT/PKR/NGN/EGP).
3. **open.er-api.com** — broad coverage including BDT/PKR/INR/NGN/EGP. API returns `1 USD = X target`, so we invert to `Y = 1/X USD per unit`.
4. **Stale cache** — better than nothing if both networks fail.
5. **Hardcoded fallback table** — `_FALLBACK_TO_USD` for 22 common currencies (BDT ~0.00833, INR ~0.012, etc.). Marked `source='fallback'` so we can spot it in the audit log.
6. **Unknown currency** — defaults to 1.0 + warning log, so the approval never gets stuck.

`convert_to_usd(amount, from_currency)` → `(amount_usd, rate_used, source)` — used at payment approval time and stored on the `PaymentRequest` for audit.

### 2.5 Admin Finance API (`api/finance_views.py`) — *new*

| Method | Endpoint | View | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/finance/summary/?from=&to=&months=12` | `FinanceSummaryView` | KPIs + by-month + expense-by-category + recent feeds. |
| `GET` | `/api/v1/admin/finance/revenue/?limit=200` | `RevenueListView` | Read-only list derived from approved `PaymentRequest` rows. |
| `GET / POST` | `/api/v1/admin/finance/expenses/` | `ExpenseListView` | List with `?category=&from=&to=` filters; create via POST. |
| `PUT / DELETE` | `/api/v1/admin/finance/expenses/<id>/` | `ExpenseDetailView` | Update / delete an expense entry. |

**How `summary/` works:**
- Window resolution — explicit `from`/`to` wins; otherwise rolling N months (default 12, max 36) normalized to start-of-month.
- Revenue side — `PaymentRequest.objects.filter(status='approved', reviewed_at__gte=window_start, reviewed_at__lt=window_end).aggregate(Sum('revenue_usd'))`. **`revenue_usd` is FX-converted at approval time** so the summary is single-currency arithmetic.
- Expense side — `ExpenseEntry.objects.filter(incurred_on__gte=..., incurred_on__lt=...).aggregate(Sum('amount_usd'))`.
- Net = revenue − expenses.
- By-month — `TruncMonth('reviewed_at')` for revenue + `TruncMonth('incurred_on')` for expenses, merged into a single dict keyed by ISO month string.
- Expense-by-category — `values('category').annotate(total=Sum('amount_usd'), n=Count('id')).order_by('-total')` joined against `ExpenseEntry.CATEGORY_CHOICES` for human labels.

### 2.6 Diamond Analytics API (`api/diamond_views.py`)

3 new endpoints feed the Diamond Analytics page:

| Method | Endpoint | View | Returns |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/diamond/usage-timeseries/?period=daily\|weekly\|monthly&days=30` | `DiamondUsageTimeseriesView` | Bucketed `[{date, diamonds_spent, transaction_count}]` for charts. |
| `GET` | `/api/v1/diamond/plan-history/` | `DiamondPlanHistoryView` | Last 50 `transaction_type='plan_grant'` entries with parsed plan name. |
| `GET` | `/api/v1/diamond/forecast/?lookback=14` | `DiamondForecastView` | `balance / avg_daily_spend` → `days_remaining` + `depletion_date`. |

**Bucketing logic for `usage-timeseries/`:**
- `period` maps to Django's `TruncDay` / `TruncWeek` / `TruncMonth` functions.
- Filters `DiamondTransaction.objects.filter(user=user, transaction_type='deduction', created_at__gte=start, created_at__lt=end)`.
- `.annotate(bucket=trunc('created_at')).values('bucket').annotate(diamonds_spent=Sum('amount'), transaction_count=Count('id'))`.
- Deduction amounts are stored negative; serializer flips sign with `abs(...)` for display.

**Forecast logic:**
- Sums all deductions in the lookback window → `spent_in_window`.
- `avg_daily = spent_in_window / lookback_days`.
- `days_remaining = round(wallet.balance / avg_daily, 1)` (or `null` if `avg_daily == 0` to indicate "infinite runway").
- `depletion_date = (now + days_remaining).date()`.

### 2.7 Plan-Upgrade Diamond Grant (`accounts/services/diamond_service.py`)

New `grant_plan_diamonds_on_upgrade(user, previous_plan, new_plan, cycle_start_date)` helper used by both the free upgrade endpoint AND the payment-approval flow.

- **Rule 1** — Only grants when `PLAN_RANK[new_plan] > PLAN_RANK[previous_plan]`. Downgrade → no grant. Same-plan re-selection → no grant.
- **Rule 2** — Idempotent per billing cycle. Note format: `Plan upgrade grant: {new_plan} cycle={cycle_start_date.isoformat()} (+{amount} diamonds)`. The exact note string is the idempotency key — re-running with the same `cycle_start_date` checks `DiamondTransaction.objects.filter(...note=cycle_note).exists()` and skips.
- **Rule 3** — Free plan grants 0 (intentional baseline).
- Returns `{granted, amount, balance, reason}` where `reason ∈ {granted, not_an_upgrade, already_granted_this_cycle, no_diamonds_for_plan}`.
- Wallet update + transaction insert in `transaction.atomic()` + `select_for_update()` to prevent races.

### 2.8 Subscription Upgrade Endpoint (`api/subscription_views.py`) — extended

`POST /api/v1/subscription/upgrade/` now also calls `grant_plan_diamonds_on_upgrade(...)` and returns the result as `diamond_grant: {granted, amount, balance, reason}` so the frontend can display the grant message in the success modal.

### 2.9 Post Update Endpoint (`api/views.py PostViewSet.update_post`)

Modified to support inline edits from the Magic History page:

- Now uses `partial=True` so callers can PATCH only the fields they want.
- Accepts new `status` field — `draft → scheduled` transition validates that user has connected accounts for every target platform; returns 400 with the missing platform list if any are missing.
- Accepts `timezone` field for accurate scheduled-time interpretation.
- Sets `post.status` only if `new_status` is in the validated payload.

### 2.10 Veo Tier by Plan (`video_studio/tasks.py`)

`generate_video_clip_task` now picks the Veo model tier based on the user's subscription plan instead of hardcoded `'standard'`:

- `free` / `starter` → `fast` ($1.20 / 8s clip)
- `pro` → `standard` ($2.00 / 8s clip)
- `business` / `enterprise` → `premium` ($3.20 / 8s clip)

Helper `get_veo_tier_for_user(user)` reads `user.profile.subscription_plan` and maps via `PLAN_TO_VEO_TIER` dict, defaulting to `fast` if anything's missing.

### 2.11 Settings (`socialsync/settings.py`)

- **`SECURE_PROXY_SSL_HEADER` + `USE_X_FORWARDED_HOST`** — without these, `request.scheme` is always `'http'` behind nginx/Cloudflare/ngrok, and approve/reject URLs in outgoing emails come out `http://` (browsers block them on production).
- **Email block** — `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL` — all read from `.env` via `python-decouple` `config(...)`.
- **`SITE_URL`** — fallback for building absolute URLs when `request.scheme://request.get_host()` isn't available (e.g. background email tasks).

---

## 3. Models Added (`accounts/models.py`)

| Model | Table | Purpose |
| :--- | :--- | :--- |
| `AdminPayoutAccount` | `admin_payout_accounts` | Admin-managed bKash/Nagad/bank/card destinations users can pay to. |
| `PaymentRequest` | `payment_requests` | User's claim that they sent money. Status flow: pending → approved/rejected/cancelled. Stores plan, billing_cycle, amount_usd (list price), amount_local + local_currency (what was paid), payment_method, payout_account FK, transaction_reference, payer_name/phone/email/notes, admin review fields, `revenue_usd` + `fx_rate_used` for accounting. |
| `FxRate` | `fx_rates` | Cached exchange rate `1 from_currency = rate * to_currency`. Unique on (from, to). 24h TTL via `fetched_at`. |
| `ExpenseEntry` | `expense_entries` (via standard naming) | Manual cost entries — server / openai / gemini / claude / marketing / payroll / etc. |

### Migrations
- `0014_adminpayoutaccount_paymentrequest.py` — initial billing tables.
- `0015_seed_payout_accounts.py` — data migration seeding example bKash/Nagad accounts.
- `0016_paymentrequest_fx_rate_used_and_more.py` — adds `revenue_usd`, `fx_rate_used` columns + `FxRate` and `ExpenseEntry` tables.

### Backfill management command
- `accounts/management/commands/backfill_revenue_usd.py` — one-time command to populate `revenue_usd` + `fx_rate_used` on historical approved payments.

---

## 4. File Summary

| Component | Key Files Modified / Added |
| :--- | :--- |
| **Billing models + migrations** | `accounts/models.py` (4 new models), `accounts/migrations/0014_*.py` (new), `0015_*.py` (new — seed), `0016_*.py` (new — FX columns) |
| **Backend services** | `accounts/services/payment_service.py` (new), `accounts/services/fx_service.py` (new), `accounts/services/diamond_service.py` (`grant_plan_diamonds_on_upgrade` + `PLAN_RANK`) |
| **Backend views** | `api/payment_views.py` (new — 8 views + email-action), `api/finance_views.py` (new — 4 views), `api/diamond_views.py` (3 new views: timeseries / plan-history / forecast), `api/subscription_views.py` (diamond grant on upgrade), `api/views.py` (`PostViewSet.update_post` partial + status), `api/serializers.py` (status + timezone fields) |
| **URL routes** | `api/urls.py` — 14 new routes (4 user payment + 5 admin payment + 4 finance + 3 diamond analytics + 1 email action) |
| **Settings** | `socialsync/settings.py` — proxy SSL header, email config, SITE_URL |
| **Background tasks** | `video_studio/tasks.py` — plan-aware Veo tier selection |
| **Mgmt command** | `accounts/management/commands/backfill_revenue_usd.py` (new) |
| **Frontend services** | `frontend/src/services/paymentService.ts` (new), `frontend/src/services/financeService.ts` (new), `frontend/src/services/diamondService.ts` (3 new methods + types), `frontend/src/services/subscriptionService.ts` (`DiamondGrantResult` type), `frontend/src/services/api.ts` (auth-endpoint 401 bypass) |
| **Frontend pages** | `frontend/src/pages/DiamondAnalyticsPage.tsx` (new), `frontend/src/pages/admin/AdminPaymentsPage.tsx` (new), `frontend/src/pages/admin/AdminFinancePage.tsx` (new), `frontend/src/pages/UpgradePage.tsx` (PaymentModal wiring), `frontend/src/pages/LoginPage.tsx` (AuthAlert), `frontend/src/pages/magic/MagicHistoryPage.tsx` (inline edit + reschedule), `frontend/src/pages/magic/VideoResultScreen.tsx` (local caption builder) |
| **Frontend components** | `frontend/src/components/billing/PaymentModal.tsx` (new), `frontend/src/components/auth/AuthModal.tsx` (AuthAlert + dismiss), `frontend/src/components/diamond/DiamondBadge.tsx` (clickable → analytics), `frontend/src/components/layout/Sidebar.tsx` (Diamond Analytics + working Upgrade), `frontend/src/components/admin/AdminSidebar.tsx` (Payments + Finance) |
| **Frontend wiring** | `frontend/src/App.tsx` (3 new routes), `frontend/src/pages/index.ts`, `frontend/src/pages/admin/index.ts`, `frontend/src/store/authStore.ts` (better error parsing), `frontend/src/types/index.ts` (`status` on `UpdatePostData`) |

---

## 5. Out of scope (deferred)

- **Real payment gateway** — Stripe / SSLCommerz / bKash Tokenized API still pending. Today's flow is manual verification with admin email approval.
- **Refunds** — no refund endpoint or UI; refunds happen out-of-band and the admin can manually decrement the wallet.
- **Recurring billing** — yearly subscriptions don't auto-renew. User has to re-submit payment 12 months later.
- **Webhook-style payment status updates** — none of the providers can ping us back yet, so admin has to verify in their bKash app and click Approve.
- **Multi-currency display in finance dashboard** — everything is normalized to USD at approval time. We don't show "amount in BDT" in the revenue feed (it's stored, just not surfaced).
