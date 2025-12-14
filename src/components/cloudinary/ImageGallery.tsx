// src/components/cloudinary/ImageGallery.tsx
'use client';

import { useState, useEffect } from 'react';
import { AdvancedImage, lazyload, responsive } from '@cloudinary/react';
import { cld } from '@/lib/cloudinary/config';
import { fill, limitFit } from '@cloudinary/url-gen/actions/resize';
import { auto } from '@cloudinary/url-gen/qualifiers/quality';
import { auto as autoFormat } from '@cloudinary/url-gen/qualifiers/format';
import { format } from '@cloudinary/url-gen/actions/delivery';
import { quality } from '@cloudinary/url-gen/actions/delivery';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageGalleryProps {
  images: string[];
  alt: string;
}

export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
  };

  useEffect(() => {
    if (selectedIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedIndex]);

  const goToPrevious = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex + 1) % images.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
  };

  // Helper to get public ID from URL or use as-is
  const getPublicId = (imageUrl: string): string => {
    if (imageUrl.includes('cloudinary.com')) {
      return imageUrl.split('/upload/').pop()?.split('.')[0] || imageUrl;
    }
    return imageUrl;
  };

  // Generate card image (400x300)
  const getCardImage = (imageUrl: string) => {
    const publicId = getPublicId(imageUrl);
    return cld.image(publicId)
      .resize(fill().width(400).height(300))
      .delivery(format(autoFormat()))
      .delivery(quality(auto()));
  };

  // Generate full image (1200px width)
  const getFullImage = (imageUrl: string) => {
    const publicId = getPublicId(imageUrl);
    return cld.image(publicId)
      .resize(limitFit().width(1200))
      .delivery(format(autoFormat()))
      .delivery(quality(auto()));
  };

  return (
    <>
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => openLightbox(index)}
            className="relative aspect-square overflow-hidden rounded-lg hover:opacity-90 transition-opacity"
          >
            <AdvancedImage
              cldImg={getCardImage(image)}
              alt={`${alt} ${index + 1}`}
              plugins={[lazyload(), responsive({ steps: [200, 400, 600] })]}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Previous Button */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-4 text-white hover:text-gray-300"
            >
              <ChevronLeft className="w-12 h-12" />
            </button>
          )}

          {/* Image */}
          <div
            className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <AdvancedImage
              cldImg={getFullImage(images[selectedIndex])}
              alt={`${alt} ${selectedIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Next Button */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-4 text-white hover:text-gray-300"
            >
              <ChevronRight className="w-12 h-12" />
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
            {selectedIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}