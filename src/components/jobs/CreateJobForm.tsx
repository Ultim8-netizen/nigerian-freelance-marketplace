'use client';
// src/components/jobs/CreateJobForm.tsx
// FIXED:
// 1. Radio button <span> labels ("fixed", "hourly", "negotiable") had NO color class at all
//    → they rendered transparent/invisible. Added explicit text-gray-900 dark:text-white.
// 2. Budget card labels ("Budget Information", "Budget Type *", "Minimum Budget *",
//    "Maximum Budget", "Required Skills", "Estimated Duration", "Experience Level")
//    were text-gray-700 on bg-blue-50 — low contrast. Bumped to text-gray-900 dark:text-white.
// 3. Supabase client was being re-instantiated on every render (inside component body, 
//    not memoized). Moved to module level — one client per module, not per render.
// 4. App crash after posting: was caused by badge.tsx missing 'use client' (already fixed
//    in that file). The crash here was downstream of that, not this file's fault.
// 5. Cancel button now actually navigates back instead of doing nothing.
// 6. Direct supabase.from('jobs').insert call replaced with fetch('/api/jobs') to go
//    through the proper API endpoint.
// 7. Added restriction state + ContestButton rendering for 403 restriction responses.

import React, { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Plus, AlertCircle } from 'lucide-react';
import { ContestButton } from '@/components/admin/ContestButton';

// FIXED: Module-level client — one instance, not re-created on every render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface JobFormData {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  budget_min: number | '';
  budget_max: number | '';
  budget_type: 'fixed' | 'hourly' | 'negotiable';
  required_skills: string[];
  experience_level: 'beginner' | 'intermediate' | 'expert' | 'any';
  estimated_duration: string;
  deadline: string;
}

const CATEGORIES = [
  'Writing & Content',
  'Design & Creative',
  'Programming & Development',
  'Marketing & Sales',
  'Business & Consulting',
  'Video & Animation',
  'Audio & Music',
  'Tutoring & Education',
  'Translation',
  'Administrative Support',
];

// Shared input class — explicit bg + text color so nothing is ever invisible
const inputClass =
  'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg ' +
  'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
  'placeholder-gray-400 dark:placeholder-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ' +
  'transition-colors';

// Shared label class — strong enough contrast in both modes
const labelClass = 'block text-sm font-semibold text-gray-900 dark:text-white mb-1.5';
const sublabelClass = 'block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5';

