// src/components/cloudinary/OptimizedImage.tsx
// Next.js Image component wrapper with Cloudinary optimization

'use client';

import Image, { ImageProps } from 'next/image';
import { getOptimizedImageUrl } from '@/lib/cloudinary/config';
import { CloudinaryMonitor } from '@/lib/cloudinary/monitoring';

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src: string;
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
      {...props}
    />
  );
}