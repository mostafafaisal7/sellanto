import { motion } from 'framer-motion';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

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
    title: '1. Information We Collect',
    intro: 'We collect information you provide directly to us, including:',
    bullets: [
      { bold: 'Account Information', text: 'Name, email address, and password when you create an account.' },
      { bold: 'Social Media Accounts', text: 'OAuth tokens and page access tokens when you connect your social media accounts.' },
      { bold: 'Content', text: 'Posts, captions, images, videos, and other content you create or upload.' },
      { bold: 'API Keys', text: 'When you provide your own OpenAI or Gemini API keys, they are stored securely and encrypted.' },
      { bold: 'Usage Data', text: 'How you interact with our platform, features used, and performance metrics.' },
    ],
  },
  {
    title: '2. How We Use Your Information',
    intro: 'We use the information we collect to:',
    bullets: [
      { text: 'Provide, maintain, and improve our services.' },
      { text: 'Process and publish your social media posts.' },
      { text: 'Generate AI-powered content (captions, images, videos, voiceovers).' },
      { text: 'Power the Messenger chatbot and knowledge base features.' },
      { text: 'Send you notifications about your posts and account activity.' },
      { text: 'Analyze usage patterns to improve user experience.' },
    ],
  },
  {
    title: '3. Data Storage & Security',
    bullets: [
      { text: 'All data is stored on secure servers with encryption at rest and in transit.' },
      { text: 'API keys are encrypted before storage and never exposed in API responses.' },
      { text: 'Social media tokens are stored securely and used only for authorized actions.' },
      { text: 'We use industry-standard security practices including HTTPS, secure headers, and input validation.' },
      { text: 'Database backups are encrypted and access is restricted to authorized personnel only.' },
    ],
  },
  {
    title: '4. Third-Party Services',
    intro: 'We integrate with the following third-party services:',
    bullets: [
      { bold: 'Facebook / Instagram / Twitter / LinkedIn', text: 'For publishing posts and managing social accounts.' },
      { bold: 'OpenAI', text: 'For AI caption generation, chatbot responses, and embeddings.' },
      { bold: 'Google Gemini', text: 'For AI image and video generation.' },
      { bold: 'WooCommerce', text: 'For e-commerce product catalog integration (when configured by user).' },
    ],
    outro: 'Your data shared with these services is governed by their respective privacy policies.',
  },
  {
    title: '5. Data Retention',
    bullets: [
      { text: 'Account data is retained as long as your account is active.' },
      { text: 'Post history and analytics data are retained for your reference.' },
      { text: 'When you delete your account, all associated data is permanently removed within 30 days.' },
      { text: 'You can request data export or deletion at any time through Settings.' },
    ],
  },
  {
    title: '6. Your Rights',
    intro: 'You have the right to:',
    bullets: [
      { bold: 'Access', text: 'your personal data at any time through your profile.' },
      { bold: 'Update', text: 'your information through the Settings page.' },
      { bold: 'Delete', text: 'your account and all associated data.' },
      { bold: 'Export', text: 'your data in a portable format.' },
      { bold: 'Disconnect', text: 'any linked social media accounts at any time.' },
    ],
  },
  {
    title: '7. Contact Us',
    intro: 'If you have questions about this Privacy Policy or your data, please contact us at:',
    bullets: [],
    outro: 'support@sellanto.com',
  },
];

export function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
          <ShieldCheckIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-4">Privacy Policy</h1>
        <p className="text-text-secondary">
          Last updated: February 15, 2026
        </p>
      </motion.div>

      {/* Introduction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-8 mb-6"
      >
        <p className="text-text-secondary leading-relaxed">
          At Sellanto, we take your privacy seriously.
          This Privacy Policy explains how we collect, use, store, and protect your
          personal information when you use our platform.
        </p>
      </motion.div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.05 }}
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

export default PrivacyPage;
