import { motion } from 'framer-motion';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

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
    id: 'agreement',
    title: '1. Agreement to Terms',
    intro:
      'These Terms of Service ("Terms") form a legally binding agreement between you ("you", "your", or "Customer") and Sellanto ("Sellanto", "we", "us", or "our") governing your access to and use of the Sellanto website, web application, APIs, and related services (collectively, the "Service"). By creating an account, clicking "I agree", or otherwise accessing the Service, you confirm that (a) you have read these Terms and our Privacy Policy, (b) you are at least 18 years old or the age of majority in your jurisdiction, and (c) you have the authority to enter into this agreement on your own behalf or on behalf of the entity you represent.',
    bullets: [],
    outro: 'If you do not agree to these Terms, do not access or use the Service.',
  },
  {
    id: 'description',
    title: '2. Description of the Service',
    intro: 'Sellanto is an AI-powered social media management platform that provides, among other things:',
    bullets: [
      { text: 'Multi-platform post scheduling and publishing (Facebook, Instagram, Twitter/X, LinkedIn, YouTube, TikTok, Pinterest, Threads, and others as added).' },
      { text: 'AI-powered content generation: captions, copywriting, images, videos, voiceovers, and end-to-end "Magic Mode" content packs.' },
      { text: 'Brand strategy, idea generation, calendar planning, and editorial workflows including approvals.' },
      { text: 'Messenger automation with knowledge-base and e-commerce integrations.' },
      { text: 'Analytics, performance tracking, and competitor insights.' },
      { text: 'Team collaboration with role-based permissions.' },
    ],
    outro:
      'The Service is delivered as software-as-a-service (SaaS). We may add, modify, or remove features over time; we will not materially reduce the core functionality of a paid plan during your current billing period without notice.',
  },
  {
    id: 'eligibility',
    title: '3. Eligibility & Accounts',
    bullets: [
      { text: 'You must create an account to use most features. You agree to provide accurate, current, and complete information and to keep it updated.' },
      { text: 'You are responsible for safeguarding your password, OTP codes, API keys, and any other credentials. Notify us immediately at support@sellanto.com if you suspect unauthorized access.' },
      { text: 'You are responsible for all activity that occurs under your account, including by team members or anyone you grant access to.' },
      { text: 'You may not create an account using false information, impersonate another person, or use the Service if you are barred from doing so under applicable law (e.g., trade sanctions).' },
      { text: 'One account per individual or business entity. You may not share a single account among multiple users — use the Team / workspace features instead.' },
    ],
  },
  {
    id: 'plans-billing',
    title: '4. Plans, Diamonds, Billing & Refunds',
    bullets: [
      { bold: 'Plans', text: 'Sellanto offers free and paid subscription tiers (Starter, Growth, Pro, and Business / Enterprise as applicable). Each plan includes a monthly allotment of "Diamonds" — our internal usage credit unit — and feature limits.' },
      { bold: 'Diamonds', text: 'Diamonds are consumed when you use AI features (captions, image generation, video generation, voiceover, Messenger AI, Magic Mode, etc.). Conversion rates per feature are displayed at point-of-use and may be revised with at least 14 days notice.' },
      { bold: 'Top-ups', text: 'You may purchase additional Diamonds at any time. Top-up Diamonds are non-refundable once added to your balance and may expire 12 months after purchase if unused.' },
      { bold: 'Billing cycle', text: 'paid plans are billed monthly or annually in advance, in the currency shown at checkout. Subscriptions auto-renew at the end of each billing period unless cancelled.' },
      { bold: 'Taxes', text: 'prices are exclusive of applicable VAT, GST, sales tax, or withholding tax, which will be added where required by law. You are responsible for any taxes not collected by us.' },
      { bold: 'Payment failure', text: 'if a payment fails, we may suspend or downgrade your account after a grace period and reasonable retries. You remain liable for outstanding fees.' },
      { bold: 'Refunds', text: 'subscription fees are generally non-refundable, but we offer a 7-day money-back guarantee on first-time upgrades to a paid plan if you have not consumed more than 25% of the plan\'s Diamond allotment. Statutory refund rights (e.g., EU consumer law) are unaffected.' },
      { bold: 'Cancellation', text: 'you may cancel your subscription at any time from Settings → Billing. Cancellation takes effect at the end of the current billing period; you retain access until then.' },
      { bold: 'Price changes', text: 'we may change plan prices with at least 30 days written notice. New prices apply at your next renewal.' },
    ],
  },
  {
    id: 'acceptable-use',
    title: '5. Acceptable Use',
    intro: 'You agree NOT to use the Service to do any of the following, and not to permit others (including team members and end-users you serve) to do so:',
    bullets: [
      { text: 'Violate any applicable law, regulation, or third-party right (including IP, privacy, and platform policies).' },
      { text: 'Post or generate content that is unlawful, defamatory, threatening, obscene, sexually explicit involving minors, harassing, hateful, or that incites violence.' },
      { text: 'Create or distribute misinformation, deepfakes of real persons without consent, deceptive political content, or fraudulent commercial offers.' },
      { text: 'Spam, send unsolicited bulk messages, manipulate engagement metrics, or operate inauthentic accounts on connected platforms.' },
      { text: 'Reverse-engineer, decompile, scrape, or attempt to extract source code, prompt templates, or model weights from the Service, except to the extent permitted by law.' },
      { text: 'Circumvent rate limits, plan quotas, security measures, content filters, or pricing logic.' },
      { text: 'Use the Service to develop a competing product, build a benchmark, or train a competing AI model.' },
      { text: 'Upload viruses, malware, or any code that could harm the Service or other users.' },
      { text: 'Use automated tools to access the Service beyond the documented APIs.' },
      { text: 'Use the Service in industries or for use cases where AI-generated content is restricted by law without obtaining the necessary licenses (e.g., regulated medical, legal, or financial advice).' },
      { text: 'Generate content that infringes third-party trademarks, copyrights, publicity rights, or trade secrets.' },
    ],
    outro:
      'We may, but are not required to, monitor use of the Service. We may suspend or terminate accounts that violate this section, and we may report illegal activity to law enforcement.',
  },
  {
    id: 'content-ownership',
    title: '6. Your Content & License to Sellanto',
    bullets: [
      { bold: 'Your content', text: 'you retain all rights, title, and interest in content you upload, import, or generate via the Service ("Customer Content"). Sellanto claims no ownership over Customer Content.' },
      { bold: 'License to us', text: 'you grant Sellanto a worldwide, non-exclusive, royalty-free license to host, store, copy, transmit, process, display, and modify Customer Content solely to provide and improve the Service for you (including transmitting it to third-party AI providers and social platforms as needed).' },
      { bold: 'AI output', text: 'subject to your compliance with these Terms and third-party model provider terms, you own the output you generate via the Service. AI output may not be unique to you, and similar output may be generated for other users — you should not assume that AI output is original or eligible for copyright protection.' },
      { bold: 'Feedback', text: 'if you send us feedback, suggestions, or ideas, you grant us a perpetual, royalty-free license to use them without obligation to you.' },
      { bold: 'Backups', text: 'we maintain backups of Customer Content for operational continuity, but you are responsible for keeping your own copies. We are not liable for data loss except as required by applicable law.' },
    ],
  },
  {
    id: 'ai-disclaimer',
    title: '7. AI-Specific Disclosures',
    bullets: [
      { text: 'AI output is generated by statistical models and may be inaccurate, incomplete, biased, offensive, or in some cases substantially similar to existing material. You must review AI output before publishing or relying on it.' },
      { text: 'You are solely responsible for the content you publish through the Service, including AI-generated content, and for ensuring it complies with applicable laws, platform rules, and third-party rights.' },
      { text: 'Sellanto is not a substitute for professional advice (legal, medical, financial, accounting, etc.). Do not rely on AI output for such purposes.' },
      { text: 'We do not guarantee that AI output will meet your specific requirements, be free from errors, or be available at any particular speed or quality.' },
      { text: 'AI providers may update their models or terms at any time, which may affect the cost, quality, or availability of certain features. We may pass through cost changes via Diamond pricing adjustments with notice.' },
      { text: 'When you use the "Bring Your Own Key" option, your use of the relevant model is also subject to that model provider\'s terms and pricing, and Sellanto is not responsible for charges or disputes between you and that provider.' },
    ],
  },
  {
    id: 'third-party',
    title: '8. Third-Party Platforms, APIs & Services',
    bullets: [
      { text: 'The Service integrates with third-party platforms (Meta, Google, X, LinkedIn, TikTok, etc.) and AI providers (OpenAI, Anthropic, Google, ElevenLabs, etc.). Your use of those services is governed by their respective terms and policies.' },
      { text: 'You authorize Sellanto to access and act on those platforms on your behalf using the OAuth scopes you grant. We use the minimum scopes necessary for each feature.' },
      { text: 'We are not responsible for changes, outages, content moderation decisions, or account actions taken by third-party platforms. If a platform terminates your account or restricts your access, the Service may be unable to perform certain actions for you.' },
      { text: 'You must comply with each connected platform\'s policies (e.g., Meta Platform Terms, Google API Services User Data Policy, X Developer Agreement). Violating those policies may result in termination of your Sellanto access.' },
    ],
  },
  {
    id: 'availability',
    title: '9. Service Availability, Modifications & Beta Features',
    bullets: [
      { text: 'We aim to provide a reliable Service but do not guarantee uninterrupted, error-free operation. We may perform scheduled maintenance and emergency repairs.' },
      { text: 'We may modify, add, or remove features at any time. We will provide reasonable notice of material changes that adversely affect paid features.' },
      { text: 'Features marked as "beta", "experimental", "alpha", or "preview" are provided as-is, may change or be discontinued at any time, and may have additional usage limits or restrictions.' },
      { text: 'Diamonds are not legal tender, have no cash value, and are non-transferable between accounts. Diamond grants from promotions may have separate expiry rules.' },
    ],
  },
  {
    id: 'security',
    title: '10. Security & Your Responsibilities',
    bullets: [
      { text: 'We employ industry-standard security measures, including TLS in transit, AES-256 encryption at rest for tokens and API keys, hashed passwords, and access controls.' },
      { text: 'You agree to maintain reasonable security on your own systems, including using strong passwords, enabling two-factor authentication where offered, keeping your devices free of malware, and not sharing credentials.' },
      { text: 'You must notify us immediately at support@sellanto.com upon discovering any unauthorized use of your account or any breach of security related to the Service.' },
    ],
  },
  {
    id: 'ip',
    title: '11. Sellanto Intellectual Property',
    bullets: [
      { text: 'The Service, including all software, designs, text, graphics, logos, prompt templates, workflow orchestration, and documentation, is owned by Sellanto or its licensors and is protected by intellectual property laws.' },
      { text: 'Subject to your compliance with these Terms and timely payment of fees, Sellanto grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your business purposes during your subscription term.' },
      { text: '"Sellanto", the Sellanto logo, and related marks are trademarks of Sellanto. You may not use them without our prior written consent except for factual reference (e.g., "powered by Sellanto").' },
      { text: 'Nothing in these Terms transfers ownership of any Sellanto intellectual property to you.' },
    ],
  },
  {
    id: 'termination',
    title: '12. Suspension & Termination',
    bullets: [
      { text: 'You may cancel your subscription at any time from Settings → Billing or by emailing support@sellanto.com.' },
      { text: 'We may suspend or terminate your access immediately if you (a) materially breach these Terms, (b) fail to pay fees when due after notice, (c) engage in activity that we reasonably believe is fraudulent, illegal, or harmful to others, or (d) violate third-party platform policies in a way that affects our integrations.' },
      { text: 'Upon termination, your right to access the Service ceases, scheduled posts may not be published, and we may delete your Customer Content after 30 days. Sections that by their nature should survive termination (including IP, fees due, disclaimers, limitation of liability, indemnity, and dispute resolution) will survive.' },
      { text: 'Prepaid subscription fees for the unused portion of the term are non-refundable unless required by law or unless termination was due solely to a material breach by Sellanto.' },
    ],
  },
  {
    id: 'disclaimers',
    title: '13. Disclaimers',
    intro:
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, OR ANY WARRANTY ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. SELLANTO DOES NOT WARRANT THAT (A) THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE, (B) AI OUTPUT WILL BE ACCURATE, NON-INFRINGING, OR SUITABLE FOR YOUR USE CASE, OR (C) ANY THIRD-PARTY PLATFORM WILL CONTINUE TO MAKE ITS APIS AVAILABLE.',
    bullets: [],
  },
  {
    id: 'liability',
    title: '14. Limitation of Liability',
    intro:
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW:',
    bullets: [
      { text: 'IN NO EVENT WILL SELLANTO OR ITS AFFILIATES, OFFICERS, EMPLOYEES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE, REGARDLESS OF LEGAL THEORY.' },
      { text: 'SELLANTO\'S TOTAL CUMULATIVE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE IN ANY 12-MONTH PERIOD WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO SELLANTO IN THE 12 MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS (USD 100).' },
      { text: 'NOTHING IN THESE TERMS EXCLUDES LIABILITY FOR FRAUD, GROSS NEGLIGENCE, OR ANY LIABILITY THAT CANNOT BE EXCLUDED OR LIMITED BY LAW.' },
    ],
  },
  {
    id: 'indemnity',
    title: '15. Indemnification',
    intro:
      'You agree to defend, indemnify, and hold harmless Sellanto and its affiliates, officers, employees, and agents from and against any claims, damages, liabilities, losses, costs, and expenses (including reasonable attorneys\' fees) arising out of or related to: (a) your Customer Content, (b) your use of the Service in violation of these Terms or applicable law, (c) your violation of a third party\'s rights (including IP, privacy, and platform policies), or (d) AI output you publish or distribute. Sellanto reserves the right to assume the exclusive defense and control of any matter subject to indemnification, in which case you agree to cooperate.',
    bullets: [],
  },
  {
    id: 'governing-law',
    title: '16. Governing Law & Dispute Resolution',
    bullets: [
      { text: 'These Terms are governed by the laws of Bangladesh, without regard to conflict-of-laws principles. The United Nations Convention on Contracts for the International Sale of Goods does not apply.' },
      { text: 'You and Sellanto first agree to attempt to resolve any dispute informally by contacting support@sellanto.com. If we cannot resolve a dispute within 60 days, you and Sellanto agree to submit to the exclusive jurisdiction of the courts located in Dhaka, Bangladesh.' },
      { text: 'Where mandatory consumer-protection law in your country provides a more protective forum or set of rights, those mandatory provisions apply to you.' },
    ],
  },
  {
    id: 'changes',
    title: '17. Changes to These Terms',
    intro:
      'We may update these Terms from time to time. The "Last updated" date at the top reflects the most recent revision. If we make material changes, we will notify you by email or in-app notification at least 14 days before they take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated Terms. If you do not agree, you must stop using the Service before the effective date.',
    bullets: [],
  },
  {
    id: 'general',
    title: '18. General',
    bullets: [
      { bold: 'Entire agreement', text: 'these Terms, together with the Privacy Policy and any order form or addenda you sign with us, constitute the entire agreement between you and Sellanto regarding the Service and supersede all prior agreements.' },
      { bold: 'Severability', text: 'if any provision is found unenforceable, the remaining provisions will remain in full force and effect.' },
      { bold: 'No waiver', text: 'our failure to enforce a right or provision is not a waiver of that right or provision.' },
      { bold: 'Assignment', text: 'you may not assign or transfer these Terms without our prior written consent. We may assign these Terms to an affiliate or in connection with a merger, acquisition, or sale of assets.' },
      { bold: 'Force majeure', text: 'we are not liable for delays or failures caused by events beyond our reasonable control (e.g., natural disasters, war, internet outages, government action, third-party platform failures).' },
      { bold: 'Notices', text: 'we may give notices via the email address on your account or via in-product notifications. You must send legal notices to support@sellanto.com with subject "Legal Notice".' },
      { bold: 'No agency', text: 'no agency, partnership, joint venture, or employment is created between you and Sellanto by these Terms.' },
    ],
  },
  {
    id: 'contact',
    title: '19. Contact',
    intro: 'For questions about these Terms, contact us at:',
    bullets: [
      { bold: 'Email', text: 'support@sellanto.com' },
      { bold: 'Subject line', text: '"Terms Inquiry — <your account email>"' },
      { bold: 'Postal mail', text: 'Sellanto — Attn: Legal, Dhaka, Bangladesh' },
    ],
  },
];

export function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
          <DocumentTextIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">Terms of Service</h1>
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
          Welcome to Sellanto. These Terms of Service explain the rules for using our platform — what you can and
          cannot do, how billing works, how we handle your content, and what you can expect from us. Please read them
          carefully. If anything is unclear, email us at{' '}
          <a className="text-primary hover:underline" href="mailto:support@sellanto.com">
            support@sellanto.com
          </a>{' '}
          before signing up.
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

export default TermsPage;
