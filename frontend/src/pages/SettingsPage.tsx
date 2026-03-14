import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Cog6ToothIcon,
  BellIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  ClockIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useTheme, type ThemeMode } from '../contexts/ThemeContext';
import { Button, Card, Input, Modal } from '../components/ui';
import { useAuthStore } from '../store';
import api from '../services/api';
import { toast } from '../store/toastStore';

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
];


const themeOptions: { value: ThemeMode; label: string; icon: typeof MoonIcon }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: ComputerDesktopIcon },
];

export function SettingsPage() {
  const { logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  // Diamond wallet state
  const [diamondBalance, setDiamondBalance] = useState<number | null>(null);

  // Load diamond balance on mount
  useEffect(() => {
    const loadDiamondBalance = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await api.get('/diamond/balance/', { _silentError: true } as any);
        setDiamondBalance(response.data.balance);
      } catch (err) {
        console.error('Failed to load diamond balance:', err);
      }
    };
    loadDiamondBalance();
  }, []);

  // Settings state
  const [settings, setSettings] = useState({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: 'en',
    notifications: {
      email: true,
      push: true,
      postSuccess: true,
      postFailed: true,
      weeklyReport: true,
      productUpdates: false,
    },
    privacy: {
      showActivity: true,
      publicProfile: false,
    },
    posting: {
      defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      autoHashtags: true,
      watermark: false,
    },
  });

  const updateSettings = (path: string, value: unknown) => {
    setSettings((prev) => {
      const keys = path.split('.');
      const newSettings = { ...prev };
      let current: Record<string, unknown> = newSettings;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const handleSave = async () => {
    try {
      // API call to save settings
      setSaved(true);
      toast.success('Settings saved!');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    try {
      // API call to delete account
      await logout();
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };


  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Cog6ToothIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
            <p className="text-text-secondary">Customize your experience</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saved}>
          {saved ? (
            <>
              <CheckCircleIcon className="w-5 h-5 mr-2" />
              Saved
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      {/* Success Message */}
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-success/10 border border-success/20 rounded-xl flex items-center gap-3"
        >
          <CheckCircleIcon className="w-5 h-5 text-success" />
          <p className="text-success">Settings saved successfully!</p>
        </motion.div>
      )}

      <div className="space-y-6">
        {/* Appearance */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <PaintBrushIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Appearance</h3>
              <p className="text-sm text-text-secondary">Customize how the app looks</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Theme Selector */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      theme === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <opt.icon className="w-6 h-6 mx-auto mb-2 text-text-primary" />
                    <p className="text-sm text-text-primary font-medium text-center">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Language</label>
              <select
                value={settings.language}
                onChange={(e) => updateSettings('language', e.target.value)}
                className="w-full px-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-text-primary focus:outline-none focus:border-primary"
              >
                {languages.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Time & Region */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <GlobeAltIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Time & Region</h3>
              <p className="text-sm text-text-secondary">Set your timezone for scheduling</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              <ClockIcon className="w-4 h-4 inline mr-2" />
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => updateSettings('timezone', e.target.value)}
              className="w-full px-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-text-primary focus:outline-none focus:border-primary"
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-text-muted">
              Current time: {new Date().toLocaleTimeString('en-US', { timeZone: settings.timezone })}
            </p>
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <BellIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Notifications</h3>
              <p className="text-sm text-text-secondary">Choose what updates you receive</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Email Notifications */}
            <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl">
              <div className="flex items-center gap-3">
                <EnvelopeIcon className="w-5 h-5 text-text-muted" />
                <div>
                  <p className="text-text-primary font-medium">Email Notifications</p>
                  <p className="text-sm text-text-muted">Receive updates via email</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.email}
                  onChange={(e) => updateSettings('notifications.email', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Push Notifications */}
            <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl">
              <div className="flex items-center gap-3">
                <DevicePhoneMobileIcon className="w-5 h-5 text-text-muted" />
                <div>
                  <p className="text-text-primary font-medium">Push Notifications</p>
                  <p className="text-sm text-text-muted">Get instant alerts on your device</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.push}
                  onChange={(e) => updateSettings('notifications.push', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Notification Types */}
            <div className="pt-4 space-y-3">
              <p className="text-sm font-medium text-text-secondary">Notification Types</p>

              {[
                { key: 'postSuccess', label: 'Successful posts', desc: 'When your posts are published' },
                { key: 'postFailed', label: 'Failed posts', desc: 'When posts fail to publish' },
                { key: 'weeklyReport', label: 'Weekly reports', desc: 'Performance summaries' },
                { key: 'productUpdates', label: 'Product updates', desc: 'New features and improvements' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 bg-dark-700/30 rounded-lg cursor-pointer hover:bg-dark-700/50 transition-colors"
                >
                  <div>
                    <p className="text-sm text-text-primary">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                    onChange={(e) => updateSettings(`notifications.${item.key}`, e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-dark-600 text-primary focus:ring-primary/50"
                  />
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* Posting Preferences */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <ClockIcon className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Posting Preferences</h3>
              <p className="text-sm text-text-secondary">Default settings for new posts</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl cursor-pointer">
              <div>
                <p className="text-text-primary font-medium">Auto-generate hashtags</p>
                <p className="text-sm text-text-muted">Automatically suggest relevant hashtags</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.posting.autoHashtags}
                  onChange={(e) => updateSettings('posting.autoHashtags', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </label>

            <label className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl cursor-pointer">
              <div>
                <p className="text-text-primary font-medium">Add watermark to images</p>
                <p className="text-sm text-text-muted">Automatically add your brand watermark</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.posting.watermark}
                  onChange={(e) => updateSettings('posting.watermark', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </label>
          </div>
        </Card>

        {/* Diamond Token Status */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <span className="text-lg">◆</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">AI Services</h3>
              <p className="text-sm text-text-secondary">Powered by Diamond Tokens</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Balance Display */}
            <div className="p-5 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">Your Diamond Balance</span>
                <Link to="/dashboard" className="text-xs text-cyan-400 hover:text-cyan-300">
                  View usage →
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 text-2xl">◆</span>
                <span className="text-3xl font-bold text-text-primary">
                  {diamondBalance !== null ? diamondBalance.toLocaleString() : '...'}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-dark-700/50 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-green-400" />
                <p className="text-sm text-green-400 font-medium">All AI Features Active</p>
              </div>
              <p className="text-xs text-text-secondary">
                All AI features — captions, images, videos, voice, strategy, and more — are powered by Diamond Tokens.
                Each generation costs a specific number of diamonds shown next to every action button.
              </p>
              <p className="text-xs text-text-muted">
                When your balance runs low, contact your administrator for a recharge.
              </p>
            </div>
          </div>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Privacy & Security</h3>
              <p className="text-sm text-text-secondary">Manage your privacy settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl cursor-pointer">
              <div>
                <p className="text-text-primary font-medium">Show activity status</p>
                <p className="text-sm text-text-muted">Let others see when you're active</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.privacy.showActivity}
                  onChange={(e) => updateSettings('privacy.showActivity', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </label>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="border-danger/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-danger/20 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-danger" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-danger">Danger Zone</h3>
              <p className="text-sm text-text-secondary">Irreversible actions</p>
            </div>
          </div>

          <div className="p-4 bg-danger/5 border border-danger/10 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary font-medium">Delete Account</p>
                <p className="text-sm text-text-muted">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<TrashIcon className="w-4 h-4" />}
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText('');
        }}
        title="Delete Account"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl">
            <p className="text-danger font-medium mb-2">Warning: This action cannot be undone</p>
            <p className="text-sm text-text-secondary">
              Deleting your account will permanently remove all your data, including posts, connected
              accounts, and settings. This action is irreversible.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Type <span className="text-danger font-mono">DELETE</span> to confirm
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE here"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="danger"
              fullWidth
              disabled={deleteConfirmText !== 'DELETE'}
              onClick={handleDeleteAccount}
            >
              Delete My Account
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SettingsPage;
