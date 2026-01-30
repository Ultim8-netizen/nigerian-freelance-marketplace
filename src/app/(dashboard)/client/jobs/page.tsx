// src/app/(dashboard)/client/jobs/page.tsx
// Client's posted jobs management

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Plus, Users, Eye, Clock } from 'lucide-react';
import type { Job as BaseJob } from '@/types';

// Extended type to match the actual query response
type JobWithProposals = BaseJob & {
  proposals: Array<{ count: number }>;
};

export default async function ClientJobsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Get all jobs posted by client
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      *,
      proposals(count)
    `)
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    const colors: Record<string, string> = {
      open: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Job Posts</h1>
          <p className="text-gray-600">Manage your job listings and proposals</p>
        </div>
        <Link href="/jobs/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Post New Job
          </Button>
        </Link>
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((job: JobWithProposals) => (
            <Card key={job.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold">{job.title}</h2>
                    <Badge className={getStatusColor(job.status)}>
                      {job.status || 'Unknown'}
                    </Badge>
                  </div>
                  <p className="text-gray-600 mb-4 line-clamp-2">{job.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">{job.proposals_count || 0} proposals</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{job.views_count || 0} views</span>
                    </div>
                    {job.budget_min && (
                      <div className="flex items-center gap-1">
                        <span>Budget: {formatCurrency(job.budget_min)}</span>
                      </div>
                    )}
                    {job.created_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>Posted {formatRelativeTime(job.created_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <Link href={`/client/jobs/${job.id}`}>
                  <Button variant="outline">
                    View Details
                  </Button>
                </Link>
              </div>

              {job.required_skills && job.required_skills.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {job.required_skills.slice(0, 5).map((skill: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                  {job.required_skills.length > 5 && (
                    <Badge variant="outline">
                      +{job.required_skills.length - 5} more
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Jobs Posted Yet</h3>
            <p className="text-gray-600 mb-6">
              Start by posting your first job and receive proposals from talented Nigerian freelancers
            </p>
            <Link href="/jobs/new">
              <Button>Post Your First Job</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}