// src/components/services/CreateServiceForm.tsx
// Service creation form with custom service support

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '@/components/cloudinary/ImageUploader';
import { SERVICE_CATEGORIES } from '@/types/service-categories';
import { NIGERIAN_STATES } from '@/types/location.types';
import { Loader2, Info } from 'lucide-react';

export function CreateServiceForm() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [customService, setCustomService] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    base_price: '',
    delivery_days: '',
  });

  const handleCategoryChange = (categoryKey: string) => {
    setSelectedCategory(categoryKey);
    setSelectedService('');
    setCustomService('');
  };

  const handleServiceChange = (service: string) => {
    setSelectedService(service);
    if (service !== 'Custom Service (Specify)') {
      setCustomService('');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Determine final category
    const finalCategory = selectedService === 'Custom Service (Specify)' 
      ? customService 
      : selectedService;

    if (!finalCategory) {
      setError('Please select or specify a service category');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          category: finalCategory,
          base_price: parseFloat(formData.base_price),
          delivery_days: parseInt(formData.delivery_days),
          images,
          service_location: serviceLocation || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push('/freelancer/services');
        router.refresh();
      } else {
        setError(result.error || 'Failed to create service');
      }
    } catch (error) {
      console.error('Error creating service:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = selectedCategory 
    ? SERVICE_CATEGORIES[selectedCategory as keyof typeof SERVICE_CATEGORIES]?.options || []
    : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {/* Service Category Selection */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">What Service Do You Offer?</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="category-group" className="block text-sm font-medium mb-2">
              Service Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category-group"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">Choose a category</option>
              {Object.entries(SERVICE_CATEGORIES).map(([key, cat]) => (
                <option key={key} value={key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {selectedCategory && (
            <div>
              <label htmlFor="service-type" className="block text-sm font-medium mb-2">
                Specific Service <span className="text-red-500">*</span>
              </label>
              <select
                id="service-type"
                value={selectedService}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select a service</option>
                {categoryOptions.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedService === 'Custom Service (Specify)' && (
            <div>
              <label htmlFor="custom-service" className="block text-sm font-medium mb-2">
                Specify Your Service <span className="text-red-500">*</span>
              </label>
              <Input
                id="custom-service"
                value={customService}
                onChange={(e) => setCustomService(e.target.value)}
                placeholder="e.g., Shoe Cleaning, Nail Art, Pet Sitting"
                required
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">
                Describe the service you want to offer
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Service Details */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Service Details</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Service Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., I will help with your assignments and projects"
              required
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">
              Make it clear and specific
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what you'll do, what's included, your experience, etc."
              required
              rows={6}
              maxLength={2000}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.description.length}/2000 characters
            </p>
          </div>
        </div>
      </Card>

      {/* Pricing & Delivery */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Pricing & Timeline</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="base_price" className="block text-sm font-medium mb-2">
              Starting Price (₦) <span className="text-red-500">*</span>
            </label>
            <Input
              id="base_price"
              name="base_price"
              type="number"
              value={formData.base_price}
              onChange={handleChange}
              placeholder="2000"
              min="500"
              step="100"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum: ₦500
            </p>
          </div>

          <div>
            <label htmlFor="delivery_days" className="block text-sm font-medium mb-2">
              Delivery Time (days) <span className="text-red-500">*</span>
            </label>
            <Input
              id="delivery_days"
              name="delivery_days"
              type="number"
              value={formData.delivery_days}
              onChange={handleChange}
              placeholder="3"
              min="1"
              max="90"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              How long will it take?
            </p>
          </div>
        </div>
      </Card>

      {/* Location */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Your Location</h3>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex gap-2">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Your location helps buyers find services nearby. All services can be offered remotely or locally - it's up to you and the buyer to agree.
          </p>
        </div>

        <div>
          <label htmlFor="service-location" className="block text-sm font-medium mb-2">
            Your State (Optional)
          </label>
          <select
            id="service-location"
            value={serviceLocation}
            onChange={(e) => setServiceLocation(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">Prefer not to say</option>
            {NIGERIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            This shows your general location, not your exact address
          </p>
        </div>
      </Card>

      {/* Images */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">
          Showcase Your Work <span className="text-red-500">*</span>
        </h3>
        <ImageUploader
          images={images}
          onImagesChange={setImages}
          maxImages={5}
        />
        <p className="text-xs text-gray-500 mt-2">
          Upload 1-5 images of your previous work or what buyers should expect. Good photos get more orders!
        </p>
      </Card>

      {/* Submit Button */}
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
              Creating Service...
            </>
          ) : (
            'Create Service'
          )}
        </Button>
      </div>
    </form>
  );
}