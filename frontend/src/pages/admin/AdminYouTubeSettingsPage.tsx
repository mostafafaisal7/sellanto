import { YouTubeSettingsPanel } from '../../components/admin/YouTubeSettingsPanel';

export function AdminYouTubeSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">YouTube OAuth Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure Google OAuth credentials so users can connect their YouTube channels with one click</p>
      </div>
      <div className="max-w-xl"><YouTubeSettingsPanel /></div>

      <div className="max-w-xl p-4 rounded-xl bg-[#FF0000]/5 border border-[#FF0000]/10 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          <p className="text-sm text-[#FF0000] font-semibold">How it works</p>
        </div>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li>Users click <strong className="text-slate-300">"Connect YouTube"</strong> &rarr; popup &rarr; Google OAuth &rarr; auto-connect channel</li>
          <li>Channel info and permissions are fetched via <strong className="text-slate-300">YouTube Data API v3</strong></li>
          <li>Supports <strong className="text-slate-300">video uploads</strong>, <strong className="text-slate-300">Shorts</strong> (vertical &le;60s), and channel management</li>
          <li>Access tokens last <strong className="text-slate-300">1 hour</strong>, refresh tokens are long-lived (revoked only by user)</li>
          <li>Refresh tokens auto-renew access tokens — no manual reconnection needed</li>
        </ul>
      </div>

      <div className="max-w-xl p-4 rounded-xl bg-slate-800/50 border border-white/5 space-y-3">
        <p className="text-sm font-semibold text-white">Setup Checklist</p>
        <ol className="text-xs text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>Create a project in <strong className="text-slate-300">Google Cloud Console</strong></li>
          <li>Enable <strong className="text-slate-300">YouTube Data API v3</strong> in APIs &amp; Services &rarr; Library</li>
          <li>Configure <strong className="text-slate-300">OAuth consent screen</strong> (External, add test users if in testing mode)</li>
          <li>Create <strong className="text-slate-300">OAuth 2.0 Client ID</strong> (Web application)</li>
          <li>Add <strong className="text-slate-300">Authorized redirect URI</strong>: <code className="text-slate-300 bg-slate-700/50 px-1 rounded">https://yourdomain.com/api/v1/platforms/youtube/callback/</code></li>
          <li>Copy <strong className="text-slate-300">Client ID</strong> and <strong className="text-slate-300">Client Secret</strong> into the form above</li>
          <li>Set the <strong className="text-slate-300">Frontend URL</strong> for post-OAuth redirect</li>
        </ol>
      </div>

      <div className="max-w-xl p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <p className="text-sm font-semibold text-amber-400">Important Notes</p>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li><strong className="text-amber-300">Quota</strong>: Default quota is 10,000 units/day. Video uploads cost ~1,600 units each (&asymp;6 uploads/day). Request quota increase for production.</li>
          <li><strong className="text-amber-300">Testing mode</strong>: While in testing, refresh tokens expire after 7 days and only added test users can authorize. Verify your app to remove this limit.</li>
          <li><strong className="text-amber-300">Shorts support</strong>: Videos &le;60 seconds with vertical aspect ratio (9:16) are automatically treated as Shorts by YouTube. No special API needed.</li>
          <li><strong className="text-amber-300">Verification</strong>: Apps using <code className="text-amber-300">youtube.upload</code> scope require Google OAuth verification before going public. Plan 4-6 weeks for review.</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminYouTubeSettingsPage;
