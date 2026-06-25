import { GoogleAdsSettingsPanel } from '../../components/admin/GoogleAdsSettingsPanel';

export function AdminGoogleAdsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Google Ads Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure a dedicated Google OAuth client and Developer Token so users can connect their Google Ads account and run campaigns</p>
      </div>
      <div className="max-w-xl"><GoogleAdsSettingsPanel /></div>

      <div className="max-w-xl p-4 rounded-xl bg-[#1a73e8]/5 border border-[#1a73e8]/10 space-y-3">
        <p className="text-sm text-[#1a73e8] font-semibold">How it works</p>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li>Users click <strong className="text-slate-300">"Connect Google Ads"</strong> &rarr; popup &rarr; Google OAuth &rarr; the account is linked (auto-selected if they have only one)</li>
          <li>Users create <strong className="text-slate-300">Search campaigns</strong> (budget + keywords + responsive search ad), created <strong className="text-slate-300">paused</strong> so nothing spends until resumed</li>
          <li>Users <strong className="text-slate-300">pause / resume</strong> campaigns and pull <strong className="text-slate-300">insights</strong> (impressions, clicks, spend, CTR)</li>
          <li><strong className="text-slate-300">Dry run</strong> validates a campaign with Google without creating anything — safe to test before any spend</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminGoogleAdsSettingsPage;
