// src/app/(dashboard)/notifications/page.tsx
// NEW FILE: Full notifications page — was 404ing because the route didn't exist.
// The nav was linking to /dashboard/notifications; corrected link now points here (/notifications).

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import Link from 'next/link';

// Server action: mark a single notification as read
async function markAsRead(notificationId: string) {
  'use server';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id);
  revalidatePath('/notifications');
}

// Server action: mark ALL notifications as read
async function markAllRead() {
  'use server';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_read', false);
  revalidatePath('/notifications');
}

const TYPE_STYLES: Record<string, { dot: string; label: string }> = {
  order_update:      { dot: 'bg-blue-500',   label: 'Order' },
  new_order:         { dot: 'bg-green-500',  label: 'New Order' },
  order_completed:   { dot: 'bg-emerald-500',label: 'Completed' },
  new_message:       { dot: 'bg-purple-500', label: 'Message' },
  payment_received:  { dot: 'bg-yellow-500', label: 'Payment' },
  payment_success:   { dot: 'bg-yellow-500', label: 'Payment' },
  proposal_accepted: { dot: 'bg-teal-500',   label: 'Proposal' },
};

// FIX: accepts `string | null` — `type` is non-nullable in the schema but
// defensive typing prevents future regressions.
function getTypeStyle(type: string | null) {
  if (!type) return { dot: 'bg-gray-400', label: 'Notification' };
  return TYPE_STYLES[type] ?? { dot: 'bg-gray-400', label: 'Notification' };
}

// FIX: accepts `string | null` — `created_at` is typed as `string | null`
// in the auto-generated Supabase schema (database.types.ts). Returns an
// empty string when the value is null so the UI degrades gracefully.
function formatTime(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{unreadCount} unread</p>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <form action={markAllRead}>
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          </form>
        )}
      </div>

      {notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const style = getTypeStyle(notif.type);
            const markReadAction = markAsRead.bind(null, notif.id);

            const cardContent = (
              <Card
                key={notif.id}
                className={`p-4 transition-all hover:shadow-md ${
                  !notif.is_read
                    ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${!notif.is_read ? style.dot : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                          {notif.title}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 hidden sm:inline-flex">
                          {style.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        {formatTime(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{notif.message}</p>
                  </div>
                  {!notif.is_read && (
                    <form action={markReadAction}>
                      <button
                        type="submit"
                        className="text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 transition-colors"
                        title="Mark as read"
                      >
                        ✕
                      </button>
                    </form>
                  )}
                </div>
              </Card>
            );

            return notif.link ? (
              <Link key={notif.id} href={notif.link}>
                {cardContent}
              </Link>
            ) : (
              <div key={notif.id}>{cardContent}</div>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="max-w-xs mx-auto">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">All caught up!</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              You have no notifications. We&apos;ll let you know when something happens.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}