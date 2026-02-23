import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  BoltIcon,
  ChartBarIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  UserCircleIcon,
  PhotoIcon,
  DocumentIcon,
  SpeakerWaveIcon,
  LinkIcon,
  ClipboardDocumentIcon,
  PlayIcon,
  ArrowUpTrayIcon,
  BellIcon,
  HandRaisedIcon,
  CloudArrowUpIcon,
  CpuChipIcon,
  XMarkIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  QuestionMarkCircleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { messengerService } from '../services/messengerService';
import { Spinner } from '../components/ui';
import type {
  MessengerConnection,
  AIConfiguration,
  PDFKnowledgeBase,
  CustomPrompt,
  Conversation,
  VoiceModel,
  PromptTone,
  NotificationType,
  GenerationStatus,
  ECommerceSettings,
  EComProduct,
} from '../types';


type TabType = 'dashboard' | 'connections' | 'conversations' | 'knowledge' | 'prompts' | 'settings';

const voiceModels: { value: VoiceModel; label: string }[] = [
  { value: 'alloy', label: 'Alloy' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'nova', label: 'Nova' },
  { value: 'shimmer', label: 'Shimmer' },
];

const promptTones: { value: PromptTone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual & Friendly' },
  { value: 'friendly', label: 'Warm & Friendly' },
  { value: 'technical', label: 'Technical & Detailed' },
  { value: 'sales', label: 'Sales-Oriented' },
  { value: 'support', label: 'Customer Support' },
];

const openaiModels = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

