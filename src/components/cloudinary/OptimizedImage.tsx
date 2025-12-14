// src/components/cloudinary/OptimizedImage.tsx
// Next.js Image component wrapper with Cloudinary optimization using @cloudinary/react

'use client';

import { AdvancedImage, lazyload, responsive, placeholder } from '@cloudinary/react';
import { cld } from '@/lib/cloudinary/config';
import { fill, scale } from '@cloudinary/url-gen/actions/resize';
import { auto } from '@cloudinary/url-gen/qualifiers/quality';
import { auto as autoFormat } from '@cloudinary/url-gen/qualifiers/format';
import { format } from '@cloudinary/url-gen/actions/delivery';
import { quality } from '@cloudinary/url-gen/actions/delivery';
import { CloudinaryMonitor } from '@/lib/cloudinary/monitoring';
import { useEffect } from 'react';
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: 'auto:low' | 'auto:good' | 'auto:best';
  className?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  fill: fillProp = false,
  sizes,
  objectFit = 'cover',
}: OptimizedImageProps) {
  // Track transformation usage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      CloudinaryMonitor.trackTransformation();
    }
  }, [src]);

  // If not a Cloudinary image, use Next.js Image component
  if (!src.includes('cloudinary.com') && !src.startsWith('http')) {
    const isCloudinaryPublicId = !src.startsWith('http');
    
    if (!isCloudinaryPublicId) {
      return (
        <Image
          src={src}
          alt={alt}
          width={width || 800}
          height={height || 600}
          className={className}
          style={{ objectFit }}
        />
      );
    }
  }

  // Extract public ID from URL or use as-is
  const publicId = src.includes('cloudinary.com')
    ? src.split('/upload/').pop()?.split('.')[0] || src
    : src;

  // Build Cloudinary image with transformations
  let image = cld.image(publicId);

  // Apply resize transformations
  if (fillProp || (width && height)) {
    image = image.resize(
      fill()
        .width(width || 800)
        .height(height || 600)
    );
  } else if (width) {
    image = image.resize(scale().width(width));
  } else if (height) {
    image = image.resize(scale().height(height));
  }

  // Apply delivery optimizations
  image = image
    .delivery(format(autoFormat()))
    .delivery(quality(auto()));

  // Build plugins array
  const plugins = [lazyload()];
  
  if (sizes) {
    plugins.push(responsive({ steps: [200, 400, 600, 800, 1000, 1200] }));
  }
  
  if (!priority) {
    plugins.push(placeholder({ mode: 'blur' }));
  }

  return (
    <AdvancedImage
      cldImg={image}
      alt={alt}
      className={className}
      plugins={plugins}
      style={{
        width: fillProp ? '100%' : width ? `${width}px` : 'auto',
        height: fillProp ? '100%' : height ? `${height}px` : 'auto',
        objectFit,
      }}
    />
  );
}