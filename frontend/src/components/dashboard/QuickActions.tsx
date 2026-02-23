import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PlusCircleIcon,
  LinkIcon,
  SparklesIcon,
  DocumentTextIcon,
  PhotoIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

interface QuickAction {
  name: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const actions: QuickAction[] = [
  {
    name: 'Create Post',
    description: 'Schedule a new post',
    href: '/posts/create',
    icon: PlusCircleIcon,
    color: 'from-primary to-secondary',
  },
  {
    name: 'Connect Account',
    description: 'Link social media',
    href: '/platforms',
    icon: LinkIcon,
    color: 'from-info to-primary',
  },
  {
    name: 'AI Caption',
    description: 'Generate captions',
    href: '/ai-caption',
    icon: SparklesIcon,
    color: 'from-secondary to-accent',
  },
  {
    name: 'My Posts',
    description: 'View all posts',
    href: '/posts',
    icon: DocumentTextIcon,
    color: 'from-success to-info',
  },
  {
    name: 'AI Image',
    description: 'Create images',
    href: '/ai-image',
    icon: PhotoIcon,
    color: 'from-accent to-warning',
  },
  {
    name: 'AI Video',
    description: 'Generate videos',
    href: '/ai-video',
    icon: VideoCameraIcon,
    color: 'from-danger to-secondary',
  },
  {
    name: 'AI Voice',
    description: 'Text to speech',
    href: '/ai-voice',
    icon: SpeakerWaveIcon,
    color: 'from-info to-success',
  },
  {
    name: 'Messenger Bot',
    description: 'AI chatbot',
    href: '/messenger',
    icon: ChatBubbleLeftRightIcon,
    color: 'from-[#006AFF] to-[#00B2FF]',
  },
];

export function QuickActions() {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {actions.map((action, index) => (
          <motion.div
            key={action.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link
              to={action.href}
              className="card p-4 h-full flex flex-col items-center justify-center text-center group"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 shrink-0 group-hover:scale-110 transition-transform duration-200`}
              >
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors leading-tight">
                {action.name}
              </h3>
              <p className="text-xs text-text-muted mt-1 hidden sm:block leading-tight">
                {action.description}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