export const notificationTypes: { value: NotificationType; label: string; color: string }[] = [
  { value: 'product_inquiry', label: 'Product Inquiry', color: 'text-green-400' },
  { value: 'appointment', label: 'Appointment Request', color: 'text-blue-400' },
  { value: 'order', label: 'Order Request', color: 'text-purple-400' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
  { value: 'complaint', label: 'Complaint', color: 'text-yellow-400' },
  { value: 'pricing', label: 'Pricing Question', color: 'text-cyan-400' },
  { value: 'availability', label: 'Availability Check', color: 'text-emerald-400' },
  { value: 'contact', label: 'Contact Request', color: 'text-indigo-400' },
  { value: 'general', label: 'Important Message', color: 'text-gray-400' },
];

export function MessengerBotPage() {
  // Core state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [connections, setConnections] = useState<MessengerConnection[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Real data state (replaces mock data)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<PDFKnowledgeBase[]>([]);
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);

  // Loading states per section
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [knowledgeBaseLoading, setKnowledgeBaseLoading] = useState(false);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Message sending
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // PDF upload
  const [isUploading, setIsUploading] = useState(false);

  // Website Knowledge Base
  const [websiteStatus, setWebsiteStatus] = useState<{
    website_url: string | null;
    has_data: boolean;
    chunk_count: number;
    pages_crawled: number;
    generated_at: string | null;
  } | null>(null);
  const [crawlingWebsite, setCrawlingWebsite] = useState(false);
  const [websiteUrlInput, setWebsiteUrlInput] = useState('');

  // E-Commerce state
  const [ecomSettings, setEcomSettings] = useState<Partial<ECommerceSettings>>({
    platform_type: 'woocommerce',
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
    is_enabled: false,
    product_match_threshold: 0.35,
    currency_symbol: '$',
  });
  const [ecomProducts, setEcomProducts] = useState<EComProduct[]>([]);
  const [ecomLoading, setEcomLoading] = useState(false);
  const [ecomSaving, setEcomSaving] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [generatingEmbeddings, setGeneratingEmbeddings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Prompt modal state
  const [editingPrompt, setEditingPrompt] = useState<CustomPrompt | null>(null);
  const [promptForm, setPromptForm] = useState({ name: '', system_prompt: '', tone: 'friendly' as PromptTone });

  // Messages ref for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive selected connection
  const selectedConnection = connections.length > 0 ? connections[0] : null;

  // AI Configuration state
  const [aiConfig, setAiConfig] = useState<Partial<AIConfiguration>>({
    openai_api_key: '',
    openai_model: 'gpt-4o',
    embedding_model: 'text-embedding-3-small',
    rag_enabled: true,
    top_k_results: 5,
    similarity_threshold: 0.7,
    temperature: 0.7,
    max_tokens: 1024,
    image_understanding_enabled: true,
    voice_transcription_enabled: true,
    voice_reply_enabled: false,
    voice_model: 'alloy',
  });

  // Connect Modal State - 4 Step Wizard
  const [connectStep, setConnectStep] = useState(1);
  const [connectForm, setConnectForm] = useState({
    page_name: '',
    page_id: '',
    page_access_token: '',
    greeting_text: 'Hi! Thanks for reaching out. How can I help you today?',
    website_url: '',
    openai_api_key: '',
    openai_model: 'gpt-4o',
    embedding_model: 'text-embedding-3-small',
    top_k_results: 5,
    similarity_threshold: 0.7,
    temperature: 0.7,
    max_tokens: 1024,
    rag_enabled: true,
    image_understanding_enabled: true,
    prompt_name: 'Customer Support',
    prompt_tone: 'friendly',
    system_prompt: 'You are a helpful customer support assistant. Answer questions clearly and professionally.',
    is_active: true,
    pdf_files: [] as File[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ========== Data Fetching ==========

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, connectionsData, notificationsData] = await Promise.all([
        messengerService.getDashboard(),
        messengerService.getConnections(),
        messengerService.getNotifications()
      ]);
      console.log('fetchData connections:', connectionsData);
      setStats(statsData);
      setConnections(Array.isArray(connectionsData) ? connectionsData : (connectionsData as any)?.results || []);
      setNotifications(Array.isArray(notificationsData) ? notificationsData : (notificationsData as any)?.results || []);
    } catch (error) {
      console.error('Error fetching messenger data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    if (!selectedConnection) return;
    setConversationsLoading(true);
    try {
      const data = await messengerService.getConversations(selectedConnection.id);
      setConversations(data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  };

  const fetchConversationMessages = async (conversationId: number) => {
    if (!selectedConnection) return;
    try {
      const data = await messengerService.getConversation(selectedConnection.id, conversationId);
      setSelectedConversation(data);
    } catch (error) {
      console.error('Failed to fetch conversation messages:', error);
    }
  };

  const fetchKnowledgeBase = async () => {
    if (!selectedConnection) return;
    setKnowledgeBaseLoading(true);
    try {
      const data = await messengerService.getPDFs(selectedConnection.id);
      setKnowledgeBase(data);
    } catch (error) {
      console.error('Failed to fetch knowledge base:', error);
    } finally {
      setKnowledgeBaseLoading(false);
    }
  };

  const fetchPrompts = async () => {
    if (!selectedConnection) return;
    setPromptsLoading(true);
    try {
      const data = await messengerService.getPrompts(selectedConnection.id);
      setPrompts(data);
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
    } finally {
      setPromptsLoading(false);
    }
  };

  const fetchAiConfig = async () => {
    if (!selectedConnection) return;
    setConfigLoading(true);
    try {
      const data = await messengerService.getConfig(selectedConnection.id);
      setAiConfig(data);
    } catch (error) {
      console.error('Failed to fetch AI config:', error);
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchWebsiteStatus = async () => {
    if (!selectedConnection) return;
    try {
      const data = await messengerService.getWebsiteStatus(selectedConnection.id);
      setWebsiteStatus(data);
      if (data.website_url) setWebsiteUrlInput(data.website_url);
    } catch (error) {
      // Website status may not exist - that's fine
    }
  };

  // ========== Event Handlers ==========

  const handleToggleTakeover = async (conversationId: number) => {
    if (!selectedConnection) return;
    try {
      const updated = await messengerService.toggleTakeover(selectedConnection.id, conversationId);
      setConversations(prev => prev.map(c => c.id === conversationId ? updated : c));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(updated);
      }
    } catch (error) {
      console.error('Failed to toggle takeover:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConnection || !selectedConversation || !messageInput.trim()) return;
    setSendingMessage(true);
    try {
      await messengerService.sendMessage(selectedConnection.id, selectedConversation.id, messageInput);
      setMessageInput('');
      await fetchConversationMessages(selectedConversation.id);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handlePDFUpload = async (file: File) => {
    if (!selectedConnection) return;
    setIsUploading(true);
    try {
      const uploaded = await messengerService.uploadPDF(selectedConnection.id, file);
      setKnowledgeBase(prev => [uploaded, ...prev]);
    } catch (error) {
      console.error('Failed to upload PDF:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePDF = async (pdfId: number) => {
    if (!selectedConnection) return;
    if (!confirm('Are you sure you want to delete this PDF?')) return;
    try {
      await messengerService.deletePDF(selectedConnection.id, pdfId);
      setKnowledgeBase(prev => prev.filter(p => p.id !== pdfId));
    } catch (error) {
      console.error('Failed to delete PDF:', error);
    }
  };

  const handleCreatePrompt = async () => {
    if (!selectedConnection || !promptForm.name || !promptForm.system_prompt) return;
    try {
      const created = await messengerService.createPrompt(selectedConnection.id, {
        name: promptForm.name,
        system_prompt: promptForm.system_prompt,
        tone: promptForm.tone,
        is_active: false,
      });
      setPrompts(prev => [created, ...prev]);
      setShowPromptModal(false);
      setPromptForm({ name: '', system_prompt: '', tone: 'friendly' });
    } catch (error: any) {
      console.error('Failed to create prompt:', error);
      const errData = error?.response?.data;
      const msg = errData
        ? typeof errData === 'string' ? errData : Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')
        : 'Failed to create prompt. Please try again.';
      alert(msg);
    }
  };

  const handleUpdatePrompt = async () => {
    if (!selectedConnection || !editingPrompt || !promptForm.name || !promptForm.system_prompt) return;
    try {
      const updated = await messengerService.updatePrompt(selectedConnection.id, editingPrompt.id, {
        name: promptForm.name,
        system_prompt: promptForm.system_prompt,
        tone: promptForm.tone,
      });
      setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? updated : p));
      setEditingPrompt(null);
      setShowPromptModal(false);
      setPromptForm({ name: '', system_prompt: '', tone: 'friendly' });
    } catch (error) {
      console.error('Failed to update prompt:', error);
    }
  };

  const handleDeletePrompt = async (promptId: number) => {
    if (!selectedConnection) return;
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    try {
      await messengerService.deletePrompt(selectedConnection.id, promptId);
      setPrompts(prev => prev.filter(p => p.id !== promptId));
    } catch (error) {
      console.error('Failed to delete prompt:', error);
    }
  };

  const handleActivatePrompt = async (promptId: number) => {
    if (!selectedConnection) return;
    try {
      await messengerService.activatePrompt(selectedConnection.id, promptId);
      setPrompts(prev => prev.map(p => ({ ...p, is_active: p.id === promptId })));
    } catch (error) {
      console.error('Failed to activate prompt:', error);
    }
  };

  const handleSaveConfig = async () => {
    console.log('handleSaveConfig called, selectedConnection:', selectedConnection?.id);
    if (!selectedConnection) { console.log('No selected connection for config!'); return; }
    setConfigSaving(true);
    try {
      const updated = await messengerService.updateConfig(selectedConnection.id, aiConfig);
      setAiConfig(updated);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleCrawlWebsite = async () => {
    if (!selectedConnection) return;
    if (!websiteUrlInput.trim()) {
      alert('Please enter a website URL.');
      return;
    }
    if (!confirm('This will crawl your website and extract knowledge for the AI chatbot. Continue?')) return;
    setCrawlingWebsite(true);
    try {
      const result = await messengerService.crawlWebsite(selectedConnection.id, websiteUrlInput);
      if (result.success) {
        alert(result.message || `Website crawled! ${result.pages_crawled} pages, ${result.total_chunks} knowledge chunks.`);
        await fetchWebsiteStatus();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Failed to crawl website:', error);
      const errorMsg = error?.response?.data?.error || 'Failed to crawl website. Please try again.';
      alert(errorMsg);
    } finally {
      setCrawlingWebsite(false);
    }
  };

  // ========== E-Commerce Handlers ==========

  const fetchEcomSettings = async () => {
    if (!selectedConnection) return;
    setEcomLoading(true);
    try {
      const data = await messengerService.getECommerceSettings(selectedConnection.id);
      setEcomSettings(data);
      if (data.product_count > 0) {
        const products = await messengerService.getProducts(selectedConnection.id);
        setEcomProducts(products);
      }
    } catch (error) {
      // E-Commerce settings may not exist yet - that's fine
    } finally {
      setEcomLoading(false);
    }
  };

  const handleSaveEcomSettings = async () => {
    console.log('handleSaveEcomSettings called, selectedConnection:', selectedConnection?.id);
    if (!selectedConnection) { console.log('No selected connection!'); return; }
    setEcomSaving(true);
    try {
      // Only send consumer_key/secret if user actually entered values
      const payload: Partial<ECommerceSettings> = { ...ecomSettings };
      if (!payload.consumer_key) delete payload.consumer_key;
      if (!payload.consumer_secret) delete payload.consumer_secret;
      console.log('Saving ecom payload:', payload);
      const updated = await messengerService.updateECommerceSettings(selectedConnection.id, payload);
      setEcomSettings(updated);
      alert('E-Commerce settings saved successfully!');
    } catch (error: any) {
      console.error('Failed to save e-commerce settings:', error);
      const errData = error?.response?.data;
      const msg = errData
        ? typeof errData === 'string' ? errData : Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')
        : 'Failed to save settings.';
      alert(msg);
    } finally {
      setEcomSaving(false);
    }
  };

  const handleTestEcomConnection = async () => {
    console.log('handleTestEcomConnection called, selectedConnection:', selectedConnection?.id);
    if (!selectedConnection) { console.log('No selected connection!'); return; }
    setTestingConnection(true);
    try {
      const result = await messengerService.testECommerceConnection(selectedConnection.id);
      alert(result.message || (result.success ? 'Connection successful!' : 'Connection failed.'));
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.response?.data?.error || 'Connection test failed.';
      alert(msg);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncProducts = async () => {
    if (!selectedConnection) return;
    setSyncingProducts(true);
    try {
      const result = await messengerService.syncProducts(selectedConnection.id);
      if (result.success) {
        alert(`Synced ${result.synced} products! (${result.created} new, ${result.updated} updated)`);
        const products = await messengerService.getProducts(selectedConnection.id);
        setEcomProducts(products);
        await fetchEcomSettings();
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Product sync failed.';
      alert(msg);
    } finally {
      setSyncingProducts(false);
    }
  };

  const handleRegenerateEmbeddings = async () => {
    if (!selectedConnection) return;
    setGeneratingEmbeddings(true);
    try {
      const result = await messengerService.regenerateProductEmbeddings(selectedConnection.id);
      if (result.success) {
        alert(`Generated embeddings for ${result.total} products!`);
      } else {
        alert(`Failed: ${result.error}`);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Embedding generation failed.';
      alert(msg);
    } finally {
      setGeneratingEmbeddings(false);
    }
  };

  // ========== UseEffects ==========

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch tab-specific data when tab changes or connection is available
  useEffect(() => {
    if (!selectedConnection) return;
    switch (activeTab) {
      case 'conversations': fetchConversations(); break;
      case 'knowledge': fetchKnowledgeBase(); fetchWebsiteStatus(); break;
      case 'prompts': fetchPrompts(); break;
      case 'settings': fetchAiConfig(); fetchEcomSettings(); break;
    }
  }, [activeTab, selectedConnection?.id]);

  // Auto-refresh conversations every 10s
  useEffect(() => {
    if (activeTab !== 'conversations' || !selectedConnection) return;
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [activeTab, selectedConnection?.id]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  // ========== Helpers ==========

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <ChartBarIcon className="w-5 h-5" /> },
    { id: 'connections', label: 'Connections', icon: <LinkIcon className="w-5 h-5" /> },
    { id: 'conversations', label: 'Conversations', icon: <ChatBubbleLeftRightIcon className="w-5 h-5" /> },
    { id: 'knowledge', label: 'Knowledge Base', icon: <DocumentTextIcon className="w-5 h-5" /> },
    { id: 'prompts', label: 'AI Prompts', icon: <BoltIcon className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Cog6ToothIcon className="w-5 h-5" /> },
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: GenerationStatus) => {
    const styles = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      completed: 'bg-green-500/10 text-green-400 border-green-500/20',
      failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return styles[status] || styles.pending;
  };

  // ========== Render Functions ==========

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Active Connections', value: stats?.active_connections || '0', icon: <LinkIcon className="w-6 h-6" />, color: 'from-blue-500 to-cyan-500' },
          { label: 'Total Conversations', value: stats?.total_conversations || '0', icon: <ChatBubbleLeftRightIcon className="w-6 h-6" />, color: 'from-purple-500 to-pink-500' },
          { label: 'Messages Sent', value: stats?.total_messages || '0', icon: <DocumentTextIcon className="w-6 h-6" />, color: 'from-green-500 to-emerald-500' },
          { label: 'Tokens Used', value: stats?.total_tokens?.toLocaleString() || '0', icon: <CpuChipIcon className="w-6 h-6" />, color: 'from-amber-500 to-yellow-500' },
          { label: 'Unread Notifications', value: stats?.unread_notifications || '0', icon: <BellIcon className="w-6 h-6" />, color: 'from-orange-500 to-red-500' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                {stat.icon}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Notifications */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Notifications</h3>
          <button className="text-primary text-sm hover:underline">View All</button>
        </div>
        <div className="space-y-3">
          {notifications.length > 0 ? (
            notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-xl border transition-colors ${notification.is_read
                  ? 'bg-dark-700/30 border-white/5'
                  : 'bg-dark-700/50 border-primary/20'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${notification.priority === 'high' ? 'bg-red-500/10' :
                    notification.priority === 'medium' ? 'bg-yellow-500/10' : 'bg-blue-500/10'
                    }`}>
                    <BellIcon className={`w-5 h-5 ${notification.priority === 'high' ? 'text-red-400' :
                      notification.priority === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                      }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{notification.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${notification.priority === 'high' ? 'bg-red-500/10 text-red-400' :
                        notification.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                        {notification.priority}
                      </span>
                      {notification.notification_type && (
                        <span className={`px-2 py-0.5 rounded-full text-xs bg-dark-700/50 ${
                          notificationTypes.find(t => t.value === notification.notification_type)?.color || 'text-gray-400'
                        }`}>
                          {notificationTypes.find(t => t.value === notification.notification_type)?.label || notification.notification_type}
                        </span>
                      )}
                    </div>
                    <p className="text-text-secondary text-sm mt-1">{notification.summary}</p>
                    <p className="text-text-muted text-xs mt-2">{formatDate(notification.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-icon-sm"
                      onClick={async () => {
                        try {
                          await messengerService.markNotificationRead(notification.id);
                          setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
                        } catch (e) { console.error(e); }
                      }}
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-dark-700/20 rounded-xl border border-dashed border-white/10">
              <BellIcon className="w-8 h-8 mx-auto text-text-muted mb-2" />
              <p className="text-text-secondary text-sm">No recent notifications</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Conversations - real data from stats */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Active Conversations</h3>
          <button
            onClick={() => setActiveTab('conversations')}
            className="text-primary text-sm hover:underline"
          >
            View All
          </button>
        </div>
        <div className="space-y-3">
          {stats?.recent_conversations && stats.recent_conversations.length > 0 ? (
            stats.recent_conversations.slice(0, 5).map((conv: Conversation) => (
              <div
                key={conv.id}
                className="p-4 rounded-xl bg-dark-700/30 border border-white/5 hover:border-primary/20 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedConversation(conv);
                  setActiveTab('conversations');
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <UserCircleIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{conv.sender_name || 'Unknown User'}</h4>
                      <span className="text-text-muted text-xs">{formatDate(conv.last_message_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-text-secondary text-sm">{conv.message_count} messages</span>
                      {conv.human_takeover && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400">
                          Human Takeover
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-dark-700/20 rounded-xl border border-dashed border-white/10">
              <ChatBubbleLeftRightIcon className="w-8 h-8 mx-auto text-text-muted mb-2" />
              <p className="text-text-secondary text-sm">No recent conversations</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDashboardContent = () => {
    if (connections.length === 0 && (!stats || stats.total_conversations === 0)) {
      return (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <ChatBubbleLeftRightIcon className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Bot Activity Yet</h3>
          <p className="text-text-secondary max-w-sm mx-auto mb-8">
            Connect a Facebook Page and start receiving messages to see your bot performance and conversations here.
          </p>
          <button onClick={() => setActiveTab('connections')} className="btn-primary">
            Connect a Page
          </button>
        </div>
      );
    }
    return renderDashboard();
  };

  const renderConnections = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Facebook Page Connections</h3>
        <button
          onClick={async () => {
            if (connections.length > 0) {
              const conn = connections[0];
              setConnectForm(prev => ({
                ...prev,
                page_name: conn.page_name || '',
                page_id: conn.page_id || '',
                page_access_token: '',
                greeting_text: conn.greeting_text || 'Hi! Thanks for reaching out. How can I help you today?',
                website_url: conn.website_url || '',
              }));
              try {
                const [configData, promptsData] = await Promise.all([
                  messengerService.getConfig(conn.id),
                  messengerService.getPrompts(conn.id),
                ]);
                if (configData) {
                  setConnectForm(prev => ({
                    ...prev,
                    openai_api_key: '',
                    openai_model: configData.openai_model || 'gpt-4o',
                    embedding_model: configData.embedding_model || 'text-embedding-3-small',
                    top_k_results: configData.top_k_results || 5,
                    similarity_threshold: configData.similarity_threshold || 0.7,
                    temperature: configData.temperature || 0.7,
                    max_tokens: configData.max_tokens || 1024,
                    rag_enabled: configData.rag_enabled ?? true,
                    image_understanding_enabled: configData.image_understanding_enabled ?? true,
                  }));
                }
                const activePrompt = promptsData.find((p: CustomPrompt) => p.is_active);
                if (activePrompt) {
                  setConnectForm(prev => ({
                    ...prev,
                    prompt_name: activePrompt.name || 'Customer Support',
                    prompt_tone: activePrompt.tone || 'friendly',
                    system_prompt: activePrompt.system_prompt || 'You are a helpful customer support assistant.',
                    is_active: activePrompt.is_active ?? true,
                  }));
                }
              } catch (error) {
                console.error('Error fetching existing config:', error);
              }
            }
            setShowConnectModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          {connections.length > 0 ? 'Edit Connection' : 'Connect Page'}
        </button>
      </div>

      <div className="grid gap-4">
        {connections.length > 0 ? connections.map((connection) => (
          <motion.div
            key={connection.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold">{connection.page_name}</h4>
                  <p className="text-text-secondary text-sm">Page ID: {connection.page_id}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`px-2 py-1 rounded-lg text-xs ${connection.is_active
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                      {connection.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-xs ${connection.is_webhook_verified
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      }`}>
                      {connection.is_webhook_verified ? 'Webhook Verified' : 'Webhook Pending'}
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-xs ${connection.auto_reply_enabled
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                      {connection.auto_reply_enabled ? 'Auto-Reply On' : 'Auto-Reply Off'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-icon" title="Sync" onClick={() => fetchData()}>
                  <ArrowPathIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Webhook Configuration */}
            <div className="mt-6 p-5 rounded-xl bg-dark-700/40 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    connection.is_webhook_verified
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {connection.is_webhook_verified ? (
                      <CheckCircleIcon className="w-6 h-6" />
                    ) : (
                      <QuestionMarkCircleIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-semibold text-base">Webhook Configuration</h5>
                    <p className={`text-xs ${connection.is_webhook_verified ? 'text-green-400' : 'text-yellow-400'}`}>
                      {connection.is_webhook_verified ? 'Webhook verified and active' : 'Webhook pending verification'}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-text-muted text-xs mb-4">
                Use these values in your Facebook App &rarr; Messenger &rarr; Webhook settings
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
                  <label className="text-text-secondary text-xs font-medium uppercase tracking-wider">Callback URL</label>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-sm text-primary flex-1 truncate">{connection.webhook_url}</code>
                    <button
                      className="btn-icon-sm flex-shrink-0"
                      title="Copy Webhook URL"
                      onClick={() => {
                        navigator.clipboard.writeText(connection.webhook_url || '');
                      }}
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
                  <label className="text-text-secondary text-xs font-medium uppercase tracking-wider">Verify Token</label>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-sm text-primary flex-1">{connection.verify_token}</code>
                    <button
                      className="btn-icon-sm flex-shrink-0"
                      title="Copy Verify Token"
                      onClick={() => {
                        navigator.clipboard.writeText(connection.verify_token || '');
                      }}
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-dark-700/30 border border-white/5">
              <label className="text-text-secondary text-sm">Greeting Message</label>
              <p className="mt-1 text-text-primary">{connection.greeting_text}</p>
            </div>

            {connection.website_url && (
              <div className="mt-4 p-4 rounded-xl bg-dark-700/30 border border-white/5">
                <label className="text-text-secondary text-sm">Website URL</label>
                <p className="mt-1 text-primary">{connection.website_url}</p>
              </div>
            )}

            <div className="mt-4 flex items-center gap-6 text-text-muted text-sm">
              <span>Connected: {formatDate(connection.connected_at)}</span>
              <span>Last Synced: {formatDate(connection.last_synced)}</span>
            </div>
          </motion.div>
        )) : (
          <div className="p-12 text-center bg-dark-700/20 rounded-xl border border-dashed border-white/10">
            <LinkIcon className="w-12 h-12 mx-auto text-text-muted mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Connections Yet</h3>
            <p className="text-text-secondary text-sm mb-6">Connect a Facebook Page to start using the Messenger Bot.</p>
            <button onClick={() => setShowConnectModal(true)} className="btn-primary">
              Connect Your First Page
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderConversations = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={fetchConversations}>
          <ArrowPathIcon className="w-5 h-5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation List */}
        <div className="lg:col-span-1 space-y-3">
          {conversationsLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center bg-dark-700/20 rounded-xl border border-dashed border-white/10">
              <ChatBubbleLeftRightIcon className="w-10 h-10 mx-auto text-text-muted mb-3" />
              <p className="text-text-secondary text-sm">No conversations yet</p>
              <p className="text-text-muted text-xs mt-1">Conversations appear when users message your page</p>
            </div>
          ) : (
            conversations
              .filter(c =>
                !searchQuery ||
                c.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.sender_id.includes(searchQuery)
              )
              .map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedConversation?.id === conv.id
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-dark-700/30 border-white/5 hover:border-primary/20'
                    }`}
                  onClick={() => fetchConversationMessages(conv.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        {conv.sender_profile_pic ? (
                          <img src={conv.sender_profile_pic} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <UserCircleIcon className="w-7 h-7 text-white" />
                        )}
                      </div>
                      {conv.is_active && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-dark-800" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium truncate">{conv.sender_name || 'Unknown User'}</h4>
                        <span className="text-text-muted text-xs">{formatDate(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-text-secondary text-sm">{conv.message_count} messages</span>
                        {conv.human_takeover && (
                          <HandRaisedIcon className="w-4 h-4 text-orange-400" title="Human Takeover" />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
          )}
        </div>

        {/* Conversation Detail */}
        <div className="lg:col-span-2 card flex flex-col" style={{ minHeight: '500px' }}>
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <UserCircleIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{selectedConversation.sender_name || 'Unknown User'}</h4>
                    <p className="text-text-secondary text-sm">ID: {selectedConversation.sender_id}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleTakeover(selectedConversation.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selectedConversation.human_takeover
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                    : 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20'
                    }`}
                >
                  {selectedConversation.human_takeover ? 'Resume Bot' : 'Take Over'}
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                  selectedConversation.messages.map((message) => {
                    const isHuman = message.model_used === 'human';
                    const isBot = message.sender === 'bot';
                    return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isBot ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.sender === 'user' ? 'bg-blue-500/20' : isHuman ? 'bg-orange-500/20' : 'bg-primary/20'
                      }`}>
                        {message.sender === 'user' ? (
                          <UserCircleIcon className="w-5 h-5 text-blue-400" />
                        ) : isHuman ? (
                          <HandRaisedIcon className="w-5 h-5 text-orange-400" />
                        ) : (
                          <CpuChipIcon className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className={`max-w-[70%] ${isBot ? 'text-right' : ''}`}>
                        {/* Human takeover label */}
                        {isHuman && (
                          <span className="inline-block px-2 py-0.5 mb-1 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            Human Reply
                          </span>
                        )}
                        <div className={`inline-block p-3 rounded-2xl ${
                          message.sender === 'user'
                            ? 'bg-dark-600 text-text-secondary rounded-tl-sm'
                            : isHuman
                            ? 'bg-orange-500/10 text-text-primary rounded-tr-sm border border-orange-500/20'
                            : 'bg-primary/20 text-text-primary rounded-tr-sm'
                        }`}>
                          {/* Text content - strip [Human] prefix for display */}
                          {message.text && (
                            <p className="text-sm whitespace-pre-wrap">
                              {isHuman && message.text.startsWith('[Human] ')
                                ? message.text.slice(8)
                                : message.text}
                            </p>
                          )}
                          {/* Image */}
                          {message.image_url && (
                            <img src={message.image_url} alt="Shared image" className="mt-2 rounded-lg max-w-full max-h-48 object-cover" />
                          )}
                          {/* Image AI description */}
                          {message.image_description && (
                            <div className="mt-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                              <p className="text-xs text-purple-400 font-medium mb-1 flex items-center gap-1">
                                <PhotoIcon className="w-3 h-3" /> AI Vision Analysis
                              </p>
                              <p className="text-xs text-text-secondary italic">{message.image_description}</p>
                            </div>
                          )}
                          {/* Voice/Audio message */}
                          {(message.message_type === 'voice' || message.message_type === 'audio') && !message.text && (
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                              <SpeakerWaveIcon className="w-4 h-4 text-purple-400" />
                              <span>Voice message</span>
                            </div>
                          )}
                          {(message.message_type === 'voice' || message.message_type === 'audio') && message.text && !message.image_url && (
                            <div className="flex items-center gap-1 mt-1">
                              <SpeakerWaveIcon className="w-3 h-3 text-purple-400" />
                              <span className="text-xs text-purple-400">Transcribed from voice</span>
                            </div>
                          )}
                          {/* File attachment */}
                          {message.file_url && (
                            <a
                              href={message.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-dark-700/50 border border-white/10 hover:border-primary/30 transition-colors"
                            >
                              <DocumentIcon className="w-5 h-5 text-blue-400" />
                              <span className="text-sm text-primary hover:underline truncate">Attached File</span>
                            </a>
                          )}
                          {/* Video message */}
                          {message.message_type === 'video' && !message.text && (
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                              <PlayIcon className="w-4 h-4 text-blue-400" />
                              <span>Video message</span>
                            </div>
                          )}
                          {/* Sticker */}
                          {message.message_type === 'sticker' && !message.text && (
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                              <span className="text-2xl">🎭</span>
                              <span>Sticker</span>
                            </div>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 mt-1 text-xs text-text-muted ${isBot ? 'justify-end' : ''}`}>
                          <span>{formatDate(message.timestamp)}</span>
                          {message.model_used && message.model_used !== 'human' && (
                            <span className="text-text-muted">{message.model_used}</span>
                          )}
                          {message.tokens_used > 0 && <span>{message.tokens_used} tokens</span>}
                          {message.rag_context_used && (
                            <span className="text-primary" title="Used knowledge base">RAG</span>
                          )}
                          {message.processing_time > 0 && (
                            <span>{message.processing_time.toFixed(1)}s</span>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center text-text-secondary">
                    <div className="text-center">
                      <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No messages in this conversation yet</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder={selectedConversation.human_takeover ? "Type a message..." : "Take over to send messages"}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    className="input flex-1"
                    disabled={!selectedConversation.human_takeover || sendingMessage}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="btn-primary"
                    disabled={!selectedConversation.human_takeover || !messageInput.trim() || sendingMessage}
                  >
                    {sendingMessage ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <PaperAirplaneIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {!selectedConversation.human_takeover && (
                  <p className="text-text-muted text-xs mt-2">
                    Take over the conversation to send manual messages
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-text-secondary p-6">
              <div className="text-center">
                <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderKnowledgeBase = () => (
    <div className="space-y-6">
      {/* Website Knowledge Base */}
      <div className="card p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-primary" />
            Website Knowledge Base
          </h3>
          <p className="text-text-secondary text-sm mt-1">
            Enter your website URL to extract knowledge for the AI chatbot
          </p>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="url"
            placeholder="https://yourwebsite.com"
            value={websiteUrlInput}
            onChange={(e) => setWebsiteUrlInput(e.target.value)}
            className="input flex-1"
          />
          <button
            onClick={handleCrawlWebsite}
            disabled={crawlingWebsite || !selectedConnection || !websiteUrlInput.trim()}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            {crawlingWebsite ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Crawling...
              </>
            ) : (
              <>
                <BoltIcon className="w-5 h-5" />
                {websiteStatus?.has_data ? 'Re-crawl Website' : 'Crawl Website'}
              </>
            )}
          </button>
        </div>

        {websiteStatus?.has_data ? (
          <div className="bg-dark-700/30 rounded-xl p-4 border border-white/5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{websiteStatus.pages_crawled || 0}</p>
                <p className="text-sm text-text-muted">Pages Crawled</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{websiteStatus.chunk_count || 0}</p>
                <p className="text-sm text-text-muted">Knowledge Chunks</p>
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  {websiteStatus.generated_at ? new Date(websiteStatus.generated_at).toLocaleDateString() : 'N/A'}
                </p>
                <p className="text-sm text-text-muted">Last Crawled</p>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-4 text-center">
              Website knowledge is automatically used by the AI alongside PDFs to answer questions
            </p>
          </div>
        ) : (
          <div className="bg-dark-700/20 border border-dashed border-white/10 rounded-xl p-4 text-center">
            <p className="text-sm text-text-muted">
              Enter your website URL and click "Crawl Website" to extract knowledge for the AI
            </p>
          </div>
        )}
      </div>

      {/* PDF Knowledge Base Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PDF Knowledge Base</h3>
          <p className="text-text-secondary text-sm mt-1">
            Upload PDF documents to enhance AI responses with RAG
          </p>
        </div>
        <button
          onClick={() => document.getElementById('pdf-upload')?.click()}
          disabled={isUploading || !selectedConnection}
          className="btn-primary flex items-center gap-2"
        >
          {isUploading ? (
            <>
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <ArrowUpTrayIcon className="w-5 h-5" />
              Upload PDF
            </>
          )}
        </button>
        <input
          id="pdf-upload"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePDFUpload(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Upload Area */}
      <div
        className="card p-8 border-2 border-dashed border-white/10 hover:border-primary/30 transition-colors cursor-pointer"
        onClick={() => document.getElementById('pdf-upload')?.click()}
      >
        <div className="text-center">
          <CloudArrowUpIcon className="w-12 h-12 mx-auto text-text-muted mb-4" />
          <p className="text-text-primary mb-2">Drag and drop PDF files here</p>
          <p className="text-text-secondary text-sm">or click to browse</p>
          <p className="text-text-muted text-xs mt-4">Supported format: PDF (max 50MB per file)</p>
        </div>
      </div>

      {/* Uploaded Files */}
      <div className="grid gap-4">
        {knowledgeBaseLoading ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : knowledgeBase.length === 0 ? (
          <div className="p-8 text-center bg-dark-700/20 rounded-xl border border-dashed border-white/10">
            <DocumentIcon className="w-10 h-10 mx-auto text-text-muted mb-3" />
            <p className="text-text-secondary text-sm">No PDFs uploaded yet</p>
          </div>
        ) : (
          knowledgeBase.map((pdf) => (
            <motion.div
              key={pdf.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-5"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <DocumentIcon className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">{pdf.filename}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusBadge(pdf.status)}`}>
                      {pdf.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-text-secondary text-sm">
                    <span>{formatFileSize(pdf.file_size)}</span>
                    <span>{pdf.total_pages} pages</span>
                    {pdf.status === 'completed' && (
                      <span className="text-green-400">{pdf.total_chunks} chunks vectorized</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pdf.status === 'processing' && (
                    <div className="flex items-center gap-2 text-blue-400">
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Processing...</span>
                    </div>
                  )}
                  <button
                    className="btn-icon text-red-400"
                    title="Delete"
                    onClick={() => handleDeletePDF(pdf.id)}
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {pdf.vectorized_at && (
                <p className="text-text-muted text-xs mt-3">
                  Vectorized: {formatDate(pdf.vectorized_at)}
                </p>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );

  const renderPrompts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom AI Prompts</h3>
          <p className="text-text-secondary text-sm mt-1">
            Create custom system prompts to personalize your chatbot's behavior
          </p>
        </div>
        <button
          onClick={() => {
            setEditingPrompt(null);
            setPromptForm({ name: '', system_prompt: '', tone: 'friendly' });
            setShowPromptModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Prompt
        </button>
      </div>

      <div className="grid gap-4">
        {promptsLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : prompts.length === 0 ? (
          <div className="p-12 text-center bg-dark-700/20 rounded-xl border border-dashed border-white/10">
            <BoltIcon className="w-12 h-12 mx-auto text-text-muted mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Prompts Yet</h3>
            <p className="text-text-secondary text-sm">Create custom prompts to define your AI assistant's personality</p>
          </div>
        ) : (
          prompts.map((prompt) => (
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`card p-5 ${prompt.is_active ? 'border-primary/30' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${prompt.is_active ? 'bg-primary/10' : 'bg-dark-700'
                    }`}>
                    <BoltIcon className={`w-6 h-6 ${prompt.is_active ? 'text-primary' : 'text-text-muted'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">{prompt.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${prompt.is_active
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                        {prompt.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {promptTones.find(t => t.value === prompt.tone)?.label}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm mt-2 line-clamp-2">
                      {prompt.system_prompt}
                    </p>
                    <p className="text-text-muted text-xs mt-2">
                      Last updated: {formatDate(prompt.updated_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!prompt.is_active && (
                    <button
                      className="btn-icon text-green-400"
                      title="Activate"
                      onClick={() => handleActivatePrompt(prompt.id)}
                    >
                      <PlayIcon className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    className="btn-icon"
                    title="Edit"
                    onClick={() => {
                      setEditingPrompt(prompt);
                      setPromptForm({
                        name: prompt.name,
                        system_prompt: prompt.system_prompt,
                        tone: prompt.tone,
                      });
                      setShowPromptModal(true);
                    }}
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    className="btn-icon text-red-400"
                    title="Delete"
                    onClick={() => handleDeletePrompt(prompt.id)}
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Prompt Tips */}
      <div className="card p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <CpuChipIcon className="w-5 h-5 text-primary" />
          Prompt Engineering Tips
        </h4>
        <ul className="space-y-2 text-text-secondary text-sm">
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            Be specific about your bot's role and expertise
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            Define clear boundaries for what the bot should and shouldn't do
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            Include examples of ideal responses in your prompt
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            Specify how to handle sensitive or off-topic questions
          </li>
        </ul>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      {configLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* OpenAI Configuration */}
          <div className="card p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CpuChipIcon className="w-5 h-5 text-primary" />
              AI Model Configuration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-text-secondary text-sm">OpenAI API Key</label>
                <input
                  type="password"
                  value={aiConfig.openai_api_key || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, openai_api_key: e.target.value })}
                  placeholder="sk-..."
                  className="input mt-2"
                />
              </div>
              <div>
                <label className="text-text-secondary text-sm">Model</label>
                <select
                  value={aiConfig.openai_model}
                  onChange={(e) => setAiConfig({ ...aiConfig, openai_model: e.target.value as AIConfiguration['openai_model'] })}
                  className="input mt-2"
                >
                  {openaiModels.map((model) => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-text-secondary text-sm">Temperature</label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={aiConfig.temperature}
                  onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-text-muted text-xs mt-1">
                  <span>Precise (0)</span>
                  <span className="text-primary">{aiConfig.temperature}</span>
                  <span>Creative (2)</span>
                </div>
              </div>
              <div>
                <label className="text-text-secondary text-sm">Max Tokens</label>
                <input
                  type="number"
                  value={aiConfig.max_tokens}
                  onChange={(e) => setAiConfig({ ...aiConfig, max_tokens: parseInt(e.target.value) })}
                  className="input mt-2"
                  min={100}
                  max={8000}
                />
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="card p-6">
            <h4 className="text-lg font-semibold mb-4">Feature Settings</h4>
            <div className="space-y-4">
              {[
                { key: 'rag_enabled', label: 'RAG (Knowledge Base)', description: 'Use uploaded PDFs to enhance AI responses', icon: <DocumentTextIcon className="w-5 h-5" /> },
                { key: 'image_understanding_enabled', label: 'Image Understanding', description: 'Analyze images sent by users using AI vision', icon: <PhotoIcon className="w-5 h-5" /> },
                { key: 'voice_transcription_enabled', label: 'Voice Transcription', description: 'Convert voice messages to text using Whisper', icon: <SpeakerWaveIcon className="w-5 h-5" /> },
                { key: 'voice_reply_enabled', label: 'Voice Replies', description: 'Send AI responses as voice messages', icon: <SpeakerWaveIcon className="w-5 h-5" /> },
              ].map((feature) => (
                <div
                  key={feature.key}
                  className="flex items-center justify-between p-4 rounded-xl bg-dark-700/30 border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      {feature.icon}
                    </div>
                    <div>
                      <h5 className="font-medium">{feature.label}</h5>
                      <p className="text-text-secondary text-sm">{feature.description}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiConfig[feature.key as keyof typeof aiConfig] as boolean}
                      onChange={(e) => setAiConfig({ ...aiConfig, [feature.key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Voice Settings */}
          {aiConfig.voice_reply_enabled && (
            <div className="card p-6">
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <SpeakerWaveIcon className="w-5 h-5 text-primary" />
                Voice Settings
              </h4>
              <div>
                <label className="text-text-secondary text-sm">Voice Model</label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                  {voiceModels.map((voice) => (
                    <button
                      key={voice.value}
                      onClick={() => setAiConfig({ ...aiConfig, voice_model: voice.value })}
                      className={`p-4 rounded-xl border transition-all text-center ${aiConfig.voice_model === voice.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-white/10 hover:border-white/20'
                        }`}
                    >
                      <SpeakerWaveIcon className="w-6 h-6 mx-auto mb-2" />
                      <span className="text-sm font-medium">{voice.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* E-Commerce Integration */}
          <div className="card p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              E-Commerce Integration
            </h4>

            {ecomLoading ? (
              <div className="flex justify-center py-8"><Spinner size="lg" /></div>
            ) : (
              <div className="space-y-6">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-dark-700/30 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-medium">Enable E-Commerce</h5>
                      <p className="text-text-secondary text-sm">Connect your WooCommerce store for product catalog &amp; AI matching</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ecomSettings.is_enabled || false}
                      onChange={(e) => setEcomSettings({ ...ecomSettings, is_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>

                {/* E-Commerce Settings Form */}
                {ecomSettings.is_enabled && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-text-secondary text-sm">Platform</label>
                        <select
                          value={ecomSettings.platform_type || 'woocommerce'}
                          onChange={(e) => setEcomSettings({ ...ecomSettings, platform_type: e.target.value as 'woocommerce' | 'shopify' | 'custom' })}
                          className="input mt-2"
                        >
                          <option value="woocommerce">WooCommerce</option>
                          <option value="shopify">Shopify</option>
                          <option value="custom">Custom API</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm">Store URL</label>
                        <input
                          type="url"
                          value={ecomSettings.store_url || ''}
                          onChange={(e) => setEcomSettings({ ...ecomSettings, store_url: e.target.value })}
                          placeholder="https://yourstore.com"
                          className="input mt-2"
                        />
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm">Consumer Key</label>
                        <input
                          type="password"
                          value={ecomSettings.consumer_key || ''}
                          onChange={(e) => setEcomSettings({ ...ecomSettings, consumer_key: e.target.value })}
                          placeholder="ck_..."
                          className="input mt-2"
                        />
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm">Consumer Secret</label>
                        <input
                          type="password"
                          value={ecomSettings.consumer_secret || ''}
                          onChange={(e) => setEcomSettings({ ...ecomSettings, consumer_secret: e.target.value })}
                          placeholder="cs_..."
                          className="input mt-2"
                        />
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm">Product Match Threshold</label>
                        <input
                          type="number"
                          value={ecomSettings.product_match_threshold ?? 0.35}
                          onChange={(e) => setEcomSettings({ ...ecomSettings, product_match_threshold: parseFloat(e.target.value) })}
                          className="input mt-2"
                          min={0}
                          max={1}
                          step={0.05}
                        />
                        <p className="text-text-muted text-xs mt-1">Lower = more matches (recommended: 0.35)</p>
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm">Currency Symbol</label>
                        <input
                          type="text"
                          value={ecomSettings.currency_symbol || '$'}
                          onChange={(e) => setEcomSettings({ ...ecomSettings, currency_symbol: e.target.value })}
                          className="input mt-2"
                          maxLength={10}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => { console.log('Test btn clicked'); handleTestEcomConnection(); }}
                        disabled={testingConnection}
                        className="px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {testingConnection ? (
                          <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Testing...</>
                        ) : (
                          <><LinkIcon className="w-4 h-4" /> Test Connection</>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => { console.log('Save ecom btn clicked'); handleSaveEcomSettings(); }}
                        disabled={ecomSaving}
                        className="btn-primary px-6"
                      >
                        {ecomSaving ? (
                          <><ArrowPathIcon className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                        ) : (
                          'Save E-Commerce Settings'
                        )}
                      </button>
                    </div>

                    {/* Product Catalog Section */}
                    <div className="border-t border-white/5 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h5 className="font-semibold text-lg">Product Catalog</h5>
                          <p className="text-text-secondary text-sm">
                            {ecomProducts.length > 0
                              ? `${ecomProducts.length} products synced`
                              : 'No products synced yet'}
                            {ecomSettings.last_synced && (
                              <span className="ml-2 text-text-muted">
                                (Last sync: {formatDate(ecomSettings.last_synced)})
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSyncProducts}
                            disabled={syncingProducts}
                            className="px-4 py-2 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
                          >
                            {syncingProducts ? (
                              <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Syncing...</>
                            ) : (
                              <><ArrowPathIcon className="w-4 h-4" /> Sync from API</>
                            )}
                          </button>
                          <button
                            onClick={handleRegenerateEmbeddings}
                            disabled={generatingEmbeddings || ecomProducts.length === 0}
                            className="px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
                          >
                            {generatingEmbeddings ? (
                              <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Generating...</>
                            ) : (
                              <><CpuChipIcon className="w-4 h-4" /> Regenerate Embeddings</>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Product Grid */}
                      {ecomProducts.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-1">
                          {ecomProducts.map((product) => (
                            <div
                              key={product.id}
                              className="rounded-xl border border-white/5 bg-dark-700/30 overflow-hidden hover:border-white/10 transition-all"
                            >
                              {/* Product Image */}
                              <div className="aspect-square bg-dark-800 flex items-center justify-center overflow-hidden">
                                {product.first_image ? (
                                  <img
                                    src={product.first_image}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <PhotoIcon className="w-12 h-12 text-text-muted" />
                                )}
                              </div>
                              {/* Product Info */}
                              <div className="p-3">
                                <h6 className="font-medium text-sm truncate" title={product.name}>{product.name}</h6>
                                <p className="text-text-muted text-xs mt-1">ID: {product.woo_product_id}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-primary font-semibold text-sm">
                                    {ecomSettings.currency_symbol || '$'}{product.price}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-lg text-xs ${
                                    product.stock_status === 'instock'
                                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                      : product.stock_status === 'onbackorder'
                                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  }`}>
                                    {product.stock_status === 'instock' ? 'In Stock' : product.stock_status === 'onbackorder' ? 'Backorder' : 'Out of Stock'}
                                  </span>
                                </div>
                                {product.sku && (
                                  <p className="text-text-muted text-xs mt-1">SKU: {product.sku}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {ecomProducts.length === 0 && (
                        <div className="text-center py-8 text-text-muted">
                          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                          </svg>
                          <p className="text-sm">No products yet. Click "Sync from API" to import your product catalog.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RAG Settings */}
          <div className="card p-6">
            <h4 className="text-lg font-semibold mb-4">RAG Configuration</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-text-secondary text-sm">Top K Results</label>
                <input
                  type="number"
                  value={aiConfig.top_k_results}
                  onChange={(e) => setAiConfig({ ...aiConfig, top_k_results: parseInt(e.target.value) })}
                  className="input mt-2"
                  min={1}
                  max={20}
                />
                <p className="text-text-muted text-xs mt-1">Number of relevant chunks to retrieve</p>
              </div>
              <div>
                <label className="text-text-secondary text-sm">Similarity Threshold</label>
                <input
                  type="number"
                  value={aiConfig.similarity_threshold}
                  onChange={(e) => setAiConfig({ ...aiConfig, similarity_threshold: parseFloat(e.target.value) })}
                  className="input mt-2"
                  min={0}
                  max={1}
                  step={0.1}
                />
                <p className="text-text-muted text-xs mt-1">Minimum similarity score (0-1)</p>
              </div>
              <div>
                <label className="text-text-secondary text-sm">Embedding Model</label>
                <select
                  value={aiConfig.embedding_model}
                  onChange={(e) => setAiConfig({ ...aiConfig, embedding_model: e.target.value })}
                  className="input mt-2"
                >
                  <option value="text-embedding-3-small">text-embedding-3-small</option>
                  <option value="text-embedding-3-large">text-embedding-3-large</option>
                  <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                </select>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { console.log('Save Settings btn clicked'); handleSaveConfig(); }}
              disabled={configSaving}
              className="btn-primary px-8"
            >
              {configSaving ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ========== Main Render ==========

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messenger Bot</h1>
          <p className="text-text-secondary mt-1">
            Manage Facebook Messenger automation with AI-powered responses
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all ${activeTab === tab.id
              ? 'bg-primary text-white'
              : 'bg-dark-700 text-text-secondary hover:text-text-primary hover:bg-dark-600'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'dashboard' && renderDashboardContent()}
        {activeTab === 'connections' && renderConnections()}
        {activeTab === 'conversations' && renderConversations()}
        {activeTab === 'knowledge' && renderKnowledgeBase()}
        {activeTab === 'prompts' && renderPrompts()}
        {activeTab === 'settings' && renderSettings()}
      </motion.div>

      {/* Prompt Create/Edit Modal */}
      <AnimatePresence>
        {showPromptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => { setShowPromptModal(false); setEditingPrompt(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 rounded-2xl border border-white/10 w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="text-lg font-bold">{editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-text-secondary text-sm mb-2 block">Prompt Name</label>
                  <input
                    type="text"
                    value={promptForm.name}
                    onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })}
                    placeholder="Customer Support"
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-sm mb-2 block">Tone</label>
                  <select
                    value={promptForm.tone}
                    onChange={(e) => setPromptForm({ ...promptForm, tone: e.target.value as PromptTone })}
                    className="input"
                  >
                    {promptTones.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-text-secondary text-sm mb-2 block">System Prompt</label>
                  <textarea
                    value={promptForm.system_prompt}
                    onChange={(e) => setPromptForm({ ...promptForm, system_prompt: e.target.value })}
                    placeholder="You are a helpful assistant..."
                    rows={6}
                    className="input resize-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => { setShowPromptModal(false); setEditingPrompt(null); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={editingPrompt ? handleUpdatePrompt : handleCreatePrompt}
                  disabled={!promptForm.name || !promptForm.system_prompt}
                  className="btn-primary"
                >
                  {editingPrompt ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connect Modal - 4 Step Wizard */}
      <AnimatePresence>
        {showConnectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowConnectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="relative px-6 py-4 border-b border-white/10 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Connect Messenger Bot</h2>
                      <p className="text-sm text-text-secondary">Step {connectStep} of 4</p>
                    </div>
                  </div>
                  <button onClick={() => setShowConnectModal(false)} className="btn-icon">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Step Indicators */}
                <div className="flex items-center justify-center gap-2 mt-4">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        connectStep === step
                          ? 'bg-primary text-white'
                          : connectStep > step
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-dark-700 text-text-muted'
                      }`}
                    >
                      {connectStep > step ? (
                        <CheckCircleIcon className="w-4 h-4" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px]">
                          {step}
                        </span>
                      )}
                      <span className="hidden sm:inline">
                        {step === 1 && 'Connect'}
                        {step === 2 && 'AI Config'}
                        {step === 3 && 'Prompt'}
                        {step === 4 && 'PDFs'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* Step 1: Facebook Messenger Connection */}
                {connectStep === 1 && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-start gap-3">
                        <QuestionMarkCircleIcon className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-blue-400 mb-2">How to get your credentials:</p>
                          <ul className="space-y-1 text-text-secondary">
                            <li>1. Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener" className="text-primary hover:underline">Graph API Explorer</a></li>
                            <li>2. Select your app and generate a Page Access Token</li>
                            <li>3. Add permissions: <code className="px-1 py-0.5 bg-dark-700 rounded text-xs">pages_manage_posts</code>, <code className="px-1 py-0.5 bg-dark-700 rounded text-xs">pages_messaging</code></li>
                            <li>4. Use <code className="px-1 py-0.5 bg-dark-700 rounded text-xs">/me/accounts</code> query to get Page ID and Token</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">Facebook Page Name <span className="text-red-400">*</span></label>
                        <input type="text" value={connectForm.page_name} onChange={(e) => setConnectForm({ ...connectForm, page_name: e.target.value })} placeholder="My Business Page" className="input" />
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">Page ID <span className="text-red-400">*</span></label>
                        <input type="text" value={connectForm.page_id} onChange={(e) => setConnectForm({ ...connectForm, page_id: e.target.value })} placeholder="123456789012345" className="input" />
                      </div>
                    </div>
                    <div>
                      <label className="text-text-secondary text-sm mb-2 block">Page Access Token <span className="text-red-400">*</span></label>
                      <input type="password" value={connectForm.page_access_token} onChange={(e) => setConnectForm({ ...connectForm, page_access_token: e.target.value })} placeholder="EAAxxxxxxx..." className="input" />
                    </div>
                    <div>
                      <label className="text-text-secondary text-sm mb-2 block">Greeting Message <span className="text-red-400">*</span></label>
                      <textarea value={connectForm.greeting_text} onChange={(e) => setConnectForm({ ...connectForm, greeting_text: e.target.value })} placeholder="Hi! Thanks for reaching out..." rows={3} className="input resize-none" />
                      <p className="text-text-muted text-xs mt-1">First message users see when they start a conversation</p>
                    </div>
                    <div>
                      <label className="text-text-secondary text-sm mb-2 block">Website URL (Optional)</label>
                      <input type="url" value={connectForm.website_url} onChange={(e) => setConnectForm({ ...connectForm, website_url: e.target.value })} placeholder="https://yourwebsite.com" className="input" />
                      <p className="text-text-muted text-xs mt-1">Your business website - AI will extract knowledge from it</p>
                    </div>
                  </div>
                )}

                {/* Step 2: AI Configuration */}
                {connectStep === 2 && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-start gap-3">
                        <CpuChipIcon className="w-5 h-5 text-purple-400 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-purple-400 mb-1">OpenAI API Key</p>
                          <p className="text-text-secondary">Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-primary hover:underline">OpenAI Platform</a></p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">OpenAI API Key <span className="text-red-400">*</span></label>
                        <input type="password" value={connectForm.openai_api_key} onChange={(e) => setConnectForm({ ...connectForm, openai_api_key: e.target.value })} placeholder="sk-..." className="input" />
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">OpenAI Model <span className="text-red-400">*</span></label>
                        <select value={connectForm.openai_model} onChange={(e) => setConnectForm({ ...connectForm, openai_model: e.target.value })} className="input">
                          <option value="gpt-4o">GPT-4o (Recommended)</option>
                          <option value="gpt-4o-mini">GPT-4o Mini</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">Embedding Model</label>
                        <select value={connectForm.embedding_model} onChange={(e) => setConnectForm({ ...connectForm, embedding_model: e.target.value })} className="input">
                          <option value="text-embedding-3-small">text-embedding-3-small</option>
                          <option value="text-embedding-3-large">text-embedding-3-large</option>
                          <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">Top K Results</label>
                        <input type="number" value={connectForm.top_k_results} onChange={(e) => setConnectForm({ ...connectForm, top_k_results: parseInt(e.target.value) })} min={1} max={20} className="input" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">Similarity Threshold</label>
                        <input type="number" value={connectForm.similarity_threshold} onChange={(e) => setConnectForm({ ...connectForm, similarity_threshold: parseFloat(e.target.value) })} min={0} max={1} step={0.1} className="input" />
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">Temperature</label>
                        <input type="number" value={connectForm.temperature} onChange={(e) => setConnectForm({ ...connectForm, temperature: parseFloat(e.target.value) })} min={0} max={2} step={0.1} className="input" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={connectForm.rag_enabled} onChange={(e) => setConnectForm({ ...connectForm, rag_enabled: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-dark-700 text-primary focus:ring-primary" />
                        <span className="text-sm">Enable RAG (Knowledge Base)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={connectForm.image_understanding_enabled} onChange={(e) => setConnectForm({ ...connectForm, image_understanding_enabled: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-dark-700 text-primary focus:ring-primary" />
                        <span className="text-sm">Enable Image Understanding</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Step 3: AI Personality */}
                {connectStep === 3 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">Prompt Name <span className="text-red-400">*</span></label>
                        <input type="text" value={connectForm.prompt_name} onChange={(e) => setConnectForm({ ...connectForm, prompt_name: e.target.value })} placeholder="Customer Support" className="input" />
                      </div>
                      <div>
                        <label className="text-text-secondary text-sm mb-2 block">Conversation Tone <span className="text-red-400">*</span></label>
                        <select value={connectForm.prompt_tone} onChange={(e) => setConnectForm({ ...connectForm, prompt_tone: e.target.value })} className="input">
                          {promptTones.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-text-secondary text-sm mb-2 block">System Prompt <span className="text-red-400">*</span></label>
                      <textarea value={connectForm.system_prompt} onChange={(e) => setConnectForm({ ...connectForm, system_prompt: e.target.value })} placeholder="You are a helpful customer support assistant..." rows={6} className="input resize-none" />
                      <p className="text-text-muted text-xs mt-1">Define how the AI should behave and respond</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={connectForm.is_active} onChange={(e) => setConnectForm({ ...connectForm, is_active: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-dark-700 text-primary focus:ring-primary" />
                      <span className="text-sm">Set as active prompt</span>
                    </label>
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                      <h4 className="font-medium text-green-400 mb-2 flex items-center gap-2"><BoltIcon className="w-4 h-4" />Prompt Tips</h4>
                      <ul className="space-y-1 text-sm text-text-secondary">
                        <li>- Be specific about your bot's role and expertise</li>
                        <li>- Define clear boundaries for what the bot should/shouldn't do</li>
                        <li>- Include examples of ideal responses</li>
                        <li>- Specify how to handle off-topic questions</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Step 4: PDF Upload */}
                {connectStep === 4 && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                      <div className="flex items-start gap-3">
                        <DocumentIcon className="w-5 h-5 text-orange-400 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-orange-400 mb-1">Knowledge Base (Optional)</p>
                          <p className="text-text-secondary">Upload PDF files to build your AI's knowledge base.</p>
                        </div>
                      </div>
                    </div>
                    <div
                      className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('modal-pdf-upload')?.click()}
                    >
                      <CloudArrowUpIcon className="w-12 h-12 mx-auto text-text-muted mb-3" />
                      <p className="font-medium mb-1">Click to upload or drag and drop</p>
                      <p className="text-text-secondary text-sm">PDF files only (max 50MB each)</p>
                      <input
                        id="modal-pdf-upload"
                        type="file"
                        accept=".pdf"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            setConnectForm({ ...connectForm, pdf_files: Array.from(e.target.files) });
                          }
                        }}
                      />
                    </div>
                    {connectForm.pdf_files.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{connectForm.pdf_files.length} file(s) selected:</p>
                        {connectForm.pdf_files.map((file, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-dark-700/50 border border-white/5">
                            <DocumentIcon className="w-5 h-5 text-red-400" />
                            <span className="flex-1 truncate">{file.name}</span>
                            <span className="text-text-muted text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            <button onClick={() => { const nf = [...connectForm.pdf_files]; nf.splice(index, 1); setConnectForm({ ...connectForm, pdf_files: nf }); }} className="text-red-400 hover:text-red-300">
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                <button
                  onClick={() => { if (connectStep > 1) setConnectStep(connectStep - 1); }}
                  disabled={connectStep === 1}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${connectStep === 1 ? 'text-text-muted cursor-not-allowed' : 'text-text-secondary hover:text-text-primary hover:bg-dark-700'}`}
                >
                  <ArrowLeftIcon className="w-4 h-4" /> Back
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowConnectModal(false)} className="px-4 py-2 rounded-xl font-medium text-text-secondary hover:text-text-primary hover:bg-dark-700 transition-all">Cancel</button>
                  {connectStep < 4 ? (
                    <button
                      onClick={() => setConnectStep(connectStep + 1)}
                      disabled={
                        (connectStep === 1 && (!connectForm.page_name || !connectForm.page_id || !connectForm.page_access_token)) ||
                        (connectStep === 2 && !connectForm.openai_api_key) ||
                        (connectStep === 3 && (!connectForm.prompt_name || !connectForm.system_prompt))
                      }
                      className="btn-primary flex items-center gap-2"
                    >
                      Next <ArrowRightIcon className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        setIsSubmitting(true);
                        try {
                          const connection = await messengerService.connectPage({
                            page_name: connectForm.page_name,
                            page_id: connectForm.page_id,
                            page_access_token: connectForm.page_access_token,
                            greeting_text: connectForm.greeting_text,
                            website_url: connectForm.website_url || undefined,
                          });
                          await messengerService.createOrUpdateConfig(connection.id, {
                            openai_api_key: connectForm.openai_api_key,
                            openai_model: connectForm.openai_model,
                            embedding_model: connectForm.embedding_model,
                            rag_enabled: connectForm.rag_enabled,
                            top_k_results: connectForm.top_k_results,
                            similarity_threshold: connectForm.similarity_threshold,
                            temperature: connectForm.temperature,
                            max_tokens: connectForm.max_tokens,
                            image_understanding_enabled: connectForm.image_understanding_enabled,
                          });
                          await messengerService.createPrompt(connection.id, {
                            name: connectForm.prompt_name,
                            system_prompt: connectForm.system_prompt,
                            tone: connectForm.prompt_tone as any,
                            is_active: connectForm.is_active,
                          });
                          if (connectForm.pdf_files.length > 0) {
                            for (const pdfFile of connectForm.pdf_files) {
                              await messengerService.uploadPDF(connection.id, pdfFile);
                            }
                          }
                          // Crawl website if URL provided
                          if (connectForm.website_url) {
                            try {
                              await messengerService.crawlWebsite(connection.id, connectForm.website_url);
                            } catch (crawlErr) {
                              console.warn('Website crawl failed (can retry later):', crawlErr);
                            }
                          }
                          await fetchData();
                          setShowConnectModal(false);
                          setConnectStep(1);
                          setConnectForm({
                            page_name: '', page_id: '', page_access_token: '',
                            greeting_text: 'Hi! Thanks for reaching out. How can I help you today?',
                            website_url: '',
                            openai_api_key: '', openai_model: 'gpt-4o', embedding_model: 'text-embedding-3-small',
                            top_k_results: 5, similarity_threshold: 0.7, temperature: 0.7, max_tokens: 1024,
                            rag_enabled: true, image_understanding_enabled: true,
                            prompt_name: 'Customer Support', prompt_tone: 'friendly',
                            system_prompt: 'You are a helpful customer support assistant. Answer questions clearly and professionally.',
                            is_active: true, pdf_files: [],
                          });
                        } catch (error: any) {
                          console.error('Error connecting page:', error);
                          const errData = error?.response?.data;
                          const msg = errData
                            ? typeof errData === 'string' ? errData : Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')
                            : 'Failed to connect page. Please check your details.';
                          alert(msg);
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      disabled={isSubmitting}
                      className="btn-primary flex items-center gap-2"
                    >
                      {isSubmitting ? (<><ArrowPathIcon className="w-4 h-4 animate-spin" />Connecting...</>) : (<><CheckCircleIcon className="w-4 h-4" />Connect Bot</>)}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MessengerBotPage;
