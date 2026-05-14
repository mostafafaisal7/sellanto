import { PinterestSettingsPanel } from '../../components/admin/PinterestSettingsPanel';

export function AdminPinterestSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pinterest OAuth Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure Pinterest App credentials so users can connect their Pinterest accounts with one click</p>
      </div>
      <div className="max-w-xl"><PinterestSettingsPanel /></div>

      <div className="max-w-xl p-4 rounded-xl bg-[#E60023]/5 border border-[#E60023]/10 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#E60023]" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
          <p className="text-sm text-[#E60023] font-semibold">How it works</p>
        </div>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li>Users click <strong className="text-slate-300">"Connect Pinterest"</strong> &rarr; popup &rarr; authorize &rarr; auto-connect</li>
          <li>Boards are auto-fetched — first board set as default for pin placement</li>
          <li>Supports <strong className="text-slate-300">image pins</strong> (URL or base64) and <strong className="text-slate-300">video pins</strong> (S3 upload)</li>
          <li>Access tokens last <strong className="text-slate-300">30 days</strong>, refresh tokens 60 days (continuous refresh)</li>
          <li>New apps start in <strong className="text-slate-300">Trial mode</strong> — pins only visible to you until Standard approval</li>
        </ul>
      </div>

      <div className="max-w-xl p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <p className="text-sm font-semibold text-amber-400">Important: Trial vs Standard Access</p>
        <ul className="text-xs text-slate-400 space-y-1.5 ml-5 list-disc">
          <li><strong className="text-amber-300">Trial mode</strong>: Pins are sandboxed (invisible to public), 1,000 API calls/day</li>
          <li><strong className="text-amber-300">Standard mode</strong>: Pins are public, per-minute rate limits, production-ready</li>
          <li>To get Standard access: submit a <strong className="text-slate-300">demo video</strong> showing your working OAuth flow</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminPinterestSettingsPage;
