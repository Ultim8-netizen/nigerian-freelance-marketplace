// src/components/cloudinary/OptimizedImage.tsx
// Next.js Image component wrapper with Cloudinary optimization

'use client';

import Image, { ImageProps } from 'next/image';
import { getOptimizedImageUrl } from '@/lib/cloudinary/config';
import { CloudinaryMonitor } from '@/lib/cloudinary/monitoring';

// ---------------------------
// FIX: Omit 'quality' from ImageProps before extending
// ---------------------------
interface OptimizedImageProps 
  extends Omit<ImageProps, 'src' | 'quality'> // <-- OMIT 'quality' HERE
{
  src: string;
  // Redefine 'quality' with your desired Cloudinary types
  quality?: 'auto:low' | 'auto:good' | 'auto:best'; 
}

export function OptimizedImage({
  src,
  width,
  height,
  quality = 'auto:good',
  alt,
  ...props
}: OptimizedImageProps) {
  // Track transformation usage
  if (typeof window !== 'undefined') {
    CloudinaryMonitor.trackTransformation();
  }

  // Generate optimized URL if it's a Cloudinary image
  const optimizedSrc = src.includes('cloudinary.com')
    ? getOptimizedImageUrl(
        src,
        typeof width === 'number' ? width : undefined,
        typeof height === 'number' ? height : undefined,
        quality
      )
    : src;

  return (
    <Image
      src={optimizedSrc}
      width={width}
      height={height}
      alt={alt}
      // Note: Next.js 'quality' prop is intentionally omitted here 
      // because we handle image optimization via the 'optimizedSrc' URL.
      // If Next.js 'quality' were required, you'd need to convert the 
      // Cloudinary string ('auto:good') to a number (0-100) for the Image component.
      {...props}
    />
  );
}