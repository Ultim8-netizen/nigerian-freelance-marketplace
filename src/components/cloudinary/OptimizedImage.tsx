// src/components/cloudinary/OptimizedImage.tsx
// Next.js Image component wrapper with Cloudinary optimization using @cloudinary/react

'use client';

import { AdvancedImage, lazyload, responsive, placeholder } from '@cloudinary/react';
import { cld, extractPublicId } from '@/lib/cloudinary/config';
import { fill, scale } from '@cloudinary/url-gen/actions/resize';
import { auto } from '@cloudinary/url-gen/qualifiers/quality';
import { auto as autoFormat } from '@cloudinary/url-gen/qualifiers/format';
import { format } from '@cloudinary/url-gen/actions/delivery';
import { quality } from '@cloudinary/url-gen/actions/delivery';
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
  if (!src) return null;

  const isCloudinaryUrl = src.includes('cloudinary.com');
  const isExternalUrl = src.startsWith('http') && !isCloudinaryUrl;
  const isLocalPath = src.startsWith('/');

  // Anything Cloudinary doesn't host — a local /public path, or an external
  // URL from some other CDN — renders via plain next/image. Cloudinary can
  // only transform assets it actually hosts; routing these through
  // cld.image() would silently produce a broken image URL.
  if (isLocalPath || isExternalUrl) {
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

  // Remaining case: a Cloudinary secure_url, or a bare public ID passed
  // directly with no scheme. extractPublicId() handles both.
  const publicId = extractPublicId(src);

  if (!publicId) {
    return null;
  }

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