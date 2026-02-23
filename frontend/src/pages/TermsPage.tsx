import { motion } from 'framer-motion';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using Sellanto ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform.`,
  },
  {
    title: '2. Description of Service',
    content: `Sellanto is a social media management platform that provides:

• Multi-platform post scheduling and publishing (Facebook, Instagram, Twitter, LinkedIn).
• AI-powered content generation (captions, images, videos, voiceovers).
• Messenger chatbot automation with knowledge base and e-commerce integration.
• Analytics and performance tracking.
• Social account management and connection.`,
  },
  {
    title: '3. User Accounts',
    content: `• You must create an account to use the Platform.
• You are responsible for maintaining the confidentiality of your account credentials.
• You must provide accurate and complete information when creating your account.
• You are responsible for all activities that occur under your account.
• You must be at least 18 years old to use the Platform.`,
  },
  {
    title: '4. Acceptable Use',
    content: `You agree NOT to use the Platform to:

• Violate any laws or regulations.
• Post spam, misleading, or harmful content.
• Infringe on the intellectual property rights of others.
• Distribute malware or engage in any form of hacking.
• Harass, abuse, or harm other users.
• Circumvent any security measures or rate limits.
• Use the AI features to generate illegal, harmful, or deceptive content.`,
  },
  {
    title: '5. Content Ownership',
    content: `• You retain ownership of all content you create and publish through the Platform.
• By using the Platform, you grant us a limited license to process, store, and transmit your content as necessary to provide the service.
• AI-generated content (captions, images, videos) created using the Platform's tools is yours to use.
• We do not claim ownership of any content you upload or create.`,
  },
  {
    title: '6. API Keys & Third-Party Services',
    content: `• When you provide your own API keys (OpenAI, Gemini), you are responsible for any charges incurred through those services.
• We are not liable for any issues, charges, or data loss related to third-party services.
• You must comply with the terms of service of all connected social media platforms.
• We may revoke access to our Platform if you violate third-party platform policies.`,
  },
  {
    title: '7. Service Availability',
    content: `• We strive to maintain 99.9% uptime but do not guarantee uninterrupted service.
• We may perform scheduled maintenance with advance notice.
• We reserve the right to modify, suspend, or discontinue any feature with reasonable notice.`,
  },
  {
    title: '8. Limitation of Liability',
    content: `• The Platform is provided "as is" without warranties of any kind.
• We are not liable for any indirect, incidental, or consequential damages.
• Our total liability shall not exceed the amount you paid for the service in the past 12 months.
• We are not responsible for content published to your social media accounts through the Platform.`,
  },
  {
    title: '9. Account Termination',
    content: `• You may delete your account at any time through the Settings page.
• We reserve the right to suspend or terminate accounts that violate these terms.
• Upon termination, your data will be deleted within 30 days.`,
  },
  {
    title: '10. Changes to Terms',
    content: `We may update these Terms of Service from time to time. We will notify you of significant changes via email or in-app notification. Continued use of the Platform after changes constitutes acceptance of the updated terms.`,
  },
  {
    title: '11. Contact',
    content: `For questions about these Terms of Service, please contact us at **support@sellanto.com**.`,
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

export default TermsPage;
