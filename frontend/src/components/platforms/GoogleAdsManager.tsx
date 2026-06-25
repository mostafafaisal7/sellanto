import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MegaphoneIcon, PlusIcon, PlayIcon, PauseIcon, ChartBarIcon,
  ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, SparklesIcon,
  PencilSquareIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import googleAdsService from '../../services/googleAdsService';
import GoogleAdsTools from './GoogleAdsTools';
import type {
  GAdsAccount, GAdsCustomer, GAdsCampaign, GAdsInsightRow, CreateCampaignPayload, CampaignType,
  CampaignSuggestion, AudienceCategory, AdRule,
} from '../../services/googleAdsService';

/**
 * Google Ads management surface: connect an ad account (OAuth popup → customer
 * picker), create a Search campaign (with dry-run), and monitor campaigns
 * (pause / resume / pull insights).
 *
 * Mirrors the GoogleBusinessConnect popup pattern. The popup returns a
 * one-time `pending_token`; we then list customers and let the user pick one
 * before persisting an ad account — the refresh token never lives in the
 * browser beyond the signed pending token.
 */

type ConnectStep = 'idle' | 'opening' | 'waiting' | 'picking' | 'error';

const OBJECTIVES = [
  { value: 'traffic', label: 'Traffic / Clicks' },
  { value: 'leads', label: 'Leads' },
  { value: 'sales', label: 'Sales / Conversions' },
  { value: 'awareness', label: 'Awareness' },
  { value: 'engagement', label: 'Engagement' },
];

