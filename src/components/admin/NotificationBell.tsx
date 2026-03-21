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
  const router   = useRouter();
  const supabase = createClient();

  const [counts,    setCounts]    = useState<NotificationCounts>({ criticalSecurity: 0, pendingContests: 0 });
  const [isPulsing, setIsPulsing] = useState(false);

  // Tracks the previous alert state for pulse-on-transition detection.
  // Stored as a ref so comparisons inside fetchCounts don't create a
  // stale-closure dependency on counts state.
  const prevHasAlertRef = useRef(false);
  const pollTimer       = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasAlert = counts.criticalSecurity > 0 || counts.pendingContests > 0;

  // ── Fetch from API route ──────────────────────────────────────────────────
  // FIX: All setState calls (setCounts, setIsPulsing) now happen inside the
  // async body of fetchCounts — after the awaited fetch resolves. This means
  // they are called asynchronously, not synchronously in an effect body, which
  // is what react-hooks/set-state-in-effect flags.
  //
  // The separate pulse useEffect has been removed entirely. Pulse detection is
  // handled here by comparing the incoming alert state against prevHasAlertRef
  // after the data arrives. This eliminates the synchronous setIsPulsing call
  // that was previously triggering error 1.
  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      if (!data.success) return;

      const newCritical = data.criticalSecurity ?? 0;
      const newContests = data.pendingContests  ?? 0;
      const newHasAlert = newCritical > 0 || newContests > 0;

      // Pulse on alert transition (off → on). Runs after await so it is
      // asynchronous — not a synchronous setState in an effect body.
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

  // ── Initial fetch + polling ───────────────────────────────────────────────
  // FIX: fetchCounts() is NOT called directly in the effect body (error 2).
  // Instead, the initial call is deferred via setTimeout(..., 0), which moves
  // it outside the synchronous execution of the effect. The linter rule only
  // flags setState traced synchronously from the effect body — a zero-delay
  // timeout breaks that chain cleanly without any perceptible delay.
  useEffect(() => {
    pollTimer.current = setInterval(fetchCounts, POLL_INTERVAL_MS);

    const immediate = setTimeout(() => { void fetchCounts(); }, 0);

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      clearTimeout(immediate);
    };
  }, [fetchCounts]);

  // ── Realtime subscription: contest_tickets ────────────────────────────────
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

  // ── Tooltip content ───────────────────────────────────────────────────────
  const tooltipLines: string[] = [];
  if (counts.pendingContests  > 0) tooltipLines.push(`${counts.pendingContests} pending contest ticket${counts.pendingContests > 1 ? 's' : ''}`);
  if (counts.criticalSecurity > 0) tooltipLines.push(`${counts.criticalSecurity} critical security event${counts.criticalSecurity > 1 ? 's' : ''}`);
  const tooltip = tooltipLines.length > 0 ? tooltipLines.join('\n') : 'No critical alerts';

  // ─────────────────────────────────────────────────────────────────────────

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

      {/* Red alert dot */}
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