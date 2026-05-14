import { TikTokSettingsPanel } from '../../components/admin/TikTokSettingsPanel';

export function AdminTikTokSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">TikTok Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure TikTok OAuth credentials so users can connect their TikTok accounts with one click</p>
      </div>
      <div className="max-w-xl"><TikTokSettingsPanel /></div>

      <div className="max-w-xl p-4 rounded-xl bg-[#FE2C55]/5 border border-[#FE2C55]/10 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#FE2C55]" fill="currentColor" viewBox="0 0 24 24"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
          <p className="text-sm text-[#FE2C55] font-semibold">How it works</p>
        </div>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li>Users click <strong className="text-slate-300">"Connect TikTok"</strong> &rarr; popup &rarr; TikTok OAuth &rarr; auto-connect account</li>
          <li>Account info and permissions are fetched via <strong className="text-slate-300">TikTok Login Kit</strong></li>
          <li>Supports <strong className="text-slate-300">video uploads</strong> and <strong className="text-slate-300">photo posts</strong> via Content Posting API</li>
          <li>Access tokens last <strong className="text-slate-300">24 hours</strong>, refresh tokens last <strong className="text-slate-300">365 days</strong></li>
          <li>Refresh tokens auto-renew access tokens — no manual reconnection needed (within 365 days)</li>
        </ul>
      </div>

      <div className="max-w-xl p-4 rounded-xl bg-slate-800/50 border border-white/5 space-y-3">
        <p className="text-sm font-semibold text-white">Setup Checklist</p>
        <ol className="text-xs text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>Create an app on the <strong className="text-slate-300">TikTok Developer Portal</strong></li>
          <li>Add required products: <strong className="text-slate-300">Login Kit</strong> and <strong className="text-slate-300">Content Posting API</strong></li>
          <li>Under <strong className="text-slate-300">"Configure"</strong>, add your redirect URI: <code className="text-slate-300 bg-slate-700/50 px-1 rounded">https://yourdomain.com/api/v1/platforms/tiktok/callback/</code></li>
          <li>Copy <strong className="text-slate-300">Client Key</strong> and <strong className="text-slate-300">Client Secret</strong> into the form above</li>
          <li>Add <strong className="text-slate-300">test users</strong> for development (before app audit approval)</li>
          <li>Set the <strong className="text-slate-300">Frontend URL</strong> for post-OAuth redirect</li>
          <li>Submit your app for <strong className="text-slate-300">audit review</strong> to enable public posting</li>
        </ol>
      </div>

      <div className="max-w-xl p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <p className="text-sm font-semibold text-amber-400">Important Notes</p>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li><strong className="text-amber-300">Before audit</strong>: All uploaded videos are set to SELF_ONLY (private). Only approved apps can post publicly.</li>
          <li><strong className="text-amber-300">Test users</strong>: Add up to 20 test users during development. Only these users can authorize your app before audit approval.</li>
          <li><strong className="text-amber-300">Token lifecycle</strong>: Access tokens expire in 24 hours, refresh tokens in 365 days. Auto-refresh handles the 24-hour rotation seamlessly.</li>
          <li><strong className="text-amber-300">Rate limits</strong>: Content Posting API has rate limits per app and per user. Monitor usage in the Developer Portal dashboard.</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminTikTokSettingsPage;
