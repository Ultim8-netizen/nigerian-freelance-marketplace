'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alerts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Save, LogOut, Trash2, Lock, Bell, Moon, Sun, Monitor,
  CheckCircle, AlertCircle, Camera, User,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string;
  email: string;
  bio: string | null;
  location: string | null;
  profile_image_url: string | null;
  phone_number: string | null;
  notification_settings?: NotificationSettings | null;
  theme_preference?: 'light' | 'dark' | 'system' | null;
}

interface NotificationSettings {
  email_messages: boolean;
  email_orders: boolean;
  email_reviews: boolean;
  push_notifications: boolean;
}

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  email_messages: true,
  email_orders: true,
  email_reviews: true,
  push_notifications: true,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  // FIX: useTheme from next-themes actually writes the `class` attribute on
  // <html> and integrates with ThemeProvider — no manual classList hacks needed.
  const { theme, setTheme, resolvedTheme } = useTheme();

  // FIX: Avoid hydration mismatch — theme value is unknown on the server side.
  const [mounted, setMounted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const [profileData, setProfileData] = useState<Partial<Profile>>({});
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIF_SETTINGS);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showStatus = (msg: StatusMessage, ms = 3000) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), ms);
  };

  // ── Mount guard for theme ──────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setProfileData(data as Profile);

        if (data.notification_settings) {
          // Cast through `unknown` first because `notification_settings` is typed
          // as `Json | null` in the generated database types (a wide union that
          // includes `Json[]`, which doesn't structurally overlap with our
          // NotificationSettings object shape). The double cast is intentional.
          const parsed = data.notification_settings as unknown as NotificationSettings;
          setNotificationSettings({ ...DEFAULT_NOTIF_SETTINGS, ...parsed });
        }

        // FIX: Theme is owned by next-themes. We only read the DB value on
        // first load to sync any previously-saved preference, then let
        // next-themes manage it going forward. We do NOT call applyTheme()
        // manually because next-themes already handles the DOM.
        if (data.theme_preference && !theme) {
          setTheme(data.theme_preference as string);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        showStatus({ type: 'error', message: 'Failed to load profile' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getInitials = (name?: string | null) =>
    (name ?? 'U').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const currentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    return user.id;
  };

  // ── Profile update ────────────────────────────────────────────────────────
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const uid = await currentUserId();
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          bio: profileData.bio,
          location: profileData.location,
          phone_number: profileData.phone_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', uid);
      if (error) throw error;
      showStatus({ type: 'success', message: 'Profile updated successfully' });
    } catch (err) {
      showStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  // ── Password change ───────────────────────────────────────────────────────
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showStatus({ type: 'error', message: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      showStatus({ type: 'error', message: 'Password must be at least 8 characters' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      showStatus({ type: 'success', message: 'Password updated successfully' });
    } catch (err) {
      showStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update password' });
    } finally {
      setSaving(false);
    }
  };

  // ── Theme change ──────────────────────────────────────────────────────────
  // FIX: setTheme() from next-themes handles the DOM; we just persist to DB.
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    try {
      const uid = await currentUserId();
      await supabase
        .from('profiles')
        .update({ theme_preference: newTheme, updated_at: new Date().toISOString() })
        .eq('id', uid);
      showStatus({ type: 'success', message: `Theme set to ${newTheme}` });
    } catch (err) {
      console.error('Failed to save theme preference:', err);
    }
  };

  // ── Notification update ───────────────────────────────────────────────────
  const handleNotificationUpdate = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const uid = await currentUserId();
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_settings: JSON.parse(JSON.stringify(notificationSettings)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', uid);
      if (error) throw error;
      showStatus({ type: 'success', message: 'Notification preferences updated' });
    } catch (err) {
      showStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update notifications' });
    } finally {
      setSaving(false);
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch {
      showStatus({ type: 'error', message: 'Failed to sign out' });
    }
  };

  // ── Delete account ────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.',
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const uid = await currentUserId();
      const { error } = await supabase.from('profiles').delete().eq('id', uid);
      if (error) throw error;
      await supabase.auth.signOut();
      router.push('/');
    } catch (err) {
      showStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete account' });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-500 dark:text-gray-400">Loading settings…</p>
      </div>
    );
  }

  const themeOptions = [
    { value: 'light' as const,  label: 'Light',  description: 'Always use light theme',              Icon: Sun },
    { value: 'dark' as const,   label: 'Dark',   description: 'Always use dark theme',               Icon: Moon },
    { value: 'system' as const, label: 'System', description: "Follow your device's theme preference", Icon: Monitor },
  ];

  const notifRows = [
    { key: 'email_messages'     as const, label: 'Messages',           desc: 'Email when you receive a new message' },
    { key: 'email_orders'       as const, label: 'Order updates',       desc: 'Email for order status changes' },
    { key: 'email_reviews'      as const, label: 'Reviews',             desc: 'Email when you receive a new review' },
    { key: 'push_notifications' as const, label: 'Push notifications',  desc: 'In-app alerts for all activity' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Manage your account and preferences</p>

        {status && (
          <Alert variant={status.type} className="mb-6">
            <div className="flex items-start gap-2">
              {status.type === 'success'
                ? <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
                : <AlertCircle  className="w-5 h-5 mt-0.5 shrink-0" />}
              <AlertDescription>{status.message}</AlertDescription>
            </div>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <TabsList variant="pills">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          {/* ── Profile Tab ─────────────────────────────────────────── */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </h2>

              {/* Avatar + change-photo shortcut */}
              <div className="flex items-center gap-5 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                <div className="relative">
                  {profileData.profile_image_url ? (
                    <Image
                      src={profileData.profile_image_url}
                      alt="Profile"
                      width={80}
                      height={80}
                      className="rounded-full ring-2 ring-gray-200 dark:ring-gray-700 object-cover"
                    />
                  ) : (
                    <Avatar className="h-20 w-20 ring-2 ring-gray-200 dark:ring-gray-700">
                      <AvatarImage src={undefined} alt={profileData.full_name} />
                      <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
                        {getInitials(profileData.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">
                    {profileData.full_name ?? 'Your Name'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{profileData.email ?? ''}</p>
                  <Link href="/dashboard/profile">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Camera className="w-4 h-4" />
                      Change Photo
                    </Button>
                  </Link>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Upload from your Profile page. JPEG or PNG, max 5 MB.
                  </p>
                </div>
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Full Name</label>
                  <Input
                    value={profileData.full_name || ''}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Email Address</label>
                  <Input
                    type="email"
                    value={profileData.email || ''}
                    disabled
                    className="opacity-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Phone Number</label>
                  <Input
                    value={profileData.phone_number || ''}
                    onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
                    placeholder="+234…"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Location</label>
                  <Input
                    value={profileData.location || ''}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    placeholder="City, State"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Bio</label>
                  <Textarea
                    value={profileData.bio || ''}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    placeholder="Tell us about yourself…"
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

          {/* ── Password Tab ─────────────────────────────────────────── */}
          <TabsContent value="password" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change Password
              </h2>
              <form onSubmit={handlePasswordChange} className="space-y-5 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">New Password</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum 8 characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Confirm Password</label>
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

          {/* ── Appearance Tab ───────────────────────────────────────── */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Appearance</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                Choose how the interface looks. &ldquo;System&rdquo; follows your OS preference.
              </p>

              {/*
               * FIX: Only render interactive buttons after mount.
               * Before mount, `theme` is undefined (SSR), so we render an
               * identical but non-interactive skeleton to prevent flicker.
               */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {themeOptions.map(({ value, label, description, Icon }) => {
                  const isActive = mounted && theme === value;
                  return mounted ? (
                    <button
                      key={value}
                      onClick={() => handleThemeChange(value)}
                      className={`w-full text-left p-4 border-2 rounded-xl transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <Icon className={`w-6 h-6 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                        <span className={`text-sm font-medium ${isActive ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                          {label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
                        {isActive && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      </div>
                    </button>
                  ) : (
                    // Skeleton shown during SSR / before hydration
                    <div
                      key={value}
                      className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl opacity-50"
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <Icon className="w-6 h-6 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live indicator — only meaningful once mounted */}
              {mounted && resolvedTheme && (
                <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                  Currently displaying: <span className="font-medium capitalize">{resolvedTheme}</span> theme
                </p>
              )}
            </Card>
          </TabsContent>

          {/* ── Notifications Tab ────────────────────────────────────── */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </h2>

              <div className="space-y-4">
                {notifRows.map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                    </div>
                    {/* Pill toggle — same pattern as the fixed shorter version */}
                    <button
                      role="switch"
                      aria-checked={notificationSettings[key]}
                      onClick={() =>
                        setNotificationSettings((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        notificationSettings[key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notificationSettings[key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
                <Button onClick={handleNotificationUpdate} loading={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Notification Preferences
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* ── Account Tab ──────────────────────────────────────────── */}
          <TabsContent value="account" className="space-y-6">
            <Card className="p-6 border-red-200 dark:border-red-900">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Account Management</h2>
              <div className="space-y-4">
                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <Button variant="outline" onClick={handleSignOut} className="gap-2">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </Button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Sign out from your current session
                  </p>
                </div>
                <div>
                  <Button variant="destructive" onClick={handleDeleteAccount} loading={saving} className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </Button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Permanently delete your account and all associated data. This cannot be undone.
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