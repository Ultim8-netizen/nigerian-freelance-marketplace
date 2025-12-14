'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Image as ImageIcon, Send, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// --- Type Definitions (Mocked for Form) ---
interface FormData {
  title: string;
  description: string;
  price: number | '';
  category: string;
  condition: 'new' | 'used' | 'refurbished' | '';
  location: string;
  images: File[];
}

// --- Component Implementation ---

export function CreateProductForm() {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: '',
    location: '',
    images: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const MAX_IMAGES = 4;
  
  // Simulated list of common categories for F9 (campus/community focused)
  const categories = [
    'Electronics & Gadgets', 'Fashion & Apparel', 'Books & Stationery',
    'Food & Beverages (Packaged)', 'Home & Kitchen', 'Art & Handmade',
    'Services (Physical)', 'Other',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: keyof FormData, value: string) => {
    // Handle specific value parsing for condition/category
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const combinedFiles = [...formData.images, ...filesArray].slice(0, MAX_IMAGES); // Limit total images
      
      setFormData(prev => ({ ...prev, images: combinedFiles }));
      // Clear the input value so the same file can be selected again after deletion
      e.target.value = ''; 
    }
  };
  
  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // 1. Basic Validation (Client-side)
    if (!formData.title || !formData.description || formData.price === '' || formData.images.length === 0) {
      
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields and upload at least one image.',
        variant: 'destructive',
      });
      
      setIsSubmitting(false);
      return;
    }

    // 2. Simulate API Call
    console.log('Product Data to be Sent:', formData);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay
      
      toast({
        title: 'Success!',
        description: 'Product listed successfully. Check your Seller Dashboard.',
        variant: 'success',
      });

      setFormData({
        title: '',
        description: '',
        price: '',
        category: '',
        condition: '',
        location: '',
        images: [],
      });
      
    } catch (error) {
      console.error('Submission Error:', error);
      
      toast({
        title: 'Submission Failed',
        description: 'A network error occurred. Please check your connection and try again.',
        variant: 'destructive',
      });
      
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto my-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <PlusCircle className="w-6 h-6 text-blue-600" />
          List a New Product
        </CardTitle>
        <CardDescription>
          Get your goods visible to the F9 community. Free to list, hassle-free selling.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Product Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">1. Core Information</h3>
            
            <div>
              <Label htmlFor="title">Product Title *</Label>
              <Input
                id="title"
                placeholder="E.g., Original Samsung Charger (Used) or Hand-made Campus Tote Bag"
                value={formData.title}
                onChange={handleInputChange}
                required
                maxLength={100}
              />
            </div>
            
            <div>
              <Label htmlFor="description">Detailed Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe your product's condition, features, size, and selling points. Max 500 characters."
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-right text-gray-500 mt-1">
                {formData.description.length} / 500
              </p>
            </div>
          </div>
          
          {/* Section 2: Pricing and Condition */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="price">Price (₦) *</Label>
              <Input
                id="price"
                type="number"
                placeholder="5000"
                value={formData.price}
                onChange={handleInputChange}
                required
                min="100" // Minimum realistic price for a transaction
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="condition">Condition</Label>
              <Select 
                value={formData.condition} 
                onValueChange={(val: 'new' | 'used' | 'refurbished') => handleSelectChange('condition', val)}
                required
              >
                <SelectTrigger id="condition">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Brand New</SelectItem>
                  <SelectItem value="used">Used (Fair/Good Condition)</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(val) => handleSelectChange('category', val)}
                required
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Section 3: Images (Crucial for Marketplace) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                2. Product Images *
            </h3>
            <p className="text-sm text-gray-600">
                Upload up to {MAX_IMAGES} clear photos. Fast-loading images are prioritized for F9&apos;s network-optimized design.
            </p>
            
            <div className="flex flex-wrap gap-4">
              {/* Image Previews */}
              {formData.images.map((file, index) => (
                <div key={index} className="relative w-24 h-24 border rounded-md overflow-hidden">
                  <ImagePreview file={file} />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-bl-md text-xs font-bold hover:bg-red-700 transition"
                    aria-label="Remove image"
                  >
                    X
                  </button>
                </div>
              ))}
              
              {/* Image Upload Button */}
              {formData.images.length < MAX_IMAGES && (
                <Label 
                  htmlFor="images" 
                  className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed rounded-md cursor-pointer hover:bg-gray-50 transition"
                >
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                  <span className="text-xs mt-1 text-gray-500">Add Photo</span>
                </Label>
              )}
              <Input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden" // Hide the default input, use the Label for clicking
                disabled={formData.images.length >= MAX_IMAGES}
              />
            </div>
          </div>
          
          {/* Section 4: Location (Important for community-based F9) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">3. Pickup Location</h3>
            <p className="text-sm text-gray-600">
                Buyers need to know where to find your product. Use a public/general location (e.g., *Unilag Gate*, *Wuse Market*)
            </p>
            <div>
              <Label htmlFor="location">General Pickup/Shipping Location</Label>
              <Input
                id="location"
                placeholder="E.g., Abuja (Wuse 2) or UNIPORT Main Campus"
                value={formData.location}
                onChange={handleInputChange}
                maxLength={100}
              />
            </div>
          </div>
          
          {/* Submission Button */}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Listing Product...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                List Product Now (Free)
              </>
            )}
          </Button>
          
          <p className="text-xs text-center text-gray-500 pt-2">
            {/* FIX: Applied escape sequence for apostrophe */}
            By listing, you agree to F9&apos;s policy on **Absolute Neutrality** and that all transactions are covered by **Escrow Protection** (for safety).
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

// Simple internal component to display image preview from File object
const ImagePreview: React.FC<{ file: File }> = ({ file }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  React.useEffect(() => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Clean up memory
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [file, imageUrl]);

  if (!imageUrl) return <div className="w-full h-full bg-gray-300 animate-pulse" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt="Product preview"
      className="w-full h-full object-cover"
    />
  );
};