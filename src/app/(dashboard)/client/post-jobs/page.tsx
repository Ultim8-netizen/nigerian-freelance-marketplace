// src/app/(dashboard)/client/post-jobs/page.tsx
// Client job posting page

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreateJobForm } from '@/components/jobs/CreateJobForm';
import { Card } from '@/components/ui/card';

export default async function PostJobPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/client/post-jobs');
  }

  // Verify user is a client
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (!profile || !['client', 'both'].includes(profile.user_type)) {
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
        <h3 className="font-semibold mb-3">Tips for Writing Great Job Postings</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>✓ Be specific about what you need</li>
          <li>✓ Include budget range (helps attract right freelancers)</li>
          <li>✓ Set realistic deadlines</li>
          <li>✓ List required skills clearly</li>
          <li>✓ Provide any reference materials or examples</li>
        </ul>
      </Card>
    </div>
  );
}