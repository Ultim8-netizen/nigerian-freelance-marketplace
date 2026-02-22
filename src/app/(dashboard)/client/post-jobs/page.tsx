// src/app/(dashboard)/client/post-jobs/page.tsx
// Client job posting page

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreateJobForm } from '@/components/jobs/CreateJobForm';
import { Card } from '@/components/ui/card';

/**
 * TYPESCRIPT FIX: Non-null assertion operator (!) after runtime verification
 * 
 * Failed attempts documented:
 * 1. Variable extraction: const userId = user.id (TypeScript still sees null)
 * 2. Type assertion: user.id as string (Error persists)
 * 
 * Working solution: user.id! after null check
 * This is standard Next.js pattern for TypeScript limitation #12825
 */
export default async function PostJobPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Auth check - redirect if no user ID
  if (!user?.id) {
    redirect('/login?redirect=/client/post-jobs');
  }

  // Fetch profile - using non-null assertion (!) because we verified above
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id!)  // ← THE FIX: ! operator tells TS this is not null
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    redirect('/dashboard');
  }

  // Check permissions
  if (!profile || !['client', 'both'].includes(profile.user_type!)) {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Post a Job</h1>
        <p className="text-gray-600">
          Describe your project and receive proposals from talented freelancers
        </p>
      </div>

      <Card className="p-8">
        <CreateJobForm />
      </Card>

      <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-3">
          Tips for Writing Great Job Postings
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>✓ Be specific about what you need and your project goals</li>
          <li>✓ Include a realistic budget range to attract the right freelancers</li>
          <li>✓ Set achievable deadlines based on project complexity</li>
          <li>✓ List required skills clearly and specifically</li>
          <li>✓ Provide reference materials, examples, or mockups if available</li>
          <li>✓ Explain your company/project background briefly</li>
        </ul>
      </Card>
    </div>
  );
}