import { motion } from 'framer-motion';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect information you provide directly to us, including:

• **Account Information**: Name, email address, and password when you create an account.
• **Social Media Accounts**: OAuth tokens and page access tokens when you connect your social media accounts.
• **Content**: Posts, captions, images, videos, and other content you create or upload.
• **API Keys**: When you provide your own OpenAI or Gemini API keys, they are stored securely and encrypted.
• **Usage Data**: How you interact with our platform, features used, and performance metrics.`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use the information we collect to:

• Provide, maintain, and improve our services.
• Process and publish your social media posts.
• Generate AI-powered content (captions, images, videos, voiceovers).
• Power the Messenger chatbot and knowledge base features.
• Send you notifications about your posts and account activity.
• Analyze usage patterns to improve user experience.`,
  },
  {
    title: '3. Data Storage & Security',
    content: `• All data is stored on secure servers with encryption at rest and in transit.
• API keys are encrypted before storage and never exposed in API responses.
• Social media tokens are stored securely and used only for authorized actions.
• We use industry-standard security practices including HTTPS, secure headers, and input validation.
• Database backups are encrypted and access is restricted to authorized personnel only.`,
  },
  {
    title: '4. Third-Party Services',
    content: `We integrate with the following third-party services:

• **Facebook / Instagram / Twitter / LinkedIn** — For publishing posts and managing social accounts.
• **OpenAI** — For AI caption generation, chatbot responses, and embeddings.
• **Google Gemini** — For AI image and video generation.
• **WooCommerce** — For e-commerce product catalog integration (when configured by user).

Your data shared with these services is governed by their respective privacy policies.`,
  },
  {
    title: '5. Data Retention',
    content: `• Account data is retained as long as your account is active.
• Post history and analytics data are retained for your reference.
• When you delete your account, all associated data is permanently removed within 30 days.
• You can request data export or deletion at any time through Settings.`,
  },
  {
    title: '6. Your Rights',
    content: `You have the right to:

• **Access** your personal data at any time through your profile.
• **Update** your information through the Settings page.
• **Delete** your account and all associated data.
• **Export** your data in a portable format.
• **Disconnect** any linked social media accounts at any time.`,
  },
  {
    title: '7. Contact Us',
    content: `If you have questions about this Privacy Policy or your data, please contact us at **support@sellanto.com**.`,
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
            <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {section.content}
            </div>
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
