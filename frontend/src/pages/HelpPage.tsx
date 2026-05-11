import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QuestionMarkCircleIcon,
  ChevronDownIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
  SparklesIcon,
  VideoCameraIcon,
  PhotoIcon,
  ShareIcon,
  ChatBubbleBottomCenterTextIcon,
  CreditCardIcon,
  KeyIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store';

interface FAQItem {
  category: string;
  question: string;
  answer: string;
}

const CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', icon: RocketLaunchIcon, desc: 'Sign up, onboarding, and your first post' },
  { id: 'magic-mode', label: 'Magic Mode', icon: SparklesIcon, desc: 'Turn any URL into a week of content' },
  { id: 'ai-video', label: 'AI Video', icon: VideoCameraIcon, desc: 'Generate videos with Veo' },
  { id: 'ai-image', label: 'AI Image & Caption', icon: PhotoIcon, desc: 'Gemini-powered images and copy' },
  { id: 'posting', label: 'Posting & Scheduling', icon: ShareIcon, desc: 'Multi-platform publishing & calendar' },
  { id: 'messenger', label: 'Messenger Bot', icon: ChatBubbleBottomCenterTextIcon, desc: 'RAG chatbot & automations' },
  { id: 'billing', label: 'Plans, Diamonds & Billing', icon: CreditCardIcon, desc: 'Subscriptions, top-ups, refunds' },
  { id: 'api-keys', label: 'API Keys (BYOK)', icon: KeyIcon, desc: 'Bring your own AI provider keys' },
  { id: 'team', label: 'Team & Permissions', icon: UserGroupIcon, desc: 'Workspaces, roles, approvals' },
  { id: 'security', label: 'Security & Privacy', icon: ShieldCheckIcon, desc: 'Data, 2FA, account safety' },
  { id: 'account', label: 'Account & Settings', icon: Cog6ToothIcon, desc: 'Profile, theme, language' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: ExclamationTriangleIcon, desc: 'Errors, failed posts, slow loads' },
];

