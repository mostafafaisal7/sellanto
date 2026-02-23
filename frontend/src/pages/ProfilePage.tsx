import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  UserCircleIcon,
  CameraIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, Input, Avatar } from '../components/ui';
import { useAuthStore } from '../store';
import { authFetch } from '../services/api';

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

const planFeatures: Record<string, string[]> = {
  free: ['5 posts/month', '2 social accounts', 'Basic AI captions'],
  starter: ['50 posts/month', '5 social accounts', 'AI captions', 'Priority support'],
  pro: ['200 posts/month', '10 social accounts', 'Advanced AI', 'Analytics', 'Team features'],
  business: ['Unlimited posts', '25 social accounts', 'White-label', 'API access', 'Dedicated support'],
  enterprise: ['Custom limits', 'Unlimited accounts', 'Custom integrations', 'SLA', 'Account manager'],
};

export function ProfilePage() {
  const { user } = useAuthStore();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone: user?.profile?.phone || '',
      company: user?.profile?.company || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onSaveProfile = async (data: ProfileFormData) => {
    try {
      // API call to update profile
      const response = await authFetch('/api/v1/auth/me/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        setProfileSaved(true);
        setIsEditingProfile(false);
        setTimeout(() => setProfileSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const onChangePassword = async (data: PasswordFormData) => {
    try {
      const response = await authFetch('/api/v1/auth/change-password/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          current_password: data.current_password,
          new_password: data.new_password,
        }),
      });
      if (response.ok) {
        setPasswordChanged(true);
        setIsChangingPassword(false);
        passwordForm.reset();
        setTimeout(() => setPasswordChanged(false), 3000);
      }
    } catch (error) {
      console.error('Failed to change password:', error);
    }
  };

  const subscription = user?.profile?.subscription_plan || 'free';
  const features = planFeatures[subscription] || planFeatures.free;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">My Profile</h1>
        <p className="text-text-secondary">Manage your account settings and preferences</p>
      </div>

      {/* Success Messages */}
      {(profileSaved || passwordChanged) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-success/10 border border-success/20 rounded-xl flex items-center gap-3"
        >
          <CheckCircleIcon className="w-5 h-5 text-success" />
          <p className="text-success">
            {profileSaved ? 'Profile updated successfully!' : 'Password changed successfully!'}
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Avatar & Basic Info */}
          <Card>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <Avatar name={user?.username || 'User'} size="xl" />
                <button className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <CameraIcon className="w-6 h-6 text-white" />
                </button>
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl font-bold text-text-primary">
                  {user?.first_name} {user?.last_name}
                </h2>
                <p className="text-text-secondary">@{user?.username}</p>
                <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                  <span className="px-3 py-1 bg-gradient-to-r from-primary to-secondary text-white text-sm rounded-full font-medium capitalize">
                    {subscription} Plan
                  </span>
                  {user?.is_staff && (
                    <span className="px-3 py-1 bg-warning/20 text-warning text-sm rounded-full font-medium">
                      Admin
                    </span>
                  )}
                </div>
              </div>
              {!isEditingProfile && (
                <Button variant="secondary" onClick={() => setIsEditingProfile(true)}>
                  Edit Profile
                </Button>
              )}
            </div>
          </Card>

          {/* Profile Form */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <UserCircleIcon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">Personal Information</h3>
              </div>
            </div>

            <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  placeholder="Your first name"
                  disabled={!isEditingProfile}
                  error={profileForm.formState.errors.first_name?.message}
                  {...profileForm.register('first_name')}
                />
                <Input
                  label="Last Name"
                  placeholder="Your last name"
                  disabled={!isEditingProfile}
                  error={profileForm.formState.errors.last_name?.message}
                  {...profileForm.register('last_name')}
                />
              </div>

              <Input
                label="Email Address"
                type="email"
                placeholder="your@email.com"
                disabled={!isEditingProfile}
                leftIcon={<EnvelopeIcon className="w-5 h-5 text-text-muted" />}
                error={profileForm.formState.errors.email?.message}
                {...profileForm.register('email')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Phone Number"
                  placeholder="+1 (555) 000-0000"
                  disabled={!isEditingProfile}
                  leftIcon={<PhoneIcon className="w-5 h-5 text-text-muted" />}
                  {...profileForm.register('phone')}
                />
                <Input
                  label="Company"
                  placeholder="Your company name"
                  disabled={!isEditingProfile}
                  leftIcon={<BuildingOfficeIcon className="w-5 h-5 text-text-muted" />}
                  {...profileForm.register('company')}
                />
              </div>

              {isEditingProfile && (
                <div className="flex gap-3 pt-4">
                  <Button type="submit" isLoading={profileForm.formState.isSubmitting}>
                    Save Changes
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setIsEditingProfile(false);
                      profileForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </form>
          </Card>

          {/* Password Change */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                  <KeyIcon className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Password & Security</h3>
                  <p className="text-sm text-text-secondary">Manage your password</p>
                </div>
              </div>
              {!isChangingPassword && (
                <Button variant="secondary" onClick={() => setIsChangingPassword(true)}>
                  Change Password
                </Button>
              )}
            </div>

            {isChangingPassword && (
              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                <Input
                  label="Current Password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Enter current password"
                  error={passwordForm.formState.errors.current_password?.message}
                  {...passwordForm.register('current_password')}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      {showCurrentPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  }
                />

                <Input
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  error={passwordForm.formState.errors.new_password?.message}
                  {...passwordForm.register('new_password')}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      {showNewPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  }
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="Confirm new password"
                  error={passwordForm.formState.errors.confirm_password?.message}
                  {...passwordForm.register('confirm_password')}
                />

                <div className="flex gap-3 pt-2">
                  <Button type="submit" isLoading={passwordForm.formState.isSubmitting}>
                    Update Password
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setIsChangingPassword(false);
                      passwordForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {!isChangingPassword && (
              <div className="flex items-center gap-3 p-4 bg-dark-700/50 rounded-xl">
                <ShieldCheckIcon className="w-5 h-5 text-success" />
                <p className="text-sm text-text-secondary">
                  Your password is securely encrypted. We recommend changing it periodically.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Subscription Card */}
          <Card className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-primary/30 to-secondary/30" />
            <div className="relative pt-8">
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-3">
                  <SparklesIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-text-primary capitalize">{subscription} Plan</h3>
              </div>

              <div className="space-y-3 mb-6">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm text-text-secondary">{feature}</span>
                  </div>
                ))}
              </div>

              {subscription !== 'enterprise' && (
                <Button fullWidth variant="secondary">
                  Upgrade Plan
                </Button>
              )}
            </div>
          </Card>

          {/* Usage Stats */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Usage This Month</h3>
            <div className="space-y-4">
              {/* Posts */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">Posts</span>
                  <span className="text-text-primary">
                    {user?.profile?.posts_this_month || 0}/{user?.profile?.max_posts_per_month || 50}
                  </span>
                </div>
                <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-primary"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(
                        ((user?.profile?.posts_this_month || 0) /
                          (user?.profile?.max_posts_per_month || 50)) *
                        100, 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* AI Captions */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">AI Captions</span>
                  <span className="text-text-primary">
                    {user?.profile?.captions_this_month || 0}/{user?.profile?.max_captions_per_month || 100}
                  </span>
                </div>
                <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-secondary to-primary"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(
                        ((user?.profile?.captions_this_month || 0) /
                          (user?.profile?.max_captions_per_month || 100)) *
                        100, 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* AI Images */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">AI Images</span>
                  <span className="text-text-primary">
                    {user?.profile?.images_this_month || 0}/{user?.profile?.max_images_per_month || 50}
                  </span>
                </div>
                <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(
                        ((user?.profile?.images_this_month || 0) /
                          (user?.profile?.max_images_per_month || 50)) *
                        100, 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* AI Videos */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">AI Videos</span>
                  <span className="text-text-primary">
                    {user?.profile?.videos_this_month || 0}/{user?.profile?.max_videos_per_month || 20}
                  </span>
                </div>
                <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(
                        ((user?.profile?.videos_this_month || 0) /
                          (user?.profile?.max_videos_per_month || 20)) *
                        100, 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Messenger Messages */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">Messenger Messages</span>
                  <span className="text-text-primary">
                    {user?.profile?.messenger_messages_this_month || 0}/{user?.profile?.max_messenger_messages || 500}
                  </span>
                </div>
                <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(
                        ((user?.profile?.messenger_messages_this_month || 0) /
                          (user?.profile?.max_messenger_messages || 500)) *
                        100, 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* API Token Usage */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">API Token Usage</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681v6.722zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                    </svg>
                  </div>
                  <span className="text-sm">OpenAI Tokens</span>
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {(user?.profile?.openai_tokens_this_month || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 19.5h20L12 2zm0 4l6.9 12H5.1L12 6z"/>
                    </svg>
                  </div>
                  <span className="text-sm">Gemini Tokens</span>
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {(user?.profile?.gemini_tokens_this_month || 0).toLocaleString()}
                </span>
              </div>
              <div className="pt-2 mt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">API Mode</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    user?.profile?.api_mode === 'admin'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {user?.profile?.api_mode === 'admin' ? 'Admin API' : 'User API'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Account Status */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Account Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Account Status</span>
                <span className={`flex items-center gap-1 text-sm ${
                  user?.profile?.is_approved ? 'text-success' : 'text-warning'
                }`}>
                  <CheckCircleIcon className="w-4 h-4" />
                  {user?.profile?.is_approved ? 'Active' : 'Pending Approval'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Social Accounts</span>
                <span className="text-sm text-text-primary">
                  0 / {user?.profile?.max_social_accounts || 5}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Member Since</span>
                <span className="text-sm text-text-primary">
                  {user?.profile?.created_at
                    ? new Date(user.profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    : 'N/A'}
                </span>
              </div>
              {user?.profile?.plan_start_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Plan Started</span>
                  <span className="text-sm text-text-primary">
                    {new Date(user.profile.plan_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
              {user?.profile?.plan_end_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Plan Expires</span>
                  <span className="text-sm text-text-primary">
                    {new Date(user.profile.plan_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Last Activity</span>
                <span className="text-sm text-text-primary">
                  {user?.profile?.last_activity
                    ? new Date(user.profile.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'Today'}
                </span>
              </div>
            </div>
          </Card>

          {/* Total Token Usage */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Total Usage (All Time)</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">OpenAI Tokens</span>
                <span className="text-sm text-text-primary font-medium">
                  {(user?.profile?.total_openai_tokens_used || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Gemini Tokens</span>
                <span className="text-sm text-text-primary font-medium">
                  {(user?.profile?.total_gemini_tokens_used || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
