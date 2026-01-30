// src/app/(dashboard)/client/dashboard/page.tsx
// FIXED: Proper type handling for Order with freelancer relation and nullable status

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Briefcase, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { 
  Job, 
  Order, 
  Profile, 
} from '@/types'; 

type TotalSpent = { amount: number };

// FIXED: Define proper type for Order with freelancer relation
type OrderWithFreelancer = Order & {
  freelancer: Profile | null;
};

export default async function ClientDashboard() {
  const supabase = await createClient(); 
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null }; 

  // Get active jobs
  const { data: activeJobs, count: activeJobsCount } = await supabase
    .from('jobs')
    .select('*, proposals_count:proposals(count)', { count: 'exact' }) 
    .eq('client_id', user.id)
    .eq('status', 'open') as { data: (Job & { proposals_count: number | null })[] | null, count: number | null };
  
  // Get ongoing orders - FIXED: Properly type the result with freelancer relation
  const { data: ongoingOrders, count: ongoingCount } = await supabase
    .from('orders')
    .select('*, freelancer:profiles!orders_freelancer_id_fkey(*)', { count: 'exact' })
    .eq('client_id', user.id)
    .in('status', ['awaiting_delivery', 'delivered']) as { data: OrderWithFreelancer[] | null, count: number | null };

  // Get completed orders
  const { count: completedCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', user.id)
    .eq('status', 'completed');

  // Get pending proposals
  const { count: proposalsCount } = await supabase
    .from('proposals')
    .select(`
      *,
      job:jobs!proposals_job_id_fkey(client_id)
    `, { count: 'exact', head: true })
    .eq('job.client_id', user.id) 
    .eq('status', 'pending');

  // Calculate total spent
  const { data: totalSpent } = await supabase
    .from('orders')
    .select('amount')
    .eq('client_id', user.id)
    .in('status', ['completed', 'awaiting_delivery', 'delivered']) as { data: TotalSpent[] | null };

  const totalAmount = totalSpent?.reduce((sum: number, order: TotalSpent) => sum + order.amount, 0) || 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {profile?.full_name}!</h1>
        <p className="text-gray-600">Manage your projects and find talented freelancers</p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Briefcase className="w-6 h-6" />}
          title="Active Jobs"
          value={activeJobsCount?.toString() || '0'}
          color="bg-blue-500"
          subtitle={`${proposalsCount || 0} new proposals`} 
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          title="Ongoing Orders"
          value={ongoingCount?.toString() || '0'}
          color="bg-orange-500"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6" />}
          title="Completed"
          value={completedCount?.toString() || '0'}
          color="bg-green-500"
        />
        <StatCard
          icon={<Users className="w-6 h-6" />}
          title="Total Spent"
          value={formatCurrency(totalAmount)}
          color="bg-purple-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/jobs/new">
              <Button className="w-full">Post a New Job</Button>
            </Link>
            <Link href="/services">
              <Button variant="outline" className="w-full">Browse Services</Button>
            </Link>
            <Link href="/client/jobs">
              <Button variant="outline" className="w-full">View My Jobs</Button>
            </Link>
            <Link href="/client/orders">
              <Button variant="outline" className="w-full">Manage Orders</Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          {ongoingOrders && ongoingOrders.length > 0 ? (
            <div className="space-y-3">
              {ongoingOrders.slice(0, 3).map((order: OrderWithFreelancer) => ( 
                <div key={order.id} className="border-l-4 border-blue-500 pl-3 py-2">
                  <p className="font-medium">{order.title}</p>
                  <p className="text-sm text-gray-600">
                    {/* FIXED: Now properly accessing freelancer relation */}
                    With {order.freelancer?.full_name || 'Unknown freelancer'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {/* FIXED: Handle nullable status properly */}
                    Status: {order.status ? order.status.replace('_', ' ') : 'Unknown'}
                  </p>
                </div>
              ))}
              {ongoingOrders.length > 3 && (
                <Link href="/client/orders">
                  <Button variant="ghost" size="sm" className="w-full">
                    View all orders
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No active orders</p>
              <Link href="/services">
                <Button variant="outline" size="sm">Browse Services</Button>
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Active Jobs with Proposals */}
      {activeJobs && activeJobs.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Your Active Job Posts</h2>
          <div className="space-y-4">
            {activeJobs.map((job: Job & { proposals_count: number | null }) => ( 
              <div key={job.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{job.title}</h3>
                  <span className="text-sm text-blue-600 font-medium">
                    {job.proposals_count || 0} proposals 
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{job.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{job.category}</span>
                    {job.budget_min && (
                      <span>{formatCurrency(job.budget_min)}</span>
                    )}
                  </div>
                  <Link href={`/client/jobs/${job.id}`}>
                    <Button variant="outline" size="sm">View Proposals</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Getting Started Guide (for new users) */}
      {(!activeJobs || activeJobs.length === 0) && (!ongoingOrders || ongoingOrders.length === 0) && (
        <Card className="p-8 bg-linear-to-r from-blue-50 to-indigo-50">
          <h2 className="text-2xl font-bold mb-4">Get Started with F9</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">1</div>
                Browse Services
              </h3>
              <p className="text-sm text-gray-600 ml-10">
                Find talented Nigerian students offering services across various categories
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">2</div>
                Post a Job
              </h3>
              <p className="text-sm text-gray-600 ml-10">
                Describe your project and receive proposals from qualified freelancers
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">3</div>
                Make Payment
              </h3>
              <p className="text-sm text-gray-600 ml-10">
                Secure escrow payment - funds held until work is delivered
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">4</div>
                Get Quality Work
              </h3>
              <p className="text-sm text-gray-600 ml-10">
                Review delivery, request revisions if needed, then approve to release payment
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ 
  icon, 
  title, 
  value, 
  color, 
  subtitle 
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <div className={`${color} text-white p-3 rounded-lg`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  );
}