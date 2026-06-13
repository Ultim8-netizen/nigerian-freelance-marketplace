// src/app/(dashboard)/freelancer/orders/[id]/page.tsx
// Freelancer-facing order detail — server component.
// Fetches the full order, enforces ownership via .eq('freelancer_id', user.id).

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  User,
  FileText,
  ExternalLink,
  CheckCircle,
  Wallet,
} from 'lucide-react';
import { DeliverForm } from './DeliverForm';

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

function getFileLabel(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/');
    const name = parts[parts.length - 1];
    return name && name.length > 0 ? decodeURIComponent(name) : 'Attachment';
  } catch {
    return 'Attachment';
  }
}

export default async function FreelancerOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      client:profiles!orders_client_id_fkey(id, full_name, profile_image_url, bio),
      service:services(id, title),
      job:jobs(id, title),
      escrow(id, amount, status)
    `
    )
    .eq('id', params.id)
    .eq('freelancer_id', user.id)
    .single();

  if (error || !order) notFound();

  const status = order.status ?? 'pending_payment';
  const statusStyle =
    STATUS_STYLES[status] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  const deliveryFiles = order.delivery_files as string[] | null;
  const escrow = Array.isArray(order.escrow) ? order.escrow[0] : order.escrow;
  const client = order.client as {
    id: string;
    full_name: string;
    profile_image_url?: string | null;
    bio?: string | null;
  } | null;

  const canDeliver =
    status === 'awaiting_delivery' || status === 'revision_requested';

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* ── Back nav ── */}
      <Link
        href="/freelancer/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </Link>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {order.title}
            </h1>
            <Badge className={statusStyle}>
              {status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {order.order_number} · Created{' '}
            {new Date(order.created_at ?? '').toLocaleDateString('en-NG')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(order.freelancer_earnings)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Your earnings (order total: {formatCurrency(order.amount)})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order description */}
          <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Order Requirements
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {order.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Due {new Date(order.delivery_date).toLocaleDateString('en-NG')}
              </span>
              <span>
                Revisions: {order.revision_count ?? 0}/{order.max_revisions ?? 0}
              </span>
            </div>
          </Card>

          {/* Revision-specific banner */}
          {status === 'revision_requested' && (
            <Card className="p-5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
              <h2 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">
                Revision {order.revision_count}/{order.max_revisions} Requested
              </h2>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                The client has reviewed your delivery and requested changes.
                Review the original order description and resubmit.
              </p>
            </Card>
          )}

          {/* DeliverForm — shown when actionable */}
          {canDeliver && (
            <DeliverForm
              orderId={order.id}
              revisionCount={order.revision_count ?? 0}
              maxRevisions={order.max_revisions ?? 0}
              isRevision={status === 'revision_requested'}
            />
          )}

          {/* Already delivered — show what was submitted */}
          {(status === 'delivered' || status === 'completed') &&
            (order.delivery_note || deliveryFiles) && (
              <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Your Delivery
                  {order.delivered_at && (
                    <span className="font-normal normal-case">
                      · {new Date(order.delivered_at).toLocaleDateString('en-NG')}
                    </span>
                  )}
                </h2>
                {order.delivery_note && (
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap mb-4 text-sm">
                    {order.delivery_note}
                  </p>
                )}
                {deliveryFiles && deliveryFiles.length > 0 && (
                  <div className="space-y-2">
                    {deliveryFiles.map((url, i) => (
                      
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                        {getFileLabel(url)}
                      </a>
                    ))}
                  </div>
                )}
                {status === 'delivered' && (
                  <div className="mt-4 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 px-3 py-2 text-xs text-purple-800 dark:text-purple-200">
                    Awaiting client review — auto-approves after 7 days if no
                    action is taken.
                  </div>
                )}
              </Card>
            )}

          {/* Completed */}
          {status === 'completed' && (
            <Card className="p-5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="font-semibold text-green-800 dark:text-green-200">
                  Order Completed
                </p>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                {formatCurrency(order.freelancer_earnings)} is pending clearance
                to your wallet. Funds clear 7 days after client approval.
              </p>
              {order.client_rating && (
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                  <p className="text-xs text-green-700 dark:text-green-300 mb-1">
                    Client rating:
                  </p>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < (order.client_rating ?? 0)
                            ? 'text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }
                      >
                        ★
                      </span>
                    ))}
                    <span className="text-xs text-gray-500 ml-1">
                      {order.client_rating}/5
                    </span>
                  </div>
                  {order.client_review && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-1">
                      &ldquo;{order.client_review}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Client card */}
          <Card className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Client
            </h2>
            {client ? (
              <div className="flex items-center gap-3">
                {client.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={client.profile_image_url}
                    alt={client.full_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  {client.full_name}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Unknown client</p>
            )}
          </Card>

          {/* Earnings card */}
          <Card className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Earnings
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Order total</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {formatCurrency(order.amount)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  You receive
                </span>
                <span className="font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(order.freelancer_earnings)}
                </span>
              </div>
              {escrow && (
                <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    Escrow
                  </span>
                  <Badge
                    className={
                      escrow.status === 'held'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs'
                        : escrow.status === 'released_to_freelancer'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs'
                    }
                  >
                    {escrow.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Timeline
            </h2>
            <ol className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
              <li className="flex justify-between">
                <span>Created</span>
                <span>
                  {new Date(order.created_at ?? '').toLocaleDateString('en-NG')}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Deadline</span>
                <span
                  className={
                    new Date(order.delivery_date) < new Date() &&
                    status === 'awaiting_delivery'
                      ? 'text-red-500'
                      : ''
                  }
                >
                  {new Date(order.delivery_date).toLocaleDateString('en-NG')}
                </span>
              </li>
              {order.delivered_at && (
                <li className="flex justify-between">
                  <span>Delivered</span>
                  <span>
                    {new Date(order.delivered_at).toLocaleDateString('en-NG')}
                  </span>
                </li>
              )}
              {order.cleared_at && (
                <li className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Cleared</span>
                  <span>
                    {new Date(order.cleared_at).toLocaleDateString('en-NG')}
                  </span>
                </li>
              )}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}