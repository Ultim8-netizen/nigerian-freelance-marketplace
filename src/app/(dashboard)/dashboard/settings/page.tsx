'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Settings,
  User,
  Lock,
  Bell,
  CreditCard,
  Eye,
  Wallet,
  LogOut,
  Trash2,
  HelpCircle,
  Shield,
  Check,
  AlertCircle,
  ChevronRight,
  Globe,
  Smartphone,
  Mail,
  MapPin,
  BadgeCheck,
  TrendingUp,
  Download,
  Share2,
  Zap,
  Loader,
} from 'lucide-react';

interface SettingItemProps {
  icon?: React.ComponentType<{ size: number; className?: string }>;
  title: string;
  description?: string;
  children: ReactNode;
  highlight?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon: Icon,
  title,
  description,
  children,
  highlight = false,
}) => (
  <div
    className={`p-4 rounded-lg border transition-all ${
      highlight
        ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50'
    }`}
  >
    <div className="flex items-start gap-3">
      {Icon && (
        <Icon
          size={20}
          className="text-blue-600 dark:text-blue-400 mt-1 shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>
        )}
        <div className="mt-3">{children}</div>
      </div>
    </div>
  </div>
);

interface ToggleProps {
  enabled: boolean;
  onChange: () => void;
}

const Toggle: React.FC<ToggleProps> = ({ enabled, onChange }) => (
  <button
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      enabled ? 'bg-linear-to-r from-blue-600 to-purple-600' : 'bg-gray-300 dark:bg-gray-600'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

interface UserData {
  id: string;
  email: string;
  full_name: string;
  location: string;
  university: string;
  liveness_verified: boolean;
  trust_score: number;
  wallet_balance: number;
}

interface SettingsState {
  emailNotifications: boolean;
  pushNotifications: boolean;
  jobAlerts: boolean;
  messageNotifications: boolean;
  promotionalEmails: boolean;
  profileVisibility: string;
  showRatings: boolean;
  showPortfolio: boolean;
  allowDirectMessages: boolean;
  twoFactorEnabled: boolean;
  withdrawalApproval: boolean;
  autoRejectLowOffers: boolean;
  autoAcceptTopMatches: boolean;
  currency: string;
  language: string;
  timezone: string;
  darkMode: boolean;
  soundEffects: boolean;
  animationsEnabled: boolean;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('account');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsState>({
    emailNotifications: true,
    pushNotifications: true,
    jobAlerts: true,
    messageNotifications: true,
    promotionalEmails: false,
    profileVisibility: 'public',
    showRatings: true,
    showPortfolio: true,
    allowDirectMessages: true,
    twoFactorEnabled: false,
    withdrawalApproval: true,
    autoRejectLowOffers: false,
    autoAcceptTopMatches: false,
    currency: 'NGN',
    language: 'en',
    timezone: 'WAT',
    darkMode: false,
    soundEffects: true,
    animationsEnabled: true,
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, location, university, liveness_verified, trust_score')
          .eq('id', user.id)
          .single();

        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setUserData({
            id: user.id,
            email: user.email || '',
            full_name: profile.full_name || '',
            location: profile.location || 'Not set',
            university: profile.university || '',
            liveness_verified: profile.liveness_verified || false,
            trust_score: profile.trust_score || 0,
            wallet_balance: wallet?.balance || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const toggleSetting = (key: keyof SettingsState): void => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectChange = (key: keyof SettingsState, value: string): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'privacy', label: 'Privacy & Security', icon: Lock },
    { id: 'preferences', label: 'Preferences', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-950 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-linear-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg">
            <Settings
              className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              size={24}
            />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-linear-to-r from-blue-700 via-purple-700 to-red-600 dark:from-blue-400 dark:via-purple-400 dark:to-red-400 bg-clip-text text-transparent">
              Account Settings
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage your F9 account, preferences, and security
            </p>
          </div>
        </div>

        {/* Trust Score Banner */}
        <div className="mt-6 p-4 rounded-lg bg-linear-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border border-red-200 dark:border-red-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-red-600 dark:text-red-400" size={20} />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-300 text-sm">
                Your Trust Score
              </h3>
              <p className="text-xs text-red-700 dark:text-red-400">
                Build credibility by completing verifications
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold bg-linear-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent">
              {userData?.trust_score || 0}/100
            </div>
            <p className="text-xs text-red-600 dark:text-red-400">
              {(userData?.trust_score || 0) >= 70 ? 'Excellent' : (userData?.trust_score || 0) >= 40 ? 'Good' : 'Building'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left text-sm font-medium ${
                    activeTab === tab.id
                      ? 'bg-linear-to-r from-blue-600 via-purple-600 to-red-600 text-white shadow-lg shadow-purple-500/50 dark:shadow-purple-800/50'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-linear-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                  {activeTab === tab.id && (
                    <ChevronRight size={16} className="ml-auto" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-4">
          <div className="space-y-6">
            {/* Account Tab */}
            {activeTab === 'account' && (
              <>
                <SettingItem
                  icon={BadgeCheck}
                  title="Email Address"
                  description="Your primary account email"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {userData?.email || 'Loading...'}
                    </div>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                      Change
                    </button>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={User}
                  title="Profile Information"
                  description="Update your name, bio, and university"
                >
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Full Name"
                      defaultValue={userData?.full_name || ''}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                    />
                    <input
                      type="text"
                      placeholder="University/Institution"
                      defaultValue={userData?.university || ''}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                    />
                    <textarea
                      placeholder="Bio (100 chars max)"
                      maxLength={100}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 resize-none"
                      rows={3}
                    />
                    <button className="text-sm px-4 py-2 rounded-lg bg-linear-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg">
                      Save Changes
                    </button>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={BadgeCheck}
                  title="Liveness Verification"
                  description="AI-powered identity confirmation"
                  highlight
                >
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                      {userData?.liveness_verified ? (
                        <Check size={18} className="text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertCircle size={18} className="text-yellow-600 dark:text-yellow-400" />
                      )}
                      <div className="text-sm">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {userData?.liveness_verified ? 'Verified' : 'Not Verified'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {userData?.liveness_verified ? 'Last verified today' : 'Complete verification to build trust'}
                        </p>
                      </div>
                    </div>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors">
                      {userData?.liveness_verified ? 'Re-verify' : 'Verify Now'}
                    </button>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={MapPin}
                  title="Location Settings"
                  description="Default city for local transactions"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Current Location: <span className="text-blue-600 dark:text-blue-400">{userData?.location}</span>
                    </p>
                    <select className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400">
                      <option>Lagos, Lagos State</option>
                      <option>Abuja, FCT</option>
                      <option>Ibadan, Oyo State</option>
                      <option>Kano, Kano State</option>
                    </select>
                  </div>
                </SettingItem>
              </>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <>
                <SettingItem
                  icon={Bell}
                  title="Email Notifications"
                  description="Receive updates via email"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        New job matches
                      </span>
                      <Toggle
                        enabled={settings.jobAlerts}
                        onChange={() => toggleSetting('jobAlerts')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Messages & bids
                      </span>
                      <Toggle
                        enabled={settings.messageNotifications}
                        onChange={() => toggleSetting('messageNotifications')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Promotional offers
                      </span>
                      <Toggle
                        enabled={settings.promotionalEmails}
                        onChange={() => toggleSetting('promotionalEmails')}
                      />
                    </div>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={Smartphone}
                  title="Push Notifications"
                  description="Mobile app alerts"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Enable all notifications
                      </span>
                      <Toggle
                        enabled={settings.pushNotifications}
                        onChange={() => toggleSetting('pushNotifications')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Message notifications
                      </span>
                      <Toggle
                        enabled={settings.messageNotifications}
                        onChange={() => toggleSetting('messageNotifications')}
                      />
                    </div>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={Mail}
                  title="Notification Frequency"
                  description="How often to receive digest emails"
                >
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400">
                    <option>Real-time</option>
                    <option>Daily digest</option>
                    <option>Weekly digest</option>
                    <option>Never</option>
                  </select>
                </SettingItem>
              </>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <>
                <SettingItem
                  icon={Wallet}
                  title="Wallet Balance"
                  description="Your current F9 balance"
                >
                  <div className="p-4 rounded-lg bg-linear-to-br from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="text-3xl font-bold bg-linear-to-r from-blue-700 to-purple-700 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent mb-2">
                      ₦{(userData?.wallet_balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex gap-2">
                      <button className="text-sm px-4 py-2 rounded-lg bg-linear-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-md">
                        Withdraw Funds
                      </button>
                      <button className="text-sm px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors font-medium">
                        Fund Wallet
                      </button>
                    </div>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={CreditCard}
                  title="Payment Methods"
                  description="Manage your payment sources"
                >
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-between bg-white dark:bg-gray-700/50">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Guaranty Trust Bank • •• •• 4562
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Primary
                        </p>
                      </div>
                      <button className="text-xs px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors">
                        Edit
                      </button>
                    </div>
                    <button className="w-full text-sm px-4 py-2 rounded-lg border border-purple-600 dark:border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors font-medium">
                      + Add Payment Method
                    </button>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={Download}
                  title="Withdrawal Settings"
                  description="Control how you receive payments"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Require approval for withdrawals
                      </span>
                      <Toggle
                        enabled={settings.withdrawalApproval}
                        onChange={() => toggleSetting('withdrawalApproval')}
                      />
                    </div>
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Minimum withdrawal: ₦1,000
                      </p>
                      <select className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400">
                        <option>Auto-withdraw on Fridays</option>
                        <option>Withdraw on demand</option>
                      </select>
                    </div>
                  </div>
                </SettingItem>
              </>
            )}

            {/* Privacy & Security Tab */}
            {activeTab === 'privacy' && (
              <>
                <SettingItem
                  icon={Lock}
                  title="Password"
                  description="Change your account password"
                >
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="Current password"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                    />
                    <input
                      type="password"
                      placeholder="Confirm password"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                    />
                    <button className="text-sm px-4 py-2 rounded-lg bg-linear-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-md">
                      Update Password
                    </button>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={Shield}
                  title="Two-Factor Authentication"
                  description="Add an extra security layer"
                >
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-300 dark:border-gray-600">
                    <div className="flex items-center gap-2">
                      {!settings.twoFactorEnabled && (
                        <AlertCircle
                          size={18}
                          className="text-red-600 dark:text-red-400"
                        />
                      )}
                      {settings.twoFactorEnabled && (
                        <Check
                          size={18}
                          className="text-green-600 dark:text-green-400"
                        />
                      )}
                      <div className="text-sm">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {settings.twoFactorEnabled ? 'Enabled' : 'Not enabled'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Use authenticator app
                        </p>
                      </div>
                    </div>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors">
                      {settings.twoFactorEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={Eye}
                  title="Profile Visibility"
                  description="Who can see your profile"
                >
                  <div className="space-y-2">
                    {['public', 'verified_only', 'private'].map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="visibility"
                          value={option}
                          checked={settings.profileVisibility === option}
                          onChange={() => handleSelectChange('profileVisibility', option)}
                          className="accent-purple-600 dark:accent-purple-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {option.replace('_', ' ')}
                          </span>
                      </label>
                    ))}
                  </div>
                </SettingItem>

                <SettingItem
                  icon={Share2}
                  title="Data & Privacy"
                  description="Control what data is shared"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Allow portfolio display
                      </span>
                      <Toggle
                        enabled={settings.showPortfolio}
                        onChange={() => toggleSetting('showPortfolio')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Show rating publicly
                      </span>
                      <Toggle
                        enabled={settings.showRatings}
                        onChange={() => toggleSetting('showRatings')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Accept direct messages
                      </span>
                      <Toggle
                        enabled={settings.allowDirectMessages}
                        onChange={() => toggleSetting('allowDirectMessages')}
                      />
                    </div>
                  </div>
                </SettingItem>
              </>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <>
                <SettingItem
                  icon={Globe}
                  title="Language & Localization"
                  description="Set your preferred language"
                >
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                        Language
                      </label>
                      <select
                        value={settings.language}
                        onChange={(e) => handleSelectChange('language', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                      >
                        <option value="en">English</option>
                        <option value="yo">Yoruba</option>
                        <option value="ha">Hausa</option>
                        <option value="ig">Igbo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                        Currency
                      </label>
                      <select
                        value={settings.currency}
                        onChange={(e) => handleSelectChange('currency', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                      >
                        <option value="NGN">Nigerian Naira (₦)</option>
                        <option value="USD">US Dollar ($)</option>
                      </select>
                    </div>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={Zap}
                  title="Display & Theme"
                  description="Customize your interface"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Dark mode
                      </span>
                      <Toggle
                        enabled={settings.darkMode}
                        onChange={() => toggleSetting('darkMode')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Animations
                      </span>
                      <Toggle
                        enabled={settings.animationsEnabled}
                        onChange={() => toggleSetting('animationsEnabled')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Sound effects
                      </span>
                      <Toggle
                        enabled={settings.soundEffects}
                        onChange={() => toggleSetting('soundEffects')}
                      />
                    </div>
                  </div>
                </SettingItem>

                <SettingItem
                  icon={Zap}
                  title="Work Preferences"
                  description="Smart matching settings"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Auto-accept top matches
                      </span>
                      <Toggle
                        enabled={settings.autoAcceptTopMatches}
                        onChange={() => toggleSetting('autoAcceptTopMatches')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Auto-reject low offers
                      </span>
                      <Toggle
                        enabled={settings.autoRejectLowOffers}
                        onChange={() => toggleSetting('autoRejectLowOffers')}
                      />
                    </div>
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Minimum offer threshold
                      </p>
                      <input
                        type="number"
                        placeholder="₦"
                        defaultValue="5000"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                      />
                    </div>
                  </div>
                </SettingItem>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2.5 rounded-lg bg-linear-to-r from-blue-600 via-purple-600 to-red-600 text-white hover:from-blue-700 hover:via-purple-700 hover:to-red-700 transition-all font-medium text-sm shadow-md hover:shadow-lg">
                Save All Changes
              </button>
              <button className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium text-sm">
                Discard
              </button>
            </div>

            <div className="pt-4 space-y-2 border-t border-gray-200 dark:border-gray-700">
              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors flex items-center gap-2">
                <HelpCircle size={16} /> Help & Support
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2">
                <LogOut size={16} /> Sign Out
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2">
                <Trash2 size={16} /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}