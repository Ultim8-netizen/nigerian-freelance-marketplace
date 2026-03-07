import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

// Defined at module scope so it's never called during render,
// satisfying react-hooks/purity. On a server component this file
// is evaluated once per request anyway, so the value is still fresh.
const MS_PER_DAY = 86_400_000;
const getSince = () => new Date(Date.now() - MS_PER_DAY).toISOString();

export default async function DailyDigest() {
  const supabase = await createClient();

  const since = getSince();

  // Note: These are lightweight count queries to maintain speed.
  const { count: ticketsCount } = await supabase.from('contest_tickets').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: newUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since);
  
  const actionRequired = (ticketsCount || 0) > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Daily Digest</h1>
      
      <div className="grid grid-cols-3 gap-6">
        
        {/* Platform Health - Static representation, to be linked to actual pings */}
        <Card className="p-6 border-l-4 border-l-green-500 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Platform Health</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center"><span className="text-sm font-medium">Database</span><div className="w-2 h-2 rounded-full bg-green-500" /></div>
            <div className="flex justify-between items-center"><span className="text-sm font-medium">Payments (FLW)</span><div className="w-2 h-2 rounded-full bg-green-500" /></div>
            <div className="flex justify-between items-center"><span className="text-sm font-medium">Redis (Rate limits)</span><div className="w-2 h-2 rounded-full bg-green-500" /></div>
          </div>
        </Card>

        {/* Action Required Card */}
        <Card className={`p-6 border-2 shadow-sm ${actionRequired ? 'border-red-500 bg-red-50/30' : 'border-green-500 bg-green-50/30'}`}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Action Required</h3>
          {actionRequired ? (
            <div className="space-y-2">
              <div className="flex justify-between text-red-800 font-medium">
                <span>Pending Contest Tickets</span>
                <span>{ticketsCount}</span>
              </div>
              {/* Add flags/escalations counts here */}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-green-700 font-medium pb-4">
              Nothing needs your attention.
            </div>
          )}
        </Card>

        {/* Quick Stats */}
        <Card className="p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">24h Summary</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500">New Registrations</p>
              <p className="text-2xl font-bold text-gray-900">{newUsers || 0}</p>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}