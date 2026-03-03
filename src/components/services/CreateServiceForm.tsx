'use client';

// src/components/services/CreateServiceForm.tsx

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alerts';
import { SERVICE_CATEGORIES } from '@/types/service.categories';
import { CheckCircle, AlertCircle, Plus, Trash2, Upload, X } from 'lucide-react';

interface PackageData {
  name: string;
  description: string;
  price: string;
  delivery_days: string;
  revisions: string;
  features: string[];
}

interface FormData {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  base_price: string;
  delivery_days: string;
  revisions_included: string;
  requirements: string;
  service_location: string;
  location_required: boolean;
  remote_ok: boolean;
  portfolio_links: string[];
  packages: {
    basic: PackageData;
    standard: PackageData;
    premium: PackageData;
  };
}

const emptyPackage = (): PackageData => ({
  name: '',
  description: '',
  price: '',
  delivery_days: '',
  revisions: '1',
  features: [''],
});

const initialForm: FormData = {
  title: '',
  description: '',
  category: '',
  subcategory: '',
  base_price: '',
  delivery_days: '3',
  revisions_included: '1',
  requirements: '',
  service_location: '',
  location_required: false,
  remote_ok: true,
  portfolio_links: [''],
  packages: {
    basic: emptyPackage(),
    standard: emptyPackage(),
    premium: emptyPackage(),
  },
};

