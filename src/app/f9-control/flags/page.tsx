import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// FIXED: Define proper types for nested relationships based on database schema
// When selecting with relationships, the foreign key field becomes the related object
type ContestTicketWithUser = Omit<Tables<'contest_tickets'>, 'user_id'> & {
  user_id: Pick<Tables<'profiles'>, 'full_name'> | null;
};

type SecurityLogWithUser = Omit<Tables<'security_logs'>, 'user_id'> & {
  user_id: Pick<Tables<'profiles'>, 'full_name'> | null;
};

export default async function AdminFlagsPage() {
  const supabase = await createClient();

  // FIXED: Use user_id(full_name) instead of profiles(full_name) to disambiguate the relationship
  // contest_tickets has two relationships to profiles (user_id and reviewed_by)
  const { data: tickets } = await supabase
    .from('contest_tickets')
    .select('*, user_id(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false }) as { data: ContestTicketWithUser[] | null };

  // FIXED: Use user_id(full_name) for security_logs relationship
  const { data: flags } = await supabase
    .from('security_logs')
    .select('*, user_id(full_name)')
    .in('severity', ['high', 'critical'])
    .order('created_at', { ascending: false })
    .limit(20) as { data: SecurityLogWithUser[] | null };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Flags & Tickets</h1>

      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="tickets">Contest Tickets ({tickets?.length || 0})</TabsTrigger>
          <TabsTrigger value="flags">Critical Flags ({flags?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          {tickets?.map(ticket => (
            <Card key={ticket.id} className="p-4 border-l-4 border-l-orange-500">
              <div className="flex justify-between items-start">
                <div>
                  {/* FIXED: Properly typed user_id object with full_name property */}
                  <h3 className="font-bold text-gray-900">{ticket.user_id?.full_name || 'Unknown User'}</h3>
                  <p className="text-sm text-gray-500">Contesting: {ticket.action_contested}</p>
                  <p className="mt-2 text-gray-800 bg-gray-50 p-3 rounded">{ticket.explanation}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50">Reverse Action</Button>
                  <Button size="sm" variant="outline" className="text-gray-600">Dismiss</Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="flags" className="space-y-4">
          {flags?.map(flag => (
            <Card 
              key={flag.id} 
              className={`p-4 border-l-4 ${(flag.severity ?? 'high') === 'critical' ? 'border-l-red-600' : 'border-l-orange-400'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {/* FIXED: Properly typed user_id object with full_name property */}
                    <h3 className="font-bold text-gray-900">{flag.user_id?.full_name || 'Unknown User'}</h3>
                    {/* FIXED: Add null coalescing for severity - use default 'high' when null */}
                    <Badge variant="destructive">{(flag.severity ?? 'high').toUpperCase()}</Badge>
                  </div>
                  <p className="text-sm font-medium text-gray-700">{flag.event_type.replace(/_/g, ' ').toUpperCase()}</p>
                  <p className="text-sm text-gray-500 mt-1">{flag.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive">Suspend User</Button>
                  <Button size="sm" variant="outline">Dismiss</Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}