function dollars(minor: number): string {
  // spend_minor / daily_budget_minor are integer cents.
  return `$${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function GoogleAdsManager() {
  const [status, setStatus] = useState<{
    configured: boolean; oauth_configured: boolean; developer_token_set: boolean;
    accounts: GAdsAccount[]; total_accounts: number;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState('');

  // Connect flow
  const [connectStep, setConnectStep] = useState<ConnectStep>('idle');
  const [pendingToken, setPendingToken] = useState('');
  const [customers, setCustomers] = useState<GAdsCustomer[]>([]);
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Campaigns
  const [campaigns, setCampaigns] = useState<GAdsCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // Insights cache: campaignId → rows
  const [insights, setInsights] = useState<Record<number, GAdsInsightRow[]>>({});
  const [insightsLoading, setInsightsLoading] = useState<number | null>(null);
  // Keyword + search-term drilldowns: campaignId → rows
  const [keywordRows, setKeywordRows] = useState<Record<number, Array<{ keyword: string; match_type: string; impressions: number; clicks: number; cost_micros: number; conversions: number; ctr: number }>>>({});
  const [searchTermRows, setSearchTermRows] = useState<Record<number, Array<{ search_term: string; status: string; impressions: number; clicks: number; cost_micros: number; conversions: number; ctr: number }>>>({});
  const [drillLoading, setDrillLoading] = useState<string | null>(null);  // `${id}:kw` | `${id}:st`
  // Account dashboard
  const [summary, setSummary] = useState<{ campaigns: Array<{ campaign_id: string; name: string; status: string; channel_type: string; impressions: number; clicks: number; cost_micros: number; conversions: number; conversions_value: number; ctr: number }>; totals: { impressions: number; clicks: number; cost_micros: number; conversions: number; conversions_value: number } } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  // Automation rules
  const [rules, setRules] = useState<AdRule[]>([]);
  const [newRule, setNewRule] = useState({ campaign_id: 0, metric: 'cpa', operator: 'gt', threshold: '', lookback_days: 7, action: 'pause', action_value: '' });
  const [ruleSaving, setRuleSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  // Inline edit (live campaign rename + budget)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // Per-campaign manage panel (ad groups / keywords / ads / segments)
  const [manageId, setManageId] = useState<number | null>(null);
  const [mgAdGroups, setMgAdGroups] = useState<Array<{ id: string; name: string; status: string; type: string }>>([]);
  const [mgKeywords, setMgKeywords] = useState<Array<{ criterion_id: string; ad_group_id: string; text: string; match_type: string; status: string; negative: boolean }>>([]);
  const [mgSegments, setMgSegments] = useState<Array<{ segment: string; impressions: number; clicks: number; cost_micros: number; conversions: number }>>([]);
  const [mgSegType, setMgSegType] = useState('device');
  const [mgNewKw, setMgNewKw] = useState({ ad_group_id: '', text: '', match_type: 'BROAD' });
  const [mgLoading, setMgLoading] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [campaignType, setCampaignType] = useState<CampaignType>('search');
  const [form, setForm] = useState<CreateCampaignPayload>({
    ad_account_id: 0, name: '', objective: 'traffic', daily_budget_usd: 10,
    keywords: [], final_url: '', headlines: [], descriptions: [],
  });
  const [keywordsText, setKeywordsText] = useState('');
  const [negativeKeywordsText, setNegativeKeywordsText] = useState('');
  const [headlinesText, setHeadlinesText] = useState('');
  const [descriptionsText, setDescriptionsText] = useState('');
  const [longHeadlinesText, setLongHeadlinesText] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [marketingImagesText, setMarketingImagesText] = useState('');
  const [logoImagesText, setLogoImagesText] = useState('');
  // Video
  const [videoUrl, setVideoUrl] = useState('');
  // Search targeting + extensions
  const [geoText, setGeoText] = useState('');           // comma-separated country codes
  const [scheduleText, setScheduleText] = useState(''); // "MONDAY 9-17" per line
  // Fine-grained targeting
  const [languagesText, setLanguagesText] = useState('');  // "en, es"
  const [devices, setDevices] = useState<string[]>([]);    // KEEP list
  const [excludeAges, setExcludeAges] = useState<string[]>([]);
  const [excludeGenders, setExcludeGenders] = useState<string[]>([]);
  const [radiusText, setRadiusText] = useState('');        // "lat,lng,radius[,unit]" per line
  // Bidding strategy (Search)
  const [biddingStrategy, setBiddingStrategy] = useState('manual_cpc');
  const [targetCpa, setTargetCpa] = useState('');
  const [targetRoas, setTargetRoas] = useState('');
  // A/B variation B (Search)
  const [variantHeadlinesText, setVariantHeadlinesText] = useState('');
  const [variantDescriptionsText, setVariantDescriptionsText] = useState('');
  const [calloutsText, setCalloutsText] = useState(''); // one per line
  const [sitelinksText, setSitelinksText] = useState(''); // "Text | url | desc1 | desc2" per line
  const [snippetHeader, setSnippetHeader] = useState('');
  const [snippetValuesText, setSnippetValuesText] = useState('');
  // PMax asset-group signals (search themes — phrases people search for)
  const [searchThemesText, setSearchThemesText] = useState('');
  // Audience targeting (Display / PMax / Video): picked interest categories
  const [audiences, setAudiences] = useState<AudienceCategory[]>([]);
  const [audQuery, setAudQuery] = useState('');
  const [audResults, setAudResults] = useState<AudienceCategory[]>([]);
  const [audSearching, setAudSearching] = useState(false);
  const [audKind, setAudKind] = useState('interest');  // interest|in_market|affinity|custom|user_list
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  // Conversion tracking
  const [convName, setConvName] = useState('');
  const [convCategory, setConvCategory] = useState('DEFAULT');
  const [convCreating, setConvCreating] = useState(false);
  const [convMsg, setConvMsg] = useState('');

  // AI suggestion
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<'mkt' | 'logo' | null>(null);
  // AI creative generation (image / video)
  const [genImageKind, setGenImageKind] = useState<'marketing' | 'square' | null>(null);
  const [genVideoLoading, setGenVideoLoading] = useState(false);
  const [videoNote, setVideoNote] = useState('');

  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handoffRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef = useRef(false);

  // ── Status ─────────────────────────────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await googleAdsService.getStatus();
      setStatus(data);
      if (data.accounts.length && !form.ad_account_id) {
        setForm((f) => ({ ...f, ad_account_id: data.accounts[0].id }));
      }
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not load Google Ads status.'));
    } finally {
      setStatusLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const data = await googleAdsService.getCampaigns();
      setCampaigns((data.campaigns || []).filter((c) => c.provider === 'google'));
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not load campaigns.'));
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => { refreshStatus(); loadCampaigns(); loadRules(); }, [refreshStatus, loadCampaigns]);

  // ── OAuth popup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (handoffRef.current) clearInterval(handoffRef.current);
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => cleanup(), [cleanup]);

  const autoConnect = useCallback(async (token: string, cust: GAdsCustomer) => {
    setConnecting(true); setError('');
    try {
      await googleAdsService.connect(token, cust.customer_id, undefined, cust.manager_id);
      setConnectStep('idle');
      setCustomers([]); setPendingToken(''); setPickerNotice(null);
      await refreshStatus();
    } catch (err) {
      // Auto-connect failed — fall back to manual picker so the user can retry.
      setError(googleAdsService.readError(err, 'Could not connect this account.'));
      setCustomers([cust]);
      setConnectStep('picking');
    } finally {
      setConnecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshStatus]);

  const fetchCustomers = useCallback(async (token: string) => {
    setConnectStep('picking');
    try {
      const data = await googleAdsService.listCustomers(token);
      const list = data.customers || [];
      setPickerNotice(data.notice || null);
      // True one-click: if exactly one *connectable* (enabled, non-manager) account, connect it.
      const selectable = list.filter((c) => !c.is_manager && (c.connectable ?? true));
      if (selectable.length === 1) {
        await autoConnect(token, selectable[0]);
        return;
      }
      setCustomers(list);
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not list Google ad accounts.'));
      setConnectStep('error');
    }
  }, [autoConnect]);

  const processOAuthResult = useCallback((data: any) => {
    if (handledRef.current) return;
    handledRef.current = true;
    cleanup();
    if (data.type === 'GOOGLE_ADS_OAUTH_SUCCESS' && data.pending_token) {
      setPendingToken(data.pending_token);
      fetchCustomers(data.pending_token);
    } else if (data.type === 'GOOGLE_ADS_OAUTH_ERROR') {
      setError(data.detail || data.title || 'Connection failed.');
      setConnectStep('error');
    }
  }, [cleanup, fetchCustomers]);

  // Recover a handoff that completed while the page was unmounted/reloaded. If
  // the OAuth round-trip reloaded this tab (or returned in a way that re-mounted
  // the page), the in-flight poll is gone, but the callback's pending token is
  // still waiting in the server cache. Claim it once on mount so the picker
  // appears without the user clicking Connect again.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { pending_token } = await googleAdsService.getPending();
        if (!cancelled && pending_token && !handledRef.current) {
          processOAuthResult({ type: 'GOOGLE_ADS_OAUTH_SUCCESS', pending_token });
        }
      } catch { /* no pending handoff — normal */ }
    })();
    return () => { cancelled = true; };
  }, [processOAuthResult]);

  const handleStorage = useCallback((event: StorageEvent) => {
    if (event.key !== 'google_ads_oauth_result' || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      localStorage.removeItem('google_ads_oauth_result');
      if (data?.type?.startsWith('GOOGLE_ADS_OAUTH_')) processOAuthResult(data);
    } catch { /* ignore */ }
  }, [processOAuthResult]);

  const handleMessage = useCallback((event: MessageEvent) => {
    // The payload is a signed, single-use, short-lived token that the server
    // re-validates on /customers/ and /connect/, and this listener is only
    // active during an OAuth popup we just opened. A strict origin check here
    // breaks the common localhost vs 127.0.0.1 host mismatch (different origins
    // => postMessage dropped, localStorage not shared) without adding real
    // security, so we gate on the message shape instead of the origin host.
    if (!event.data?.type?.startsWith('GOOGLE_ADS_OAUTH_')) return;
    processOAuthResult(event.data);
  }, [processOAuthResult]);

  const handleConnect = async () => {
    setError(''); setConnectStep('opening'); handledRef.current = false;
    localStorage.removeItem('google_ads_oauth_result');
    // Drain any stale server-side handoff from an abandoned attempt so the new
    // poll can't fire early with an old token.
    try { await googleAdsService.getPending(); } catch { /* ignore */ }
    try {
      const { auth_url } = await googleAdsService.initiate();
      const W = 650, H = 700;
      const left = window.screenX + Math.round((window.outerWidth - W) / 2);
      const top = window.screenY + Math.round((window.outerHeight - H) / 2);
      popupRef.current = window.open(
        auth_url, 'google_ads_oauth',
        `width=${W},height=${H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`,
      );
      if (!popupRef.current || popupRef.current.closed) {
        setError('Your browser blocked the popup. Allow popups for this site, then try again.');
        setConnectStep('error');
        return;
      }
      setConnectStep('waiting');
      window.addEventListener('message', handleMessage);
      window.addEventListener('storage', handleStorage);
      // Source of truth: poll the server for the pending token the callback
      // stashed. This is origin-independent — unlike postMessage/localStorage,
      // which break across origins (localhost vs 127.0.0.1) and when COOP nulls
      // window.opener after the Google round-trip. Crucially this poll owns its
      // OWN deadline and is NOT torn down by popup-close detection: COOP can make
      // popupRef.closed read true the moment the popup navigates to Google, long
      // before the user finishes consent, so we must keep polling regardless.
      const HANDOFF_TIMEOUT_MS = 180_000; // matches server HANDOFF_TTL
      const startedAt = Date.now();
      handoffRef.current = setInterval(async () => {
        if (handledRef.current) { if (handoffRef.current) clearInterval(handoffRef.current); return; }
        if (Date.now() - startedAt > HANDOFF_TIMEOUT_MS) {
          cleanup();
          setConnectStep((prev) => (prev === 'waiting' ? 'idle' : prev));
          return;
        }
        try {
          const { pending_token } = await googleAdsService.getPending();
          if (pending_token && !handledRef.current) {
            processOAuthResult({ type: 'GOOGLE_ADS_OAUTH_SUCCESS', pending_token });
          }
        } catch { /* keep polling */ }
      }, 1200);
    } catch (err) {
      setError(googleAdsService.readError(err, 'Failed to start Google Ads connection.'));
      setConnectStep('error');
    }
  };

  const handlePickCustomer = async (cust: GAdsCustomer) => {
    setConnecting(true); setError('');
    try {
      await googleAdsService.connect(pendingToken, cust.customer_id, undefined, cust.manager_id);
      setConnectStep('idle');
      setCustomers([]); setPendingToken(''); setPickerNotice(null);
      await refreshStatus();
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not connect this account.'));
    } finally {
      setConnecting(false);
    }
  };

  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  // ── AI suggestion ────────────────────────────────────────────────────────────
  // Apply a suggestion payload to the form. Shared by AI-generate and the
  // restore-from-saved-draft path so reload keeps the generated content.
  const applySuggestion = (g: CampaignSuggestion) => {
    setForm((f) => ({
      ...f,
      name: g.name || f.name,
      objective: g.objective || f.objective,
      daily_budget_usd: g.daily_budget_usd || f.daily_budget_usd,
    }));
    setHeadlinesText((g.headlines || []).join('\n'));
    setDescriptionsText((g.descriptions || []).join('\n'));
    setLongHeadlinesText((g.long_headlines || []).join('\n'));
    setKeywordsText((g.keywords || []).join(', '));
    if (g.business_name) setBusinessName(g.business_name);
    // Extensions, when the AI provided them.
    if (g.callouts?.length) setCalloutsText(g.callouts.join('\n'));
    if (g.sitelinks?.length) {
      setSitelinksText(
        g.sitelinks
          .map((s) => [s.text, s.url, s.description1 || '', s.description2 || ''].join(' | '))
          .join('\n'),
      );
    }
    if (g.snippet_header) setSnippetHeader(g.snippet_header);
    if (g.snippet_values?.length) setSnippetValuesText(g.snippet_values.join('\n'));
    if (g.search_themes?.length) setSearchThemesText(g.search_themes.join('\n'));
  };

  const runSuggest = async () => {
    setAiLoading(true); setError(''); setCreateMsg('');
    try {
      const { suggestion: g } = await googleAdsService.suggestCampaign(aiTopic.trim(), campaignType);
      applySuggestion(g);
      setCreateMsg('✓ AI filled the form — review and edit before creating.');
    } catch (err) {
      setError(googleAdsService.readError(err, 'AI suggestion failed.'));
    } finally {
      setAiLoading(false);
    }
  };

  // Restore the last saved draft for this campaign type so generated content
  // survives a page reload. Runs on mount and whenever campaignType changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await googleAdsService.getDraft(campaignType);
        if (cancelled || !res?.draft) return;
        if (res.draft.topic) setAiTopic(res.draft.topic);
        applySuggestion(res.draft.suggestion);
        setCreateMsg('✓ Restored your last generated draft — regenerate or edit, then create.');
      } catch {
        // No draft / not connected yet — silent, this is best-effort restore.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignType]);

  // ── Image upload (Display/PMax) ────────────────────────────────────────────────
  const handleImageUpload = async (file: File, kind: 'mkt' | 'logo') => {
    setUploadingKind(kind); setError('');
    try {
      const { image_url } = await googleAdsService.uploadImage(file);
      if (kind === 'mkt') {
        setMarketingImagesText((t) => (t ? `${t}\n${image_url}` : image_url));
      } else {
        setLogoImagesText((t) => (t ? `${t}\n${image_url}` : image_url));
      }
    } catch (err) {
      setError(googleAdsService.readError(err, 'Image upload failed.'));
    } finally {
      setUploadingKind(null);
    }
  };

  // ── AI creative generation ─────────────────────────────────────────────────
  // Generate an ad image from the AI topic + Brand DNA and append its URL to the
  // matching image list (marketing/square → marketing images, logo → logos).
  const handleGenerateImage = async (kind: 'marketing' | 'square') => {
    setGenImageKind(kind); setError('');
    try {
      const { image_url } = await googleAdsService.generateImage({
        prompt: aiTopic.trim(), kind, ad_account_id: form.ad_account_id || undefined,
      });
      setMarketingImagesText((t) => (t ? `${t}\n${image_url}` : image_url));
    } catch (err) {
      setError(googleAdsService.readError(err, 'AI image generation failed.'));
    } finally {
      setGenImageKind(null);
    }
  };

  // Generate a video clip. Google only runs videos from YouTube, so we surface
  // the hosted preview URL + the note telling the user to upload it to YouTube.
  const handleGenerateVideo = async () => {
    setGenVideoLoading(true); setError(''); setVideoNote('');
    try {
      const res = await googleAdsService.generateVideo({
        prompt: aiTopic.trim(), aspect_ratio: '16:9', duration: 8,
      });
      // If it was auto-uploaded to YouTube, drop the URL straight into the field.
      if (res.youtube_url) {
        setVideoUrl(res.youtube_url);
        setVideoNote(res.note);
      } else {
        setVideoNote(`${res.note} Preview: ${res.video_url}`);
      }
    } catch (err) {
      setError(googleAdsService.readError(err, 'AI video generation failed.'));
    } finally {
      setGenVideoLoading(false);
    }
  };

  // ── Audience picker (Display / PMax / Video) ──────────────────────────────
  const runAudienceSearch = async () => {
    const q = audQuery.trim();
    if (!form.ad_account_id) return;
    if (audKind === 'interest' && !q) return;  // interest search needs a keyword
    setAudSearching(true); setError('');
    try {
      const { results } = audKind === 'interest'
        ? await googleAdsService.searchAudiences(form.ad_account_id, q)
        : await googleAdsService.listAudiences(form.ad_account_id, audKind, q);
      setAudResults(results || []);
    } catch (err) {
      setError(googleAdsService.readError(err, 'Audience search failed.'));
    } finally {
      setAudSearching(false);
    }
  };
  const addAudience = (a: AudienceCategory) => {
    setAudiences((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]));
  };
  const removeAudience = (id: string) =>
    setAudiences((prev) => prev.filter((a) => a.id !== id));

  // Parse "MONDAY 9-17" lines into ad-schedule slots.
  const parseSchedule = (s: string) =>
    lines(s).map((line) => {
      const m = line.match(/^(\w+)\s+(\d{1,2})\s*-\s*(\d{1,2})$/);
      if (!m) return null;
      return { day: m[1].toUpperCase(), start_hour: Number(m[2]), end_hour: Number(m[3]) };
    }).filter(Boolean) as { day: string; start_hour: number; end_hour: number }[];

  // Parse "Text | url | desc1 | desc2" lines into sitelinks.
  const parseSitelinks = (s: string) =>
    lines(s).map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) return null;
      return { text: parts[0], url: parts[1], description1: parts[2] || '', description2: parts[3] || '' };
    }).filter(Boolean) as { text: string; url: string; description1: string; description2: string }[];

  // ── Create campaign ──────────────────────────────────────────────────────────
  const submitCreate = async (dryRun: boolean) => {
    setCreating(true); setCreateMsg(''); setError('');
    const longHeadlines = lines(longHeadlinesText);
    const payload: CreateCampaignPayload = {
      ...form,
      campaign_type: campaignType,
      keywords: keywordsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      negative_keywords: negativeKeywordsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      headlines: lines(headlinesText),
      descriptions: lines(descriptionsText),
      long_headlines: longHeadlines,
      long_headline: longHeadlines[0] || '',
      business_name: businessName.trim(),
      marketing_image_urls: lines(marketingImagesText),
      logo_image_urls: lines(logoImagesText),
      video_url: videoUrl.trim(),
      geo_targets: geoText.split(/[\n,]/).map((s) => s.trim().toUpperCase()).filter(Boolean),
      ad_schedule: parseSchedule(scheduleText),
      sitelinks: parseSitelinks(sitelinksText),
      callouts: lines(calloutsText),
      snippet_header: snippetHeader.trim(),
      snippet_values: lines(snippetValuesText),
      search_themes: lines(searchThemesText),
      audience_ids: audiences.map((a) => a.id),
      languages: languagesText.split(/[\n,]/).map((s) => s.trim().toLowerCase()).filter(Boolean),
      devices,
      exclude_ages: excludeAges,
      exclude_genders: excludeGenders,
      bidding_strategy: biddingStrategy,
      target_cpa_usd: biddingStrategy === 'target_cpa' ? Number(targetCpa) || 0 : 0,
      target_roas: biddingStrategy === 'target_roas' ? Number(targetRoas) || 0 : 0,
      ad_variations: (lines(variantHeadlinesText).length >= 3 && lines(variantDescriptionsText).length >= 2)
        ? [{ headlines: lines(variantHeadlinesText), descriptions: lines(variantDescriptionsText) }]
        : [],
      radius_targets: lines(radiusText).map((line) => {
        const [lat, lng, radius, unit] = line.split(',').map((p) => p.trim());
        return { lat: Number(lat), lng: Number(lng), radius: Number(radius), unit: unit || 'MILES' };
      }).filter((r) => r.lat && r.lng && r.radius),
      dry_run: dryRun,
    };
    try {
      const res = await googleAdsService.createCampaign(payload);
      if (dryRun) {
        setCreateMsg('✓ Validated by Google — the request is well-formed. Nothing was created.');
      } else {
        setCreateMsg('✓ Campaign created (paused). Resume it when ready to spend.');
        setShowCreate(false);
        await loadCampaigns();
      }
      if (res.warnings?.length) setCreateMsg((m) => `${m} ${res.warnings!.join(' ')}`);
    } catch (err) {
      setError(googleAdsService.readError(err, 'Failed to create the campaign.'));
    } finally {
      setCreating(false);
    }
  };

  // ── Conversion tracking ──────────────────────────────────────────────────────
  const submitConversion = async () => {
    if (!form.ad_account_id || !convName.trim()) return;
    setConvCreating(true); setConvMsg(''); setError('');
    try {
      const res = await googleAdsService.createConversionAction({
        ad_account_id: form.ad_account_id,
        name: convName.trim(),
        category: convCategory,
      });
      setConvMsg(`✓ ${res.note || 'Conversion action created.'}`);
      setConvName('');
    } catch (err) {
      setError(googleAdsService.readError(err, 'Failed to create conversion action.'));
    } finally {
      setConvCreating(false);
    }
  };

  // ── Campaign actions ─────────────────────────────────────────────────────────
  const togglePauseResume = async (c: GAdsCampaign) => {
    if (togglingId === c.id) return;   // guard against double-click
    setTogglingId(c.id); setError('');
    try {
      if (c.status === 'paused' || c.status === 'draft') {
        await googleAdsService.resumeCampaign(c.id);
      } else {
        await googleAdsService.pauseCampaign(c.id);
      }
      await loadCampaigns();
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not change campaign status.'));
    } finally {
      setTogglingId(null);
    }
  };

  const loadInsights = async (c: GAdsCampaign) => {
    setInsightsLoading(c.id); setError('');
    try {
      const data = await googleAdsService.getInsights(c.id);
      setInsights((prev) => ({ ...prev, [c.id]: data.insights || [] }));
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not load insights.'));
    } finally {
      setInsightsLoading(null);
    }
  };

  const loadKeywords = async (c: GAdsCampaign) => {
    setDrillLoading(`${c.id}:kw`); setError('');
    try {
      const data = await googleAdsService.getKeywordInsights(c.id);
      setKeywordRows((p) => ({ ...p, [c.id]: data.keywords || [] }));
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not load keywords.'));
    } finally {
      setDrillLoading(null);
    }
  };
  const loadSearchTerms = async (c: GAdsCampaign) => {
    setDrillLoading(`${c.id}:st`); setError('');
    try {
      const data = await googleAdsService.getSearchTerms(c.id);
      setSearchTermRows((p) => ({ ...p, [c.id]: data.search_terms || [] }));
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not load search terms.'));
    } finally {
      setDrillLoading(null);
    }
  };
  const loadSummary = async () => {
    if (!form.ad_account_id) return;
    setSummaryLoading(true); setError('');
    try {
      const data = await googleAdsService.getAccountSummary(form.ad_account_id, 'last_30d');
      setSummary({ campaigns: data.campaigns, totals: data.totals });
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not load the account dashboard.'));
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadRules = async () => {
    try {
      const data = await googleAdsService.listRules();
      setRules(data.rules || []);
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not load automation rules.'));
    }
  };
  const createRule = async () => {
    if (!newRule.campaign_id || !newRule.threshold) {
      setError('Pick a campaign and set a threshold for the rule.');
      return;
    }
    setRuleSaving(true); setError('');
    try {
      await googleAdsService.createRule({
        campaign_id: newRule.campaign_id, metric: newRule.metric, operator: newRule.operator,
        threshold: Number(newRule.threshold), lookback_days: Number(newRule.lookback_days),
        action: newRule.action, action_value: Number(newRule.action_value) || 0,
      });
      setNewRule({ ...newRule, threshold: '', action_value: '' });
      await loadRules();
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not create the rule.'));
    } finally {
      setRuleSaving(false);
    }
  };
  const toggleRule = async (r: AdRule) => {
    try { await googleAdsService.updateRule(r.id, { is_active: !r.is_active }); await loadRules(); }
    catch (err) { setError(googleAdsService.readError(err, 'Could not update the rule.')); }
  };
  const deleteRule = async (r: AdRule) => {
    try { await googleAdsService.deleteRule(r.id); await loadRules(); }
    catch (err) { setError(googleAdsService.readError(err, 'Could not delete the rule.')); }
  };

  // Per-campaign manage panel: load ad groups + keywords + segments.
  const openManage = async (c: GAdsCampaign) => {
    if (manageId === c.id) { setManageId(null); return; }
    setManageId(c.id); setMgLoading(true); setError('');
    try {
      const [ag, kw, seg] = await Promise.all([
        googleAdsService.listAdGroups(c.id),
        googleAdsService.listKeywordsEdit(c.id),
        googleAdsService.getSegments(c.id, mgSegType, 'last_30d'),
      ]);
      setMgAdGroups(ag.ad_groups || []);
      setMgKeywords(kw.keywords || []);
      setMgSegments(seg.rows || []);
      if (ag.ad_groups?.[0]) setMgNewKw((p) => ({ ...p, ad_group_id: ag.ad_groups[0].id }));
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not load campaign details.'));
    } finally {
      setMgLoading(false);
    }
  };
  const reloadSegments = async (c: GAdsCampaign, segType: string) => {
    setMgSegType(segType);
    try { setMgSegments((await googleAdsService.getSegments(c.id, segType, 'last_30d')).rows || []); }
    catch (err) { setError(googleAdsService.readError(err, 'Could not load segments.')); }
  };
  const mgAddKeyword = async (c: GAdsCampaign) => {
    if (!mgNewKw.ad_group_id || !mgNewKw.text.trim()) return;
    try {
      await googleAdsService.addKeyword(c.id, mgNewKw);
      setMgNewKw({ ...mgNewKw, text: '' });
      setMgKeywords((await googleAdsService.listKeywordsEdit(c.id)).keywords || []);
    } catch (err) { setError(googleAdsService.readError(err, 'Could not add keyword.')); }
  };
  const mgRemoveKeyword = async (c: GAdsCampaign, k: { ad_group_id: string; criterion_id: string }) => {
    try {
      await googleAdsService.removeKeywordEdit(c.id, k.ad_group_id, k.criterion_id);
      setMgKeywords((await googleAdsService.listKeywordsEdit(c.id)).keywords || []);
    } catch (err) { setError(googleAdsService.readError(err, 'Could not remove keyword.')); }
  };
  const mgPauseAdGroup = async (c: GAdsCampaign, ag: { id: string; status: string }) => {
    try {
      await googleAdsService.updateAdGroup(c.id, ag.id, { status: ag.status === 'PAUSED' ? 'ENABLED' : 'PAUSED' });
      setMgAdGroups((await googleAdsService.listAdGroups(c.id)).ad_groups || []);
    } catch (err) { setError(googleAdsService.readError(err, 'Could not update ad group.')); }
  };

  // Inline edit: rename + change daily budget on a live campaign.
  const startEdit = (c: GAdsCampaign) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditBudget((c.daily_budget_minor / 100).toFixed(2));
  };
  const cancelEdit = () => { setEditingId(null); setEditName(''); setEditBudget(''); };
  const saveEdit = async (c: GAdsCampaign) => {
    setSavingEdit(true); setError('');
    try {
      const changes: { name?: string; daily_budget_usd?: number } = {};
      if (editName.trim() && editName.trim() !== c.name) changes.name = editName.trim();
      const b = Number(editBudget);
      if (b > 0 && Math.round(b * 100) !== c.daily_budget_minor) changes.daily_budget_usd = b;
      if (Object.keys(changes).length) await googleAdsService.updateCampaign(c.id, changes);
      cancelEdit();
      await loadCampaigns();
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not update the campaign.'));
    } finally {
      setSavingEdit(false);
    }
  };
  const removeCampaign = async (c: GAdsCampaign) => {
    if (deletingId === c.id) return;
    if (!window.confirm(`Archive "${c.name}"? It will stop serving and be hidden in Google Ads.`)) return;
    setDeletingId(c.id); setError('');
    try {
      await googleAdsService.deleteCampaign(c.id);
      await loadCampaigns();
    } catch (err) {
      setError(googleAdsService.readError(err, 'Could not archive the campaign.'));
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (statusLoading) {
    return <div className="p-6 text-slate-400 text-sm">Loading Google Ads…</div>;
  }

  const connected = (status?.total_accounts || 0) > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MegaphoneIcon className="w-6 h-6 text-[#1a73e8]" />
          <h2 className="text-lg font-semibold text-white">Google Ads</h2>
        </div>
        <button
          onClick={() => { refreshStatus(); loadCampaigns(); }}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
        >
          <ArrowPathIcon className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Not configured warning */}
      {status && !status.configured && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300">
          Google Ads isn't fully configured yet.
          {!status.oauth_configured && ' OAuth client missing.'}
          {!status.developer_token_set && ' Developer token missing.'}
          {' '}An admin can set these in Admin Panel → Google Ads Settings.
        </div>
      )}

      {/* Connect / accounts */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        {!connected ? (
          <div className="text-center py-4">
            <p className="text-slate-300 text-sm mb-3">Connect a Google Ads account to create and manage campaigns.</p>
            <button
              onClick={handleConnect}
              disabled={!status?.oauth_configured || connectStep === 'waiting' || connectStep === 'opening'}
              className="inline-flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1765cc] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <MegaphoneIcon className="w-4 h-4" />
              {connectStep === 'waiting' ? 'Waiting for Google…' : 'Connect Google Ads'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircleIcon className="w-5 h-5" /> Connected
            </div>
            {status!.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                <div>
                  <div className="text-white text-sm">{a.name || a.external_id}</div>
                  <div className="text-slate-500 text-xs">ID {a.external_id} · {a.currency_code || '—'}</div>
                </div>
              </div>
            ))}
            <button onClick={handleConnect} className="text-xs text-[#1a73e8] hover:underline">+ Connect another account</button>
          </div>
        )}

        {/* Customer picker */}
        {connectStep === 'picking' && (
          <div className="mt-4 border-t border-slate-700 pt-4">
            <p className="text-slate-300 text-sm mb-2">Pick the account to manage:</p>
            {pickerNotice && (
              <p className="text-amber-300/90 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-3">
                {pickerNotice}
              </p>
            )}
            {customers.length === 0 ? (
              !pickerNotice && (
                <p className="text-slate-500 text-xs">No accessible ad accounts found for this Google login.</p>
              )
            ) : (
              <div className="space-y-2">
                {customers.map((c) => {
                  const isDraft = !!c.status && c.status !== 'ENABLED';
                  const notSelectable = c.is_manager || (c.connectable === false);
                  return (
                  <button
                    key={c.customer_id}
                    onClick={() => handlePickCustomer(c)}
                    disabled={connecting || notSelectable}
                    className="w-full text-left bg-slate-900/50 hover:bg-slate-900 disabled:opacity-50 rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <span>
                      <span className="text-white text-sm">{c.name || c.customer_id}</span>
                      <span className="text-slate-500 text-xs block">
                        ID {c.customer_id} · {c.currency_code || '—'}
                        {c.is_manager && ' · Manager (not selectable)'}
                        {isDraft && ` · ${c.status} (finish setup in Google Ads)`}
                        {c.is_test_account && ' · TEST'}
                      </span>
                    </span>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create campaign */}
      {connected && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-medium">Create a Campaign</h3>
            <button
              onClick={() => setShowCreate((s) => !s)}
              className="inline-flex items-center gap-1 text-xs text-[#1a73e8] hover:underline"
            >
              <PlusIcon className="w-4 h-4" /> {showCreate ? 'Hide' : 'New campaign'}
            </button>
          </div>

          {createMsg && <p className="mt-2 text-emerald-400 text-xs">{createMsg}</p>}

          {showCreate && (
            <div className="mt-4 space-y-3">
              {/* Campaign type selector */}
              <div className="flex gap-2">
                {(['search', 'display', 'pmax', 'video'] as CampaignType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCampaignType(t)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border ${campaignType === t
                      ? 'bg-[#1a73e8] border-[#1a73e8] text-white'
                      : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {t === 'search' ? 'Search' : t === 'display' ? 'Display'
                      : t === 'pmax' ? 'Performance Max' : 'Video'}
                  </button>
                ))}
              </div>

              {/* AI suggest bar */}
              <div className="flex gap-2 items-end bg-slate-900/40 border border-slate-700 rounded-lg p-2">
                <label className="block flex-1">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3 text-[#1a73e8]" /> Topic / offer for AI
                  </span>
                  <input
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="e.g. spring sale on running shoes"
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <button
                  onClick={runSuggest}
                  disabled={aiLoading}
                  className="bg-[#1a73e8]/20 border border-[#1a73e8]/40 text-[#8ab4f8] hover:bg-[#1a73e8]/30 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                >
                  {aiLoading ? 'Thinking…' : 'Generate with AI'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-slate-400 text-xs">Ad account</span>
                  <select
                    value={form.ad_account_id}
                    onChange={(e) => setForm({ ...form, ad_account_id: Number(e.target.value) })}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                  >
                    {status!.accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name || a.external_id}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 text-xs">Objective</span>
                  <select
                    value={form.objective}
                    onChange={(e) => setForm({ ...form, objective: e.target.value })}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                  >
                    {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-slate-400 text-xs">Campaign name</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                    placeholder="Spring Sale"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400 text-xs">Daily budget (USD)</span>
                  <input
                    type="number" min={1} step={0.5}
                    value={form.daily_budget_usd}
                    onChange={(e) => setForm({ ...form, daily_budget_usd: Number(e.target.value) })}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-slate-400 text-xs">Landing page URL (needed to attach an ad)</span>
                <input
                  value={form.final_url}
                  onChange={(e) => setForm({ ...form, final_url: e.target.value })}
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                  placeholder="https://example.com/spring"
                />
              </label>

              {(campaignType === 'video' || campaignType === 'pmax') && (
                <label className="block">
                  <span className="text-slate-400 text-xs flex items-center justify-between gap-2">
                    <span>
                      YouTube video URL or ID
                      {campaignType === 'pmax' ? ' (optional — adds a video asset)' : ' (required)'}
                    </span>
                    <button type="button" onClick={handleGenerateVideo}
                      disabled={genVideoLoading}
                      className="text-[#8ab4f8] hover:underline disabled:opacity-50 inline-flex items-center gap-0.5 whitespace-nowrap">
                      <SparklesIcon className="w-3 h-3" />
                      {genVideoLoading ? 'Generating…' : 'AI generate video'}
                    </button>
                  </span>
                  <input
                    value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                    placeholder="https://www.youtube.com/watch?v=…"
                  />
                  <span className="text-[10px] text-slate-500">
                    {campaignType === 'video'
                      ? "Google only runs videos hosted on YouTube. Test accounts can't create video campaigns."
                      : 'If set, the video is added to the PMax asset group alongside the images.'}
                  </span>
                  {videoNote && (
                    <span className="mt-1 block text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1 break-all">
                      {videoNote}
                    </span>
                  )}
                </label>
              )}

              {campaignType === 'search' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-400 text-xs">Keywords (comma or newline separated)</span>
                    <textarea
                      value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} rows={2}
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                      placeholder={'running shoes\n"marathon gear"\n[trail running shoes]'}
                    />
                    <span className="text-[10px] text-slate-500">
                      Match type: plain = broad, "quotes" = phrase, [brackets] = exact.
                    </span>
                  </label>
                  <label className="block">
                    <span className="text-slate-400 text-xs">Negative keywords (don't show for these)</span>
                    <textarea
                      value={negativeKeywordsText} onChange={(e) => setNegativeKeywordsText(e.target.value)} rows={2}
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                      placeholder={'free\ncheap\nused'}
                    />
                    <span className="text-[10px] text-slate-500">
                      Blocks wasted clicks. Same match-type syntax applies.
                    </span>
                  </label>
                </div>
              )}

              {campaignType === 'search' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-400 text-xs">Bidding strategy</span>
                    <select
                      value={biddingStrategy} onChange={(e) => setBiddingStrategy(e.target.value)}
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                    >
                      <option value="manual_cpc">Manual CPC</option>
                      <option value="maximize_clicks">Maximize clicks</option>
                      <option value="maximize_conversions">Maximize conversions</option>
                      <option value="target_cpa">Target CPA</option>
                      <option value="maximize_conversion_value">Maximize conversion value</option>
                      <option value="target_roas">Target ROAS</option>
                    </select>
                  </label>
                  {biddingStrategy === 'target_cpa' && (
                    <label className="block">
                      <span className="text-slate-400 text-xs">Target CPA (USD)</span>
                      <input type="number" min={0} step={0.5}
                        value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder="e.g. 20" />
                    </label>
                  )}
                  {biddingStrategy === 'target_roas' && (
                    <label className="block">
                      <span className="text-slate-400 text-xs">Target ROAS (ratio, e.g. 4 = 400%)</span>
                      <input type="number" min={0} step={0.1}
                        value={targetRoas} onChange={(e) => setTargetRoas(e.target.value)}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder="e.g. 4" />
                    </label>
                  )}
                </div>
              )}

              {campaignType === 'search' && (
                <details className="border-t border-slate-700 pt-3">
                  <summary className="text-slate-300 text-xs cursor-pointer select-none">
                    A/B test — second ad variation (optional)
                  </summary>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <label className="block">
                      <span className="text-slate-400 text-xs">Variation B headlines (≥3, one per line)</span>
                      <textarea
                        value={variantHeadlinesText} onChange={(e) => setVariantHeadlinesText(e.target.value)} rows={3}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder={'Different Angle\nNew Hook\nFresh Offer'}
                      />
                    </label>
                    <label className="block">
                      <span className="text-slate-400 text-xs">Variation B descriptions (≥2, one per line)</span>
                      <textarea
                        value={variantDescriptionsText} onChange={(e) => setVariantDescriptionsText(e.target.value)} rows={3}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder={'A second message to test.\nGoogle rotates and optimizes.'}
                      />
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Creates a second RSA in the same ad group. Google serves both and learns which performs better.
                  </span>
                </details>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-slate-400 text-xs">
                    Headlines (one per line, {campaignType === 'display' ? '≥1' : '≥3'}, ≤30 chars)
                  </span>
                  <textarea
                    value={headlinesText} onChange={(e) => setHeadlinesText(e.target.value)} rows={3}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                    placeholder={'Free Shipping\nShop the Sale\nLimited Time'}
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400 text-xs">Descriptions (one per line, ≥2, ≤90 chars)</span>
                  <textarea
                    value={descriptionsText} onChange={(e) => setDescriptionsText(e.target.value)} rows={3}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                    placeholder={'Save big this week only.\nQuality gear for every runner.'}
                  />
                </label>
              </div>

              {/* Display + PMax extra assets */}
              {(campaignType === 'display' || campaignType === 'pmax') && (
                <div className="space-y-3 border-t border-slate-700 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-slate-400 text-xs">
                        Long headline{campaignType === 'pmax' ? 's (one per line, ≤90)' : ' (≤90 chars)'}
                      </span>
                      <textarea
                        value={longHeadlinesText} onChange={(e) => setLongHeadlinesText(e.target.value)}
                        rows={2}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder="The best running gear, delivered fast"
                      />
                    </label>
                    <label className="block">
                      <span className="text-slate-400 text-xs">Business name (≤25 chars)</span>
                      <input
                        value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder="Acme Running"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-slate-400 text-xs flex items-center justify-between gap-2">
                        <span>Marketing image URLs (one per line)</span>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <button type="button" onClick={() => handleGenerateImage('marketing')}
                            disabled={!!genImageKind}
                            className="text-[#8ab4f8] hover:underline disabled:opacity-50 inline-flex items-center gap-0.5">
                            <SparklesIcon className="w-3 h-3" />
                            {genImageKind === 'marketing' ? 'Generating…' : 'AI 1.91:1'}
                          </button>
                          <button type="button" onClick={() => handleGenerateImage('square')}
                            disabled={!!genImageKind}
                            className="text-[#8ab4f8] hover:underline disabled:opacity-50 inline-flex items-center gap-0.5">
                            <SparklesIcon className="w-3 h-3" />
                            {genImageKind === 'square' ? 'Generating…' : 'AI 1:1'}
                          </button>
                          <span className="relative">
                            <input type="file" accept="image/*"
                              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'mkt')}
                              className="absolute inset-0 opacity-0 w-full cursor-pointer" />
                            <span className="text-[#8ab4f8] hover:underline cursor-pointer">
                              {uploadingKind === 'mkt' ? 'Uploading…' : '+ Upload'}
                            </span>
                          </span>
                        </span>
                      </span>
                      <textarea
                        value={marketingImagesText} onChange={(e) => setMarketingImagesText(e.target.value)}
                        rows={2}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder="https://…/banner.jpg"
                      />
                    </label>
                    <label className="block">
                      <span className="text-slate-400 text-xs flex items-center justify-between gap-2">
                        <span>Logo image URLs (one per line)</span>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <span className="relative">
                            <input type="file" accept="image/*"
                              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')}
                              className="absolute inset-0 opacity-0 w-full cursor-pointer" />
                            <span className="text-[#8ab4f8] hover:underline cursor-pointer">
                              {uploadingKind === 'logo' ? 'Uploading…' : '+ Upload'}
                            </span>
                          </span>
                        </span>
                      </span>
                      <textarea
                        value={logoImagesText} onChange={(e) => setLogoImagesText(e.target.value)}
                        rows={2}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder="https://…/logo.png"
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Image URLs must be publicly reachable — Google downloads them. Uploads are hosted on this server.
                  </p>

                  {campaignType === 'pmax' && (
                    <label className="block">
                      <span className="text-slate-400 text-xs">
                        Search themes (one per line — phrases your customers search for)
                      </span>
                      <textarea
                        value={searchThemesText} onChange={(e) => setSearchThemesText(e.target.value)}
                        rows={2}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder={'running shoes\nmarathon training gear'}
                      />
                      <span className="text-[10px] text-slate-500">
                        Signals that steer Performance Max — they guide, not restrict, where ads show.
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Targeting & extensions (geo + schedule for all types; audiences
                  for Display/PMax/Video; ad extensions for Search) */}
              <details className="border-t border-slate-700 pt-3">
                <summary className="text-slate-300 text-xs cursor-pointer select-none">
                  Targeting{campaignType === 'search' ? ' & ad extensions' : ' & audiences'} (optional)
                </summary>
                <div className="space-y-3 mt-3">
                  {/* Geo + schedule — universal */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-slate-400 text-xs">Locations (country codes, comma-separated)</span>
                      <input
                        value={geoText} onChange={(e) => setGeoText(e.target.value)}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder="US, GB, CA"
                      />
                      <span className="text-[10px] text-slate-500">Supported: US, GB, CA, AU, IN, DE, FR, BD, AE, SG, PK, NG, ZA, BR, JP</span>
                    </label>
                    <label className="block">
                      <span className="text-slate-400 text-xs">Ad schedule (one per line: DAY start-end)</span>
                      <textarea
                        value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} rows={2}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder={'MONDAY 9-17\nSATURDAY 10-14'}
                      />
                    </label>
                  </div>

                  {/* Fine-grained targeting (Search-complete) */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-slate-400 text-xs">Languages (ISO codes)</span>
                      <input
                        value={languagesText} onChange={(e) => setLanguagesText(e.target.value)}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder="en, es, fr"
                      />
                      <span className="text-[10px] text-slate-500">en, de, fr, es, it, ja, pt, zh, ar, ru, hi, bn, ur, id, ms, ko</span>
                    </label>
                    <label className="block">
                      <span className="text-slate-400 text-xs">Radius targets (lat,lng,radius[,MILES|KILOMETERS])</span>
                      <textarea
                        value={radiusText} onChange={(e) => setRadiusText(e.target.value)} rows={2}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        placeholder={'40.7128,-74.0060,25,MILES'}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 text-xs block mb-1">Devices (keep)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['MOBILE', 'DESKTOP', 'TABLET'].map((d) => {
                          const on = devices.includes(d);
                          return (
                            <button key={d} type="button"
                              onClick={() => setDevices((p) => on ? p.filter((x) => x !== d) : [...p, d])}
                              className={`text-[11px] rounded-full px-2 py-0.5 border ${on
                                ? 'bg-[#1a73e8] border-[#1a73e8] text-white'
                                : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                              {d[0] + d.slice(1).toLowerCase()}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-slate-500">None = all devices</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block mb-1">Exclude ages</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((a) => {
                          const on = excludeAges.includes(a);
                          return (
                            <button key={a} type="button"
                              onClick={() => setExcludeAges((p) => on ? p.filter((x) => x !== a) : [...p, a])}
                              className={`text-[11px] rounded-full px-2 py-0.5 border ${on
                                ? 'bg-red-500/30 border-red-500/50 text-red-200'
                                : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                              {a}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block mb-1">Exclude genders</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['male', 'female'].map((g) => {
                          const on = excludeGenders.includes(g);
                          return (
                            <button key={g} type="button"
                              onClick={() => setExcludeGenders((p) => on ? p.filter((x) => x !== g) : [...p, g])}
                              className={`text-[11px] rounded-full px-2 py-0.5 border ${on
                                ? 'bg-red-500/30 border-red-500/50 text-red-200'
                                : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                              {g[0].toUpperCase() + g.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Audience picker — Display / PMax / Video */}
                  {campaignType !== 'search' && (
                    <div className="space-y-2">
                      <span className="text-slate-400 text-xs block">
                        Audiences ({campaignType === 'pmax' ? 'PMax signals' : 'interest targeting'})
                      </span>
                      <div className="flex gap-2">
                        <select value={audKind} onChange={(e) => { setAudKind(e.target.value); setAudResults([]); }}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
                          <option value="interest">Interests</option>
                          <option value="in_market">In-market</option>
                          <option value="affinity">Affinity</option>
                          <option value="custom">Custom</option>
                          <option value="user_list">Remarketing / Customer Match</option>
                        </select>
                        <input
                          value={audQuery}
                          onChange={(e) => setAudQuery(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runAudienceSearch(); } }}
                          placeholder={audKind === 'user_list' ? 'Leave blank to list all, or filter…' : 'Search, e.g. fitness, travel, gaming'}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                        />
                        <button
                          type="button" onClick={runAudienceSearch}
                          disabled={audSearching || !form.ad_account_id || (audKind === 'interest' && !audQuery.trim())}
                          className="border border-slate-600 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap"
                        >
                          {audSearching ? 'Searching…' : 'Search'}
                        </button>
                      </div>
                      {/* Selected chips */}
                      {audiences.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {audiences.map((a) => (
                            <span key={a.id}
                              className="inline-flex items-center gap-1 bg-[#1a73e8]/20 border border-[#1a73e8]/40 text-[#8ab4f8] text-[11px] rounded-full px-2 py-0.5">
                              {a.name}
                              <button type="button" onClick={() => removeAudience(a.id)}
                                className="hover:text-white">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Results */}
                      {audResults.length > 0 && (
                        <div className="max-h-40 overflow-y-auto bg-slate-900/50 border border-slate-700 rounded-lg divide-y divide-slate-800">
                          {audResults.map((a) => {
                            const picked = audiences.some((x) => x.id === a.id);
                            return (
                              <button key={a.id} type="button" onClick={() => addAudience(a)}
                                disabled={picked}
                                className="w-full text-left px-2 py-1.5 hover:bg-slate-800 disabled:opacity-40 flex items-center justify-between">
                                <span className="text-slate-200 text-xs">{a.name}</span>
                                <span className="text-slate-500 text-[10px]">{picked ? 'Added' : a.taxonomy}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {campaignType === 'pmax'
                          ? 'Added as audience signals to guide Performance Max.'
                          : 'Targets people in these interest categories.'}
                      </span>
                    </div>
                  )}

                  {/* Search-only ad extensions */}
                  {campaignType === 'search' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-slate-400 text-xs">Callouts (one per line, ≤25 chars)</span>
                          <textarea
                            value={calloutsText} onChange={(e) => setCalloutsText(e.target.value)} rows={2}
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                            placeholder={'Free Shipping\n24/7 Support'}
                          />
                        </label>
                        <label className="block">
                          <span className="text-slate-400 text-xs">Sitelinks (one per line: Text | url | desc1 | desc2)</span>
                          <textarea
                            value={sitelinksText} onChange={(e) => setSitelinksText(e.target.value)} rows={2}
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                            placeholder={'Shop | https://site.com/shop | Browse all | Top picks'}
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-slate-400 text-xs">Snippet header</span>
                          <input
                            value={snippetHeader} onChange={(e) => setSnippetHeader(e.target.value)}
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                            placeholder="Brands / Services / Types"
                          />
                        </label>
                        <label className="block">
                          <span className="text-slate-400 text-xs">Snippet values (one per line, ≥3, ≤25 chars)</span>
                          <textarea
                            value={snippetValuesText} onChange={(e) => setSnippetValuesText(e.target.value)} rows={2}
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                            placeholder={'Nike\nAdidas\nPuma'}
                          />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </details>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => submitCreate(false)}
                  disabled={creating || !form.name || !form.ad_account_id || !(form.daily_budget_usd >= 1)}
                  className="bg-[#1a73e8] hover:bg-[#1765cc] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                >
                  {creating ? 'Working…' : 'Create (paused)'}
                </button>
                <button
                  onClick={() => submitCreate(true)}
                  disabled={creating || !form.name || !form.ad_account_id || !(form.daily_budget_usd >= 1)}
                  className="border border-slate-600 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-4 py-1.5 rounded-lg text-sm"
                >
                  Validate only (dry run)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Account dashboard (last 30 days rollup) */}
      {connected && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-medium">Account dashboard (last 30 days)</h3>
            <button onClick={loadSummary} disabled={summaryLoading}
              className="text-xs text-[#1a73e8] hover:underline disabled:opacity-50 flex items-center gap-1">
              <ChartBarIcon className="w-4 h-4" /> {summaryLoading ? 'Loading…' : (summary ? 'Refresh' : 'Load dashboard')}
            </button>
          </div>
          {summary && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  ['Impressions', summary.totals.impressions.toLocaleString()],
                  ['Clicks', summary.totals.clicks.toLocaleString()],
                  ['Spend', dollars(Math.round(summary.totals.cost_micros / 10000))],
                  ['Conv.', summary.totals.conversions.toFixed(1)],
                  ['Conv. value', dollars(Math.round(summary.totals.conversions_value * 100))],
                ].map(([label, val]) => (
                  <div key={label} className="bg-slate-900/50 rounded-lg py-2">
                    <div className="text-white text-sm font-semibold">{val}</div>
                    <div className="text-slate-500 text-[10px]">{label}</div>
                  </div>
                ))}
              </div>
              {summary.campaigns.length > 0 && (
                <table className="w-full text-xs text-slate-300">
                  <thead className="text-slate-500">
                    <tr><th className="text-left">Campaign</th><th className="text-right">Impr.</th><th className="text-right">Clicks</th><th className="text-right">Spend</th><th className="text-right">Conv.</th></tr>
                  </thead>
                  <tbody>
                    {summary.campaigns.filter((r) => r.status !== 'REMOVED').slice(0, 20).map((r) => (
                      <tr key={r.campaign_id}>
                        <td className="truncate max-w-[160px]">{r.name}</td>
                        <td className="text-right">{r.impressions.toLocaleString()}</td>
                        <td className="text-right">{r.clicks.toLocaleString()}</td>
                        <td className="text-right">{dollars(Math.round(r.cost_micros / 10000))}</td>
                        <td className="text-right">{r.conversions.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Advanced tools (keyword planner, recommendations, change history, etc.) */}
      {connected && form.ad_account_id ? (
        <details className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <summary className="text-white text-sm font-medium cursor-pointer select-none">
            Advanced tools (Keyword Planner, Recommendations, Change history, Shared budgets, Labels, Customer Match, Experiments)
          </summary>
          <div className="mt-3">
            <GoogleAdsTools
              adAccountId={form.ad_account_id}
              campaigns={campaigns.filter((c) => c.status !== 'REMOVED').map((c) => ({ id: c.id, name: c.name }))}
            />
          </div>
        </details>
      ) : null}

      {/* Automation rules */}
      {connected && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <details>
            <summary className="text-white text-sm font-medium cursor-pointer select-none">
              Automation rules (auto-pause / budget pacing)
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-slate-500">
                Rules run every 30 minutes against each campaign's recent metrics. Example:
                "if CPA &gt; $50 over 7 days → pause". You're always notified when a rule fires.
              </p>
              {/* New rule builder */}
              <div className="grid grid-cols-6 gap-2 items-end bg-slate-900/40 border border-slate-700 rounded-lg p-2">
                <label className="block col-span-2">
                  <span className="text-slate-400 text-[10px]">Campaign</span>
                  <select value={newRule.campaign_id}
                    onChange={(e) => setNewRule({ ...newRule, campaign_id: Number(e.target.value) })}
                    className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white">
                    <option value={0}>Select…</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 text-[10px]">Metric</span>
                  <select value={newRule.metric} onChange={(e) => setNewRule({ ...newRule, metric: e.target.value })}
                    className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white">
                    {['spend', 'cpc', 'ctr', 'conversions', 'cpa'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 text-[10px]">Op</span>
                  <select value={newRule.operator} onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                    className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white">
                    <option value="gt">&gt;</option><option value="lt">&lt;</option>
                    <option value="gte">≥</option><option value="lte">≤</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 text-[10px]">Threshold</span>
                  <input value={newRule.threshold} onChange={(e) => setNewRule({ ...newRule, threshold: e.target.value })}
                    type="number" step="0.01"
                    className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 text-[10px]">Action</span>
                  <select value={newRule.action} onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                    className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white">
                    <option value="pause">Pause</option>
                    <option value="notify">Notify</option>
                    <option value="increase_budget">Budget +%</option>
                    <option value="decrease_budget">Budget −%</option>
                  </select>
                </label>
              </div>
              <button onClick={createRule} disabled={ruleSaving}
                className="bg-[#1a73e8] hover:bg-[#1765cc] disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium">
                {ruleSaving ? 'Saving…' : 'Add rule'}
              </button>

              {/* Existing rules */}
              {rules.length > 0 && (
                <div className="space-y-1.5">
                  {rules.map((r) => (
                    <div key={r.id} className="flex items-center justify-between bg-slate-900/50 rounded px-2 py-1.5 text-xs">
                      <span className="text-slate-300">
                        <span className={r.is_active ? 'text-emerald-400' : 'text-slate-500'}>●</span>{' '}
                        {r.metric.toUpperCase()} {r.operator} {r.threshold} ({r.lookback_days}d) → {r.action}
                        {r.trigger_count > 0 && <span className="text-amber-400"> · fired {r.trigger_count}×</span>}
                      </span>
                      <span className="flex gap-2">
                        <button onClick={() => toggleRule(r)} className="text-slate-400 hover:text-white">
                          {r.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => deleteRule(r)} className="text-red-300 hover:text-red-200">Delete</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* Conversion tracking */}
      {connected && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <details>
            <summary className="text-white text-sm font-medium cursor-pointer select-none">
              Conversion tracking (measure leads / sales)
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-slate-500">
                Creates a website conversion action on your account. Add the Google tag to your
                site and fire it on the success page to track results. Test accounts validate but
                report no data.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-slate-400 text-xs">Conversion name</span>
                  <input
                    value={convName} onChange={(e) => setConvName(e.target.value)}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                    placeholder="Purchase / Lead form submit"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400 text-xs">Category</span>
                  <select
                    value={convCategory} onChange={(e) => setConvCategory(e.target.value)}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                  >
                    {['DEFAULT', 'PURCHASE', 'SIGNUP', 'LEAD', 'PAGE_VIEW', 'DOWNLOAD', 'ADD_TO_CART'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                onClick={submitConversion}
                disabled={convCreating || !convName.trim() || !form.ad_account_id}
                className="bg-[#1a73e8] hover:bg-[#1765cc] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
              >
                {convCreating ? 'Working…' : 'Create conversion action'}
              </button>
              {convMsg && <p className="text-emerald-400 text-xs">{convMsg}</p>}
            </div>
          </details>
        </div>
      )}

      {/* Campaign monitor */}
      {connected && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-sm font-medium">Campaigns</h3>
            <button onClick={loadCampaigns} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
              <ArrowPathIcon className="w-4 h-4" /> Reload
            </button>
          </div>

          {campaignsLoading ? (
            <p className="text-slate-500 text-xs">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-slate-500 text-xs">No Google campaigns yet.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="bg-slate-900/50 rounded-lg p-3">
                  {editingId === c.id ? (
                    /* Inline edit form (live rename + budget) */
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="text-slate-400 text-[11px]">Name</span>
                          <input
                            value={editName} onChange={(e) => setEditName(e.target.value)}
                            className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                          />
                        </label>
                        <label className="block">
                          <span className="text-slate-400 text-[11px]">Daily budget (USD)</span>
                          <input
                            type="number" min={1} step={0.5}
                            value={editBudget} onChange={(e) => setEditBudget(e.target.value)}
                            className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEdit(c)} disabled={savingEdit}
                          className="bg-[#1a73e8] hover:bg-[#1765cc] disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium">
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={cancelEdit} disabled={savingEdit}
                          className="border border-slate-600 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded text-xs">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">{c.name}</div>
                      <div className="text-slate-500 text-xs">
                        {c.objective} · {dollars(c.daily_budget_minor)}/day · <span className="uppercase">{c.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePauseResume(c)}
                        disabled={togglingId === c.id}
                        className="text-xs flex items-center gap-1 text-slate-300 hover:text-white border border-slate-600 rounded px-2 py-1 disabled:opacity-50"
                      >
                        {c.status === 'paused' || c.status === 'draft'
                          ? <><PlayIcon className="w-3.5 h-3.5" /> Resume</>
                          : <><PauseIcon className="w-3.5 h-3.5" /> Pause</>}
                      </button>
                      <button
                        onClick={() => loadInsights(c)}
                        disabled={insightsLoading === c.id}
                        className="text-xs flex items-center gap-1 text-slate-300 hover:text-white border border-slate-600 rounded px-2 py-1 disabled:opacity-50"
                      >
                        <ChartBarIcon className="w-3.5 h-3.5" />
                        {insightsLoading === c.id ? '…' : 'Insights'}
                      </button>
                      <button
                        onClick={() => loadKeywords(c)}
                        disabled={drillLoading === `${c.id}:kw`}
                        title="Per-keyword performance"
                        className="text-xs text-slate-300 hover:text-white border border-slate-600 rounded px-2 py-1 disabled:opacity-50"
                      >
                        {drillLoading === `${c.id}:kw` ? '…' : 'Keywords'}
                      </button>
                      <button
                        onClick={() => loadSearchTerms(c)}
                        disabled={drillLoading === `${c.id}:st`}
                        title="Actual search queries"
                        className="text-xs text-slate-300 hover:text-white border border-slate-600 rounded px-2 py-1 disabled:opacity-50"
                      >
                        {drillLoading === `${c.id}:st` ? '…' : 'Terms'}
                      </button>
                      <button
                        onClick={() => openManage(c)}
                        title="Manage ad groups, keywords, segments"
                        className="text-xs flex items-center gap-1 text-slate-300 hover:text-white border border-slate-600 rounded px-2 py-1"
                      >
                        {manageId === c.id ? 'Close' : 'Manage'}
                      </button>
                      <button
                        onClick={() => startEdit(c)}
                        title="Edit name / budget"
                        className="text-xs flex items-center gap-1 text-slate-300 hover:text-white border border-slate-600 rounded px-2 py-1"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => removeCampaign(c)}
                        disabled={deletingId === c.id}
                        title="Archive campaign"
                        className="text-xs flex items-center gap-1 text-red-300 hover:text-red-200 border border-red-500/40 rounded px-2 py-1 disabled:opacity-50"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        {deletingId === c.id ? '…' : 'Archive'}
                      </button>
                    </div>
                  </div>
                  )}

                  {c.rejection_reason && (
                    <p className="mt-2 text-amber-400 text-xs">⚠ {c.rejection_reason}</p>
                  )}

                  {insights[c.id] && (
                    <div className="mt-3 border-t border-slate-700 pt-2">
                      {insights[c.id].length === 0 ? (
                        <p className="text-slate-500 text-xs">No data for the last 7 days.</p>
                      ) : (
                        <table className="w-full text-xs text-slate-300">
                          <thead className="text-slate-500">
                            <tr><th className="text-left">Date</th><th className="text-right">Impr.</th><th className="text-right">Clicks</th><th className="text-right">Spend</th><th className="text-right">CTR</th></tr>
                          </thead>
                          <tbody>
                            {insights[c.id].map((r) => (
                              <tr key={r.date}>
                                <td>{r.date}</td>
                                <td className="text-right">{r.impressions.toLocaleString()}</td>
                                <td className="text-right">{r.clicks.toLocaleString()}</td>
                                <td className="text-right">{dollars(r.spend_minor)}</td>
                                <td className="text-right">{(r.ctr * 100).toFixed(2)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {keywordRows[c.id] && (
                    <div className="mt-3 border-t border-slate-700 pt-2">
                      <div className="text-slate-400 text-[11px] mb-1">Keywords</div>
                      {keywordRows[c.id].length === 0 ? (
                        <p className="text-slate-500 text-xs">No keyword data yet.</p>
                      ) : (
                        <table className="w-full text-xs text-slate-300">
                          <thead className="text-slate-500">
                            <tr><th className="text-left">Keyword</th><th className="text-left">Match</th><th className="text-right">Impr.</th><th className="text-right">Clicks</th><th className="text-right">Spend</th></tr>
                          </thead>
                          <tbody>
                            {keywordRows[c.id].map((r, i) => (
                              <tr key={i}>
                                <td className="truncate max-w-[160px]">{r.keyword}</td>
                                <td className="text-slate-500">{r.match_type}</td>
                                <td className="text-right">{r.impressions.toLocaleString()}</td>
                                <td className="text-right">{r.clicks.toLocaleString()}</td>
                                <td className="text-right">{dollars(Math.round(r.cost_micros / 10000))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {searchTermRows[c.id] && (
                    <div className="mt-3 border-t border-slate-700 pt-2">
                      <div className="text-slate-400 text-[11px] mb-1">Search terms (actual queries)</div>
                      {searchTermRows[c.id].length === 0 ? (
                        <p className="text-slate-500 text-xs">No search-term data yet (none on test accounts).</p>
                      ) : (
                        <table className="w-full text-xs text-slate-300">
                          <thead className="text-slate-500">
                            <tr><th className="text-left">Query</th><th className="text-right">Impr.</th><th className="text-right">Clicks</th><th className="text-right">Spend</th></tr>
                          </thead>
                          <tbody>
                            {searchTermRows[c.id].map((r, i) => (
                              <tr key={i}>
                                <td className="truncate max-w-[200px]">{r.search_term}</td>
                                <td className="text-right">{r.impressions.toLocaleString()}</td>
                                <td className="text-right">{r.clicks.toLocaleString()}</td>
                                <td className="text-right">{dollars(Math.round(r.cost_micros / 10000))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Manage panel — ad groups / keywords / segments */}
                  {manageId === c.id && (
                    <div className="mt-3 border-t border-slate-700 pt-3 space-y-4">
                      {mgLoading ? <p className="text-slate-500 text-xs">Loading…</p> : (
                        <>
                          {/* Ad groups */}
                          <div>
                            <div className="text-slate-400 text-[11px] mb-1">Ad groups</div>
                            {mgAdGroups.length === 0 ? <p className="text-slate-500 text-xs">None.</p> : mgAdGroups.map((ag) => (
                              <div key={ag.id} className="flex items-center justify-between bg-slate-900/50 rounded px-2 py-1 text-xs">
                                <span className="text-slate-300">{ag.name} <span className="text-slate-500">· {ag.status}</span></span>
                                <button onClick={() => mgPauseAdGroup(c, ag)} className="text-[#8ab4f8] hover:underline">
                                  {ag.status === 'PAUSED' ? 'Enable' : 'Pause'}
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Keywords */}
                          <div>
                            <div className="text-slate-400 text-[11px] mb-1">Keywords</div>
                            <div className="flex gap-1.5 mb-1.5">
                              <select value={mgNewKw.ad_group_id} onChange={(e) => setMgNewKw({ ...mgNewKw, ad_group_id: e.target.value })}
                                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white">
                                {mgAdGroups.map((ag) => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                              </select>
                              <input value={mgNewKw.text} onChange={(e) => setMgNewKw({ ...mgNewKw, text: e.target.value })}
                                placeholder="new keyword" className="flex-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white" />
                              <select value={mgNewKw.match_type} onChange={(e) => setMgNewKw({ ...mgNewKw, match_type: e.target.value })}
                                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white">
                                <option value="BROAD">Broad</option><option value="PHRASE">Phrase</option><option value="EXACT">Exact</option>
                              </select>
                              <button onClick={() => mgAddKeyword(c)} className="bg-[#1a73e8] hover:bg-[#1765cc] text-white px-2 py-1 rounded text-xs">Add</button>
                            </div>
                            {mgKeywords.slice(0, 30).map((k) => (
                              <div key={k.criterion_id} className="flex items-center justify-between bg-slate-900/50 rounded px-2 py-1 text-xs">
                                <span className="text-slate-300">{k.text} <span className="text-slate-500">· {k.match_type}{k.negative ? ' · neg' : ''}</span></span>
                                <button onClick={() => mgRemoveKeyword(c, k)} className="text-red-300 hover:text-red-200">Remove</button>
                              </div>
                            ))}
                          </div>

                          {/* Segments */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-slate-400 text-[11px]">Segments</span>
                              <select value={mgSegType} onChange={(e) => reloadSegments(c, e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white">
                                <option value="device">Device</option><option value="hour">Hour</option>
                                <option value="day_of_week">Day of week</option><option value="geo">Geo</option>
                              </select>
                            </div>
                            {mgSegments.length === 0 ? <p className="text-slate-500 text-xs">No segment data (test accounts report zeros).</p> : (
                              <table className="w-full text-xs text-slate-300">
                                <thead className="text-slate-500"><tr><th className="text-left">{mgSegType}</th><th className="text-right">Impr.</th><th className="text-right">Clicks</th><th className="text-right">Spend</th></tr></thead>
                                <tbody>{mgSegments.map((s, i) => (
                                  <tr key={i}><td>{s.segment}</td><td className="text-right">{s.impressions.toLocaleString()}</td>
                                    <td className="text-right">{s.clicks.toLocaleString()}</td>
                                    <td className="text-right">{dollars(Math.round(s.cost_micros / 10000))}</td></tr>
                                ))}</tbody>
                              </table>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
