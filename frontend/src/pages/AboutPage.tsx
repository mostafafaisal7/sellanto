import { motion } from 'framer-motion';
import {
  RocketLaunchIcon,
  SparklesIcon,
  GlobeAltIcon,
  UserGroupIcon,
  HeartIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const features = [
  {
    icon: SparklesIcon,
    title: 'AI-Powered Content',
    description: 'Generate captions, images, videos, and voiceovers using cutting-edge AI models.',
  },
  {
    icon: GlobeAltIcon,
    title: 'Multi-Platform Publishing',
    description: 'Post to Facebook, Instagram, Twitter, and LinkedIn from one dashboard.',
  },
  {
    icon: UserGroupIcon,
    title: 'Messenger Automation',
    description: 'Smart chatbot with RAG-powered responses, knowledge base, and e-commerce integration.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Secure & Private',
    description: 'Your data is encrypted and your API keys are stored securely. We never share your information.',
  },
];

const team = [
  { name: 'Sellanto Team', role: 'Development & Design', emoji: '🚀' },
];

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
          <RocketLaunchIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-4">
          About <span className="gradient-text">Sellanto</span>
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Sellanto is an all-in-one social media management platform powered by AI.
          We help businesses and creators manage their social presence, generate content,
          and engage with their audience — all from a single dashboard.
        </p>
      </motion.div>

      {/* Mission */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-8 mb-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <HeartIcon className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-text-primary">Our Mission</h2>
        </div>
        <p className="text-text-secondary leading-relaxed">
          We believe managing social media shouldn't be complicated or time-consuming.
          Our mission is to empower businesses of all sizes with intelligent tools that
          automate repetitive tasks, generate high-quality content, and provide actionable
          insights — so you can focus on what matters most: growing your business.
        </p>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="text-xl font-bold text-text-primary mb-6 text-center">What We Offer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="card p-6"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Team */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card p-8 mb-8 text-center"
      >
        <h2 className="text-xl font-bold text-text-primary mb-4">Built By</h2>
        {team.map((member) => (
          <div key={member.name} className="inline-flex items-center gap-3 px-6 py-3 bg-dark-700/50 rounded-xl">
            <span className="text-2xl">{member.emoji}</span>
            <div className="text-left">
              <p className="font-semibold text-text-primary">{member.name}</p>
              <p className="text-sm text-text-secondary">{member.role}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Version */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-sm text-text-muted pb-8"
      >
        <p>Sellanto v2.0</p>
      </motion.div>
    </div>
  );
}

export default AboutPage;
