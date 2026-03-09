'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/hooks/use-toast';

const TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

export function AdminSessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // FIXED: Moved supabase creation inside useEffect
    // This ensures all dependencies are properly scoped and avoids exhaustive-deps warnings
    const supabase = createClient();

    const resetTimeout = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        await supabase.auth.signOut();
        toast({
          title: 'Session Expired',
          description: 'You have been logged out due to 2 hours of inactivity.',
          variant: 'destructive',
        });
        router.push('/f9-control/login');
      }, TIMEOUT_MS);
    };

    // Initial set
    resetTimeout();

    // Event listeners for activity
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetTimeout();

    events.forEach((event) => window.addEventListener(event, handleActivity));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [router]);

  return <>{children}</>;
}