const FAQS: FAQItem[] = [
  // Getting Started
  { category: 'getting-started', question: 'What is Sellanto?', answer: 'Sellanto is an AI-powered social media management platform. It turns any product URL or idea into a week of cross-platform content — captions, images, videos, and voiceovers — and schedules it to Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Pinterest, and Threads from one dashboard.' },
  { category: 'getting-started', question: 'How do I create an account?', answer: 'Click "Get Started Free" on the landing page, enter your email, username, password, and phone number, then verify your email with the OTP we send. You\'ll be guided through a short onboarding flow to set up your brand.' },
  { category: 'getting-started', question: 'Is there a free plan?', answer: 'Yes. The free tier includes a monthly allotment of Diamonds (our usage credit unit) so you can try Magic Mode, AI captions, AI images, and scheduling without entering a card. Upgrade any time from Settings → Billing.' },
  { category: 'getting-started', question: 'What is onboarding and can I skip it?', answer: 'Onboarding collects your brand details (business name, industry, voice, audience) so every AI generation matches your brand. It takes about 2 minutes and powers Magic Mode\'s personalization. You can edit everything later from Business Profile, but completing it once gives you much better output from day one.' },
  { category: 'getting-started', question: 'How do I connect my first social account?', answer: 'After login, go to "Connect Accounts" in the sidebar, pick the platform (Facebook/Instagram/X/LinkedIn/YouTube/TikTok/Pinterest/Threads), and follow the OAuth flow. Sellanto only requests the minimum permissions needed to publish on your behalf.' },

  // Magic Mode
  { category: 'magic-mode', question: 'What is Magic Mode?', answer: 'Magic Mode is the fastest way to create content. Paste any product URL (your shop, a competitor, a blog post) and Sellanto extracts the key info, generates a content pack (multiple captions, images, optional video, voiceover), and lets you schedule it across all your platforms in one click.' },
  { category: 'magic-mode', question: 'What kinds of URLs work in Magic Mode?', answer: 'WooCommerce, Shopify, and most public product/landing pages work best. Blog posts and news articles work too. If a page is gated by login or strict bot protection, Magic Mode may not be able to read it — in that case use Create Post instead.' },
  { category: 'magic-mode', question: 'Can I edit Magic Mode results before posting?', answer: 'Yes. Each generated caption, image, and video can be regenerated, manually edited, or replaced before scheduling. Drafts are saved to "Magic Drafts" so you can refine them over time.' },
  { category: 'magic-mode', question: 'How much does one Magic Mode run cost?', answer: 'The Diamond cost depends on what gets generated (number of captions, whether you include AI video, voiceover length, image count). The exact cost is shown on the review screen before you confirm — nothing is charged without your approval.' },

  // AI Video
  { category: 'ai-video', question: 'Which video model does Sellanto use?', answer: 'Sellanto uses Google Veo for high-quality AI video generation, with Kling and other models available for specific use cases. Voiceovers use ElevenLabs and Google TTS.' },
  { category: 'ai-video', question: 'How long can generated videos be?', answer: 'Standard generations are 8 seconds (Veo) to 30 seconds depending on the model and plan tier. Longer videos can be assembled from multiple clips in the Video Studio.' },
  { category: 'ai-video', question: 'Can I add my own voiceover or music?', answer: 'Yes. You can record/upload a voiceover, generate one with AI in 30+ languages, or upload a music track. Video Studio handles syncing.' },
  { category: 'ai-video', question: 'Why did my video fail to generate?', answer: 'Most video failures come from prompts that violate the provider\'s safety policy (real people, violent content, copyrighted characters). Try rephrasing the prompt. If the request is policy-safe and still fails, the provider may be at capacity — retry in a few minutes. Failed generations do not consume Diamonds.' },

  // AI Image & Caption
  { category: 'ai-image', question: 'Which models power AI Image and AI Caption?', answer: 'AI Image uses Google Gemini (Imagen) and DALL·E (OpenAI). AI Caption uses GPT and Claude depending on the task. You can use Sellanto\'s shared keys or bring your own (BYOK).' },
  { category: 'ai-image', question: 'How do I keep my brand style consistent in images?', answer: 'Set your brand details in Business Profile (colors, style notes, do/don\'t list). Sellanto injects these into every image prompt automatically. You can also create reusable Brand Templates in AI Image → Templates.' },
  { category: 'ai-image', question: 'Can I edit a generated image?', answer: 'Yes. Use the inline editor to crop, resize, change aspect ratio (Story, Reel, Square, Landscape), add text overlays, or send the image to the Image Editor for fine-grained edits including object removal and background swap.' },
  { category: 'ai-image', question: 'Why do my captions all start the same way?', answer: 'Most likely your brand tone is set too narrowly. Open Business Profile → Voice and add 2–3 example posts in different tones (excited, informative, casual) so the AI has range to draw from.' },

  // Posting & Scheduling
  { category: 'posting', question: 'Which platforms does Sellanto support for publishing?', answer: 'Facebook Pages, Instagram (Feed, Reels, Stories), X/Twitter, LinkedIn (Personal & Company), YouTube (Shorts & long-form), TikTok, Pinterest, and Threads. We add new platforms regularly.' },
  { category: 'posting', question: 'How do I schedule a post for the best time?', answer: 'On the Create Post screen, click the "Suggest best time" button. Sellanto analyzes your past post performance per platform and recommends a slot. You can override it manually or let the calendar auto-distribute across the week.' },
  { category: 'posting', question: 'What happens if a scheduled post fails?', answer: 'If publishing fails (e.g., the platform revoked your token), the post moves to "Failed" with the exact error message. You\'ll receive an in-app and email notification within minutes. Re-authenticate the account and click "Retry" — your content is preserved.' },
  { category: 'posting', question: 'Can I post the same content to multiple platforms at once?', answer: 'Yes. Select the platforms on the Create Post screen. Sellanto automatically adapts the format (image aspect ratio, caption length, hashtag style) for each platform. You can also use per-platform variants if you want different copy for each.' },
  { category: 'posting', question: 'How does the approval workflow work?', answer: 'If your team uses approvals, drafts go to the Approval Queue. Approvers can comment, request changes, or approve. Approved posts move to the schedule. Configure who can publish without approval in Settings → Permissions.' },

  // Messenger Bot
  { category: 'messenger', question: 'What can the Messenger bot do?', answer: 'It answers customer questions on Facebook Messenger using your uploaded knowledge base (PDFs, product catalogs, FAQs), recommends products from your WooCommerce/Shopify store, captures leads, and hands off to a human when needed.' },
  { category: 'messenger', question: 'How do I train the bot on my business?', answer: 'Go to Messenger Bot → Knowledge Base and upload your PDFs, FAQs, or paste in text. The system creates embeddings and stores them per page. When customers ask questions, the bot retrieves the most relevant snippets and generates a contextual answer (RAG).' },
  { category: 'messenger', question: 'What is RAG?', answer: 'RAG (Retrieval-Augmented Generation) means the bot first searches your documents for relevant information, then generates an answer grounded in those snippets — instead of relying purely on the AI model\'s training. The result: accurate, on-brand answers with much less hallucination.' },
  { category: 'messenger', question: 'How do I connect my Facebook Page to the bot?', answer: 'In Messenger Bot, click "Add Connection", paste your Page ID and Page Access Token, and configure the webhook URL we provide in your Facebook App settings. Detailed step-by-step instructions are in the connection wizard.' },

  // Plans, Diamonds & Billing
  { category: 'billing', question: 'What are Diamonds?', answer: 'Diamonds are Sellanto\'s internal usage credit unit. Every AI generation (caption, image, video, voiceover, Magic Mode run) consumes a specific amount of Diamonds shown at point-of-use. Each plan includes a monthly Diamond allotment; you can top up any time.' },
  { category: 'billing', question: 'What happens if I run out of Diamonds?', answer: 'You can still post and use non-AI features, but AI generations will be blocked until your next billing cycle or until you top up. The Insufficient Diamonds modal shows up with one-click top-up options.' },
  { category: 'billing', question: 'Do unused Diamonds roll over?', answer: 'Plan Diamonds reset each billing cycle and do not roll over. Top-up Diamonds (purchased separately) stay in your balance for up to 12 months from purchase.' },
  { category: 'billing', question: 'How do I upgrade or downgrade my plan?', answer: 'Go to Settings → Billing → Upgrade. Upgrades take effect immediately and are prorated. Downgrades take effect at the next renewal so you keep what you paid for in the current cycle.' },
  { category: 'billing', question: 'Can I get a refund?', answer: 'First-time subscription upgrades come with a 7-day money-back guarantee if you\'ve used less than 25% of the plan\'s Diamond allotment. After that, fees are non-refundable except as required by law. See the Terms for details.' },
  { category: 'billing', question: 'Which payment methods are accepted?', answer: 'Credit/debit cards via Stripe (Visa, Mastercard, Amex), local payment methods via SSLCOMMERZ, and mobile financial services like bKash for users in Bangladesh.' },
  { category: 'billing', question: 'How do I download an invoice?', answer: 'Settings → Billing → Invoices. Each successful payment generates a downloadable PDF invoice you can use for accounting and tax.' },

  // API Keys (BYOK)
  { category: 'api-keys', question: 'What is BYOK?', answer: 'Bring Your Own Key. You provide your own OpenAI, Anthropic, Google Gemini, or ElevenLabs API key, and Sellanto routes the relevant AI feature through your account. This unlocks higher rate limits, your own quotas, and direct billing with the provider.' },
  { category: 'api-keys', question: 'Where do I add my API keys?', answer: 'Settings → API Keys. Paste the key, click Save — it\'s encrypted with AES-256 and never shown back to you in plaintext. You can rotate or remove keys any time.' },
  { category: 'api-keys', question: 'Are my API keys safe?', answer: 'Yes. Keys are encrypted at rest, never returned to the frontend after entry, never logged, and only decrypted in-memory when needed for a request. We strongly recommend creating a separate API key per project so you can revoke it if needed.' },
  { category: 'api-keys', question: 'Where do I get OpenAI / Gemini keys?', answer: 'OpenAI: visit platform.openai.com → API Keys → Create new key (starts with sk-). Google Gemini: visit ai.google.dev → Get API key (starts with AIza). ElevenLabs: visit elevenlabs.io → Profile → API Key.' },

  // Team & Permissions
  { category: 'team', question: 'Can I invite teammates?', answer: 'Yes, on paid plans. Settings → Team → Invite. Each teammate gets a role (Admin, Editor, Approver, Viewer) that controls what they can do. Approvers can review but not publish; Editors can create drafts but require approval; Admins have full access.' },
  { category: 'team', question: 'How are seats counted?', answer: 'Each active team member counts as one seat. The plan tier determines included seats; additional seats are billed monthly. Pending invites do not count until accepted.' },
  { category: 'team', question: 'Can I have separate workspaces for different clients?', answer: 'Yes (Business / Enterprise tiers). Each workspace has its own brand, connected accounts, content library, and billing. Switch workspaces from the top-left menu.' },

  // Security & Privacy
  { category: 'security', question: 'How is my data protected?', answer: 'TLS 1.2+ in transit, AES-256 encryption at rest for tokens and API keys, hashed passwords (PBKDF2/Argon2), and access controls with MFA for our engineers. See the Privacy Policy for full details.' },
  { category: 'security', question: 'Do you use my content to train AI models?', answer: 'No. We do not use your private content to train foundation models without your explicit opt-in. Where third-party providers offer an "opt out of training" setting at the API tier, we enable it by default.' },
  { category: 'security', question: 'How do I enable two-factor authentication (2FA)?', answer: 'Profile → Security → Two-Factor Authentication. Scan the QR code with any authenticator app (Google Authenticator, Authy, 1Password) and enter the 6-digit code to confirm.' },
  { category: 'security', question: 'What happens when I delete my account?', answer: 'Go to Settings → Danger Zone → Delete Account. Confirm with your password. Your data, connected tokens, and content are deleted or anonymized within 30 days. Billing/tax records are retained as legally required.' },
  { category: 'security', question: 'How do I revoke a connected social account?', answer: 'Go to Connect Accounts → click the account → Disconnect. The OAuth token is revoked immediately on Sellanto\'s side. We recommend also revoking the app from the platform\'s own settings (e.g., Facebook → Business Integrations).' },

  // Account & Settings
  { category: 'account', question: 'How do I change my theme?', answer: 'Settings → Appearance. Choose Light, Dark, or System (matches your OS).' },
  { category: 'account', question: 'How do I change my password?', answer: 'Profile → Security → Change Password. You\'ll need your current password to set a new one. If you forgot it, use "Forgot Password" on the login screen.' },
  { category: 'account', question: 'Can I change my email address?', answer: 'Yes. Profile → Account → Email. We\'ll send a verification OTP to the new address before the change takes effect.' },
  { category: 'account', question: 'How do I switch languages?', answer: 'The UI is currently English-first. AI content generation supports 30+ languages — set your output language per generation, or pin a default in Business Profile.' },

  // Troubleshooting
  { category: 'troubleshooting', question: 'My scheduled post did not publish — what do I do?', answer: 'Go to My Posts → Failed. Click the post to see the platform\'s exact error message. Most failures are token expiration (reconnect the account on Connect Accounts) or platform rule violations (e.g., Instagram requires a square or vertical aspect ratio for Reels). Fix the issue and click Retry.' },
  { category: 'troubleshooting', question: 'The dashboard is loading slowly. Why?', answer: 'Try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R). Most slowdowns come from a slow Facebook/Instagram analytics fetch — disable platform analytics syncing in Settings if you don\'t need it.' },
  { category: 'troubleshooting', question: 'I keep getting "Insufficient Diamonds" — what does it mean?', answer: 'Your Diamond balance is below what the requested action costs. Open Upgrade or Top-Up to add more, or wait until your next billing cycle when plan Diamonds refill.' },
  { category: 'troubleshooting', question: 'Why am I getting OTP / email verification emails for an action I didn\'t do?', answer: 'Someone may be trying to access your account. Do not share the OTP code. Change your password immediately, enable 2FA, and email support@sellanto.com with details so we can investigate.' },
  { category: 'troubleshooting', question: 'I lost access to my email — how do I recover my account?', answer: 'Email support@sellanto.com from the alternate email you registered as a backup contact (if any), with your username and a description of the last actions you took. We will verify your identity manually before resetting access.' },
];

