'use client';

import React, { useState, } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Image as ImageIcon, Send, Loader2, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface FormData {
  title: string;
  description: string;
  price: number | '';
  category: string;
  condition: 'new' | 'used' | 'refurbished' | '';
  location: string;
  images: File[];
}

export function CreateProductForm() {
  const router = useRouter();
  const MAX_IMAGES = 2; // Cloudinary free tier optimization
  
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
  
  const categories = [
    'Electronics & Gadgets',
    'Fashion & Apparel',
    'Books & Stationery',
    'Food & Beverages (Packaged)',
    'Home & Kitchen',
    'Art & Handmade',
    'Services (Physical)',
    'Other',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      
      // Enforce max limit
      if (formData.images.length + filesArray.length > MAX_IMAGES) {
        toast({ 
          title: "Limit Reached", 
          description: `You can only upload ${MAX_IMAGES} photos.`, 
          variant: "destructive" 
        });
        return;
      }
      
      setFormData(prev => ({ ...prev, images: [...prev.images, ...filesArray] }));
      e.target.value = ''; // Clear input for re-selection
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
    
    // Client-side validation
    if (!formData.title || !formData.description || formData.price === '' || !formData.category || !formData.condition) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    if (formData.images.length === 0) {
      toast({
        title: 'Images Required',
        description: 'Please upload at least one product image.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // TODO: Implement actual API call
      console.log('Product Data to be Sent:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: 'Success!',
        description: 'Product listed successfully. Redirecting to your dashboard...',
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        price: '',
        category: '',
        condition: '',
        location: '',
        images: [],
      });

      // Redirect to seller dashboard
      router.push('/marketplace/seller/products');
      
    } catch (error) {
      console.error('Submission Error:', error);
      
      toast({
        title: 'Submission Failed',
        description: 'A network error occurred. Please try again.',
        variant: 'destructive',
      });
      
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto my-8 bg-white border-gray-200 shadow-lg">
      <CardHeader className="bg-linear-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <PlusCircle className="w-6 h-6" />
          List a New Product
        </CardTitle>
        <CardDescription className="text-purple-100">
          Get your goods visible to the F9 community. Free to list, hassle-free selling.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Core Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 text-gray-900">1. Core Information</h3>
            
            <div>
              <Label htmlFor="title" className="text-gray-700">Product Title *</Label>
              <Input
                id="title"
                className="bg-white text-gray-900 border-gray-300"
                placeholder="e.g., iPhone 12 Pro Max or Hand-made Campus Tote Bag"
                value={formData.title}
                onChange={handleInputChange}
                required
                maxLength={100}
              />
            </div>
            
            <div>
              <Label htmlFor="description" className="text-gray-700">Detailed Description *</Label>
              <Textarea
                id="description"
                className="bg-white text-gray-900 border-gray-300"
                placeholder="Describe your product's condition, features, size, and selling points."
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
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 text-gray-900">2. Pricing & Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="price" className="text-gray-700">Price (₦) *</Label>
                <Input
                  id="price"
                  type="number"
                  className="bg-white text-gray-900 border-gray-300"
                  placeholder="50000"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                  min="100"
                />
              </div>

              <div>
                <Label htmlFor="condition" className="text-gray-700">Condition *</Label>
                <Select 
                  value={formData.condition} 
                  onValueChange={(val: 'new' | 'used' | 'refurbished') => handleSelectChange('condition', val)}
                >
                  <SelectTrigger id="condition" className="bg-white text-gray-900 border-gray-300">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="new">Brand New</SelectItem>
                    <SelectItem value="used">Used (Good Condition)</SelectItem>
                    <SelectItem value="refurbished">Refurbished</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category" className="text-gray-700">Category *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(val) => handleSelectChange('category', val)}
                >
                  <SelectTrigger id="category" className="bg-white text-gray-900 border-gray-300">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Section 3: Images */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 text-gray-900">3. Product Images *</h3>
            <p className="text-sm text-gray-600">
              Upload up to {MAX_IMAGES} clear photos. ({formData.images.length}/{MAX_IMAGES} uploaded)
            </p>
            
            <div className="flex flex-wrap gap-4">
              {/* Image Previews */}
              {formData.images.map((file, index) => (
                <div key={index} className="relative w-24 h-24 border-2 border-gray-300 rounded-lg overflow-hidden shadow-sm">
                  <ImagePreview file={file} />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition shadow-md"
                    aria-label="Remove image"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              
              {/* Upload Button */}
              {formData.images.length < MAX_IMAGES && (
                <Label 
                  htmlFor="images" 
                  className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-purple-400 transition"
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
                className="hidden"
                disabled={formData.images.length >= MAX_IMAGES}
              />
            </div>
            <p className="text-xs text-gray-500">
              Clear photos help attract buyers. First image will be the main display.
            </p>
          </div>
          
          {/* Section 4: Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 text-gray-900">4. Pickup Location</h3>
            <p className="text-sm text-gray-600">
              Buyers need to know where to find your product. Use a public location.
            </p>
            <div>
              <Label htmlFor="location" className="text-gray-700">General Location</Label>
              <Input
                id="location"
                className="bg-white text-gray-900 border-gray-300"
                placeholder="e.g., Abuja (Wuse 2) or UNIPORT Main Campus"
                value={formData.location}
                onChange={handleInputChange}
                maxLength={100}
              />
            </div>
          </div>
          
          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md" 
            disabled={isSubmitting}
          >
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
            By listing, you agree to F9&apos;s marketplace policies. All transactions are protected by escrow.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

// Image Preview Component
const ImagePreview: React.FC<{ file: File }> = ({ file }) => {
  // Generate the URL only when the file changes
  const imageUrl = React.useMemo(() => URL.createObjectURL(file), [file]);

  // Handle cleanup separately
  React.useEffect(() => {
    return () => {
      URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={imageUrl}
      alt="Product preview"
      className="w-full h-full object-cover"
    />
  );
};