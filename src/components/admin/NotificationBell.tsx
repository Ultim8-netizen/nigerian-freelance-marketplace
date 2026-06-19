'use client';

// src/components/admin/NotificationBell.tsx

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bell } from 'lucide-react';

const POLL_INTERVAL_MS = 30_000;

interface NotificationCounts {
  criticalSecurity: number;
  pendingContests:  number;
}

export function NotificationBell() {
  const router = useRouter();

  // FIX (Issue 8): createClient() called in the render body returned a new
  // object on every render. The Realtime useEffect lists `supabase` in its
  // dep array, so a changed reference caused the channel to be torn down and
  // re-subscribed on every poll cycle (~every 30s). useState initialiser
  // runs once — reference is stable for the lifetime of the component.
  const [supabase] = useState(() => createClient());

  const [counts,    setCounts]    = useState<NotificationCounts>({ criticalSecurity: 0, pendingContests: 0 });
  const [isPulsing, setIsPulsing] = useState(false);

  const prevHasAlertRef = useRef(false);
  const pollTimer       = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasAlert = counts.criticalSecurity > 0 || counts.pendingContests > 0;

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      if (!data.success) return;

      const newCritical = data.criticalSecurity ?? 0;
      const newContests = data.pendingContests  ?? 0;
      const newHasAlert = newCritical > 0 || newContests > 0;

      if (newHasAlert && !prevHasAlertRef.current) {
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 2000);
      }
      prevHasAlertRef.current = newHasAlert;

      setCounts({ criticalSecurity: newCritical, pendingContests: newContests });
    } catch {
      // Silent — network errors must not surface as UI errors in the admin shell
    }
  }, []);

  useEffect(() => {
    pollTimer.current = setInterval(fetchCounts, POLL_INTERVAL_MS);
    const immediate = setTimeout(() => { void fetchCounts(); }, 0);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      clearTimeout(immediate);
    };
  }, [fetchCounts]);

  // With supabase now stable, this effect runs once on mount and the channel
  // is held open for the lifetime of the component — no more 30s churn.
  useEffect(() => {
    const channel = supabase
      .channel('admin-contest-tickets-bell')
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'contest_tickets',
        },
        () => {
          if (pollTimer.current) clearInterval(pollTimer.current);
          void fetchCounts().then(() => {
            pollTimer.current = setInterval(fetchCounts, POLL_INTERVAL_MS);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchCounts]);

  const tooltipLines: string[] = [];
  if (counts.pendingContests  > 0) tooltipLines.push(`${counts.pendingContests} pending contest ticket${counts.pendingContests > 1 ? 's' : ''}`);
  if (counts.criticalSecurity > 0) tooltipLines.push(`${counts.criticalSecurity} critical security event${counts.criticalSecurity > 1 ? 's' : ''}`);
  const tooltip = tooltipLines.length > 0 ? tooltipLines.join('\n') : 'No critical alerts';

  return (
    <button
      type="button"
      title={tooltip}
      aria-label={hasAlert ? `${tooltip} — click to review` : 'Notifications — no alerts'}
      onClick={() => router.push('/f9-control/flags')}
      className="relative p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <Bell
        className={`w-5 h-5 transition-transform ${isPulsing ? 'animate-bounce' : ''}`}
      />

      {hasAlert && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 flex h-2 w-2"
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
        </span>
      )}
    </button>
  );
}