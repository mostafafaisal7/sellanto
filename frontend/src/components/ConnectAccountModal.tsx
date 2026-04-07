import { Link } from 'react-router-dom';

interface ConnectAccountModalProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

export default function ConnectAccountModal({ open, message, onClose }: ConnectAccountModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
      <div
        className="rounded-[24px] p-8 max-w-[420px] w-full mx-4 scale-in"
        style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
      >
        <div className="text-center mb-6">
          <div className="text-[40px] mb-3">🔗</div>
          <h3 className="text-[20px] font-extrabold text-text-primary mb-2">Account Not Connected</h3>
          <p className="text-[14px] text-text-secondary">{message}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/platforms"
            className="w-full py-3.5 rounded-[14px] text-[15px] font-bold text-white text-center transition-all"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
              boxShadow: 'var(--shadow-glow-coral)',
            }}
          >
            Connect Account
          </Link>
          <button
            onClick={onClose}
            className="text-[13px] font-semibold mt-1"
            style={{ color: 'rgb(var(--c-text-muted))' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
