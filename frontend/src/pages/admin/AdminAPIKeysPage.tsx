import { GlobalAPIKeysPanel } from '../../components/admin/GlobalAPIKeysPanel';

export function AdminAPIKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Global API Keys</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure API keys that power AI features for all users
        </p>
      </div>

      <div className="max-w-xl">
        <GlobalAPIKeysPanel />
      </div>

      <div className="max-w-xl p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-cyan-400">◆</span>
          <p className="text-sm text-cyan-400 font-medium">How it works</p>
        </div>
        <ul className="text-xs text-slate-400 space-y-1 ml-5 list-disc">
          <li>API keys set here are used globally for all users on the platform</li>
          <li>Users consume Diamond Tokens for each AI operation</li>
          <li>Claude is used for text (captions, strategy, analysis)</li>
          <li>OpenAI is used for images (DALL-E) and voice (TTS)</li>
          <li>Gemini is used for images (Imagen) and video generation</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminAPIKeysPage;
