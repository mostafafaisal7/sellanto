"""
Subscription / Upgrade Plan endpoints.

Provides the API surface for the in-app Upgrade Plan page:
- GET  /api/v1/subscription/        → current user's plan + usage + limits
- GET  /api/v1/subscription/plans/  → catalog of plans (Solo / Pro / Business)
- POST /api/v1/subscription/upgrade/ → switch to a different plan

No payment gateway is wired yet — POST /upgrade/ applies the change directly.
When a real gateway (Stripe / SSLCommerz / bKash) is integrated, swap the
direct apply for a checkout-session creation and confirm via webhook.
"""

from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services.diamond_service import grant_plan_diamonds_on_upgrade


# ---------------------------------------------------------------------------
# Plan catalog — single source of truth for the upgrade UI.
# Prices are USD. `limits` matches UserProfile.set_plan() keys.
# Cost basis (provider COGS) is sourced from tokenCostEstimations.md.
# ---------------------------------------------------------------------------

PLAN_CATALOG: list[dict[str, Any]] = [
    {
        "id": "free",
        "display_name": "Solo",
        "tagline": "For creators just getting started",
        "price_monthly_usd": 0,
        "price_yearly_usd": 0,
        "limits": {
            "posts": 3,           # Magic Mode runs / month
            "captions": 10,
            "videos": 0,
            "images": 5,
            "messenger": 0,
            "accounts": 1,
        },
        "features": [
            "3 Magic Mode runs / month",
            "10 AI captions / month",
            "5 AI images / month",
            "1 connected platform",
            "Basic scheduling",
            "Community support",
        ],
        "highlight": False,
        "cta": "Start free",
    },
    {
        "id": "pro",
        "display_name": "Pro",
        "tagline": "For full-time content creators",
        "price_monthly_usd": 29,
        "price_yearly_usd": 23,
        "limits": {
            "posts": 30,          # Magic Mode runs
            "captions": 99999,    # "Unlimited"
            "videos": 2,
            "images": 100,
            "messenger": 200,
            "accounts": 8,
        },
        "features": [
            "30 Magic Mode runs / month",
            "Unlimited AI captions",
            "100 AI images / month",
            "2 AI videos (Veo) / month",
            "All 8 platforms connected",
            "Smart-time scheduling",
            "200 Messenger Bot replies / month",
            "Priority email support",
        ],
        "highlight": True,
        "cta": "Upgrade to Pro",
    },
    {
        "id": "business",
        "display_name": "Business",
        "tagline": "For teams and agencies",
        "price_monthly_usd": 149,
        "price_yearly_usd": 119,
        "limits": {
            "posts": 99999,       # "Unlimited" Magic Mode
            "captions": 99999,
            "videos": 8,
            "images": 500,
            "messenger": 1000,
            "accounts": 10,
        },
        "features": [
            "Unlimited Magic Mode runs",
            "Unlimited AI captions",
            "500 AI images / month",
            "8 AI videos (Veo) / month",
            "1,000 Messenger Bot replies / month",
            "5 brand profiles & 3 team seats",
            "Custom Brand DNA training",
            "Dedicated success manager & SLA",
        ],
        "highlight": False,
        "cta": "Upgrade to Business",
    },
]


def _get_plan(plan_id: str) -> dict[str, Any] | None:
    return next((p for p in PLAN_CATALOG if p["id"] == plan_id), None)


def _serialize_subscription(profile) -> dict[str, Any]:
    """Build the subscription payload the frontend renders."""
    plan_def = _get_plan(profile.subscription_plan) or PLAN_CATALOG[0]
    return {
        "plan_id": profile.subscription_plan,
        "plan_display_name": plan_def["display_name"],
        "plan_start_date": profile.plan_start_date,
        "plan_end_date": profile.plan_end_date,
        "plan_duration_months": profile.plan_duration_months,
        "is_plan_active": profile.is_plan_active,
        "days_remaining": profile.days_remaining,
        "limits": {
            "posts": profile.max_posts_per_month,
            "captions": profile.max_captions_per_month,
            "videos": profile.max_videos_per_month,
            "images": profile.max_images_per_month,
            "messenger": profile.max_messenger_messages,
            "accounts": profile.max_social_accounts,
        },
        "usage": {
            "posts": profile.posts_this_month,
            "captions": profile.captions_this_month,
            "videos": profile.videos_this_month,
            "images": profile.images_this_month,
            "messenger": profile.messenger_messages_this_month,
        },
    }


class SubscriptionStatusView(APIView):
    """GET /api/v1/subscription/ — current plan + usage."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        return Response(_serialize_subscription(profile))


class SubscriptionPlansView(APIView):
    """GET /api/v1/subscription/plans/ — catalog of available plans."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"plans": PLAN_CATALOG})


class SubscriptionUpgradeView(APIView):
    """POST /api/v1/subscription/upgrade/ — switch to a different plan.

    Body: { "plan": "pro" | "business" | "free", "billing_cycle": "monthly"|"yearly" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get("plan")
        billing_cycle = request.data.get("billing_cycle", "monthly")

        plan_def = _get_plan(plan_id)
        if plan_def is None:
            return Response(
                {"error": f"Unknown plan: {plan_id!r}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if billing_cycle not in {"monthly", "yearly"}:
            return Response(
                {"error": "billing_cycle must be 'monthly' or 'yearly'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        duration_months = 12 if billing_cycle == "yearly" else 1
        profile = request.user.profile
        previous_plan = profile.subscription_plan

        # Paid plans must go through a payment gateway. Stripe is wired at
        # /api/v1/billing/stripe/checkout/; manual bKash/Nagad claims go
        # through /api/v1/payments/submit/ + admin approval.
        # Only free-plan transitions (downgrade-to-free) apply directly here.
        if plan_id != "free":
            return Response(
                {
                    "error": "Paid plans require checkout.",
                    "detail": (
                        "Use POST /api/v1/billing/stripe/checkout/ for Stripe, "
                        "or POST /api/v1/payments/submit/ for manual payment."
                    ),
                    "checkout_endpoints": {
                        "stripe": "/api/v1/billing/stripe/checkout/",
                        "manual": "/api/v1/payments/submit/",
                    },
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        profile.set_plan(plan_id, duration_months=duration_months)

        # Grant plan diamonds on upgrade (rank-up only, idempotent per cycle).
        # Downgrades and same-plan re-selections are no-ops; the user keeps
        # the diamonds they already have.
        diamond_grant = grant_plan_diamonds_on_upgrade(
            user=request.user,
            previous_plan=previous_plan,
            new_plan=plan_id,
            cycle_start_date=profile.plan_start_date,
        )

        return Response(
            {
                "ok": True,
                "previous_plan": previous_plan,
                "billing_cycle": billing_cycle,
                "subscription": _serialize_subscription(profile),
                "diamond_grant": diamond_grant,
                "message": (
                    f"Plan changed from {previous_plan} to {plan_id} "
                    f"({billing_cycle})."
                    + (
                        f" Granted {diamond_grant['amount']} diamonds."
                        if diamond_grant['granted']
                        else ""
                    )
                ),
            },
            status=status.HTTP_200_OK,
        )
