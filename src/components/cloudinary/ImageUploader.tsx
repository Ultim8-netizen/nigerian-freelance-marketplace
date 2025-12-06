// src/components/cloudinary/ImageUploader.tsx
// Multi-image uploader for service listings

'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { uploadImage, validateImage } from '@/lib/cloudinary/upload';
import { getCardImageUrl } from '@/lib/cloudinary/config';
import { Button } from '@/components/ui/button';
import { X, Upload, Loader2 } from 'lucide-react';

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUploader({
  images,
  onImagesChange,
  maxImages = 5,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed max
    if (images.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const validation = validateImage(file);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
        
        const result = await uploadImage(file, 'marketplace/services');
        return result.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      onImagesChange([...images, ...uploadedUrls]);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading || images.length >= maxImages}
        />
        
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || images.length >= maxImages}
          variant="outline"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Images ({images.length}/{maxImages})
            </>
          )}
        </Button>

        <p className="text-sm text-gray-500">
          JPG, PNG, or WebP. Max 5MB each.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative aspect-square group">
              <Image
                src={getCardImageUrl(image)}
                alt={`Upload ${index + 1}`}
                fill
                className="object-cover rounded-lg"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
              />
              
              {/* Remove Button */}
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Image Number */}
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 mb-2">No images uploaded yet</p>
          <p className="text-sm text-gray-500">
            Click "Upload Images" to add photos of your work
          </p>
        </div>
      )}
    </div>
  );
}