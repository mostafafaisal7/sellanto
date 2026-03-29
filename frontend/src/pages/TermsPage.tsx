import { motion } from 'framer-motion';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

interface BulletItem {
  bold?: string;
  text: string;
}

interface Section {
  title: string;
  intro?: string;
  bullets: BulletItem[];
  outro?: string;
}

const sections: Section[] = [
  {
    title: '1. Acceptance of Terms',
    intro: 'By accessing or using Sellanto ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform.',
    bullets: [],
  },
  {
    title: '2. Description of Service',
    intro: 'Sellanto is a social media management platform that provides:',
    bullets: [
      { text: 'Multi-platform post scheduling and publishing (Facebook, Instagram, Twitter, LinkedIn).' },
      { text: 'AI-powered content generation (captions, images, videos, voiceovers).' },
      { text: 'Messenger chatbot automation with knowledge base and e-commerce integration.' },
      { text: 'Analytics and performance tracking.' },
      { text: 'Social account management and connection.' },
    ],
  },
  {
    title: '3. User Accounts',
    bullets: [
      { text: 'You must create an account to use the Platform.' },
      { text: 'You are responsible for maintaining the confidentiality of your account credentials.' },
      { text: 'You must provide accurate and complete information when creating your account.' },
      { text: 'You are responsible for all activities that occur under your account.' },
      { text: 'You must be at least 18 years old to use the Platform.' },
    ],
  },
  {
    title: '4. Acceptable Use',
    intro: 'You agree NOT to use the Platform to:',
    bullets: [
      { text: 'Violate any laws or regulations.' },
      { text: 'Post spam, misleading, or harmful content.' },
      { text: 'Infringe on the intellectual property rights of others.' },
      { text: 'Distribute malware or engage in any form of hacking.' },
      { text: 'Harass, abuse, or harm other users.' },
      { text: 'Circumvent any security measures or rate limits.' },
      { text: 'Use the AI features to generate illegal, harmful, or deceptive content.' },
    ],
  },
  {
    title: '5. Content Ownership',
    bullets: [
      { text: 'You retain ownership of all content you create and publish through the Platform.' },
      { text: 'By using the Platform, you grant us a limited license to process, store, and transmit your content as necessary to provide the service.' },
      { text: 'AI-generated content (captions, images, videos) created using the Platform\'s tools is yours to use.' },
      { text: 'We do not claim ownership of any content you upload or create.' },
    ],
  },
  {
    title: '6. API Keys & Third-Party Services',
    bullets: [
      { text: 'When you provide your own API keys (OpenAI, Gemini), you are responsible for any charges incurred through those services.' },
      { text: 'We are not liable for any issues, charges, or data loss related to third-party services.' },
      { text: 'You must comply with the terms of service of all connected social media platforms.' },
      { text: 'We may revoke access to our Platform if you violate third-party platform policies.' },
    ],
  },
  {
    title: '7. Service Availability',
    bullets: [
      { text: 'We strive to maintain 99.9% uptime but do not guarantee uninterrupted service.' },
      { text: 'We may perform scheduled maintenance with advance notice.' },
      { text: 'We reserve the right to modify, suspend, or discontinue any feature with reasonable notice.' },
    ],
  },
  {
    title: '8. Limitation of Liability',
    bullets: [
      { text: 'The Platform is provided "as is" without warranties of any kind.' },
      { text: 'We are not liable for any indirect, incidental, or consequential damages.' },
      { text: 'Our total liability shall not exceed the amount you paid for the service in the past 12 months.' },
      { text: 'We are not responsible for content published to your social media accounts through the Platform.' },
    ],
  },
  {
    title: '9. Account Termination',
    bullets: [
      { text: 'You may delete your account at any time through the Settings page.' },
      { text: 'We reserve the right to suspend or terminate accounts that violate these terms.' },
      { text: 'Upon termination, your data will be deleted within 30 days.' },
    ],
  },
  {
    title: '10. Changes to Terms',
    intro: 'We may update these Terms of Service from time to time. We will notify you of significant changes via email or in-app notification. Continued use of the Platform after changes constitutes acceptance of the updated terms.',
    bullets: [],
  },
  {
    title: '11. Contact',
    intro: 'For questions about these Terms of Service, please contact us at:',
    bullets: [],
    outro: 'support@sellanto.com',
  },
];

export function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
          <DocumentTextIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-4">Terms of Service</h1>
        <p className="text-text-secondary">
          Last updated: February 15, 2026
        </p>
      </motion.div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.04 }}
            className="card p-6"
          >
            <h2 className="text-lg font-semibold text-text-primary mb-3">{section.title}</h2>

            {section.intro && (
              <p className="text-sm text-text-secondary mb-3">{section.intro}</p>
            )}

            {section.bullets.length > 0 && (
              <ul className="space-y-2 ml-1">
                {section.bullets.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
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
              <p className="text-sm text-text-secondary mt-3">{section.outro}</p>
            )}
          </motion.div>
        ))}
      </div>

      <div className="text-center text-sm text-text-muted py-8">
        <p>Sellanto v2.0</p>
      </div>
    </div>
  );
}

export default TermsPage;
