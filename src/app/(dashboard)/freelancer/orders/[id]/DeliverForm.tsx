// src/app/(dashboard)/freelancer/orders/[id]/DeliverForm.tsx
// Client component: freelancer submits (or resubmits) delivery for an order.
// Mounts in the freelancer order detail page when status is
// 'awaiting_delivery' or 'revision_requested'.
//
// NOTE: file links are plain URL inputs (Cloudinary/Drive/GitHub etc.), not
// an upload widget — no upload component existed in this domain's context.
// Swap in your existing upload widget here if you have one.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  Link as LinkIcon,
  Plus,
  X,
  Loader2,
  UploadCloud,
} from 'lucide-react';

interface DeliverFormProps {
  orderId: string;
  revisionCount: number;
  maxRevisions: number;
  isRevision: boolean;
}

function isValidUrl(value: string): boolean {
  try {
    
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function DeliverForm({
  orderId,
  revisionCount,
  maxRevisions,
  isRevision,
}: DeliverFormProps) {
  const router = useRouter();
  const [deliveryNote, setDeliveryNote] = useState('');
  const [fileUrls, setFileUrls] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateFileUrl = (index: number, value: string) => {
    setFileUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  };

  const addFileUrl = () => {
    setFileUrls((prev) => (prev.length >= 10 ? prev : [...prev, '']));
  };

  const removeFileUrl = (index: number) => {
    setFileUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const cleanedUrls = fileUrls.map((u) => u.trim()).filter((u) => u.length > 0);
  const invalidUrlCount = cleanedUrls.filter((u) => !isValidUrl(u)).length;
  const noteLength = deliveryNote.trim().length;

  const canSubmit =
    noteLength >= 20 &&
    noteLength <= 1000 &&
    cleanedUrls.length >= 1 &&
    cleanedUrls.length <= 10 &&
    invalidUrlCount === 0;

  const handleSubmit = async () => {
    if (noteLength < 20) {
      setError('Delivery note must be at least 20 characters.');
      return;
    }
    if (cleanedUrls.length === 0) {
      setError('Add at least one link to your delivered work.');
      return;
    }
    if (invalidUrlCount > 0) {
      setError('One or more file links are not valid URLs.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_note: deliveryNote.trim(),
          delivery_files: cleanedUrls,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit delivery');
      }

      setSuccessMessage(
        isRevision
          ? 'Revised delivery submitted! The client has been notified.'
          : 'Delivery submitted! The client has been notified and has 7 days to review.'
      );
      setTimeout(() => router.refresh(), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <Card className="overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <UploadCloud className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">
              {isRevision ? 'Submit Revised Delivery' : 'Submit Delivery'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isRevision
                ? `Addressing revision ${revisionCount}/${maxRevisions}`
                : 'Share your completed work with the client'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {error && (
          <div className="rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-3 py-2 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Delivery note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Delivery Note <span className="text-red-500">*</span>
          </label>
          <textarea
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            placeholder="Describe what you're delivering and any notes for the client (min 20 chars)..."
            rows={4}
            maxLength={1000}
            className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
          <p className="text-xs mt-1 flex justify-between">
            <span className={noteLength < 20 ? 'text-red-400' : 'text-green-500'}>
              {deliveryNote.length}/1000 (min 20)
            </span>
          </p>
        </div>

        {/* File links */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Delivery Links <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Add links to your hosted files (Cloudinary, Google Drive, GitHub, etc.) — 1 to 10 links.
          </p>
          <div className="space-y-2">
            {fileUrls.map((url, i) => {
              const trimmed = url.trim();
              const showInvalid = trimmed.length > 0 && !isValidUrl(trimmed);
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updateFileUrl(i, e.target.value)}
                      placeholder="https://..."
                      className={`w-full text-sm border rounded-md pl-9 pr-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        showInvalid
                          ? 'border-red-300 dark:border-red-700'
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    />
                  </div>
                  {fileUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFileUrl(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      aria-label="Remove link"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {fileUrls.length < 10 && (
            <button
              type="button"
              onClick={addFileUrl}
              className="mt-2 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another link
            </button>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !canSubmit}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting…
            </span>
          ) : isRevision ? (
            'Submit Revised Delivery'
          ) : (
            'Submit Delivery'
          )}
        </Button>
      </div>
    </Card>
  );
}