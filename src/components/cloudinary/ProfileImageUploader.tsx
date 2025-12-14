// src/components/cloudinary/ProfileImageUploader.tsx
// Specialized uploader for profile pictures with cropping

'use client';

import { useState, useRef } from 'react';
import { AdvancedImage, lazyload } from '@cloudinary/react';
import { cld } from '@/lib/cloudinary/config';
import { fill } from '@cloudinary/url-gen/actions/resize';
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity';
import { AutoFocus } from '@cloudinary/url-gen/qualifiers/autoFocus';
import { FocusOn } from '@cloudinary/url-gen/qualifiers/focusOn';
import { auto } from '@cloudinary/url-gen/qualifiers/quality';
import { auto as autoFormat } from '@cloudinary/url-gen/qualifiers/format';
import { format } from '@cloudinary/url-gen/actions/delivery';
import { quality } from '@cloudinary/url-gen/actions/delivery';
import { uploadImage, validateImage } from '@/lib/cloudinary/upload';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';

interface ProfileImageUploaderProps {
  currentImage?: string;
  onUploadComplete: (url: string) => void;
  onRemove?: () => void;
}

export function ProfileImageUploader({
  currentImage,
  onUploadComplete,
  onRemove,
}: ProfileImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImage(file);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const result = await uploadImage(file, 'marketplace/profiles');
      onUploadComplete(result.url);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Helper to get public ID from URL
  const getPublicId = (imageUrl: string): string => {
    if (imageUrl.includes('cloudinary.com')) {
      return imageUrl.split('/upload/').pop()?.split('.')[0] || imageUrl;
    }
    return imageUrl;
  };

  // Generate profile thumbnail
  const getProfileThumbnail = () => {
    if (!currentImage) return null;
    
    const publicId = getPublicId(currentImage);
    return cld.image(publicId)
      .resize(
        fill()
          .width(200)
          .height(200)
          .gravity(autoGravity().autoFocus(AutoFocus.focusOn(FocusOn.faces())))
      )
      .delivery(format(autoFormat()))
      .delivery(quality(auto()));
  };

  const profileImage = getProfileThumbnail();

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
          {profileImage ? (
            <AdvancedImage
              cldImg={profileImage}
              alt="Profile"
              plugins={[lazyload()]}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Camera className="w-12 h-12" />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {currentImage && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-600 hover:text-red-700"
        >
          Remove Photo
        </Button>
      )}
    </div>
  );
}