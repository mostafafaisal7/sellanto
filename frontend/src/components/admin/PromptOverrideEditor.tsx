import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal } from '../ui';
import {
  adminPromptService,
  type PromptDescriptor,
  type PromptType,
} from '../../services/adminPromptService';

interface Props {
  userId: number;
  prompt: PromptDescriptor;
  onSaved: (updated: PromptDescriptor) => void;
  onOpenAudit: (promptType: PromptType) => void;
}

function findMissingVariables(template: string, expected: string[]): string[] {
  // A variable is "present" if `{name}` appears as an exact token in the template.
  return expected.filter((v) => !new RegExp(`\\{${v}(?:[!:|][^}]*)?\\}`).test(template));
}

export function PromptOverrideEditor({ userId, prompt, onSaved, onOpenAudit }: Props) {
  const hasOverride = !!prompt.override;
  const [text, setText] = useState(prompt.override?.prompt_text ?? '');
  const [isActive, setIsActive] = useState(prompt.override?.is_active ?? true);
  const [showDefault, setShowDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(prompt.override?.prompt_text ?? '');
    setIsActive(prompt.override?.is_active ?? true);
  }, [prompt.override?.id, prompt.override?.prompt_text, prompt.override?.is_active]);

  const missing = useMemo(
    () => findMissingVariables(text, prompt.variables),
    [text, prompt.variables],
  );
  const dirty =
    (prompt.override?.prompt_text ?? '') !== text ||
    (prompt.override?.is_active ?? true) !== isActive;

  const insertVariable = (varName: string) => {
    const placeholder = `{${varName}}`;
    const ta = textareaRef.current;
    if (!ta) {
      setText((prev) => prev + placeholder);
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + placeholder + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + placeholder.length;
      ta.setSelectionRange(cursor, cursor);
    });
  };

  const doSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await adminPromptService.save(userId, prompt.type, text, isActive);
      onSaved({ ...prompt, override: res.override });
      setSuccess('Saved');
      setConfirmSave(false);
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminPromptService.remove(userId, prompt.type);
      onSaved({ ...prompt, override: null });
      setText('');
      setIsActive(true);
      setConfirmReset(false);
      setSuccess('Reset to default');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-text-primary">{prompt.display_name}</h4>
            {hasOverride && isActive ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-coral/15 text-coral border border-coral/20">
                Custom
              </span>
            ) : hasOverride && !isActive ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.06] text-text-muted border border-white/[0.08]">
                Disabled
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-text-muted border border-white/[0.06]">
                Default
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1">{prompt.stage}</p>
        </div>
        <button
          onClick={() => onOpenAudit(prompt.type)}
          className="text-xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/[0.04] flex-shrink-0"
          title="View change history"
        >
          <ClockIcon className="w-3.5 h-3.5" />
          History
        </button>
      </div>

      {/* Variable chips */}
      {prompt.variables.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Available variables (click to insert)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {prompt.variables.map((v) => {
              const isMissing = missing.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className={`text-[11px] font-mono px-2 py-1 rounded-md border transition-colors ${
                    isMissing
                      ? 'bg-amber/10 text-amber border-amber/30 hover:bg-amber/20'
                      : 'bg-white/[0.04] text-text-secondary border-white/[0.08] hover:bg-white/[0.08] hover:text-text-primary'
                  }`}
                >
                  {`{${v}}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Textarea / default preview */}
      {showDefault ? (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Default prompt (read-only)
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary bg-bg-primary/50 border border-white/[0.06] rounded-lg p-3 max-h-64 overflow-y-auto">
            {prompt.default_preview}
          </pre>
        </div>
      ) : (
        <div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={
              hasOverride
                ? ''
                : `(empty) — leaves the system default in place. Click "Show default" to view it.`
            }
            spellCheck={false}
            className="w-full px-3 py-3 font-mono text-xs leading-relaxed bg-bg-primary/60 text-text-primary placeholder:text-text-muted border border-white/[0.08] rounded-lg focus:outline-none focus:border-coral/50 focus:shadow-[0_0_0_3px_rgba(232,54,79,0.15)] resize-y"
          />
          {missing.length > 0 && text.trim() && (
            <div className="mt-2 flex items-start gap-2 text-[11px] text-amber bg-amber/5 border border-amber/20 rounded-lg px-2.5 py-1.5">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Missing expected variables:{' '}
                <span className="font-mono">
                  {missing.map((m) => `{${m}}`).join(', ')}
                </span>
                . Magic Mode will fall back to default at runtime if these are needed.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="text-xs text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="text-xs text-green bg-green/10 border border-green/20 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => setConfirmSave(true)}
          disabled={!dirty || !text.trim() || saving}
          isLoading={saving && confirmSave}
        >
          Save override
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={
            showDefault ? (
              <EyeSlashIcon className="w-4 h-4" />
            ) : (
              <EyeIcon className="w-4 h-4" />
            )
          }
          onClick={() => setShowDefault((v) => !v)}
        >
          {showDefault ? 'Back to editor' : 'Show default'}
        </Button>
        {hasOverride && (
          <>
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-coral"
              />
              Active
            </label>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<TrashIcon className="w-4 h-4" />}
              onClick={() => setConfirmReset(true)}
              className="!text-coral hover:!bg-coral/10"
            >
              Reset to default
            </Button>
          </>
        )}
      </div>

      {/* Save confirmation */}
      <Modal
        isOpen={confirmSave}
        onClose={() => !saving && setConfirmSave(false)}
        size="md"
        showCloseButton={!saving}
        title="Confirm override"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Save this prompt override for{' '}
            <span className="text-text-primary font-semibold">
              {prompt.display_name}
            </span>
            ? The new template will be used immediately on the next Magic Mode run.
          </p>
          {missing.length > 0 && (
            <div className="text-xs text-amber bg-amber/10 border border-amber/20 rounded-lg px-3 py-2 flex items-start gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                {missing.length} expected variable
                {missing.length === 1 ? '' : 's'} missing. Runtime will soft-fall to
                default if formatting fails.
              </span>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfirmSave(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={doSave} isLoading={saving}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset confirmation */}
      <Modal
        isOpen={confirmReset}
        onClose={() => !saving && setConfirmReset(false)}
        size="sm"
        showCloseButton={!saving}
        title="Reset to default?"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            This will delete the custom override and restore the system default for{' '}
            <span className="text-text-primary font-semibold">
              {prompt.display_name}
            </span>
            . The action is recorded in the audit log.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfirmReset(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={doReset}
              isLoading={saving}
              leftIcon={<ArrowPathIcon className="w-4 h-4" />}
            >
              Reset
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PromptOverrideEditor;
