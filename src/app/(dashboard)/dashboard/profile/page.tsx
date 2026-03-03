'use client';

// src/app/(dashboard)/dashboard/profile/page.tsx
// Full profile edit page with Cloudinary image upload.
// FIXES:
//  - Settings page "Change Profile Photo" now links here
//  - This page previously lacked image upload functionality
//  - Cloudinary upload is handled by the reusable ProfileImageUpload component

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alerts';
import { ProfileImageUpload } from '@/components/profile/ProfileImageUpload';
import { NIGERIAN_STATES } from '@/types/location.types';
import { Save, CheckCircle, AlertCircle, ArrowLeft, Shield, Star, Briefcase } from 'lucide-react';
import Link from 'next/link';
import type { Profile } from '@/types';

interface ProfileFormState {
  full_name: string;
  bio: string;
  location: string;
  phone_number: string;
  university: string;
  profile_image_url: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileFormState>({
    full_name: '',
    bio: '',
    location: '',
    phone_number: '',
    university: '',
    profile_image_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Load profile ──────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) { router.push('/login'); return; }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile(data as unknown as Profile);
        setForm({
          full_name: data.full_name ?? '',
          bio: data.bio ?? '',
          location: data.location ?? '',
          phone_number: data.phone_number ?? '',
          university: data.university ?? '',
          profile_image_url: data.profile_image_url ?? '',
        });
      }
    } catch (err) {
      setStatus({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Failed to load profile. Please refresh.' 
      });
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Cloudinary upload callback ────────────────────────────────────────────
  // Called immediately when upload completes — saves the new URL to Supabase
  // so it persists even if the user doesn't click "Save Profile".
  const handleImageUploaded = async (url: string) => {
    setForm((prev) => ({ ...prev, profile_image_url: url }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          profile_image_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setStatus({ type: 'success', message: 'Profile photo updated!' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Photo saved locally but failed to sync. Save profile to persist.',
      });
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setStatus({ type: 'error', message: 'Full name is required.' });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          bio: form.bio.trim() || null,
          location: form.location.trim() || null,
          phone_number: form.phone_number.trim() || null,
          university: form.university.trim() || null,
          profile_image_url: form.profile_image_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setStatus({ type: 'success', message: 'Profile updated successfully!' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm" className="gap-2 pl-0 hover:pl-2 transition-all mb-3">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Profile</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Update your public profile information
        </p>
      </div>

      {/* Trust & Verification badges */}
      {profile && (
        <div className="flex flex-wrap gap-2 mb-6">
          {profile.email_verified && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3" /> Email Verified
            </span>
          )}
          {profile.liveness_verified && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              <Shield className="w-3 h-3" /> Identity Verified
            </span>
          )}
          {(profile.freelancer_rating ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
              <Star className="w-3 h-3" /> {(profile.freelancer_rating ?? 0).toFixed(1)} Rating
            </span>
          )}
          {(profile.total_jobs_completed ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              <Briefcase className="w-3 h-3" /> {profile.total_jobs_completed} Jobs Completed
            </span>
          )}
        </div>
      )}

      {status && (
        <Alert variant={status.type} className="mb-6">
          <div className="flex items-start gap-2">
            {status.type === 'success' ? (
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <AlertDescription>{status.message}</AlertDescription>
          </div>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Profile Photo ──────────────────────────────────────────────── */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Photo</h2>
          <ProfileImageUpload
            currentImageUrl={form.profile_image_url || null}
            displayName={form.full_name}
            onUploadComplete={handleImageUploaded}
            size={112}
          />
        </Card>

        {/* ── Basic Info ─────────────────────────────────────────────────── */}
        <Card className="p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Your full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Bio
            </label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Tell clients about yourself — your skills, experience, and what makes you stand out."
              className="min-h-28"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{form.bio.length}/500 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Phone Number
            </label>
            <Input
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="+234 800 000 0000"
              type="tel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              University / School
            </label>
            <Input
              value={form.university}
              onChange={(e) => setForm({ ...form, university: e.target.value })}
              placeholder="e.g. University of Lagos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              State
            </label>
            <select
              value={form.location.split(',')[0]?.trim() ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  location: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="">Select state</option>
              {NIGERIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* ── Save Button ────────────────────────────────────────────────── */}
        <div className="flex gap-4">
          <Button type="submit" loading={saving} className="gap-2 flex-1 sm:flex-none">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}