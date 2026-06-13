// src/app/(dashboard)/client/orders/[id]/page.tsx
// FIX: <a opening tag restored in deliveryFiles.map() — was stripped by markdown renderer in prior delivery.
// FIX: flex-shrink-0 → shrink-0 (Tailwind v3 canonical)

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
  Package,
} from 'lucide-react';
import { OrderActions } from './OrderActions';

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

export default async function ClientOrderDetailPage({
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
      freelancer:profiles!orders_freelancer_id_fkey(
        id, full_name, profile_image_url, bio, freelancer_rating, total_jobs_completed
      ),
      service:services(id, title),
      job:jobs(id, title),
      transactions(id, amount, status, transaction_type, created_at),
      escrow(id, amount, status, created_at)
    `
    )
    .eq('id', params.id)
    .eq('client_id', user.id)
    .single();

  if (error || !order) notFound();

  const status = order.status ?? 'pending_payment';
  const statusStyle =
    STATUS_STYLES[status] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  const deliveryFiles = order.delivery_files as string[] | null;
  const escrow = Array.isArray(order.escrow) ? order.escrow[0] : order.escrow;
  const freelancer = order.freelancer as {
    id: string;
    full_name: string;
    profile_image_url?: string | null;
    bio?: string | null;
    freelancer_rating?: number | null;
    total_jobs_completed?: number | null;
  } | null;

  const now = Date.now();
  let autoApproveCountdown: number | null = null;
  if (status === 'delivered' && order.delivered_at) {
    const deliveredAt = new Date(order.delivered_at).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const remaining = Math.ceil(
      (deliveredAt + sevenDaysMs - now) / (24 * 60 * 60 * 1000)
    );
    autoApproveCountdown = Math.max(0, remaining);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* ── Back nav ── */}
      <Link
        href="/client/orders"
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
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(order.amount)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Platform fee: {formatCurrency(order.platform_fee)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order description */}
          <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Order Details
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
              {order.service && (
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {(order.service as { title: string }).title}
                </span>
              )}
            </div>
          </Card>

          {/* Delivery section */}
          {(status === 'delivered' ||
            status === 'revision_requested' ||
            status === 'completed') &&
            (order.delivery_note || deliveryFiles) && (
              <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Delivery
                  {order.delivered_at && (
                    <span className="font-normal normal-case">
                      · {new Date(order.delivered_at).toLocaleDateString('en-NG')}
                    </span>
                  )}
                </h2>
                {order.delivery_note && (
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap mb-4">
                    {order.delivery_note}
                  </p>
                )}
                {deliveryFiles && deliveryFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Attached Files
                    </p>
                    {deliveryFiles.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        {getFileLabel(url)}
                      </a>
                    ))}
                  </div>
                )}
                {status === 'delivered' && autoApproveCountdown !== null && (
                  <div className="mt-4 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-200">
                    Auto-approves in{' '}
                    <strong>{autoApproveCountdown} day{autoApproveCountdown !== 1 ? 's' : ''}</strong>{' '}
                    if no action is taken
                  </div>
                )}
              </Card>
            )}

          {/* Completed review recap */}
          {status === 'completed' && order.client_rating && (
            <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Your Review
              </h2>
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={
                      i < (order.client_rating ?? 0)
                        ? 'text-yellow-400 text-lg'
                        : 'text-gray-300 dark:text-gray-600 text-lg'
                    }
                  >
                    ★
                  </span>
                ))}
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  {order.client_rating}/5
                </span>
              </div>
              {order.client_review && (
                <p className="text-gray-700 dark:text-gray-300 text-sm italic">
                  &ldquo;{order.client_review}&rdquo;
                </p>
              )}
            </Card>
          )}

          {/* Interactive actions */}
          <OrderActions
            orderId={order.id}
            status={status}
            revisionCount={order.revision_count ?? 0}
            maxRevisions={order.max_revisions ?? 0}
            deliveryFiles={deliveryFiles}
          />
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Freelancer card */}
          <Card className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Freelancer
            </h2>
            {freelancer ? (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {freelancer.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={freelancer.profile_image_url}
                      alt={freelancer.full_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {freelancer.full_name}
                    </p>
                    {freelancer.freelancer_rating && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        ★{' '}
                        {Number(freelancer.freelancer_rating).toFixed(1)} ·{' '}
                        {freelancer.total_jobs_completed ?? 0} jobs
                      </p>
                    )}
                  </div>
                </div>
                {freelancer.bio && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">
                    {freelancer.bio}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Unknown freelancer</p>
            )}
          </Card>

          {/* Payment / escrow card */}
          <Card className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Payment
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Order total</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(order.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Platform fee</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {formatCurrency(order.platform_fee)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Freelancer earns</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(order.freelancer_earnings)}
                </span>
              </div>
              {escrow && (
                <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Escrow</span>
                  <Badge
                    className={
                      escrow.status === 'held'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : escrow.status === 'released_to_freelancer'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
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
                <span>{new Date(order.created_at ?? '').toLocaleDateString('en-NG')}</span>
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