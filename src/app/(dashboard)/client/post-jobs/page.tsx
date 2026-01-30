// src/app/(dashboard)/client/post-jobs/page.tsx
// Client job posting page - PRODUCTION READY WITH ALL FIXES APPLIED

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreateJobForm } from '@/components/jobs/CreateJobForm';
import { Card } from '@/components/ui/card';

/**
 * PostJobPage - Server Component
 * 
 * This page allows authenticated clients to create and post new jobs.
 * 
 * FIXES APPLIED:
 * 1. Extract userId to variable before using in queries
 *    - Fixes: "string | null is not assignable to string" error
 *    - Why: Supabase .eq() method doesn't inherit TypeScript type narrowing
 * 
 * 2. Don't pass userId to CreateJobForm component
 *    - Fixes: "Property 'userId' does not exist on type 'IntrinsicAttributes'"
 *    - Why: CreateJobForm is self-contained and retrieves user from auth internally
 * 
 * TYPE SAFETY:
 * - User authentication is checked before accessing user.id
 * - user.id is extracted to a typed variable before database operations
 * - All Supabase queries receive clearly typed userId (not string | null)
 */
export default async function PostJobPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ============================================================================
  // AUTHENTICATION CHECK - FIX #1: Explicit type checking
  // ============================================================================
  // Check that both user exists AND user.id is not null/undefined
  // This is more explicit than optional chaining guard (!user?.id)
  // because it properly narrows the type for TypeScript
  
  if (!user || !user.id) {
    return redirect('/login?redirect=/client/post-jobs');
  }

  // ============================================================================
  // CRITICAL FIX #2: Extract userId to variable BEFORE using
  // ============================================================================
  // This is the KEY to fixing the ".eq('id', user.id)" type error.
  // 
  // Why this works:
  // - Explicit variable assignment makes TypeScript confident about the type
  // - userId is now type 'string' (not 'string | null')
  // - When passed to .eq(), Supabase receives clearly typed string
  // - No type ambiguity through method chains
  // 
  // Alternative would be to use non-null assertion: user.id!
  // But extracting to a variable is cleaner and more readable
  
  const userId = user.id;

  // ============================================================================
  // VERIFY USER PERMISSIONS - Using extracted userId for type safety
  // ============================================================================
  // Get user profile to verify they have client permissions
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', userId)  // ✅ FIX APPLIED: Using extracted userId variable, NOT user.id
    .single();

  // Handle profile fetch error
  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return redirect('/dashboard');
  }

  // Check if user has client permissions
  if (!profile || !['client', 'both'].includes(profile.user_type)) {
    return redirect('/dashboard');
  }

  // ============================================================================
  // COMPONENT RENDER
  // ============================================================================
  // At this point, we have guaranteed:
  // 1. User is authenticated with valid ID
  // 2. userId is extracted and type-safe (string, not string | null)
  // 3. User has client permissions (profile.user_type is 'client' or 'both')

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Post a Job</h1>
        <p className="text-gray-600">
          Describe your project and receive proposals from talented freelancers
        </p>
      </div>

      {/* Job Creation Form Card */}
      <Card className="p-8">
        {/* 
          FIX #3: CreateJobForm is self-contained
          
          ✅ CORRECT PATTERN:
          - Do NOT pass userId as prop
          - CreateJobForm retrieves user from auth internally
          - Component manages its own authentication state
          
          ❌ WRONG PATTERN (what we had before):
          - <CreateJobForm userId={userId} />
          - Creates prop mismatch error
          - Component doesn't define userId in props interface
          - Couples component to parent data
          
          BENEFITS OF CORRECT PATTERN:
          - Form is truly self-contained and reusable
          - No prop drilling through component tree
          - Each component owns its authentication state
          - Clearer component responsibility
          - Easier to test independently
          - Better separation of concerns
        */}
        <CreateJobForm />
      </Card>

      {/* Tips Card */}
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