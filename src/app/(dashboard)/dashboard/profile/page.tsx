import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ProfileRedirect() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    // Redirect to the role-specific profile page
    // Note: The original code implies /freelancer/profile exists.
    // If client profile page doesn't exist, we can fallback to settings or create one.
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single();

    if (profile?.user_type === 'client') {
        // Fallback for client profile - often just settings or a specific client view
        redirect('/dashboard/settings'); 
    } else {
        redirect('/freelancer/profile');
    }
}