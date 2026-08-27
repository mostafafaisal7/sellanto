/**
 * HelpButton — a small "?" beside a control that explains what it does.
 *
 * Opens on CLICK rather than hover: a hover tooltip needs the cursor to rest
 * for about a second before it appears, which is both easy to miss and
 * expensive to demonstrate in a screen recording. A click is deliberate and
 * shows up immediately.
 *
 * Sized and coloured to double as an on-screen caption. App Review screencasts
 * are watched at whatever size the reviewer's player is, and the guidance asks
 * that the meaning of buttons be explained on screen — so the panel uses
 * 16-18px text rather than the 12px a normal tooltip would, and the trigger is
 * large enough to see the cursor land on it.
 *
 * It is deliberately light-on-dark against the rest of the app. A dark panel
 * reading grey-on-navy is the worst case for video: the contrast is low to
 * begin with and compression eats what is left. Near-black text on white
 * survives re-encoding and reads as an annotation layer rather than as one
 * more dark surface among the app's own.
 *
 * The panel is rendered through a portal into <body> and positioned `fixed`
 * from the button's own rect. The portal is not optional: `position: fixed`
 * resolves against the nearest ancestor carrying a `transform`, and these
 * buttons sit inside framer-motion cards and modals which all set one — so a
 * panel left in place would take viewport coordinates but be positioned
 * against a transformed card, landing off-screen. Going through <body> also
 * escapes `overflow-hidden` clipping and modal stacking contexts.
 *
 *   <HelpButton
 *     title="Post Now"
 *     body="Publishes this post immediately to every platform you selected."
 *   />
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface HelpButtonProps {
  /** What the control is called — matches the button's own label. */
  title: string;
  /** What pressing it actually does. Wrap the words that matter in <strong>;
   *  the panel styles those darker so they carry on a compressed recording. */
  body: ReactNode;
  /** Shown in red when the action is destructive or irreversible. */
  warning?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const PANEL_WIDTH = 440;
// Rough height used only to decide whether the panel opens up or down.
const PANEL_MAX_HEIGHT = 230;

export function HelpButton({
  title,
  body,
  warning,
  size = 'sm',
  className = '',
}: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.bottom + 8;
    // Opens upward instead when there is no room underneath, so a button near
    // the bottom of the window does not get a panel hanging off the screen.
    const room = window.innerHeight - rect.bottom;
    setPos({
      top: room < PANEL_MAX_HEIGHT ? Math.max(8, rect.top - PANEL_MAX_HEIGHT) : below,
      // Clamped so a button near the right edge still shows the whole panel.
      left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8)),
    });
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // The panel is anchored to a rect taken at open time, so it would drift
    // away from its button if the page moved underneath it.
    const onMove = () => setOpen(false);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  const icon = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`What does "${title}" do?`}
        aria-expanded={open}
        onClick={(e) => {
          // These sit inside cards and rows that have their own click targets.
          e.stopPropagation();
          e.preventDefault();
          if (!open) place();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center justify-center rounded-full text-text-muted hover:text-text-primary transition-colors ${className}`}
      >
        <QuestionMarkCircleIcon className={icon} />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`${title} — what this does`}
          style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH }}
          // Above the app's modals, which this can be opened from inside.
          className="fixed z-[9999] overflow-hidden rounded-2xl border-l-8 border-l-coral bg-white px-5 py-4 shadow-2xl shadow-black/70 ring-1 ring-black/20"
        >
          <p className="text-lg font-bold text-slate-900">{title}</p>
          <p className="mt-1.5 text-base leading-relaxed text-slate-700 [&_strong]:font-bold [&_strong]:text-slate-900">
            {body}
          </p>
          {warning && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-base font-semibold leading-relaxed text-red-700 [&_strong]:font-extrabold [&_strong]:underline [&_strong]:decoration-2 [&_strong]:underline-offset-2">
              {warning}
            </p>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

export default HelpButton;
