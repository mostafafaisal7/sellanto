import { motion } from 'framer-motion';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

interface BulletItem {
  bold?: string;
  text: string;
}

interface Section {
  id: string;
  title: string;
  intro?: string;
  bullets: BulletItem[];
  outro?: string;
}

const LAST_UPDATED = 'May 11, 2026';
const EFFECTIVE_DATE = 'May 11, 2026';

const sections: Section[] = [
  {
    id: 'who-we-are',
    title: '1. Who We Are',
    intro:
      'Sellanto ("Sellanto", "we", "us", or "our") is an AI-powered social media management platform that helps creators, small businesses, and marketing teams plan, generate, schedule, and analyze content across multiple social networks. This Privacy Policy explains what personal information we collect, why we collect it, how we use and share it, and the choices and rights you have. It applies to the Sellanto website, web application, mobile-responsive interfaces, browser extensions (if any), and any related services that link to this policy (collectively, the "Service").',
    bullets: [],
    outro:
      'For the purposes of applicable data-protection laws, Sellanto acts as a data controller for the personal information you provide directly to us when you create an account, and as a data processor for content and personal information you upload, generate, or import into the Service in the course of using it for your business.',
  },
  {
    id: 'information-we-collect',
    title: '2. Information We Collect',
    intro: 'We collect information in three main ways: (a) information you provide to us directly, (b) information we collect automatically as you use the Service, and (c) information we receive from third parties you authorize.',
    bullets: [
      { bold: 'Account & profile information', text: 'name, username, email address, hashed password, phone number, country, time zone, profile photo, business name, brand details, and role (creator, business owner, team member, admin).' },
      { bold: 'Authentication tokens', text: 'OAuth access tokens, refresh tokens, page access tokens, and account identifiers when you connect Facebook, Instagram, Twitter/X, LinkedIn, YouTube, TikTok, Pinterest, Threads, or other platforms. Tokens are stored encrypted and used only to perform the actions you authorize.' },
      { bold: 'Content you upload or generate', text: 'product URLs, captions, scripts, images, videos, voiceovers, audio files, knowledge-base documents, chatbot training data, brand DNA, competitor lists, content ideas, scheduled posts, drafts, comments, and analytics imported from connected accounts.' },
      { bold: 'AI inputs & outputs', text: 'the prompts you submit, the AI-generated text/images/videos/voiceovers, regeneration requests, edits you make, and any feedback (ratings, approvals, rejections) you provide on AI output. These are stored to power features like Magic Mode history, drafts, regeneration, and to improve prompts used in your own brand.' },
      { bold: 'Payment & billing information', text: 'plan tier, subscription status, top-up history, invoice records, partial card metadata (last 4 digits, brand, expiry month/year), and transaction IDs. We do not store full card numbers — these are handled directly by our PCI-compliant payment processors (e.g., Stripe, SSLCOMMERZ, bKash). Diamond balance, usage counters, and cost-of-goods tracking are stored for billing transparency.' },
      { bold: 'Bring-your-own keys (BYOK)', text: 'if you provide your own OpenAI, Anthropic, Google Gemini, ElevenLabs, or other AI provider API keys, they are encrypted at rest using AES-256 and never shown in API responses or returned to the frontend in plaintext after entry.' },
      { bold: 'Usage & telemetry data', text: 'pages visited, features used, buttons clicked, search queries within the Service, generation counts, error logs, performance metrics, IP address, browser type/version, operating system, device type, screen size, and approximate location derived from IP.' },
      { bold: 'Cookies & similar technologies', text: 'session cookies, JWT tokens stored in browser storage, CSRF tokens, and analytics cookies. See Section 9 for details.' },
      { bold: 'Support communications', text: 'messages you send to support@sellanto.com, in-app chatbot conversations, screenshots you attach, and our responses. We retain these to provide support and improve the product.' },
      { bold: 'Information from connected platforms', text: 'when you link a social account, the platform shares profile information, page lists, posting permissions, post performance metrics (impressions, reach, clicks, likes, comments, video views), audience demographics where permitted, and message threads (for Messenger automation). We only request the minimum scopes needed for the features you enable.' },
    ],
    outro: 'You may use Sellanto without giving us certain optional information (e.g., profile photo, phone number), but some features (e.g., posting, payments, OTP verification) will not work without the relevant data.',
  },
  {
    id: 'sensitive-info',
    title: '3. Sensitive Information & Children',
    bullets: [
      { text: 'We do not knowingly collect government IDs, health information, biometric data, precise GPS coordinates, racial or ethnic origin, religious beliefs, or sexual orientation. Please do not upload such data into the Service.' },
      { text: 'Sellanto is intended for users aged 18 or older. We do not knowingly collect personal information from children under 13 (or under the equivalent minimum age in your country). If you believe a child has provided us information, contact support@sellanto.com and we will delete it.' },
      { text: 'If you upload images or videos containing identifiable individuals, you confirm you have the rights and consents necessary to do so under applicable law.' },
    ],
  },
  {
    id: 'how-we-use',
    title: '4. How We Use Your Information',
    intro: 'We use personal information for the following purposes, each with a corresponding legal basis where the GDPR or similar laws apply:',
    bullets: [
      { bold: 'Provide the Service (contract)', text: 'authenticate you, render your dashboard, generate AI content, schedule and publish posts, run Messenger automations, render analytics, calculate billing, and otherwise deliver the features you signed up for.' },
      { bold: 'Improve the Service (legitimate interest)', text: 'monitor errors, debug issues, analyze aggregated usage trends, tune prompt templates and pricing models, run A/B tests, and develop new features.' },
      { bold: 'Communicate with you (contract / legitimate interest)', text: 'transactional emails (sign-up confirmation, OTP codes, payment receipts, scheduled-post alerts, security notifications), product announcements, and responses to your support requests.' },
      { bold: 'Marketing (consent, where required)', text: 'send newsletters, feature launches, or promotional offers. You can unsubscribe at any time via the link in any marketing email or in account settings.' },
      { bold: 'Safety, fraud prevention & legal compliance (legitimate interest / legal obligation)', text: 'detect abuse, prevent fraudulent payments, enforce our Terms of Service, comply with tax/accounting rules, and respond to lawful government requests.' },
      { bold: 'AI quality & abuse review (legitimate interest)', text: 'review flagged generations to detect policy violations and improve safety filters. We do not use your private content to train foundation models without your explicit opt-in.' },
    ],
  },
  {
    id: 'ai-and-training',
    title: '5. AI Content, Model Providers & Training',
    bullets: [
      { text: 'Sellanto orchestrates third-party AI models (OpenAI GPT, Anthropic Claude, Google Gemini & Veo, ElevenLabs, Kling, and others) to generate captions, images, videos, and voiceovers on your behalf.' },
      { text: 'Your prompts and any content you submit for generation are transmitted to the relevant AI provider for the sole purpose of producing the requested output. We send only what is necessary for the request.' },
      { text: 'By default, Sellanto does not authorize third-party AI providers to train their general-purpose models on your inputs or outputs. Where a provider offers an "opt-out of training" setting at the API tier, we enable it.' },
      { text: 'We may use anonymized, aggregated metadata (e.g., "users in plan tier X generate an average of N images per week") to improve the Service. We do not use your private content to train Sellanto-owned models without your explicit opt-in.' },
      { text: 'AI output may be inaccurate, biased, or in some cases similar to existing material. You are responsible for reviewing AI output before publishing it.' },
      { text: 'When you use BYOK (your own API key), traffic for that feature is billed to and routed through the provider account associated with that key, and is subject to that provider\'s data-handling policies.' },
    ],
  },
  {
    id: 'sharing',
    title: '6. How We Share Information',
    intro: 'We share personal information only as described below. We do not sell personal information.',
    bullets: [
      { bold: 'Service providers (subprocessors)', text: 'cloud hosting (database, file storage, CDN), email delivery, payment processing, error monitoring, customer-support tooling, and AI model providers. Each is bound by contractual confidentiality and data-protection obligations.' },
      { bold: 'Connected social platforms', text: 'when you publish a post or send a Messenger reply, the content and metadata you authorized are transmitted to that platform under its terms.' },
      { bold: 'Within your organization', text: 'if you are part of a team or business workspace, your colleagues with appropriate permissions can see content, performance metrics, and account settings shared in the workspace.' },
      { bold: 'Business transfers', text: 'in the event of a merger, acquisition, financing, or sale of assets, your information may be transferred subject to standard confidentiality protections. We will notify you of any change in ownership or use of your data.' },
      { bold: 'Legal & safety', text: 'we may disclose information when required by law, valid legal process, or to protect the rights, property, or safety of Sellanto, our users, or the public.' },
      { bold: 'With your consent', text: 'in any other case where you instruct us to share data (e.g., third-party integrations you connect).' },
    ],
    outro: 'A current list of major subprocessors is available on request at support@sellanto.com.',
  },
  {
    id: 'international',
    title: '7. International Data Transfers',
    bullets: [
      { text: 'Sellanto is operated from Bangladesh, and our service providers may process data in the United States, the European Union, India, Singapore, and other regions.' },
      { text: 'Where we transfer personal information of EU/UK/EEA residents outside their region, we rely on appropriate safeguards such as the EU Standard Contractual Clauses (SCCs) and the UK International Data Transfer Addendum.' },
      { text: 'By using the Service, you understand that your information may be processed in countries with data-protection laws different from those of your jurisdiction.' },
    ],
  },
  {
    id: 'security',
    title: '8. Data Security',
    bullets: [
      { text: 'All traffic to and from the Service is encrypted in transit using TLS 1.2+.' },
      { text: 'Passwords are hashed with industry-standard algorithms (PBKDF2/Argon2) and are never stored in plaintext.' },
      { text: 'API keys and OAuth tokens are encrypted at rest using AES-256 with keys held in a separate secret manager.' },
      { text: 'Access to production data is restricted to a small number of authorized engineers, requires multi-factor authentication, and is logged.' },
      { text: 'We perform regular dependency audits, security scans, and review of permissions on connected platforms.' },
      { text: 'No system is 100% secure. If we become aware of a breach affecting your personal information, we will notify you and the relevant authorities within the time frames required by applicable law.' },
      { text: 'You are responsible for keeping your password and OTP codes confidential, enabling 2FA where offered, and disconnecting unused social accounts.' },
    ],
  },
  {
    id: 'cookies',
    title: '9. Cookies, Local Storage & Tracking',
    intro: 'We use the following categories of cookies and similar technologies:',
    bullets: [
      { bold: 'Strictly necessary', text: 'session cookies, CSRF tokens, and JWT access/refresh tokens stored in browser storage. Without these, the Service cannot function.' },
      { bold: 'Functional', text: 'remember your sidebar state, theme preference, language, and last-used filters.' },
      { bold: 'Analytics (first-party, aggregated)', text: 'count page views, feature usage, and error rates to improve the product. These do not build cross-site advertising profiles.' },
      { bold: 'No advertising cookies', text: 'we do not run third-party advertising or behavioral retargeting on the in-product experience. Our public marketing site may use a limited set of analytics tags disclosed via its own cookie banner.' },
    ],
    outro: 'You can clear cookies and browser storage at any time in your browser settings. Doing so will sign you out and reset preferences.',
  },
  {
    id: 'retention',
    title: '10. Data Retention',
    bullets: [
      { text: 'Account, brand, content, and analytics data are retained while your account is active and for as long as needed to provide the Service.' },
      { text: 'Billing and tax records are retained for the period required by law (typically 5–7 years).' },
      { text: 'Backups are encrypted, retained for up to 90 days, and then overwritten on a rolling basis.' },
      { text: 'When you delete your account, we delete or anonymize personal information within 30 days, except for records we are legally required to keep.' },
      { text: 'Disconnected social account tokens are revoked immediately and the corresponding identifiers are deleted within 30 days.' },
      { text: 'Anonymous, aggregated, or de-identified data that can no longer be linked to you may be retained indefinitely.' },
    ],
  },
  {
    id: 'your-rights',
    title: '11. Your Privacy Rights',
    intro: 'Depending on your location, you may have the following rights regarding your personal information:',
    bullets: [
      { bold: 'Access', text: 'request a copy of the personal data we hold about you.' },
      { bold: 'Rectification', text: 'correct inaccurate or incomplete information from your Profile and Settings pages.' },
      { bold: 'Erasure (right to be forgotten)', text: 'request deletion of your account and personal data.' },
      { bold: 'Portability', text: 'export your data in a structured, machine-readable format (JSON / CSV).' },
      { bold: 'Restriction & objection', text: 'limit how we process your data, including objecting to processing based on legitimate interests.' },
      { bold: 'Withdraw consent', text: 'where we rely on consent, withdraw it at any time. This does not affect the lawfulness of prior processing.' },
      { bold: 'Non-discrimination (CCPA/CPRA)', text: 'we will not deny you service, charge different prices, or provide a different level of quality for exercising your rights.' },
      { bold: 'Complaint', text: 'lodge a complaint with your local supervisory authority (e.g., your national Data Protection Authority in the EU/UK).' },
    ],
    outro:
      'To exercise any of these rights, email support@sellanto.com from the address associated with your account, or use the in-product controls under Profile → Settings → Privacy. We will respond within 30 days (or the time frame required by your jurisdiction).',
  },
  {
    id: 'platform-specific',
    title: '12. Platform-Specific Disclosures',
    intro:
      'Sellanto integrates with multiple social platforms. The following disclosures are required by those platforms\' developer policies:',
    bullets: [
      { bold: 'Meta (Facebook, Instagram, Messenger, Threads)', text: 'we use Meta Graph API only to publish content, fetch insights, and operate Messenger automations you configure. We do not transfer Meta data to data brokers or use it for advertising profiling.' },
      { bold: 'Google (YouTube, Gemini, Veo, Drive auth)', text: 'use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.' },
      { bold: 'X (Twitter)', text: 'we use X API only for the actions you authorize (posting, fetching tweet performance).' },
      { bold: 'LinkedIn, TikTok, Pinterest', text: 'we use each platform\'s API only to perform the actions you authorize and we never resell platform data.' },
      { bold: 'Revocation', text: 'you can revoke any platform\'s access at any time from the Connected Accounts page in Sellanto, and additionally from the platform\'s own settings (e.g., Facebook → Settings → Business Integrations).' },
    ],
  },
  {
    id: 'do-not-track',
    title: '13. Do-Not-Track Signals',
    intro:
      'Some browsers transmit "Do Not Track" (DNT) or Global Privacy Control (GPC) signals. Because there is no universally accepted standard for DNT, we currently do not respond to DNT signals, but we do honor GPC signals where required by law as an opt-out of "sale" and "sharing" of personal information (we do not sell or share personal information for targeted advertising in any case).',
    bullets: [],
  },
  {
    id: 'third-party-links',
    title: '14. Third-Party Links',
    intro: 'The Service may link to third-party sites, blogs, or videos. We are not responsible for the privacy practices of those sites — please review their policies before submitting any personal information.',
    bullets: [],
  },
  {
    id: 'changes',
    title: '15. Changes to This Policy',
    intro:
      'We may update this Privacy Policy from time to time. The "Last updated" date at the top reflects the most recent revision. If we make material changes, we will notify you by email or in-app notification at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the updated policy.',
    bullets: [],
  },
  {
    id: 'contact',
    title: '16. Contact Us',
    intro: 'If you have questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact us:',
    bullets: [
      { bold: 'Email', text: 'support@sellanto.com' },
      { bold: 'Subject line', text: '"Privacy Request — <your account email>"' },
      { bold: 'Postal mail', text: 'Sellanto — Attn: Privacy, Dhaka, Bangladesh' },
    ],
    outro: 'For users in the EU/UK, you may also contact our Data Protection point of contact at the same email address.',
  },
];

