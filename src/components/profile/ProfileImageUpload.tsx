'use client';

// src/components/profile/ProfileImageUpload.tsx
// Reusable Cloudinary upload component for profile pictures.
// Uses unsigned uploads via a Cloudinary upload preset.
//
// Required env vars:
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME   — your Cloudinary cloud name
//   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET — an unsigned upload preset

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Loader2, X } from 'lucide-react';

interface ProfileImageUploadProps {
  /** Currently saved image URL (from Supabase profile) */
  currentImageUrl?: string | null;
  /** User's display name — used to render initials when no image exists */
  displayName?: string;
  /** Called with the new Cloudinary URL after a successful upload */
  onUploadComplete: (url: string) => void;
  /** Optional extra CSS classes for the avatar wrapper */
  className?: string;
  /** Size in pixels for the avatar circle (default 96) */
  size?: number;
}

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function getInitials(name?: string): string {
  if (!name) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ProfileImageUpload({
  currentImageUrl,
  displayName,
  onUploadComplete,
  className = '',
  size = 96,
}: ProfileImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displaySrc = preview ?? currentImageUrl ?? null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state
    setError(null);

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, WebP, or GIF files are allowed.');
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // Upload to Cloudinary
    setUploading(true);
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error(
          'Cloudinary is not configured. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your environment variables.'
        );
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'f9/profiles');
      // Apply transformation: crop to square face-focused thumbnail
      formData.append('transformation', JSON.stringify([{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]));

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ?? 'Upload failed. Please try again.'
        );
      }

      const json = (await res.json()) as { secure_url: string };
      onUploadComplete(json.secure_url);
      // Keep the object URL preview until parent refreshes
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      // Revert preview on error
      setPreview(null);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
      // Reset the file input so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClearPreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Avatar */}
      <div
        className="relative group"
        style={{ width: size, height: size }}
      >
        {/* Image or initials */}
        {displaySrc ? (
          // FIX 1: Replaced <img> with next/image <Image /> for optimized LCP and bandwidth.
          // `unoptimized` is set for blob/object URLs (local previews), since next/image
          // cannot process them through its optimization pipeline.
          <Image
            src={displaySrc}
            alt={displayName ?? 'Profile'}
            width={size}
            height={size}
            unoptimized={displaySrc.startsWith('blob:')}
            className="rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 w-full h-full"
          />
        ) : (
          // FIX 2: Replaced deprecated `bg-gradient-to-br` with canonical `bg-linear-to-br`
          // as flagged by Tailwind CSS IntelliSense (Tailwind v4+ syntax).
          <div
            className="rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold border-2 border-gray-200 dark:border-gray-700 w-full h-full"
            style={{ fontSize: size * 0.3 }}
          >
            {getInitials(displayName)}
          </div>
        )}

        {/* Loading overlay */}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="text-white animate-spin" style={{ width: size * 0.3, height: size * 0.3 }} />
          </div>
        )}

        {/* Camera button — shown on hover when not uploading */}
        {!uploading && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center"
            aria-label="Upload new profile photo"
          >
            <Camera
              className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ width: size * 0.28, height: size * 0.28 }}
            />
          </button>
        )}

        {/* Clear preview button */}
        {preview && !uploading && (
          <button
            type="button"
            onClick={handleClearPreview}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 transition-colors"
            aria-label="Remove preview"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Click-to-upload text */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? 'Uploading...' : currentImageUrl ? 'Change Photo' : 'Upload Photo'}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        JPEG, PNG, WebP or GIF · Max {MAX_FILE_SIZE_MB}MB
      </p>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 text-center max-w-xs">{error}</p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
    </div>
  );
}