// src/components/jobs/CreateJobForm.tsx
// FIXED: Proper type safety, user ID handling, and component design
// Component correctly manages its own authentication state

'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Plus } from 'lucide-react';

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

/**
 * CreateJobForm Component
 * 
 * This component handles job posting form UI and submission.
 * It manages its own authentication state by fetching the current user.
 * 
 * NOTE: This component does NOT accept userId as a prop.
 * Instead, it retrieves the user ID directly from Supabase auth.
 * This is the correct pattern for client components.
 * 
 * Props: None (component is self-contained)
 */
export function CreateJobForm() {
  // ============================================================================
  // Supabase Client Initialization
  // ============================================================================
  // Create Supabase client with public env variables
  // These are safe to expose in the browser
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [skillInput, setSkillInput] = useState('');
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

  // ============================================================================
  // Form Input Handlers
  // ============================================================================
  
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'budget_min' || name === 'budget_max' 
        ? (value ? parseFloat(value) : '') 
        : value,
    }));
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.required_skills.includes(skillInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        required_skills: [...prev.required_skills, skillInput.trim()],
      }));
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      required_skills: prev.required_skills.filter((s) => s !== skill),
    }));
  };

  // ============================================================================
  // Form Submission Handler
  // ============================================================================
  // FIXED: Proper type checking and userId extraction
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get current user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      
      // ✅ FIX: Explicit type check for user and user.id
      // This ensures TypeScript knows user.id is definitely a string
      if (!user || !user.id) {
        alert('You must be logged in to post a job');
        router.push('/auth/login');
        return;
      }

      // ✅ KEY FIX: Extract userId into a variable
      // This makes the type completely explicit when passing to database
      const userId = user.id;

      // Insert job into database with the explicitly typed userId
      const { error } = await supabase.from('jobs').insert({
        client_id: userId,  // ✅ Using extracted variable, not user.id
        title: formData.title,
        description: formData.description,
        category: formData.category,
        subcategory: formData.subcategory || null,
        budget_min: formData.budget_min || null,
        budget_max: formData.budget_max || null,
        budget_type: formData.budget_type,
        required_skills: formData.required_skills,
        experience_level: formData.experience_level,
        estimated_duration: formData.estimated_duration,
        deadline: formData.deadline || null,
        status: 'open',
      });

      if (error) {
        console.error('Supabase error:', error);
        alert(`Error creating job: ${error.message}`);
        return;
      }

      alert('Job posted successfully!');
      router.push('/client/jobs');
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while posting the job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Job Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Job Title *
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          placeholder="e.g., Website Redesign for Student Portfolio"
          required
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Job Description *
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Describe what you need. Be specific about requirements and expectations."
          required
          rows={6}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </div>

      {/* Category & Subcategory */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category *
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Subcategory
          </label>
          <input
            type="text"
            name="subcategory"
            value={formData.subcategory}
            onChange={handleInputChange}
            placeholder="Optional"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Budget */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Budget Information
        </label>

        <div className="mb-4">
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
            Budget Type *
          </label>
          <div className="flex gap-4">
            {(['fixed', 'hourly', 'negotiable'] as const).map((type) => (
              <label key={type} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="budget_type"
                  value={type}
                  checked={formData.budget_type === type}
                  onChange={handleInputChange}
                  className="w-4 h-4"
                />
                <span className="text-sm capitalize">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {formData.budget_type !== 'negotiable' && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                {formData.budget_type === 'hourly' ? 'Rate per Hour' : 'Minimum Budget'} *
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-l-lg">
                  ₦
                </span>
                <input
                  type="number"
                  name="budget_min"
                  value={formData.budget_min}
                  onChange={handleInputChange}
                  required
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {formData.budget_type === 'fixed' && (
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Maximum Budget
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-l-lg">
                    ₦
                  </span>
                  <input
                    type="number"
                    name="budget_max"
                    value={formData.budget_max}
                    onChange={handleInputChange}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Required Skills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Required Skills
        </label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            placeholder="Add a skill..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <Button type="button" onClick={addSkill} variant="outline">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {formData.required_skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.required_skills.map((skill) => (
              <div
                key={skill}
                className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full flex items-center gap-2 text-sm"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Experience Level & Duration */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Experience Level
          </label>
          <select
            name="experience_level"
            value={formData.experience_level}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <option value="any">Any Level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Estimated Duration
          </label>
          <select
            name="estimated_duration"
            value={formData.estimated_duration}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <option value="1-2 days">1-2 days</option>
            <option value="1-2 weeks">1-2 weeks</option>
            <option value="1 month">1 month</option>
            <option value="2-3 months">2-3 months</option>
            <option value="Long term">Long term</option>
          </select>
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Application Deadline (Optional)
        </label>
        <input
          type="date"
          name="deadline"
          value={formData.deadline}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-linear-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
        >
          {loading ? 'Posting Job...' : 'Post Job'}
        </Button>
        <Button type="button" variant="outline" className="flex-1">
          Cancel
        </Button>
      </div>
    </form>
  );
}