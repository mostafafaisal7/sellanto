/**
 * LeadFormModal
 * =============
 * Build a native Meta Instant Lead Form: name, standard-field checklist, custom
 * short-answer questions, a required privacy-policy URL, and a thank-you screen.
 * Calls adsService.createLeadForm → POST /ads/meta/lead-forms/.
 *
 * Also lists existing forms (listLeadForms) with a "view leads" drill-down
 * (getFormLeads) rendered as a table. All network calls are try/catch guarded
 * with inline error banners.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  XMarkIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import {
  adsService,
  type LeadForm,
  type FormLead,
  type LeadFormQuestion,
} from '../../services/adsService';
import { extractApiError } from '../../utils/extractApiError';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (formId: string) => void;
}

// Standard Meta prefill field types (a subset of the common ones).
const STANDARD_FIELDS: { type: string; label: string }[] = [
  { type: 'FULL_NAME', label: 'Full name' },
  { type: 'EMAIL', label: 'Email' },
  { type: 'PHONE', label: 'Phone number' },
  { type: 'CITY', label: 'City' },
  { type: 'STATE', label: 'State / Province' },
  { type: 'COUNTRY', label: 'Country' },
  { type: 'ZIP', label: 'Postal code' },
  { type: 'COMPANY_NAME', label: 'Company name' },
  { type: 'JOB_TITLE', label: 'Job title' },
];

const BUTTON_TYPES: { value: 'VIEW_WEBSITE' | 'CALL_BUSINESS' | 'DOWNLOAD'; label: string }[] = [
  { value: 'VIEW_WEBSITE', label: 'View website' },
  { value: 'CALL_BUSINESS', label: 'Call business' },
  { value: 'DOWNLOAD', label: 'Download' },
];

interface CustomQuestion {
  label: string;
}

export function LeadFormModal({ isOpen, onClose, onSuccess }: Props) {
  // Builder state
  const [name, setName] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>(['FULL_NAME', 'EMAIL']);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [privacyUrl, setPrivacyUrl] = useState('');
  const [tyTitle, setTyTitle] = useState('');
  const [tyBody, setTyBody] = useState('');
  const [tyButtonText, setTyButtonText] = useState('');
  const [tyButtonType, setTyButtonType] = useState<'VIEW_WEBSITE' | 'CALL_BUSINESS' | 'DOWNLOAD'>('VIEW_WEBSITE');
  const [tyWebsiteUrl, setTyWebsiteUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Existing forms + leads
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [leadsFor, setLeadsFor] = useState<string | null>(null);
  const [leads, setLeads] = useState<FormLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  const loadForms = useCallback(async () => {
    setFormsLoading(true);
    setFormsError(null);
    try {
      const r = await adsService.listLeadForms();
      setForms(r.forms || []);
    } catch (err: unknown) {
      setFormsError(extractApiError(err).message);
      setForms([]);
    } finally {
      setFormsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    setLeadsFor(null);
    setLeads([]);
    loadForms();
  }, [isOpen, loadForms]);

  const toggleField = (type: string) =>
    setSelectedFields((prev) => (prev.includes(type) ? prev.filter((f) => f !== type) : [...prev, type]));

  const addCustom = () => setCustomQuestions((prev) => [...prev, { label: '' }]);
  const patchCustom = (i: number, label: string) =>
    setCustomQuestions((prev) => prev.map((q, j) => (j === i ? { label } : q)));
  const removeCustom = (i: number) => setCustomQuestions((prev) => prev.filter((_, j) => j !== i));

  const validCustom = customQuestions.filter((q) => q.label.trim());
  const totalQuestions = selectedFields.length + validCustom.length;

  const canSubmit = !!name.trim() && totalQuestions > 0 && !!privacyUrl.trim();

  const viewLeads = async (formId: string) => {
    setLeadsFor(formId);
    setLeadsLoading(true);
    setLeadsError(null);
    setLeads([]);
    try {
      const r = await adsService.getFormLeads(formId);
      setLeads(r.leads || []);
    } catch (err: unknown) {
      setLeadsError(extractApiError(err).message);
    } finally {
      setLeadsLoading(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      // Standard fields are `{ type }`; custom are `{ type:'CUSTOM', label }`.
      const questions: LeadFormQuestion[] = [
        ...selectedFields.map((type) => ({ type })),
        ...validCustom.map((q) => ({ type: 'CUSTOM' as const, label: q.label.trim() })),
      ];
      const hasThankYou = tyTitle.trim() || tyBody.trim() || tyButtonText.trim() || tyWebsiteUrl.trim();
      const r = await adsService.createLeadForm({
        name: name.trim(),
        questions,
        privacy_policy_url: privacyUrl.trim(),
        ...(hasThankYou
          ? {
              thank_you: {
                title: tyTitle.trim() || undefined,
                body: tyBody.trim() || undefined,
                button_text: tyButtonText.trim() || undefined,
                button_type: tyButtonType,
                website_url: tyWebsiteUrl.trim() || undefined,
              },
            }
          : {}),
      });
      setResult({ type: 'success', message: `Lead form created (id ${r.form_id}).` });
      onSuccess?.(r.form_id);
      // Reset the builder + refresh the list.
      setName('');
      setCustomQuestions([]);
      await loadForms();
    } catch (err: unknown) {
      setResult({ type: 'error', message: extractApiError(err).message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputCls =
    'w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-dark-800 border border-white/10 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-dark-800 z-10">
          <div className="flex items-center gap-2">
            <ClipboardDocumentListIcon className="w-5 h-5 text-purple-300" />
            <h2 className="text-lg font-bold text-text-primary">Instant Lead Form</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-50">
            <XMarkIcon className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Form name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Newsletter sign-ups" className={inputCls} />
          </div>

          {/* Standard fields */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Fields to collect</label>
            <div className="grid grid-cols-2 gap-2">
              {STANDARD_FIELDS.map((f) => {
                const checked = selectedFields.includes(f.type);
                return (
                  <button key={f.type} type="button" onClick={() => toggleField(f.type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                      checked
                        ? 'bg-purple-500/15 text-purple-200 border border-purple-500/40'
                        : 'bg-dark-900/60 text-text-muted border border-white/10 hover:border-white/20'
                    }`}>
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                      checked ? 'bg-purple-500 border-purple-500 text-white' : 'border-white/20'
                    }`}>
                      {checked ? '✓' : ''}
                    </span>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom questions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-secondary">Custom questions (short answer)</label>
              <button type="button" onClick={addCustom}
                className="flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-purple-200">
                <PlusIcon className="w-3.5 h-3.5" /> Add question
              </button>
            </div>
            {customQuestions.length === 0 ? (
              <p className="text-[10px] text-text-muted">Optional free-text questions in addition to the fields above.</p>
            ) : (
              <div className="space-y-1.5">
                {customQuestions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={q.label} onChange={(e) => patchCustom(i, e.target.value)}
                      placeholder="e.g. What are you looking for?"
                      className="flex-1 bg-dark-900/60 border border-white/10 rounded-xl px-3 py-2 text-text-primary text-sm outline-none" />
                    <button type="button" onClick={() => removeCustom(i)}
                      className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-red-400">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy policy */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Privacy policy URL *</label>
            <input value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)}
              placeholder="https://yoursite.com/privacy" className={inputCls} />
            <p className="text-[10px] text-text-muted mt-1">Meta requires a privacy policy link on every lead form.</p>
          </div>

          {/* Thank-you screen */}
          <div className="rounded-xl border border-white/10 bg-dark-900/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-text-secondary">Thank-you screen (optional)</p>
            <input value={tyTitle} onChange={(e) => setTyTitle(e.target.value)} placeholder="Title (e.g. Thanks!)"
              className="w-full bg-dark-900/60 border border-white/10 rounded-lg px-3 py-2 text-text-primary text-sm outline-none" />
            <textarea value={tyBody} onChange={(e) => setTyBody(e.target.value)} rows={2} placeholder="Body message"
              className="w-full bg-dark-900/60 border border-white/10 rounded-lg px-3 py-2 text-text-primary text-sm outline-none resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={tyButtonText} onChange={(e) => setTyButtonText(e.target.value)} placeholder="Button text"
                className="bg-dark-900/60 border border-white/10 rounded-lg px-3 py-2 text-text-primary text-sm outline-none" />
              <select value={tyButtonType} onChange={(e) => setTyButtonType(e.target.value as typeof tyButtonType)}
                className="bg-dark-900/60 border border-white/10 rounded-lg px-3 py-2 text-text-primary text-sm outline-none">
                {BUTTON_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <input value={tyWebsiteUrl} onChange={(e) => setTyWebsiteUrl(e.target.value)} placeholder="Website URL (for the button)"
              className="w-full bg-dark-900/60 border border-white/10 rounded-lg px-3 py-2 text-text-primary text-sm outline-none" />
          </div>

          {result && (
            <div className={`p-3 rounded-xl flex items-start gap-2 text-xs ${
              result.type === 'success' ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'
            }`}>
              {result.type === 'success'
                ? <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                : <ExclamationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />}
              <p className="whitespace-pre-line">{result.message}</p>
            </div>
          )}

          {/* Create button */}
          <button type="button" onClick={submit} disabled={!canSubmit || submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Creating…' : 'Create lead form'}
          </button>

          {/* Existing forms */}
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs font-semibold text-text-secondary mb-2 pt-2">Existing forms</p>
            {formsError && (
              <div className="mb-2 p-2 rounded-lg bg-red-500/10 text-red-300 text-xs">{formsError}</div>
            )}
            {formsLoading ? (
              <p className="text-xs text-text-muted">Loading forms…</p>
            ) : forms.length === 0 ? (
              <p className="text-xs text-text-muted">No lead forms on this Page yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {forms.map((f) => (
                  <li key={f.id} className="rounded-lg bg-dark-900/60">
                    <div className="flex items-center justify-between gap-2 p-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">{f.name}</p>
                        <p className="text-[10px] text-text-muted">
                          {f.status ? `${f.status} · ` : ''}
                          {typeof f.leads_count === 'number' ? `${f.leads_count} leads` : 'id ' + f.id}
                        </p>
                      </div>
                      <button type="button" onClick={() => viewLeads(f.id)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary text-[11px] font-semibold">
                        <EyeIcon className="w-3.5 h-3.5" /> View leads
                      </button>
                    </div>

                    {leadsFor === f.id && (
                      <div className="px-2.5 pb-2.5">
                        {leadsError ? (
                          <div className="p-2 rounded-lg bg-red-500/10 text-red-300 text-xs">{leadsError}</div>
                        ) : leadsLoading ? (
                          <p className="text-[11px] text-text-muted">Loading leads…</p>
                        ) : leads.length === 0 ? (
                          <p className="text-[11px] text-text-muted">No leads submitted yet.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-white/10">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-text-muted border-b border-white/10">
                                  <th className="text-left font-semibold py-1.5 px-2">Submitted</th>
                                  <th className="text-left font-semibold py-1.5 px-2">Answers</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leads.map((lead) => (
                                  <tr key={lead.id} className="border-b border-white/5 last:border-0 align-top">
                                    <td className="text-text-secondary py-1.5 px-2 whitespace-nowrap">
                                      {lead.created_time ? new Date(lead.created_time).toLocaleString() : '—'}
                                    </td>
                                    <td className="text-text-primary py-1.5 px-2">
                                      {lead.field_data.map((fd, k) => (
                                        <div key={k}>
                                          <span className="text-text-muted">{fd.name}:</span> {fd.values.join(', ')}
                                        </div>
                                      ))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default LeadFormModal;
