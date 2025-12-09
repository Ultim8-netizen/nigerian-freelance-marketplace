// src/app/marketplace/seller/products/new/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreateProductForm } from '@/components/marketplace/CreateProductForm';

export default async function CreateProductPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/marketplace/seller/products/new');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">List a Product</h1>
            <p className="text-gray-600">
              Sell your items to students across Nigeria
            </p>
          </div>

          <CreateProductForm />
        </div>
      </div>
    </div>
  );
}

// src/components/marketplace/CreateProductForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ImageUploader } from '@/components/cloudinary/ImageUploader';
import { Loader2, Info } from 'lucide-react';

const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Books & Stationery',
  'Home & Kitchen',
  'Sports & Outdoors',
  'Beauty & Health',
  'Food & Drinks',
  'Other',
];

const DELIVERY_OPTIONS = [
  'Pickup',
  'Campus Delivery',
  'Local Delivery',
  'Nationwide Shipping',
];

export function CreateProductForm() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used',
    delivery_options: [] as string[],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDeliveryToggle = (option: string) => {
    const current = formData.delivery_options;
    if (current.includes(option)) {
      setFormData({ 
        ...formData, 
        delivery_options: current.filter(o => o !== option) 
      });
    } else {
      setFormData({ 
        ...formData, 
        delivery_options: [...current, option] 
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    if (formData.delivery_options.length === 0) {
      setError('Please select at least one delivery option');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          images,
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/marketplace/products/${result.data.id}`);
        router.refresh();
      } else {
        setError(result.error || 'Failed to create product');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {/* Product Images */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">
          Product Images <span className="text-red-500">*</span>
        </h3>
        <ImageUploader
          images={images}
          onImagesChange={setImages}
          maxImages={8}
        />
        <p className="text-sm text-gray-500 mt-2">
          Upload 1-8 high-quality images. First image will be the cover.
        </p>
      </Card>

      {/* Basic Information */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Product Details</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Product Title <span className="text-red-500">*</span>
            </label>
            <Input
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., iPhone 12 Pro Max - 128GB"
              required
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <Textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your product in detail..."
              required
              rows={6}
              maxLength={2000}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.description.length}/2000 characters
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Price (₦) <span className="text-red-500">*</span>
              </label>
              <Input
                name="price"
                type="number"
                value={formData.price}
                onChange={handleChange}
                placeholder="50000"
                required
                min="100"
                step="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select category</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Condition <span className="text-red-500">*</span>
            </label>
            <select
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="used">Used</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Delivery Options */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">
          Delivery Options <span className="text-red-500">*</span>
        </h3>
        
        <div className="space-y-3">
          {DELIVERY_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={formData.delivery_options.includes(option)}
                onChange={() => handleDeliveryToggle(option)}
                className="w-5 h-5"
              />
              <span className="font-medium">{option}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded flex gap-2">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Select all delivery methods you're willing to offer. More options increase your chances of sales.
          </p>
        </div>
      </Card>

      {/* Submit */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={images.length === 0 || isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Product...
            </>
          ) : (
            'List Product'
          )}
        </Button>
      </div>
    </form>
  );
}