export function HelpPage() {
  const { isAuthenticated } = useAuthStore();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      const matchesCategory = activeCategory === 'all' || f.category === activeCategory;
      if (!q) return matchesCategory;
      const matchesQuery =
        f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of FAQS) counts[f.category] = (counts[f.category] || 0) + 1;
    return counts;
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
          <QuestionMarkCircleIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">Help Center</h1>
        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto">
          Answers, guides, and best practices for getting the most out of Sellanto.
        </p>

        {/* Search */}
        <div className="mt-8 max-w-2xl mx-auto relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for answers... (e.g., Magic Mode, Diamonds, scheduling)"
            className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/[0.06]"
              aria-label="Clear search"
            >
              <XMarkIcon className="w-4 h-4 text-text-muted" />
            </button>
          )}
        </div>
        {query && (
          <p className="mt-3 text-xs text-text-muted">
            {filteredFaqs.length} result{filteredFaqs.length === 1 ? '' : 's'} for "{query}"
          </p>
        )}
      </motion.div>

      {/* Category cards */}
      {!query && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <h2 className="text-lg font-semibold text-text-primary mb-4">Browse by topic</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  document.getElementById('faq-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="text-left card p-4 hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <cat.icon className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-medium text-text-muted px-1.5 py-0.5 rounded-full bg-white/[0.04]">
                    {categoryCounts[cat.id] ?? 0}
                  </span>
                </div>
                <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                  {cat.label}
                </p>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">{cat.desc}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Category filter pills (also shown during search) */}
      <motion.div
        id="faq-list"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6 scroll-mt-24"
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
              activeCategory === 'all'
                ? 'bg-primary text-white'
                : 'bg-white/[0.04] text-text-secondary hover:bg-white/[0.08] border border-white/10'
            }`}
          >
            All ({FAQS.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? 'bg-primary text-white'
                  : 'bg-white/[0.04] text-text-secondary hover:bg-white/[0.08] border border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* FAQ list */}
      <div className="space-y-3 mb-12">
        {filteredFaqs.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-text-secondary mb-1">No results for "{query}".</p>
            <p className="text-xs text-text-muted">
              Try a different keyword or{' '}
              <a href="mailto:support@sellanto.com" className="text-primary hover:underline">
                contact support
              </a>
              .
            </p>
          </div>
        ) : (
          filteredFaqs.map((faq, index) => {
            const key = `${faq.category}-${index}-${faq.question}`;
            const isOpen = openKey === key;
            const catLabel = CATEGORIES.find((c) => c.id === faq.category)?.label ?? faq.category;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index * 0.02, 0.4) }}
                className="card overflow-hidden"
              >
                <button
                  onClick={() => setOpenKey(isOpen ? null : key)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 pr-4">
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                      {catLabel}
                    </span>
                    <p className="text-sm font-semibold text-text-primary mt-1">{faq.question}</p>
                  </div>
                  <ChevronDownIcon
                    className={`w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed border-t border-white/5 pt-4">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Useful links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid sm:grid-cols-2 gap-3 mb-10"
      >
        <Link
          to="/privacy"
          className="card p-5 hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200 flex items-center gap-4"
        >
          <ShieldCheckIcon className="w-6 h-6 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">Privacy Policy</p>
            <p className="text-xs text-text-muted mt-0.5">How we collect, use, and protect your data.</p>
          </div>
          <ArrowRightIcon className="w-4 h-4 text-text-muted" />
        </Link>
        <Link
          to="/terms"
          className="card p-5 hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200 flex items-center gap-4"
        >
          <Cog6ToothIcon className="w-6 h-6 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">Terms of Service</p>
            <p className="text-xs text-text-muted mt-0.5">Rules of the road for using Sellanto.</p>
          </div>
          <ArrowRightIcon className="w-4 h-4 text-text-muted" />
        </Link>
      </motion.div>

      {/* Contact CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card p-8 sm:p-10 text-center"
      >
        <EnvelopeIcon className="w-10 h-10 text-primary mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-text-primary mb-2">Still need help?</h2>
        <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
          Can't find what you're looking for? Our support team replies within one business day.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="mailto:support@sellanto.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-primary text-white font-semibold rounded-xl shadow-glow-primary hover:-translate-y-0.5 transition-all duration-300"
          >
            <EnvelopeIcon className="w-5 h-5" />
            Email Support
          </a>
          {!isAuthenticated && (
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 text-text-primary font-semibold rounded-xl hover:bg-white/[0.04] transition-colors"
            >
              <SparklesIcon className="w-5 h-5" />
              Try Sellanto Free
            </Link>
          )}
        </div>
        <p className="text-xs text-text-muted mt-6">
          support@sellanto.com · response time: under 24 hours
        </p>
      </motion.div>

      <div className="text-center text-xs text-text-muted py-10">
        <p>© {new Date().getFullYear()} Sellanto. All rights reserved.</p>
      </div>
    </div>
  );
}

export default HelpPage;
