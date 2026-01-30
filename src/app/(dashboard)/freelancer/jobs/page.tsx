import { createClient } from '@/lib/supabase/server';
import { JobCard } from '@/components/jobs/JobCard';
import { Job } from '@/types';
import { Card } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default async function BrowseJobsPage() {
  const supabase = await createClient();
  
  // Fetch open jobs
  const { data: jobs, } = await supabase
    .from('jobs')
    .select(`
      *,
      client:profiles!jobs_client_id_fkey(
        id, full_name, location, client_rating
      )
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Browse Jobs</h1>
          <p className="text-gray-600">Find work that matches your skills</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search jobs..." className="pl-9" />
          </div>
          <Button>Search</Button>
        </div>
      </div>

      <div className="grid gap-6">
        {jobs && jobs.length > 0 ? (
          jobs.map((job) => (
            // Cast to compatible type if needed, or ensure JobCard accepts the query result
            <JobCard key={job.id} job={job as unknown as Job} />
          ))
        ) : (
          <Card className="p-12 text-center">
            <p className="text-gray-500">No open jobs found at the moment.</p>
          </Card>
        )}
      </div>
    </div>
  );
}