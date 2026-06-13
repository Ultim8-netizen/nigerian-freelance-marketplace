// src/components/orders/OrderCard.tsx
// Shared order summary card — used by client/orders/page.tsx
// Renders a condensed view with status badge, counterparty, amounts, and detail link.

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { Clock, User, AlertTriangle } from 'lucide-react';

// Extend the base Order type locally to include joined relations
// (base @/types Order does not type Supabase join results)
interface JoinedProfile {
  id: string;
  full_name: string;
  profile_image_url?: string | null;
}

interface OrderWithRelations {
  id: string;
  title: string;
  order_number: string;
  amount: number;
  platform_fee: number;
  freelancer_earnings: number;
  delivery_date: string;
  delivered_at?: string | null;
  status?: string | null;
  revision_count?: number | null;
  max_revisions?: number | null;
  created_at?: string | null;
  client?: JoinedProfile | null;
  freelancer?: JoinedProfile | null;
  service?: { title: string } | null;
}

interface OrderCardProps {
  order: OrderWithRelations;
  userType: 'client' | 'freelancer';
}

const STATUS_STYLES: Record<string, string> = {
  pending_payment:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  awaiting_delivery:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  delivered:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  revision_requested:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  completed:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  disputed:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  cancelled:
    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export function OrderCard({ order, userType }: OrderCardProps) {
  const status = order.status ?? 'pending_payment';
  const statusStyle =
    STATUS_STYLES[status] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';

  const counterparty =
    userType === 'client' ? order.freelancer : order.client;
  const counterpartyLabel = userType === 'client' ? 'Freelancer' : 'Client';
  const href = `/${userType}/orders/${order.id}`;

  const isOverdue =
    status === 'awaiting_delivery' &&
    new Date(order.delivery_date) < new Date();

  return (
    <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* ── Left: details ── */}
        <div className="flex-1 min-w-0">
          {/* Title + status */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
              {order.title}
            </h3>
            <Badge className={statusStyle}>
              {status.replace(/_/g, ' ')}
            </Badge>
            {isOverdue && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Overdue
              </Badge>
            )}
          </div>

          {/* Order number */}
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            {order.order_number}
          </p>

          {/* Counterparty */}
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-3">
            <User className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{counterpartyLabel}:</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {counterparty?.full_name ?? 'Unknown'}
            </span>
          </div>

          {/* Amounts + delivery date */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(order.amount)}
            </span>
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              Due {new Date(order.delivery_date).toLocaleDateString('en-NG')}
            </span>
            {order.created_at && (
              <span
                className="text-xs text-gray-400 dark:text-gray-500"
                suppressHydrationWarning
              >
                {formatRelativeTime(order.created_at)}
              </span>
            )}
          </div>

          {/* Status-specific banners */}
          {status === 'delivered' && userType === 'client' && (
            <div className="mt-3 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 px-3 py-2 text-xs text-purple-800 dark:text-purple-200">
              Work delivered — review and approve to release payment
            </div>
          )}
          {status === 'revision_requested' && (
            <div className="mt-3 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 px-3 py-2 text-xs text-orange-800 dark:text-orange-200">
              Revision {order.revision_count ?? 0}/{order.max_revisions ?? 0} in progress
            </div>
          )}
          {status === 'pending_payment' && userType === 'client' && (
            <div className="mt-3 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-200">
              Awaiting payment to activate this order
            </div>
          )}
        </div>

        {/* ── Right: CTA ── */}
        <Link href={href} className="flex-shrink-0">
          <Button variant="outline" size="sm">
            View Order
          </Button>
        </Link>
      </div>
    </Card>
  );
}