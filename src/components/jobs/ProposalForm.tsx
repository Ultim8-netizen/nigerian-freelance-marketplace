'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ProposalFormProps {
  jobId: string;
}

export function ProposalForm({ jobId }: ProposalFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const proposed_price = parseFloat(fd.get('proposed_price') as string);
    const delivery_days = parseInt(fd.get('delivery_days') as string, 10);
    const cover_letter = (fd.get('cover_letter') as string)?.trim();

    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, proposed_price, delivery_days, cover_letter }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to submit proposal. Please try again.');
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
        <p className="text-green-800 dark:text-green-200 font-medium">
          Proposal submitted! The client will review it shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="proposed_price"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Your Bid (₦) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₦</span>
            <input
              type="number"
              id="proposed_price"
              name="proposed_price"
              min="0"
              step="100"
              required
              placeholder="0"
              className="w-full pl-8 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="delivery_days"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Delivery Time (days) *
          </label>
          <input
            type="number"
            id="delivery_days"
            name="delivery_days"
            min="1"
            max="365"
            required
            placeholder="e.g. 7"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="cover_letter"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          Cover Letter *
        </label>
        <textarea
          id="cover_letter"
          name="cover_letter"
          rows={6}
          required
          placeholder="Introduce yourself, explain your relevant experience, and why you're the best fit for this project..."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Tip: Personalise your proposal to this specific job for better results.
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit Proposal
          </>
        )}
      </Button>
    </form>
  );
}