import { LinkedInSettingsPanel } from '../../components/admin/LinkedInSettingsPanel';

export function AdminLinkedInSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">LinkedIn OAuth Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure your LinkedIn App credentials so users can connect their LinkedIn profiles and Company Pages with one click
        </p>
      </div>

      <div className="max-w-xl">
        <LinkedInSettingsPanel />
      </div>

      {/* How it works */}
      <div className="max-w-xl p-4 rounded-xl bg-[#0077B5]/5 border border-[#0077B5]/10 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#0077B5]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <p className="text-sm text-[#0077B5] font-semibold">How it works</p>
        </div>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li>These credentials are stored securely in the database — no server restart needed</li>
          <li>Users click <strong className="text-slate-300">"Connect LinkedIn"</strong> on the Platforms page &rarr; a popup opens &rarr; they authorize &rarr; account auto-connects</li>
          <li>Personal profile + Company Pages (if org scopes enabled) are connected in one flow</li>
          <li>Access tokens last <strong className="text-slate-300">60 days</strong>. Refresh tokens (Community Mgmt API only) last 365 days</li>
          <li>Supports <strong className="text-slate-300">text, image, and video posts</strong> to both personal profiles and company pages</li>
          <li>Uses the <strong className="text-slate-300">new REST Posts API</strong> (not deprecated ugcPosts)</li>
        </ul>
      </div>

      {/* Setup checklist */}
      <div className="max-w-xl p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
        <p className="text-sm font-semibold text-white">LinkedIn Developer Portal Checklist</p>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Create an app at linkedin.com/developers/apps (or use existing)' },
            { step: '2', text: 'Under Auth tab, copy Client ID and Client Secret' },
            { step: '3', text: 'Add your Redirect URI to "Authorized redirect URLs for your app"' },
            { step: '4', text: 'Under Products tab, request "Share on LinkedIn" (instant approval)' },
            { step: '5', text: 'For Company Page posting: request "Community Management API" (requires LinkedIn review)' },
            { step: '6', text: 'Paste all values into the form above and click Save' },
            { step: '7', text: 'If using ngrok for testing, update Redirect URI with your ngrok domain' },
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

      {/* Important notes */}
      <div className="max-w-xl p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <p className="text-sm font-semibold text-amber-400">Important Notes</p>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li><strong className="text-amber-300">"Share on LinkedIn"</strong> and <strong className="text-amber-300">"Community Management API"</strong> are mutually exclusive — you cannot have both on the same app</li>
          <li>For a SaaS tool with Company Page posting, you need <strong className="text-slate-300">Community Management API</strong></li>
          <li>Community Management API requires a <strong className="text-slate-300">registered legal entity</strong> (not individual developers)</li>
          <li>All REST API calls require <code className="text-slate-300 bg-white/5 px-1 rounded">LinkedIn-Version: YYYYMM</code> header — currently set to 202604</li>
          <li>Rate limit: <strong className="text-slate-300">100 post-creation calls per day per member</strong></li>
        </ul>
      </div>
    </div>
  );
}

export default AdminLinkedInSettingsPage;
