// src/components/notifications/UserNotificationBell.tsx
//
// Unread notification badge for regular (non-admin) dashboard users.
// Mirrors the admin NotificationBell pattern in src/components/admin/:
//   — Polls /api/user/notifications/count every 30s.
//   — Supabase Realtime filtered to this user's notifications only via
//     filter: `user_id=eq.${userId}`. This prevents bell re-renders on
//     notifications inserted for other users — important at scale.
//   — Subscribes to both INSERT (new notification) and UPDATE (mark-read)
//     so the badge decrements immediately when the user reads notifications.
//   — Pulses on unread count transition (0 → N).
//   — Shows numeric count (capped at 99+) rather than just a dot, since
//     users benefit from knowing how many unread items await them.
//   — Navigates to /notifications on click.
//
// MOUNT POINT:
//   Currently mounted in src/app/(dashboard)/layout.tsx adjacent to
//   DashboardNav. Once DashboardNav.tsx is available, move this bell
//   inside that component for tighter visual integration.

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter }    from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bell }         from 'lucide-react';

const POLL_INTERVAL_MS = 30_000;

interface UserNotificationBellProps {
  /** The authenticated user's UUID — used to filter Realtime events. */
  userId: string;
}

export function UserNotificationBell({ userId }: UserNotificationBellProps) {
  const router = useRouter();

  // Stable client reference — createClient() returns a new object on every
  // render call; useState initialiser runs exactly once.
  const [supabase] = useState(() => createClient());
  const [count,     setCount]     = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);

  const prevCountRef = useRef(0);
  const pollTimer    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch current unread count from the server ─────────────────────────
  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/user/notifications/count', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json() as { count?: number };
      const newCount = data.count ?? 0;

      // Pulse on zero → non-zero transition.
      if (newCount > 0 && prevCountRef.current === 0) {
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 2000);
      }
      prevCountRef.current = newCount;
      setCount(newCount);
    } catch {
      // Silent — network errors must not surface as UI noise.
    }
  }, []);

  // ── Initial fetch + 30s poll ───────────────────────────────────────────
  // Deferred via setTimeout(0): moves the first fetchCount call out of the
  // synchronous effect body so React's setState-in-effect lint rule is not
  // triggered (same pattern as admin NotificationBell).
  useEffect(() => {
    pollTimer.current = setInterval(fetchCount, POLL_INTERVAL_MS);
    const immediate   = setTimeout(() => { void fetchCount(); }, 0);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      clearTimeout(immediate);
    };
  }, [fetchCount]);

  // ── Realtime: INSERT (new notification) + UPDATE (mark-as-read) ────────
  // Filter by user_id so we only receive events for this user's rows.
  // On any event: reset the poll timer and refetch the authoritative count
  // from the server. The count endpoint is the single source of truth.
  useEffect(() => {
    const refetchAndResetPoll = () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      void fetchCount().then(() => {
        pollTimer.current = setInterval(fetchCount, POLL_INTERVAL_MS);
      });
    };

    const channel = supabase
      .channel(`user-notif-bell-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        refetchAndResetPoll,
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        refetchAndResetPoll,
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId, fetchCount]);

  // ── Render ─────────────────────────────────────────────────────────────
  const hasUnread    = count > 0;
  const displayCount = count > 99 ? '99+' : String(count);
  const label        = hasUnread
    ? `${count} unread notification${count !== 1 ? 's' : ''} — click to view`
    : 'Notifications — none unread';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => router.push('/notifications')}
      className="relative p-2 rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <Bell className={`w-5 h-5 ${isPulsing ? 'animate-bounce' : ''}`} />

      {hasUnread && (
        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span
            className="relative flex items-center justify-center rounded-full bg-red-600 text-white font-bold leading-none"
            style={{ fontSize: '9px', minWidth: '16px', height: '16px', padding: '0 3px' }}
          >
            {displayCount}
          </span>
        </span>
      )}
    </button>
  );
}