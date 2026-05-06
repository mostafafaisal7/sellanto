# Sellanto - Changes Summary (5 May 2026)

This document summarizes the work shipped on May 5, 2026, focused on introducing a public marketing landing page, an in-app authentication modal, a pricing experience, and the routing reshape required to make `/` a real product surface.

Reference commit: `85f2a7e4 — feat: add public landing page with auth modal and pricing`.

---

## 1. Public Landing Page
Logged-out visitors now land on a real marketing page instead of being bounced straight to `/login`. Logged-in users are still routed to their dashboard (or admin panel for staff) automatically.

### New Page:
- **`frontend/src/pages/LandingPage.tsx`**: Composes all of the landing sections, manages the auth modal state (`login` / `signup`), pre-fills the signup email when captured from the final CTA, and updates `<title>` + `<meta description>` while mounted (restored on unmount).

### New Section Components (`frontend/src/components/landing/`):
- **LandingNavbar.tsx**: Sticky navbar that transitions transparent → frosted on scroll, with `Sign In` and `Get Started Free` actions at the very top.
- **HeroSection.tsx**: Animated orb backdrop, gradient headline, dual CTA, and an animated Magic Mode browser mockup. Secondary CTA smooth-scrolls to the Magic Mode section.
- **PlatformStrip.tsx**: 8 real brand-icon tiles (Facebook, Instagram, X, LinkedIn, TikTok, YouTube, Pinterest, Threads) with per-brand hover glows.
- **MagicModeSection.tsx**: 3-step animated flow demo — URL → AI questions → generated posts.
- **AIVideoSection.tsx**: Veo showcase with a shimmering 9:16 preview card.
- **AIImageSection.tsx**: Gemini ImageFX masonry grid showcase.
- **MultiPlatformSection.tsx**: Weekly calendar mockup with platform chips, illustrating multi-platform scheduling.
- **PricingSection.tsx**: Three plans — **Solo** (free), **Pro** ($29/mo, $23/mo billed yearly), **Business** ($89/mo, $71/mo billed yearly). Includes a monthly/yearly toggle with a `-20%` savings badge and per-plan feature lists (Magic Mode quotas, AI image/video quotas, platform connections, etc.).
- **FinalCTASection.tsx**: Gradient capture card with an email-to-signup field that pre-fills the AuthModal.
- **LandingFooter.tsx**: 4-column footer with product, resources, company, and legal links.
- **index.ts**: Barrel export for the landing components.

---

## 2. Auth Modal (Single-Modal Sign In / Sign Up)
A new in-app authentication experience that lets visitors authenticate without leaving the landing page.

### New Component:
- **`frontend/src/components/auth/AuthModal.tsx`**:
    - Single modal with a sliding **Sign In / Sign Up** segmented toggle (animated via `framer-motion`).
    - Forms validated with `react-hook-form` + `zod` (login: username/password; signup: username, email, phone, password, confirm).
    - Sign In reuses the existing `useAuthStore.login()` flow.
    - Sign Up posts to `/api/v1/auth/register/`. If the API returns auth tokens it stores them, fetches the user, and navigates to `/dashboard`; otherwise it shows an "Account requested — awaiting approval" success state.
    - Honors an optional `initialEmail` prop so emails captured from the Final CTA pre-fill the signup form.
    - Show/hide password toggles, root-level error surfacing, and a link to the standalone `/login` page.
- **`frontend/src/components/auth/index.ts`**: Barrel export including the `AuthMode` type.

---

## 3. Routing Reshape
The router has been restructured so `/` is a public landing surface and the dashboard now lives at its own route.

### `frontend/src/App.tsx`:
- **New `RootRoute` component** at `/`: renders `LandingPage` for logged-out users, redirects logged-in regular users to `/dashboard`, and staff to `/admin-panel`.
- **DashboardPage moved** from `/` to `/dashboard`.
- **`PublicRoute`** redirect target updated from `/` → `/dashboard` for already-authenticated users.
- **`AdminRoute`** fallback updated from `/` → `/dashboard` for non-staff access attempts.
- **Catch-all `*`** route still redirects to `/`, which now correctly routes to landing or dashboard depending on auth state.

### Post-action / "back to dashboard" links updated to `/dashboard`:
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Footer.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/OverflowPage.tsx`
- `frontend/src/pages/SetupFlowPage.tsx`
- `frontend/src/pages/magic/ResultsScreen.tsx`
- `frontend/src/pages/magic/VideoResultScreen.tsx`
- `frontend/src/components/admin/UserSelectModal.tsx`

### `frontend/src/pages/index.ts`:
- Exports the new `LandingPage` from the page barrel.

---

## 4. File Summary
| Component | Key Files Modified / Added |
| :--- | :--- |
| **Landing page** | `pages/LandingPage.tsx`, `components/landing/*` (10 new files: `LandingNavbar`, `HeroSection`, `PlatformStrip`, `MagicModeSection`, `AIVideoSection`, `AIImageSection`, `MultiPlatformSection`, `PricingSection`, `FinalCTASection`, `LandingFooter`, `index.ts`) |
| **Auth modal** | `components/auth/AuthModal.tsx`, `components/auth/index.ts` |
| **Routing** | `App.tsx` (RootRoute, dashboard moved to `/dashboard`, redirect targets updated) |
| **Post-action navigation** | `Sidebar.tsx`, `Footer.tsx`, `LoginPage.tsx`, `OverflowPage.tsx`, `SetupFlowPage.tsx`, `magic/ResultsScreen.tsx`, `magic/VideoResultScreen.tsx`, `admin/UserSelectModal.tsx` |
| **Barrels** | `pages/index.ts` |

**Net diff:** 24 files changed, 2,044 insertions(+), 16 deletions(-).

---
