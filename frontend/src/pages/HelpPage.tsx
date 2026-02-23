import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QuestionMarkCircleIcon,
  ChevronDownIcon,
  EnvelopeIcon,
  ChatBubbleBottomCenterTextIcon,
  LinkIcon,
  SparklesIcon,
  CalendarDaysIcon,
  KeyIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: 'Getting Started',
    question: 'How do I connect my social media accounts?',
    answer: 'Go to the "Connect Account" page from the sidebar. Click on the platform you want to connect (Facebook, Instagram, Twitter, or LinkedIn) and follow the authorization flow. Once connected, you\'ll see the account appear in your dashboard.',
  },
  {
    category: 'Getting Started',
    question: 'How do I create and schedule a post?',
    answer: 'Click "Create Post" in the sidebar. Write your content, attach media if needed, select the platforms to post to, and either publish immediately or schedule for a future date and time. You can view all your scheduled posts in "My Posts".',
  },
  {
    category: 'AI Features',
    question: 'How does AI Caption generation work?',
    answer: 'Navigate to "AI Caption" in the sidebar. Enter a topic or description, select the tone and platform, and click generate. The AI will create multiple caption options for you. You can save, edit, or use them directly in a new post.',
  },
  {
    category: 'AI Features',
    question: 'What AI models are used for image and video generation?',
    answer: 'AI Image uses DALL-E (OpenAI) and Gemini (Google) for generation. AI Video uses Google Gemini. You can use either the platform\'s shared API or provide your own API keys in Settings for unlimited usage.',
  },
  {
    category: 'API Keys',
    question: 'Do I need my own API keys?',
    answer: 'No, you can use the platform\'s shared API (Admin mode). However, if you want unlimited usage or faster processing, you can provide your own OpenAI and Gemini API keys in Settings > API Keys. Your keys are encrypted and shared across all AI features automatically.',
  },
  {
    category: 'API Keys',
    question: 'Where do I get API keys?',
    answer: 'For OpenAI: Visit platform.openai.com, create an account, and generate an API key (starts with sk-). For Google Gemini: Visit ai.google.dev, create a project, and generate an API key (starts with AIza).',
  },
  {
    category: 'Messenger Bot',
    question: 'How do I set up the Messenger chatbot?',
    answer: 'Go to "Messenger Bot" in the sidebar. Create a new connection by entering your Facebook Page ID and Page Access Token. Configure the webhook in your Facebook App settings using the provided Webhook URL and Verify Token. Upload PDFs to build a knowledge base for your bot.',
  },
  {
    category: 'Messenger Bot',
    question: 'What is RAG and how does the knowledge base work?',
    answer: 'RAG (Retrieval-Augmented Generation) allows your chatbot to answer questions using your uploaded documents. Upload PDFs (product catalogs, FAQs, guides) and the system generates embeddings. When a customer asks a question, the bot searches your documents for relevant information and generates accurate, contextual responses.',
  },
  {
    category: 'Account',
    question: 'How do I change my theme?',
    answer: 'Go to Settings > Appearance. You can choose between Light, Dark, or System theme. The System option will automatically match your device\'s theme preference.',
  },
  {
    category: 'Account',
    question: 'How do I delete my account?',
    answer: 'Go to Settings, scroll down to the "Danger Zone" section, and click "Delete Account". You\'ll need to type DELETE to confirm. This action is irreversible and will permanently remove all your data.',
  },
];

const categories = [...new Set(faqs.map(f => f.category))];

const quickLinks = [
  { icon: LinkIcon, label: 'Connect Accounts', href: '/platforms', desc: 'Link your social profiles' },
  { icon: SparklesIcon, label: 'AI Caption', href: '/ai-caption', desc: 'Generate AI-powered captions' },
  { icon: CalendarDaysIcon, label: 'Create Post', href: '/posts/create', desc: 'Schedule a new post' },
  { icon: ChatBubbleBottomCenterTextIcon, label: 'Messenger Bot', href: '/messenger', desc: 'Set up your chatbot' },
  { icon: KeyIcon, label: 'API Keys', href: '/settings', desc: 'Configure your API keys' },
  { icon: CpuChipIcon, label: 'Business Profile', href: '/business-profile', desc: 'Set up your brand' },
];

export function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredFaqs = activeCategory === 'all'
    ? faqs
    : faqs.filter(f => f.category === activeCategory);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
          <QuestionMarkCircleIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-4">Help Center</h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Find answers to common questions and learn how to get the most out of Sellanto.
        </p>
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-10"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="card p-4 hover:-translate-y-1 transition-all duration-200 block"
            >
              <link.icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm font-semibold text-text-primary">{link.label}</p>
              <p className="text-xs text-text-muted mt-1">{link.desc}</p>
            </a>
          ))}
        </div>
      </motion.div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-10"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-4">Frequently Asked Questions</h2>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === 'all'
                ? 'bg-primary text-white'
                : 'bg-dark-600 text-text-secondary hover:bg-dark-500'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-dark-600 text-text-secondary hover:bg-dark-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {filteredFaqs.map((faq, index) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className="card overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <div>
                  <span className="text-xs text-primary font-medium">{faq.category}</span>
                  <p className="text-sm font-semibold text-text-primary mt-1">{faq.question}</p>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-text-muted flex-shrink-0 ml-4 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === index && (
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
          ))}
        </div>
      </motion.div>

      {/* Contact Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card p-8 text-center mb-8"
      >
        <EnvelopeIcon className="w-8 h-8 text-primary mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">Still need help?</h2>
        <p className="text-sm text-text-secondary mb-4">
          Can't find what you're looking for? Reach out to our support team.
        </p>
        <a
          href="mailto:support@sellanto.com"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-primary text-white font-semibold rounded-xl shadow-glow-primary hover:-translate-y-0.5 transition-all duration-300"
        >
          <EnvelopeIcon className="w-5 h-5" />
          Contact Support
        </a>
      </motion.div>
    </div>
  );
}

export default HelpPage;