export default function CreateServiceForm() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<FormData>(initialForm);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [usePackages, setUsePackages] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (images.length + files.length > 5) {
      setStatus({ type: 'error', message: 'Maximum 5 images allowed.' });
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary is not configured. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.');
      }

      const uploaded: string[] = [];

      for (const file of files) {
        const data = new FormData();
        data.append('file', file);
        data.append('upload_preset', uploadPreset);
        data.append('folder', 'f9/services');

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: data }
        );

        if (!res.ok) throw new Error('Image upload failed. Please try again.');
        const json = await res.json();
        uploaded.push(json.secure_url as string);
      }

      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Image upload failed.',
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePortfolioLink = (index: number, value: string) => {
    const updated = [...form.portfolio_links];
    updated[index] = value;
    setForm({ ...form, portfolio_links: updated });
  };

  const addPortfolioLink = () => {
    if (form.portfolio_links.length < 5) {
      setForm({ ...form, portfolio_links: [...form.portfolio_links, ''] });
    }
  };

  const removePortfolioLink = (index: number) => {
    setForm({
      ...form,
      portfolio_links: form.portfolio_links.filter((_, i) => i !== index),
    });
  };

  const updatePackage = (
    tier: keyof FormData['packages'],
    field: keyof PackageData,
    value: string | string[]
  ) => {
    setForm({
      ...form,
      packages: {
        ...form.packages,
        [tier]: { ...form.packages[tier], [field]: value },
      },
    });
  };

  const addPackageFeature = (tier: keyof FormData['packages']) => {
    const pkg = form.packages[tier];
    updatePackage(tier, 'features', [...pkg.features, '']);
  };

  const updatePackageFeature = (
    tier: keyof FormData['packages'],
    index: number,
    value: string
  ) => {
    const features = [...form.packages[tier].features];
    features[index] = value;
    updatePackage(tier, 'features', features);
  };

  const removePackageFeature = (tier: keyof FormData['packages'], index: number) => {
    updatePackage(
      tier,
      'features',
      form.packages[tier].features.filter((_, i) => i !== index)
    );
  };

  const validateStep1 = () => {
    if (!form.title.trim()) return 'Service title is required.';
    if (!form.description.trim()) return 'Service description is required.';
    if (!form.category) return 'Please select a category.';
    if (!form.base_price || Number(form.base_price) <= 0) return 'Please enter a valid base price.';
    if (!form.delivery_days || Number(form.delivery_days) <= 0) return 'Please enter delivery days.';
    return null;
  };

  const handleNextStep = () => {
    const error = step === 1 ? validateStep1() : null;
    if (error) {
      setStatus({ type: 'error', message: error });
      return;
    }
    setStatus(null);
    setStep((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('You must be logged in to create a service.');

      const portfolioLinks = form.portfolio_links.filter((l) => l.trim() !== '');

      const { data: service, error: serviceError } = await supabase
        .from('services')
        .insert({
          freelancer_id: user.id,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          subcategory: form.subcategory || null,
          base_price: Number(form.base_price),
          currency: 'NGN',
          delivery_days: Number(form.delivery_days),
          revisions_included: Number(form.revisions_included) || 1,
          requirements: form.requirements.trim() || null,
          images: images.length > 0 ? images : null,
          portfolio_links: portfolioLinks.length > 0 ? portfolioLinks : null,
          service_location: form.service_location.trim() || null,
          location_required: form.location_required,
          remote_ok: form.remote_ok,
          is_active: true,
        })
        .select()
        .single();

      if (serviceError) throw serviceError;

      if (usePackages && service) {
        const tiers = ['basic', 'standard', 'premium'] as const;
        const packageInserts = tiers
          .map((tier) => {
            const pkg = form.packages[tier];
            if (!pkg.name.trim() || !pkg.price || !pkg.delivery_days) return null;
            return {
              service_id: service.id,
              package_type: tier,
              name: pkg.name.trim(),
              description: pkg.description.trim() || null,
              price: Number(pkg.price),
              delivery_days: Number(pkg.delivery_days),
              revisions: Number(pkg.revisions) || 1,
              features: pkg.features.filter((f) => f.trim() !== ''),
            };
          })
          .filter(Boolean);

        if (packageInserts.length > 0) {
          const { error: pkgError } = await supabase
            .from('service_packages')
            .insert(packageInserts as Parameters<typeof supabase.from>[0] extends never ? never : never[]);

          if (pkgError) console.warn('Package insert error (non-fatal):', pkgError);
        }
      }

      setStatus({ type: 'success', message: 'Service created successfully! Redirecting...' });
      setTimeout(() => router.push('/freelancer/services'), 1500);
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create service.',
      });
    } finally {
      setSaving(false);
    }
  };

  // FIX 1 (TS2352): Cast to `{ options: readonly string[] }` instead of
  // `{ options: string[] }`. SERVICE_CATEGORIES options are readonly tuples,
  // which are assignable to `readonly string[]` but NOT to mutable `string[]`.
  const subcategoryOptions =
    form.category && SERVICE_CATEGORIES[form.category as keyof typeof SERVICE_CATEGORIES]
      ? (SERVICE_CATEGORIES[form.category as keyof typeof SERVICE_CATEGORIES] as { options: readonly string[] }).options
      : [];

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <React.Fragment key={s}>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                step === s
                  ? 'bg-blue-600 text-white'
                  : step > s
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-1 rounded transition-colors ${
                  step > s ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 -mt-2">
        <span>Service Details</span>
        <span>Media & Portfolio</span>
        <span>Packages</span>
      </div>

      {status && (
        <Alert variant={status.type}>
          <div className="flex items-start gap-2">
            {status.type === 'success' ? (
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <AlertDescription>{status.message}</AlertDescription>
          </div>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── STEP 1: Service Details ───────────────────────────────────── */}
        {step === 1 && (
          <Card className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">Service Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Service Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. I will design a professional logo for your brand"
                maxLength={80}
              />
              <p className="text-xs text-gray-500 mt-1">
                {form.title.length}/80 characters. Be specific and clear.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe your service in detail. What will you deliver? What makes you the right person for this?"
                className="min-h-36"
                maxLength={2000}
              />
              <p className="text-xs text-gray-500 mt-1">{form.description.length}/2000 characters</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: '' })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a category</option>
                  {Object.entries(SERVICE_CATEGORIES).map(([key, cat]) => (
                    <option key={key} value={key}>
                      {(cat as { label: string }).label}
                    </option>
                  ))}
                </select>
              </div>

              {subcategoryOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Subcategory
                  </label>
                  <select
                    value={form.subcategory}
                    onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select subcategory</option>
                    {subcategoryOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Base Price (₦) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={form.base_price}
                  onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                  placeholder="5000"
                  min="100"
                  step="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Delivery Days <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={form.delivery_days}
                  onChange={(e) => setForm({ ...form, delivery_days: e.target.value })}
                  placeholder="3"
                  min="1"
                  max="90"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Revisions Included
                </label>
                <Input
                  type="number"
                  value={form.revisions_included}
                  onChange={(e) => setForm({ ...form, revisions_included: e.target.value })}
                  placeholder="1"
                  min="0"
                  max="10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Client Requirements
              </label>
              <Textarea
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                placeholder="What do you need from the client to get started? (e.g. brand colors, reference images, text content)"
                className="min-h-24"
              />
            </div>

            {/* Location */}
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="text-sm font-semibold">Location Settings</h3>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="remote_ok"
                  checked={form.remote_ok}
                  onChange={(e) => setForm({ ...form, remote_ok: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
                <label htmlFor="remote_ok" className="text-sm text-gray-700 dark:text-gray-300">
                  Available for remote work
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="location_required"
                  checked={form.location_required}
                  onChange={(e) => setForm({ ...form, location_required: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
                <label htmlFor="location_required" className="text-sm text-gray-700 dark:text-gray-300">
                  Requires in-person/local delivery
                </label>
              </div>
              {form.location_required && (
                <Input
                  value={form.service_location}
                  onChange={(e) => setForm({ ...form, service_location: e.target.value })}
                  placeholder="e.g. Lagos Island, Lagos"
                />
              )}
            </div>
          </Card>
        )}

        {/* ── STEP 2: Media & Portfolio ────────────────────────────────── */}
        {step === 2 && (
          <Card className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">Media & Portfolio</h2>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Service Images (up to 5)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {images.map((url, i) => (
                  <div key={i} className="relative group aspect-video rounded-lg overflow-hidden border">
                    {/*
                      FIX 2 (no-img-element): Replaced <img> with next/image <Image />.
                      - `fill` makes it behave like w-full h-full (requires position:relative on parent).
                      - `sizes` gives the browser accurate viewport hints to pick the right srcset entry.
                      - `object-cover` preserves the original crop behaviour.
                      - `z-10` on the delete button keeps it above the image layer.
                    */}
                    <Image
                      src={url}
                      alt={`Service image ${i + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 z-10 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="aspect-video rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center cursor-pointer transition-colors">
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">
                      {uploading ? 'Uploading...' : 'Upload image'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Show off your best work. JPEG, PNG, WebP accepted. Max 5MB per image.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Portfolio Links (optional)
              </label>
              <div className="space-y-2">
                {form.portfolio_links.map((link, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={link}
                      onChange={(e) => updatePortfolioLink(i, e.target.value)}
                      placeholder="https://behance.net/yourwork"
                      type="url"
                    />
                    {form.portfolio_links.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removePortfolioLink(i)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {form.portfolio_links.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPortfolioLink}
                  className="mt-2 gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Link
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* ── STEP 3: Packages ──────────────────────────────────────────── */}
        {step === 3 && (
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Service Packages</h2>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="usePackages"
                  checked={usePackages}
                  onChange={(e) => setUsePackages(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <label htmlFor="usePackages" className="text-sm font-medium">
                  Offer tiered packages
                </label>
              </div>
            </div>

            {!usePackages ? (
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Packages let you offer Basic, Standard, and Premium tiers at different prices.
                  Toggle on to set them up, or skip to publish with your base price only.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {(['basic', 'standard', 'premium'] as const).map((tier) => (
                  <div key={tier} className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold capitalize text-gray-900 dark:text-white">
                      {tier} Package
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1">Package Name</label>
                        <Input
                          value={form.packages[tier].name}
                          onChange={(e) => updatePackage(tier, 'name', e.target.value)}
                          placeholder={tier === 'basic' ? 'Starter' : tier === 'standard' ? 'Professional' : 'Enterprise'}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Price (₦)</label>
                        <Input
                          type="number"
                          value={form.packages[tier].price}
                          onChange={(e) => updatePackage(tier, 'price', e.target.value)}
                          placeholder="5000"
                          min="100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Delivery Days</label>
                        <Input
                          type="number"
                          value={form.packages[tier].delivery_days}
                          onChange={(e) => updatePackage(tier, 'delivery_days', e.target.value)}
                          placeholder="3"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Revisions</label>
                        <Input
                          type="number"
                          value={form.packages[tier].revisions}
                          onChange={(e) => updatePackage(tier, 'revisions', e.target.value)}
                          placeholder="1"
                          min="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Description</label>
                      <Input
                        value={form.packages[tier].description}
                        onChange={(e) => updatePackage(tier, 'description', e.target.value)}
                        placeholder="What's included in this package?"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-2">Features</label>
                      <div className="space-y-2">
                        {form.packages[tier].features.map((feat, fi) => (
                          <div key={fi} className="flex gap-2">
                            <Input
                              value={feat}
                              onChange={(e) => updatePackageFeature(tier, fi, e.target.value)}
                              placeholder="e.g. Source files included"
                            />
                            {form.packages[tier].features.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => removePackageFeature(tier, fi)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addPackageFeature(tier)}
                        className="mt-2 gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Feature
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-4">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev))}
            >
              ← Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button type="button" onClick={handleNextStep}>
              Continue →
            </Button>
          ) : (
            <Button type="submit" loading={saving} className="gap-2">
              <CheckCircle className="w-4 h-4" />
              {saving ? 'Publishing...' : 'Publish Service'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}