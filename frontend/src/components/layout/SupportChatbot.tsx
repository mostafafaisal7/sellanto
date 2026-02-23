import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';
import { api } from '../../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SupportChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_QUESTIONS = [
  'How to connect Facebook?',
  'How to schedule posts?',
  'What AI tools are available?',
  'How to set up API keys?',
];

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content:
    "Hi! I'm your **Sellanto** support assistant. I can help you with connecting social accounts, creating posts, using AI tools, setting up the Messenger Bot, and more.\n\nWhat would you like to know?",
};

export function SupportChatbot({ isOpen, onClose }: SupportChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await api.post('/support-chat/', {
        messages: updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: errorMsg },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const showQuickQuestions = messages.length <= 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 z-40 w-[380px] h-[520px] flex flex-col rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.4)] border border-white/10"
          style={{ background: 'rgb(var(--c-dark-700))' }}
        >
          {/* Gradient top border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent z-10" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-dark-800/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  Sellanto Support
                </h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] text-text-muted font-medium">
                    AI Assistant
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-icon w-8 h-8 hover:bg-white/5 rounded-lg"
            >
              <XMarkIcon className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mr-2 mt-1 shrink-0">
                    <SparklesIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-primary to-secondary text-white rounded-br-md'
                      : 'bg-dark-500/80 text-text-primary rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="chatbot-markdown">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-bold text-primary">{children}</strong>,
                          em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 last:mb-0">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 last:mb-0">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          h1: ({ children }) => <h1 className="text-base font-bold text-text-primary mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-bold text-text-primary mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold text-text-primary mb-1">{children}</h3>,
                          code: ({ children }) => (
                            <code className="px-1.5 py-0.5 bg-dark-800 rounded text-xs text-warning font-mono">{children}</code>
                          ),
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 transition-colors">
                              {children}
                            </a>
                          ),
                          hr: () => <hr className="border-white/10 my-2" />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mr-2 mt-1 shrink-0">
                  <SparklesIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-dark-500/80 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Quick question chips */}
            {showQuickQuestions && (
              <div className="flex flex-wrap gap-2 pt-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="px-4 py-3 border-t border-white/5 bg-dark-800/50 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about Sellanto..."
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-dark-600 text-text-primary text-sm rounded-xl border border-white/5 placeholder:text-text-muted focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SupportChatbot;
