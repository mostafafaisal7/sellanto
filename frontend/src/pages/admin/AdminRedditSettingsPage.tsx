import { RedditSettingsPanel } from '../../components/admin/RedditSettingsPanel';

export function AdminRedditSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reddit Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure Reddit OAuth credentials so users can connect their Reddit accounts with one click</p>
      </div>
      <div className="max-w-xl"><RedditSettingsPanel /></div>

      <div className="max-w-xl p-4 rounded-xl bg-[#FF4500]/5 border border-[#FF4500]/10 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#FF4500]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
          <p className="text-sm text-[#FF4500] font-semibold">How it works</p>
        </div>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li>Users click <strong className="text-slate-300">"Connect Reddit"</strong> &rarr; popup &rarr; Reddit OAuth &rarr; auto-connect account</li>
          <li>User identity and subreddit info are fetched via <strong className="text-slate-300">Reddit API</strong></li>
          <li>Supports <strong className="text-slate-300">text posts</strong>, <strong className="text-slate-300">link posts</strong>, and <strong className="text-slate-300">subreddit listing</strong></li>
          <li>Access tokens last <strong className="text-slate-300">1 hour</strong>, refresh tokens are permanent (when <code className="text-slate-300">duration=permanent</code> is used)</li>
          <li>Refresh tokens auto-renew access tokens — no manual reconnection needed</li>
        </ul>
      </div>

      <div className="max-w-xl p-4 rounded-xl bg-slate-800/50 border border-white/5 space-y-3">
        <p className="text-sm font-semibold text-white">Setup Checklist</p>
        <ol className="text-xs text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>Go to <strong className="text-slate-300">reddit.com/prefs/apps</strong> and click "Create App" or "Create Another App"</li>
          <li>Select <strong className="text-slate-300">"web app"</strong> as the application type</li>
          <li>Set <strong className="text-slate-300">redirect URI</strong>: <code className="text-slate-300 bg-slate-700/50 px-1 rounded">https://yourdomain.com/api/v1/platforms/reddit/callback/</code></li>
          <li>Copy <strong className="text-slate-300">client_id</strong> (the string under the app name) into the form above</li>
          <li>Copy <strong className="text-slate-300">client_secret</strong> into the form above</li>
          <li>Set the <strong className="text-slate-300">Frontend URL</strong> for post-OAuth redirect</li>
        </ol>
      </div>

      <div className="max-w-xl p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <p className="text-sm font-semibold text-amber-400">Important Notes</p>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li><strong className="text-amber-300">Rate limit</strong>: 60 requests/minute per OAuth client. Reddit enforces this strictly — exceed it and you get 429 errors.</li>
          <li><strong className="text-amber-300">Access tokens</strong>: Expire every 1 hour. Use <code className="text-amber-300">duration=permanent</code> in the authorization URL to receive a refresh token for auto-renewal.</li>
          <li><strong className="text-amber-300">Scopes</strong>: The app requests <code className="text-amber-300">identity</code>, <code className="text-amber-300">read</code>, <code className="text-amber-300">submit</code>, and <code className="text-amber-300">mysubreddits</code> scopes.</li>
          <li><strong className="text-amber-300">User-Agent</strong>: Reddit API requires a unique User-Agent header. The backend handles this automatically.</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminRedditSettingsPage;
