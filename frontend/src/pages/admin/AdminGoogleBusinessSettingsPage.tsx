import { GoogleBusinessSettingsPanel } from '../../components/admin/GoogleBusinessSettingsPanel';

export function AdminGoogleBusinessSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Google Business Profile Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure a dedicated Google OAuth client so users can connect their Google Business Profile and publish Google Posts</p>
      </div>
      <div className="max-w-xl"><GoogleBusinessSettingsPanel /></div>

      <div className="max-w-xl p-4 rounded-xl bg-[#4285F4]/5 border border-[#4285F4]/10 space-y-3">
        <p className="text-sm text-[#4285F4] font-semibold">How it works</p>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li>Users click <strong className="text-slate-300">"Connect Google Business"</strong> &rarr; popup &rarr; Google OAuth &rarr; account is linked</li>
          <li>The user picks which <strong className="text-slate-300">business location</strong> to manage</li>
          <li>Sellanto publishes <strong className="text-slate-300">Google Posts</strong> (text + image + call-to-action) to the location's listing on Google Search &amp; Maps</li>
          <li>Access tokens last <strong className="text-slate-300">1 hour</strong> and auto-refresh via the refresh token</li>
        </ul>
      </div>

      <div className="max-w-xl p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <p className="text-sm font-semibold text-amber-400">Before this works end-to-end</p>
        <ol className="text-xs text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>Create a <strong className="text-slate-300">separate</strong> OAuth client (don't reuse the YouTube one)</li>
          <li>Enable the <strong className="text-slate-300">Business Profile APIs</strong> in the Library</li>
          <li>Add the <strong className="text-slate-300">business.manage</strong> scope</li>
          <li><strong className="text-amber-300">Request API access</strong> — Google gates the Business Profile API behind an approval form</li>
          <li>Add the connecting Google account as a <strong className="text-slate-300">test user</strong> while in Testing mode</li>
        </ol>
      </div>
    </div>
  );
}

export default AdminGoogleBusinessSettingsPage;
