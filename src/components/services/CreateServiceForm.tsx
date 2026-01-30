'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alerts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Save, LogOut, Trash2, Lock, Bell, Moon, Sun, CheckCircle, AlertCircle,
} from 'lucide-react';
import Image from 'next/image';
import type { Database } from '@/types';

// Use the database-generated Profile type
type DatabaseProfile = Database['public']['Tables']['profiles']['Row'];

// Create a custom type for our notification settings
interface NotificationSettings {
  email_messages: boolean;
  email_orders: boolean;
  email_reviews: boolean;
  push_notifications: boolean;
}

// Create a form-specific profile type that extends the database type
type ProfileFormData = Omit<DatabaseProfile, 'notification_settings' | 'theme_preference'> & {
  notification_settings?: NotificationSettings | null;
  theme_preference?: 'light' | 'dark' | 'system' | null;
};

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileData, setProfileData] = useState<Partial<ProfileFormData>>({});
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_messages: true,
    email_orders: true,
    email_reviews: true,
    push_notifications: true,
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          // Convert database Json type to our custom types
          const formData: Partial<ProfileFormData> = {
            ...data,
            notification_settings: data.notification_settings 
              ? (data.notification_settings as unknown as NotificationSettings)
              : null,
            theme_preference: data.theme_preference as 'light' | 'dark' | 'system' | null,
          };

          setProfileData(formData);

          // Load notification settings
          if (data.notification_settings && typeof data.notification_settings === 'object') {
            setNotificationSettings(data.notification_settings as unknown as NotificationSettings);
          }

          // Load theme preference
          const themeValue = data.theme_preference as string | null;
          const savedTheme = themeValue || localStorage.getItem('theme');
          if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
            setTheme(savedTheme);
            applyTheme(savedTheme);
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setStatus({
          type: 'error',
          message: 'Failed to load profile',
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [supabase, router]);

  const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
    const html = document.documentElement;
    if (newTheme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.toggle('dark', isDark);
    } else {
      html.classList.toggle('dark', newTheme === 'dark');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          bio: profileData.bio,
          location: profileData.location,
          phone_number: profileData.phone_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setStatus({
        type: 'success',
        message: 'Profile updated successfully',
      });

      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update profile',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({
        type: 'error',
        message: 'Passwords do not match',
      });
      setSaving(false);
      return;
    }

    if (newPassword.length < 8) {
      setStatus({
        type: 'error',
        message: 'Password must be at least 8 characters',
      });
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setStatus({
        type: 'success',
        message: 'Password updated successfully',
      });
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update password',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);

    // Save to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({
          theme_preference: newTheme,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      setStatus({
        type: 'success',
        message: `Theme changed to ${newTheme}`,
      });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const handleNotificationUpdate = async () => {
    setSaving(true);
    setStatus(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Cast NotificationSettings to Json type for database
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_settings: notificationSettings as unknown as Database['public']['Tables']['profiles']['Update']['notification_settings'],
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setStatus({
        type: 'success',
        message: 'Notification preferences updated',
      });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update notification preferences',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'Failed to sign out',
      });
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) throw profileError;

      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete account',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-500 dark:text-gray-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Manage your account and preferences</p>

        {status && (
          <Alert variant={status.type} className="mb-6">
            <div className="flex items-start gap-2">
              {status.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              )}
              <AlertDescription>{status.message}</AlertDescription>
            </div>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <TabsList variant="pills">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Profile Information</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                {profileData.profile_image_url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Profile Picture
                    </label>
                    <div className="mb-4">
                      <Image
                        src={profileData.profile_image_url}
                        alt="Profile"
                        width={96}
                        height={96}
                        className="rounded-lg"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Edit profile image in your freelancer profile
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Full Name
                  </label>
                  <Input
                    value={profileData.full_name || ''}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={profileData.email || ''}
                    disabled
                    className="opacity-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Phone Number
                  </label>
                  <Input
                    value={profileData.phone_number || ''}
                    onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
                    placeholder="+234..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Location
                  </label>
                  <Input
                    value={profileData.location || ''}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    placeholder="City, State"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Bio
                  </label>
                  <Textarea
                    value={profileData.bio || ''}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                    className="min-h-32"
                  />
                </div>

                <Button type="submit" loading={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change Password
              </h2>
              <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Minimum 8 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Confirm Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>

                <Button type="submit" loading={saving} className="gap-2">
                  <Lock className="w-4 h-4" />
                  Update Password
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* Theme Tab */}
          <TabsContent value="theme" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Display Theme</h2>
              <div className="space-y-4">
                <ThemeOption
                  icon={<Sun className="w-5 h-5" />}
                  title="Light Mode"
                  description="Always use light theme"
                  selected={theme === 'light'}
                  onClick={() => handleThemeChange('light')}
                />
                <ThemeOption
                  icon={<Moon className="w-5 h-5" />}
                  title="Dark Mode"
                  description="Always use dark theme"
                  selected={theme === 'dark'}
                  onClick={() => handleThemeChange('dark')}
                />
                <ThemeOption
                  icon={null}
                  title="System Default"
                  description="Follow your device's theme preference"
                  selected={theme === 'system'}
                  onClick={() => handleThemeChange('system')}
                />
              </div>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </h2>
              <div className="space-y-4">
                <NotificationToggle
                  label="Messages"
                  description="Get notified when you receive new messages"
                  checked={notificationSettings.email_messages}
                  onChange={(checked) => setNotificationSettings({
                    ...notificationSettings,
                    email_messages: checked,
                  })}
                />
                <NotificationToggle
                  label="Orders"
                  description="Updates on your orders and delivery status"
                  checked={notificationSettings.email_orders}
                  onChange={(checked) => setNotificationSettings({
                    ...notificationSettings,
                    email_orders: checked,
                  })}
                />
                <NotificationToggle
                  label="Reviews"
                  description="Notifications when you receive reviews"
                  checked={notificationSettings.email_reviews}
                  onChange={(checked) => setNotificationSettings({
                    ...notificationSettings,
                    email_reviews: checked,
                  })}
                />
                <NotificationToggle
                  label="Push Notifications"
                  description="Enable browser push notifications"
                  checked={notificationSettings.push_notifications}
                  onChange={(checked) => setNotificationSettings({
                    ...notificationSettings,
                    push_notifications: checked,
                  })}
                />
              </div>
              
              <div className="mt-6">
                <Button onClick={handleNotificationUpdate} loading={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Notification Preferences
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card className="p-6 border-red-200 dark:border-red-900">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Account Management</h2>
              
              <div className="space-y-4">
                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </Button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Sign out from your current session
                  </p>
                </div>

                <div>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    loading={saving}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </Button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Permanently delete your account and all associated data
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-6 h-6 rounded cursor-pointer accent-blue-600"
      />
    </div>
  );
}

function ThemeOption({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode | null;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border rounded-lg transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className={`text-2xl ${selected ? 'text-blue-600' : 'text-gray-400'}`}>
            {icon}
          </div>
        )}
        <div>
          <p className={`font-medium ${selected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
            {title}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        {selected && (
          <div className="ml-auto">
            <CheckCircle className="w-6 h-6 text-blue-600" />
          </div>
        )}
      </div>
    </button>
  );
}