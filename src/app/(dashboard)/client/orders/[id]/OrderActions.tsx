// src/app/(dashboard)/client/orders/[id]/OrderActions.tsx
// Client component: approve, request-revision, and raise-dispute action panels.
// Mounts in the client order detail page.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

interface OrderActionsProps {
  orderId: string;
  status: string;
  revisionCount: number;
  maxRevisions: number;
  deliveryFiles: string[] | null;
}

type ActivePanel = 'none' | 'approve' | 'revision' | 'dispute';

interface ApproveState {
  rating: number;
  review: string;
  communicationRating: number;
  qualityRating: number;
  professionalismRating: number;
}

function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs text-gray-500 dark:text-gray-400 w-36 shrink-0">
          {label}
        </span>
      )}
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`text-xl leading-none transition-colors ${
              star <= value
                ? 'text-yellow-400 hover:text-yellow-500'
                : 'text-gray-300 dark:text-gray-600 hover:text-gray-400'
            }`}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500">{value}/5</span>
      )}
    </div>
  );
}

export function OrderActions({
  orderId,
  status,
  revisionCount,
  maxRevisions,
  deliveryFiles,
}: OrderActionsProps) {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Approve form state
  const [approveState, setApproveState] = useState<ApproveState>({
    rating: 0,
    review: '',
    communicationRating: 0,
    qualityRating: 0,
    professionalismRating: 0,
  });

  // Revision form state
  const [revisionNote, setRevisionNote] = useState('');

  // Dispute form state
  const [disputeState, setDisputeState] = useState({
    reason: '',
    description: '',
  });

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
    setError(null);
  };

  // ── Approve submission ──
  const handleApprove = async () => {
    if (approveState.rating === 0) {
      setError('Please select a rating before approving.');
      return;
    }
    if (
      approveState.review.trim().length > 0 &&
      approveState.review.trim().length < 10
    ) {
      setError('Review must be at least 10 characters if provided.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: approveState.rating,
          review: approveState.review.trim() || undefined,
          communication_rating:
            approveState.communicationRating > 0
              ? approveState.communicationRating
              : undefined,
          quality_rating:
            approveState.qualityRating > 0
              ? approveState.qualityRating
              : undefined,
          professionalism_rating:
            approveState.professionalismRating > 0
              ? approveState.professionalismRating
              : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve order');
      }

      setSuccessMessage(
        'Order approved! Payment is queued for release to the freelancer.'
      );
      setTimeout(() => router.push('/client/orders'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Revision submission ──
  const handleRevision = async () => {
    if (revisionNote.trim().length < 20) {
      setError('Revision note must be at least 20 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_note: revisionNote.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to request revision');
      }

      setSuccessMessage(
        `Revision ${data.data?.revision_count ?? revisionCount + 1}/${maxRevisions} requested. The freelancer has been notified.`
      );
      setTimeout(() => router.refresh(), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Dispute submission ──
  const handleDispute = async () => {
    if (disputeState.reason.trim().length < 5) {
      setError('Please provide a reason (min 5 characters).');
      return;
    }
    if (disputeState.description.trim().length < 50) {
      setError('Description must be at least 50 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: disputeState.reason.trim(),
          description: disputeState.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to raise dispute');
      }

      setSuccessMessage(
        'Dispute raised. Our team will review within 48 hours.'
      );
      setTimeout(() => router.refresh(), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success state ──
  if (successMessage) {
    return (
      <Card className="p-5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 dark:text-green-200">
            {successMessage}
          </p>
        </div>
      </Card>
    );
  }

  // ── Pending payment ──
  if (status === 'pending_payment') {
    return (
      <Card className="p-5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          This order is waiting for payment. Complete the payment to activate it.
        </p>
      </Card>
    );
  }

  // ── Awaiting delivery ──
  if (status === 'awaiting_delivery') {
    return (
      <div className="space-y-4">
        <Card className="p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Waiting for the freelancer to deliver the work.
          </p>
        </Card>
        {renderDisputeSection()}
      </div>
    );
  }

  // ── Revision requested ──
  if (status === 'revision_requested') {
    return (
      <div className="space-y-4">
        <Card className="p-5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            Revision {revisionCount}/{maxRevisions} requested. Waiting for the
            freelancer to resubmit.
          </p>
        </Card>
        {renderDisputeSection()}
      </div>
    );
  }

  // ── Disputed ──
  if (status === 'disputed') {
    return (
      <Card className="p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">
            A dispute is open on this order. Our team will review and contact
            both parties within 48 hours.
          </p>
        </div>
      </Card>
    );
  }

  // ── Completed ──
  if (status === 'completed') {
    return (
      <Card className="p-5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-800 dark:text-green-200 font-medium">
            Order completed. Payment is being processed to the freelancer.
          </p>
        </div>
      </Card>
    );
  }

  // ── Cancelled ──
  if (status === 'cancelled') {
    return (
      <Card className="p-5 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This order was cancelled.
        </p>
      </Card>
    );
  }

  // ── Delivered — primary action state ──
  if (status === 'delivered') {
    const canRevise = revisionCount < maxRevisions;

    return (
      <div className="space-y-4">
        {/* Error banner */}
        {error && (
          <div className="rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-3 py-2 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Primary: Approve */}
        <Card className="overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => togglePanel('approve')}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                  Approve &amp; Release Payment
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Satisfied with the delivery? Rate and approve.
                </p>
              </div>
            </div>
            {activePanel === 'approve' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {activePanel === 'approve' && (
            <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-5">
              {/* Main rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Overall Rating <span className="text-red-500">*</span>
                </label>
                <StarPicker
                  value={approveState.rating}
                  onChange={(v) =>
                    setApproveState((s) => ({ ...s, rating: v }))
                  }
                />
              </div>

              {/* Sub-ratings */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Optional sub-ratings
                </p>
                <StarPicker
                  label="Communication"
                  value={approveState.communicationRating}
                  onChange={(v) =>
                    setApproveState((s) => ({ ...s, communicationRating: v }))
                  }
                />
                <StarPicker
                  label="Quality"
                  value={approveState.qualityRating}
                  onChange={(v) =>
                    setApproveState((s) => ({ ...s, qualityRating: v }))
                  }
                />
                <StarPicker
                  label="Professionalism"
                  value={approveState.professionalismRating}
                  onChange={(v) =>
                    setApproveState((s) => ({
                      ...s,
                      professionalismRating: v,
                    }))
                  }
                />
              </div>

              {/* Review text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Review{' '}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={approveState.review}
                  onChange={(e) =>
                    setApproveState((s) => ({ ...s, review: e.target.value }))
                  }
                  placeholder="Share details about your experience (min 10 chars if provided)..."
                  rows={3}
                  maxLength={500}
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {approveState.review.length}/500
                </p>
              </div>

              <Button
                onClick={handleApprove}
                disabled={isSubmitting || approveState.rating === 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing…
                  </span>
                ) : (
                  'Confirm Approval & Release Payment'
                )}
              </Button>
            </div>
          )}
        </Card>

        {/* Secondary: Request Revision */}
        {canRevise && (
          <Card className="overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => togglePanel('revision')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    Request Revision
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {revisionCount}/{maxRevisions} revisions used
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs">
                  {maxRevisions - revisionCount} left
                </Badge>
                {activePanel === 'revision' ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {activePanel === 'revision' && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    What needs to be revised?{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                    placeholder="Describe clearly what changes are needed (min 20 chars)..."
                    rows={4}
                    maxLength={500}
                    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1 flex justify-between">
                    <span className={revisionNote.length < 20 ? 'text-red-400' : 'text-green-500'}>
                      {revisionNote.length}/500 (min 20)
                    </span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleRevision}
                  disabled={isSubmitting || revisionNote.trim().length < 20}
                  className="w-full border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    'Submit Revision Request'
                  )}
                </Button>
              </div>
            )}
          </Card>
        )}

        {!canRevise && (
          <Card className="p-4 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Maximum revisions ({maxRevisions}) reached. You may approve the
              order or raise a dispute.
            </p>
          </Card>
        )}

        {renderDisputeSection()}
      </div>
    );
  }

  return null;

  // ── Shared dispute section ──
  function renderDisputeSection() {
    const canDispute = ['awaiting_delivery', 'delivered', 'revision_requested'].includes(
      status
    );
    if (!canDispute) return null;

    return (
      <Card className="overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => togglePanel('dispute')}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm text-red-700 dark:text-red-400 font-medium">
              Raise a Dispute
            </span>
          </div>
          {activePanel === 'dispute' ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {activePanel === 'dispute' && (
          <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-4">
            <div className="rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              Disputes freeze the escrow and are reviewed by our team. Only
              raise a dispute if you cannot resolve the issue directly.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={disputeState.reason}
                onChange={(e) =>
                  setDisputeState((s) => ({ ...s, reason: e.target.value }))
                }
                placeholder="e.g. Work not as described (5–100 chars)"
                maxLength={100}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={disputeState.description}
                onChange={(e) =>
                  setDisputeState((s) => ({
                    ...s,
                    description: e.target.value,
                  }))
                }
                placeholder="Provide full context — what was promised vs. what was delivered (min 50 chars)..."
                rows={5}
                maxLength={2000}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {disputeState.description.length}/2000
              </p>
            </div>
            {error && activePanel === 'dispute' && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <Button
              variant="outline"
              onClick={handleDispute}
              disabled={
                isSubmitting ||
                disputeState.reason.trim().length < 5 ||
                disputeState.description.trim().length < 50
              }
              className="w-full border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </span>
              ) : (
                'Submit Dispute'
              )}
            </Button>
          </div>
        )}
      </Card>
    );
  }
}