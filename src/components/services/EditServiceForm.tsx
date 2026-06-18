// src/components/services/EditServiceForm.tsx
// Client form for editing an existing service. Calls PATCH /api/services/:id.
// On success, redirects to /freelancer/services.
//
// FIXED (Domain 4 audit): removed the `tags` field entirely. `tags` is not a
// column on the `services` table (database.types.ts). The field was collecting
// user input, serialising it into an array, and sending it in the PATCH body —
// where it was stripped silently by serviceSchema.partial() before the update,
// meaning nothing was ever persisted. Keeping the field creates a false UX
// expectation (user fills in tags, saves, refreshes — tags are gone).

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Save, Loader2 } from 'lucide-react';

interface ServiceData {
  id: string;
  title: string;
  description: string;
  category: string;
  base_price: number;
  requirements: string | null;
  is_active: boolean;
  service_location: string | null;
  remote_ok: boolean | null;
  location_required: boolean | null;
}

interface EditServiceFormProps {
  service: ServiceData;
}

export default function EditServiceForm({ service }: EditServiceFormProps) {
  const router = useRouter();
  const [title, setTitle]               = useState(service.title);
  const [description, setDescription]   = useState(service.description);
  const [category, setCategory]         = useState(service.category);
  const [basePrice, setBasePrice]       = useState(String(service.base_price));
  const [requirements, setRequirements] = useState(service.requirements ?? '');
  const [isActive, setIsActive]         = useState(service.is_active);
  const [location, setLocation]         = useState(service.service_location ?? '');
  const [remoteOk, setRemoteOk]         = useState(service.remote_ok ?? true);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const price = parseFloat(basePrice);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (!category.trim()) {
      setError('Category is required.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      setError('Please enter a valid base price.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:            title.trim(),
          description:      description.trim(),
          category:         category.trim(),
          base_price:       price,
          requirements:     requirements.trim() || null,
          is_active:        isActive,
          service_location: location.trim() || null,
          remote_ok:        remoteOk,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update service. Please try again.');
        return;
      }

      router.push('/freelancer/services');
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Service Details</h2>

        <div>
          <label htmlFor="title" className={labelClass}>Title *</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            placeholder="e.g. I will design your professional logo"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="category" className={labelClass}>Category *</label>
          <input
            type="text"
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            placeholder="e.g. Graphic Design, Tech & Digital"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>Description *</label>
          <textarea
            id="description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Describe what you offer, your process, and what clients will receive…"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label htmlFor="requirements" className={labelClass}>Requirements from client</label>
          <textarea
            id="requirements"
            rows={3}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="What do you need from the client to get started? (optional)"
            className={`${inputClass} resize-none`}
          />
        </div>
      </Card>

      <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Pricing & Availability</h2>

        <div>
          <label htmlFor="base_price" className={labelClass}>Base Price (₦) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium select-none">
              ₦
            </span>
            <input
              type="number"
              id="base_price"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              required
              min="1"
              step="100"
              placeholder="0"
              className={`${inputClass} pl-8`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="location" className={labelClass}>Service Location</label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Lagos, Abuja, or leave blank for remote only"
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="remote_ok"
            checked={remoteOk}
            onChange={(e) => setRemoteOk(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="remote_ok" className="text-sm text-gray-700 dark:text-gray-300">
            Available for remote work
          </label>
        </div>
      </Card>

      <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Service Visibility</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isActive
                ? 'Visible to clients. Uncheck to hide without deleting.'
                : 'Hidden from clients. Check to make it visible again.'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
          </label>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {loading ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/freelancer/services')}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}