export function CreateJobForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState('');

  // NEW: restriction state for 403 responses from /api/jobs
  const [restriction, setRestriction] = useState<{ type: string; reason: string } | null>(null);

  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    description: '',
    category: '',
    subcategory: '',
    budget_min: '',
    budget_max: '',
    budget_type: 'fixed',
    required_skills: [],
    experience_level: 'any',
    estimated_duration: '1-2 weeks',
    deadline: '',
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]:
          name === 'budget_min' || name === 'budget_max'
            ? value
              ? parseFloat(value)
              : ''
            : value,
      }));
    },
    []
  );

  const addSkill = useCallback(() => {
    const trimmed = skillInput.trim();
    if (trimmed && !formData.required_skills.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        required_skills: [...prev.required_skills, trimmed],
      }));
      setSkillInput('');
    }
  }, [skillInput, formData.required_skills]);

  const removeSkill = useCallback((skill: string) => {
    setFormData((prev) => ({
      ...prev,
      required_skills: prev.required_skills.filter((s) => s !== skill),
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRestriction(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setError('You must be logged in to post a job.');
        router.push('/login?redirect=/client/post-job');
        return;
      }

      // FIXED: replaced direct supabase.from('jobs').insert(...) with a proper
      // fetch call to /api/jobs so the request goes through the API layer.
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      // Handle 403 restriction responses
      if (response.status === 403) {
        if (result.restrictionType) {
          setRestriction({ type: result.restrictionType, reason: result.error });
          return;
        }
        setError(result.error ?? 'You are not allowed to post jobs at this time.');
        return;
      }

      if (!response.ok) {
        console.error('API error:', result);
        setError(result.error ?? `Error posting job (${response.status}). Please try again.`);
        return;
      }

      router.push('/client/jobs?success=job_posted');
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
        </div>
      )}

      {/* Restriction banner — shown when API returns a 403 with a restrictionType */}
      {restriction && (
        <div className="flex flex-col gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
              {restriction.reason}
            </p>
          </div>
          <ContestButton actionContested={restriction.type} />
        </div>
      )}

      {/* ── Job Title ── */}
      <div>
        <label className={labelClass} htmlFor="title">
          Job Title *
        </label>
        <input
          id="title"
          type="text"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          placeholder="e.g., Website Redesign for Student Portfolio"
          required
          className={inputClass}
        />
      </div>

      {/* ── Description ── */}
      <div>
        <label className={labelClass} htmlFor="description">
          Job Description *
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Describe what you need. Be specific about requirements and expectations."
          required
          rows={6}
          className={inputClass + ' resize-none'}
        />
      </div>

      {/* ── Category & Subcategory ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="category">
            Category *
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            required
            className={inputClass}
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="subcategory">
            Subcategory
          </label>
          <input
            id="subcategory"
            type="text"
            name="subcategory"
            value={formData.subcategory}
            onChange={handleInputChange}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
      </div>

      {/* ── Budget ── */}
      {/* FIXED: Card now uses white/gray-50 background with strong label text so 
          "Budget Information", "Budget Type *", "Minimum Budget *" etc. are all legible */}
      <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        {/* Section heading */}
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
          Budget Information
        </h3>

        {/* Budget Type */}
        <div className="mb-5">
          <label className={sublabelClass}>
            Budget Type *
          </label>
          {/* FIXED: radio <span> labels now have explicit text-gray-900 dark:text-white 
              Previously had NO color class → rendered as transparent/invisible */}
          <div className="flex gap-6 mt-1">
            {(['fixed', 'hourly', 'negotiable'] as const).map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <input
                  type="radio"
                  name="budget_type"
                  value={type}
                  checked={formData.budget_type === type}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-500 focus:ring-blue-500"
                />
                {/* FIXED: added text-gray-900 dark:text-white — was completely missing before */}
                <span className="text-sm font-medium capitalize text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {type}
                </span>
              </label>
            ))}
          </div>
        </div>

        {formData.budget_type !== 'negotiable' && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              {/* FIXED: label text upgraded to text-gray-900 from text-gray-700 */}
              <label className={sublabelClass}>
                {formData.budget_type === 'hourly' ? 'Rate per Hour (₦)' : 'Minimum Budget (₦)'}{' '}
                *
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2.5 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-600 select-none">
                  ₦
                </span>
                <input
                  type="number"
                  name="budget_min"
                  value={formData.budget_min}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="100"
                  placeholder="0"
                  className={
                    'flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 ' +
                    'rounded-r-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
                    'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  }
                />
              </div>
            </div>

            {formData.budget_type === 'fixed' && (
              <div>
                <label className={sublabelClass}>
                  Maximum Budget (₦)
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-2.5 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-600 select-none">
                    ₦
                  </span>
                  <input
                    type="number"
                    name="budget_max"
                    value={formData.budget_max}
                    onChange={handleInputChange}
                    min="0"
                    step="100"
                    placeholder="0"
                    className={
                      'flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 ' +
                      'rounded-r-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
                      'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Required Skills ── */}
      <div>
        <label className={labelClass}>Required Skills</label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="Type a skill and press Enter or click +"
            className={inputClass}
          />
          <Button type="button" onClick={addSkill} variant="outline" className="shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {formData.required_skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.required_skills.map((skill) => (
              <div
                key={skill}
                className="inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700 px-3 py-1 rounded-full text-sm font-medium"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="ml-0.5 hover:text-blue-700 dark:hover:text-blue-100 transition-colors"
                  aria-label={`Remove ${skill}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Experience Level & Duration ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="experience_level">
            Experience Level
          </label>
          <select
            id="experience_level"
            name="experience_level"
            value={formData.experience_level}
            onChange={handleInputChange}
            className={inputClass}
          >
            <option value="any">Any Level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="estimated_duration">
            Estimated Duration
          </label>
          <select
            id="estimated_duration"
            name="estimated_duration"
            value={formData.estimated_duration}
            onChange={handleInputChange}
            className={inputClass}
          >
            <option value="1-2 days">1–2 days</option>
            <option value="1-2 weeks">1–2 weeks</option>
            <option value="1 month">1 month</option>
            <option value="2-3 months">2–3 months</option>
            <option value="Long term">Long term</option>
          </select>
        </div>
      </div>

      {/* ── Deadline ── */}
      <div>
        <label className={labelClass} htmlFor="deadline">
          Application Deadline{' '}
          <span className="text-gray-500 dark:text-gray-400 font-normal">(Optional)</span>
        </label>
        <input
          id="deadline"
          type="date"
          name="deadline"
          value={formData.deadline}
          onChange={handleInputChange}
          min={new Date().toISOString().split('T')[0]}
          className={inputClass}
        />
      </div>

      {/* ── Submit ── */}
      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Posting Job...
            </span>
          ) : (
            'Post Job'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}