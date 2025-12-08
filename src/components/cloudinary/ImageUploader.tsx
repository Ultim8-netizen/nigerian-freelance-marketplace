// src/components/cloudinary/ImageUploader.tsx
// Multi-image uploader with rate limiting, drag-drop, and smart UX features

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { uploadImage, validateImage } from '@/lib/cloudinary/upload';
import { getCardImageUrl } from '@/lib/cloudinary/config';
import { Button } from '@/components/ui/button';
import { X, Upload, Loader2, AlertCircle, ImagePlus, Check } from 'lucide-react';

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  maxUploadsPerHour?: number;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export function ImageUploader({
  images,
  onImagesChange,
  maxImages = 5,
  maxUploadsPerHour = 20,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadResetTime, setUploadResetTime] = useState<Date | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Initialize rate limit tracking from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('imageUploadTracking');
    if (stored) {
      try {
        const { count, resetTime } = JSON.parse(stored);
        const resetDate = new Date(resetTime);
        
        if (new Date() < resetDate) {
          setUploadCount(count);
          setUploadResetTime(resetDate);
        } else {
          // Reset expired tracking
          localStorage.removeItem('imageUploadTracking');
        }
      } catch (error) {
        console.error('Failed to load upload tracking:', error);
        localStorage.removeItem('imageUploadTracking');
      }
    }
  }, []);

  // Save rate limit tracking to localStorage
  const updateUploadTracking = useCallback((newCount: number) => {
    const resetTime = uploadResetTime || new Date(Date.now() + 60 * 60 * 1000);
    
    localStorage.setItem('imageUploadTracking', JSON.stringify({
      count: newCount,
      resetTime: resetTime.toISOString(),
    }));
    
    setUploadCount(newCount);
    if (!uploadResetTime) {
      setUploadResetTime(resetTime);
    }
  }, [uploadResetTime]);

  // Calculate time remaining for rate limit reset
  const getTimeRemaining = useCallback(() => {
    if (!uploadResetTime) return null;
    
    const now = new Date();
    const diff = uploadResetTime.getTime() - now.getTime();
    
    if (diff <= 0) {
      setUploadCount(0);
      setUploadResetTime(null);
      localStorage.removeItem('imageUploadTracking');
      return null;
    }
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }, [uploadResetTime]);

  // Update timer display
  const [timeRemaining, setTimeRemaining] = useState<string | null>(getTimeRemaining());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [getTimeRemaining]);

  // Validate files before upload
  const validateFiles = useCallback((files: File[]): { valid: boolean; error?: string } => {
    // Check max images limit
    if (images.length + files.length > maxImages) {
      return {
        valid: false,
        error: `Maximum ${maxImages} images allowed. You can add ${maxImages - images.length} more.`
      };
    }

    // Check rate limit
    if (uploadCount + files.length > maxUploadsPerHour) {
      return {
        valid: false,
        error: `Upload limit reached (${maxUploadsPerHour}/hour). ${timeRemaining ? `Resets in ${timeRemaining}` : 'Try again later.'}`
      };
    }

    // Validate each file
    for (const file of files) {
      const validation = validateImage(file);
      if (!validation.valid) {
        return { valid: false, error: `${file.name}: ${validation.error}` };
      }
    }

    return { valid: true };
  }, [images.length, maxImages, uploadCount, maxUploadsPerHour, timeRemaining]);

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
  };

  // Process selected files
  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Validate files
    const validation = validateFiles(files);
    if (!validation.valid) {
      setError(validation.error!);
      setTimeout(() => setError(null), 5000);
      return;
    }

    setError(null);
    setIsUploading(true);

    // Initialize progress tracking
    const initialProgress: UploadProgress[] = files.map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'pending' as const,
    }));
    setUploadProgress(initialProgress);

    try {
      const uploadPromises = files.map(async (file, index) => {
        // Update status to uploading
        setUploadProgress(prev => 
          prev.map((p, i) => i === index ? { ...p, status: 'uploading', progress: 25 } : p)
        );

        try {
          const result = await uploadImage(file, 'marketplace/services');
          
          // Update progress
          setUploadProgress(prev => 
            prev.map((p, i) => i === index ? { ...p, progress: 100, status: 'success' } : p)
          );
          
          return result.url;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Upload failed';
          
          setUploadProgress(prev => 
            prev.map((p, i) => i === index ? { 
              ...p, 
              status: 'error', 
              error: errorMessage
            } : p)
          );
          
          throw err;
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const successfulUploads = uploadedUrls.filter(Boolean);
      
      if (successfulUploads.length > 0) {
        onImagesChange([...images, ...successfulUploads]);
        updateUploadTracking(uploadCount + successfulUploads.length);
        
        // Show success message
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
      
      // Clear progress after delay
      setTimeout(() => setUploadProgress([]), 2000);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      await processFiles(files);
    }
  };

  // Remove image with confirmation for first image
  const removeImage = (index: number) => {
    if (index === 0 && images.length > 1) {
      const confirmed = confirm('Remove cover image? The next image will become the cover.');
      if (!confirmed) return;
    }
    
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  // Reorder images (make selected image the cover)
  const makeCover = (index: number) => {
    if (index === 0) return;
    
    const newImages = [...images];
    const [removed] = newImages.splice(index, 1);
    newImages.unshift(removed);
    onImagesChange(newImages);
  };

  const canUpload = !isUploading && 
                    images.length < maxImages && 
                    uploadCount < maxUploadsPerHour;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div 
        className={`border-2 border-dashed rounded-lg transition-colors ${
          isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${!canUpload ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => canUpload && fileInputRef.current?.click()}
      >
        <div className="p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={!canUpload}
          />
          
          {isDragging ? (
            <>
              <ImagePlus className="w-12 h-12 mx-auto text-blue-500 mb-3" />
              <p className="text-blue-600 font-medium">Drop images here</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 mb-2 font-medium">
                {isUploading ? 'Uploading...' : 'Click or drag images here'}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                JPG, PNG, or WebP. Max 5MB each.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mb-4">
                <span>{images.length}/{maxImages} images</span>
                <span>•</span>
                <span>{uploadCount}/{maxUploadsPerHour} uploads used</span>
                {timeRemaining && uploadCount >= maxUploadsPerHour && (
                  <>
                    <span>•</span>
                    <span className="text-orange-600">Resets in {timeRemaining}</span>
                  </>
                )}
              </div>
              {canUpload && (
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={!canUpload}
                  className="mx-auto"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Browse Files
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-600 font-medium">Images uploaded successfully!</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          {uploadProgress.map((progress, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 truncate flex-1">
                  {progress.fileName}
                </span>
                {progress.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                )}
                {progress.status === 'success' && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
                {progress.status === 'error' && (
                  <X className="w-4 h-4 text-red-600" />
                )}
              </div>
              
              {progress.status === 'uploading' && (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              )}
              
              {progress.error && (
                <p className="text-xs text-red-600 mt-1">{progress.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Uploaded Images {images.length > 1 && '(First image is cover)'}
            </p>
            {images.length > 1 && (
              <p className="text-xs text-gray-500">Click an image to make it the cover</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {images.map((image, index) => (
              <div 
                key={index} 
                className={`relative aspect-square group cursor-pointer ${
                  index === 0 ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => makeCover(index)}
              >
                <Image
                  src={getCardImageUrl(image)}
                  alt={`Upload ${index + 1}`}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
                
                {/* Cover Badge */}
                {index === 0 && (
                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-medium">
                    Cover
                  </div>
                )}
                
                {/* Remove Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-700"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Image Number */}
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-medium">
                  #{index + 1}
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && !isUploading && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">
            Add up to {maxImages} high-quality images to showcase your service
          </p>
        </div>
      )}

      {/* Rate Limit Warning */}
      {uploadCount >= maxUploadsPerHour * 0.8 && uploadCount < maxUploadsPerHour && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
          <p className="text-sm text-orange-600">
            Approaching upload limit: {uploadCount}/{maxUploadsPerHour} used
            {timeRemaining && ` (resets in ${timeRemaining})`}
          </p>
        </div>
      )}
    </div>
  );
}