import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function WalletRedirect() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  // Redirect freelancers to their earnings page which acts as their wallet
  if (profile?.user_type === 'freelancer' || profile?.user_type === 'both') {
    redirect('/freelancer/earnings');
  }

  // Render Client Wallet View here (Simplified for now)
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Wallet</h1>
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <p>Client wallet funding features coming soon.</p>
      </div>
    </div>
  );
}