export function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
          <ShieldCheckIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">Privacy Policy</h1>
        <p className="text-text-secondary text-sm">
          Effective: {EFFECTIVE_DATE} · Last updated: {LAST_UPDATED}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card p-6 sm:p-8 mb-6"
      >
        <p className="text-text-secondary leading-relaxed text-sm sm:text-base">
          Your privacy matters to us. This Privacy Policy describes how Sellanto collects, uses, shares, and protects
          personal information when you use our website and platform. We aim to be transparent about our data
          practices and to give you meaningful control over your information. If anything in this policy is unclear,
          please email us at <a className="text-primary hover:underline" href="mailto:support@sellanto.com">support@sellanto.com</a>.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6 mb-6"
      >
        <h2 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">Table of Contents</h2>
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-text-secondary list-decimal list-inside">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:text-primary transition-colors">
                {s.title.replace(/^\d+\.\s*/, '')}
              </a>
            </li>
          ))}
        </ol>
      </motion.div>

      <div className="space-y-4">
        {sections.map((section, index) => (
          <motion.section
            id={section.id}
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.03 }}
            className="card p-6 scroll-mt-24"
          >
            <h2 className="text-lg font-semibold text-text-primary mb-3">{section.title}</h2>

            {section.intro && (
              <p className="text-sm text-text-secondary mb-3 leading-relaxed">{section.intro}</p>
            )}

            {section.bullets.length > 0 && (
              <ul className="space-y-2 ml-1">
                {section.bullets.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary leading-relaxed">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                    <span>
                      {item.bold && (
                        <span className="font-medium text-text-primary">{item.bold} — </span>
                      )}
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {section.outro && (
              <p className="text-sm text-text-secondary mt-3 leading-relaxed">{section.outro}</p>
            )}
          </motion.section>
        ))}
      </div>

      <div className="text-center text-xs text-text-muted py-10">
        <p>© {new Date().getFullYear()} Sellanto. All rights reserved.</p>
      </div>
    </div>
  );
}

export default PrivacyPage;
