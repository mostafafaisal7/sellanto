import { FacebookSettingsPanel } from '../../components/admin/FacebookSettingsPanel';
import { MessengerWebhooksPanel } from '../../components/admin/MessengerWebhooksPanel';

export function AdminFacebookSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Facebook OAuth Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure your Facebook App credentials so users can connect their Facebook Pages with one click
        </p>
      </div>

      <div className="max-w-xl">
        <FacebookSettingsPanel />
      </div>

      {/* Messenger Webhook Setup */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Messenger Webhook Setup</h2>
        <p className="text-sm text-slate-400 mb-4">
          After a user connects their Facebook Page, copy the values below into Meta Developer Console → Messenger → Settings → Webhooks.
        </p>
        <div className="max-w-xl">
          <MessengerWebhooksPanel />
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-xl p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <p className="text-sm text-blue-400 font-semibold">How it works</p>
        </div>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li>These credentials are stored securely in the database — no server restart needed</li>
          <li>Users click <strong className="text-slate-300">"Connect Facebook Page"</strong> on the Platforms page → a popup opens → they log in → pages auto-connect</li>
          <li>Facebook Pages, Instagram Business accounts, and Messenger Bot are all connected in one flow</li>
          <li>Page tokens from Facebook never expire — no manual token refresh needed</li>
          <li>In Development Mode, only users you add as Testers in Meta Dashboard can connect</li>
          <li>In Live Mode (after App Review), any Facebook user can connect</li>
        </ul>
      </div>

      {/* Setup checklist */}
      <div className="max-w-xl p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
        <p className="text-sm font-semibold text-white">Meta Developer Console Checklist</p>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Create a Facebook App → choose Business type' },
            { step: '2', text: 'Add "Facebook Login" product → set Web platform' },
            { step: '3', text: 'Add "Messenger" product (required for Messenger bot)' },
            { step: '4', text: 'Set the Redirect URI in Facebook Login → Settings → Valid OAuth Redirect URIs' },
            { step: '5', text: 'Copy App ID and App Secret from Settings → Basic into the form above' },
            { step: '6', text: 'Add test users under Roles → Testers (for Development Mode testing)' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                {item.step}
              </span>
              <p className="text-xs text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminFacebookSettingsPage;
