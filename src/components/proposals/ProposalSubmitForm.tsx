// src/components/proposals/ProposalSubmitForm.tsx
// Client form for submitting a proposal on a job.
// Replaces the broken server action in jobs/[id]/page.tsx.
// Calls POST /api/proposals; on success triggers router.refresh() so the
// parent server component re-fetches and displays the submitted proposal state.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Send, Loader2, CheckCircle } from 'lucide-react';

interface ProposalSubmitFormProps {
  jobId: string;
}

export function ProposalSubmitForm({ jobId }: ProposalSubmitFormProps) {
  const router = useRouter();
  const [proposedPrice, setProposedPrice] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const price = parseFloat(proposedPrice);
    const days = parseInt(deliveryDays, 10);

    if (!price || price <= 0) {
      setError('Please enter a valid bid amount.');
      return;
    }
    if (!days || days < 1) {
      setError('Please enter a valid delivery time (at least 1 day).');
      return;
    }
    if (!coverLetter.trim() || coverLetter.trim().length < 30) {
      setError('Cover letter must be at least 30 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          proposed_price: price,
          delivery_days: days,
          cover_letter: coverLetter.trim(),
          portfolio_links: [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError('You have already submitted a proposal for this job.');
        } else {
          setError(data.error || 'Failed to submit proposal. Please try again.');
        }
        return;
      }

      // Signal success briefly before the server component re-renders
      setSubmitted(true);
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
        <p className="text-green-800 dark:text-green-200 font-medium">
          Proposal submitted! Loading your proposal details…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium select-none">
              ₦
            </span>
            <input
              type="number"
              id="proposed_price"
              min="1"
              step="100"
              required
              placeholder="0"
              value={proposedPrice}
              onChange={(e) => setProposedPrice(e.target.value)}
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
            min="1"
            max="365"
            required
            placeholder="e.g. 7"
            value={deliveryDays}
            onChange={(e) => setDeliveryDays(e.target.value)}
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
          rows={6}
          required
          placeholder="Introduce yourself, explain your relevant experience, and why you're the best fit for this project…"
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Minimum 30 characters. Personalise your proposal for better results.
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {loading ? 'Submitting…' : 'Submit Proposal'}
      </Button>
    </form>
  );
}