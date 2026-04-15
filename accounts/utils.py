from accounts.models import SiteConfiguration


def is_messenger_enabled():
    """Central kill switch for the entire Messenger feature.
    Reads from SiteConfiguration DB table. Default: enabled (true).
    Admin can toggle via Facebook Settings panel."""
    return SiteConfiguration.get('messenger_feature_enabled', 'true') == 'true'
