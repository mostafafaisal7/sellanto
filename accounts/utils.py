from accounts.models import SiteConfiguration


def is_messenger_enabled():
    """Central kill switch for the entire Messenger feature.
    Reads from SiteConfiguration DB table. Default: enabled (true).
    Admin can toggle via Facebook Settings panel."""
    return SiteConfiguration.get('messenger_feature_enabled', 'true') == 'true'


def is_instagram_comment_hide_enabled():
    """Admin switch for hiding Instagram comments. Default: enabled (true).

    Hiding takes someone's comment out of public view on a real Instagram
    account, so an operator may want it off entirely. Only hiding is gated --
    unhiding stays available whatever this says, otherwise turning the switch
    off would strand already-hidden comments with no way to restore them.

    Admin toggles it via the Facebook Settings panel."""
    return SiteConfiguration.get('instagram_comment_hide_enabled', 'true') == 'true'
