"""Ad automation rule engine.

Evaluates AdRule rows against recent AdInsight metrics and takes actions
(pause / budget change / notify). Designed to be called periodically by the
APScheduler job (see posts/scheduler.py). Each evaluation is independent and
best-effort: one failing rule never aborts the rest.
"""
import logging
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)


def _aggregate_metrics(campaign, lookback_days):
    """Sum/average AdInsight rows for a campaign over the lookback window.

    Returns a dict with spend (USD), clicks, impressions, conversions,
    conversion_value (USD), plus derived cpc, ctr, cpa.
    """
    from ads.models import AdInsight

    since = timezone.now().date() - timedelta(days=max(1, lookback_days))
    rows = AdInsight.objects.filter(campaign=campaign, date__gte=since)

    spend_minor = sum(r.spend_minor for r in rows)
    clicks = sum(r.clicks for r in rows)
    impressions = sum(r.impressions for r in rows)
    conversions = sum(r.conversions for r in rows)
    conv_value_minor = sum(r.conversion_value_minor for r in rows)

    spend_usd = spend_minor / 100.0
    return {
        'spend': spend_usd,
        'clicks': clicks,
        'impressions': impressions,
        'conversions': conversions,
        'conversion_value': conv_value_minor / 100.0,
        'cpc': (spend_usd / clicks) if clicks else 0.0,
        'ctr': (clicks / impressions) if impressions else 0.0,
        'cpa': (spend_usd / conversions) if conversions else 0.0,
    }


_OPS = {
    'gt': lambda a, b: a > b,
    'lt': lambda a, b: a < b,
    'gte': lambda a, b: a >= b,
    'lte': lambda a, b: a <= b,
}


def _take_action(rule, campaign):
    """Execute a triggered rule's action. Returns a human-readable result string."""
    from ads.services import google_ads as gads
    from ads.services import meta_ads

    provider = campaign.ad_account.provider
    action = rule.action

    if action == 'notify':
        return 'notified'

    if action == 'pause':
        if provider == 'google':
            gads.pause_campaign(campaign.ad_account, campaign.external_campaign_id)
        else:
            meta_ads.pause_campaign(campaign)
        campaign.status = 'paused'
        campaign.save(update_fields=['status', 'updated_at'])
        return 'paused campaign'

    if action in ('increase_budget', 'decrease_budget'):
        pct = float(rule.action_value or 0) / 100.0
        factor = (1 + pct) if action == 'increase_budget' else (1 - pct)
        if factor <= 0:
            return 'skipped: budget factor would be ≤ 0'
        new_minor = int(round(campaign.daily_budget_minor * factor))
        if provider == 'google':
            # Google stores micros; daily_budget_minor is cents → micros = ×10_000.
            gads.update_campaign_budget_by_campaign(
                campaign.ad_account, campaign.external_campaign_id, new_minor * 10_000)
        else:
            meta_ads.update_campaign_budget(campaign, new_minor)
        campaign.daily_budget_minor = new_minor
        campaign.save(update_fields=['daily_budget_minor', 'updated_at'])
        return f'{action} to {new_minor} minor units'

    return f'unknown action {action}'


def evaluate_rule(rule):
    """Evaluate a single rule. Returns {triggered, value, action_result?, error?}."""
    from accounts.services.notification_service import notify

    campaign = rule.campaign
    metrics = _aggregate_metrics(campaign, rule.lookback_days)
    value = metrics.get(rule.metric, 0.0)
    op = _OPS.get(rule.operator)
    triggered = bool(op and op(value, rule.threshold))

    rule.last_evaluated_at = timezone.now()
    result = {'triggered': triggered, 'value': value}

    if triggered:
        try:
            action_result = _take_action(rule, campaign)
            result['action_result'] = action_result
            rule.last_triggered_at = timezone.now()
            rule.trigger_count = (rule.trigger_count or 0) + 1
            # Always notify the user a rule fired.
            try:
                notify(
                    user=rule.user,
                    event_type='ad_rule_triggered',
                    title=f'Ad rule "{rule.name}" triggered',
                    message=(f'{campaign.name}: {rule.metric}={value:.2f} '
                             f'{rule.operator} {rule.threshold} → {action_result}'),
                )
            except Exception:
                pass
        except Exception as e:  # noqa: BLE001
            logger.exception('rule %s action failed', rule.id)
            result['error'] = str(e)

    rule.save(update_fields=['last_evaluated_at', 'last_triggered_at',
                             'trigger_count', 'updated_at'])
    return result


def evaluate_all_active_rules():
    """Evaluate every active rule. Called by the scheduler. Returns a summary."""
    from ads.models import AdRule

    rules = AdRule.objects.filter(is_active=True).select_related(
        'campaign', 'campaign__ad_account', 'user')
    evaluated = triggered = 0
    for rule in rules:
        # Skip rules on campaigns that aren't live.
        if rule.campaign.status not in ('active', 'paused', 'pending_review'):
            continue
        try:
            res = evaluate_rule(rule)
            evaluated += 1
            if res.get('triggered'):
                triggered += 1
        except Exception as e:  # noqa: BLE001
            logger.exception('rule %s evaluation failed: %s', rule.id, e)
    logger.info('[ad rules] evaluated=%s triggered=%s', evaluated, triggered)
    return {'evaluated': evaluated, 'triggered': triggered}
