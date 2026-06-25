import GoogleAdsManager from '../components/platforms/GoogleAdsManager';

export function GoogleAdsPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">Google Ads</h1>
        <p className="text-sm text-slate-400 mt-1">
          Connect your Google Ads account, create Search campaigns, and monitor performance.
          Campaigns are created paused — nothing spends until you resume.
        </p>
      </div>
      <GoogleAdsManager />
    </div>
  );
}

export default GoogleAdsPage;
