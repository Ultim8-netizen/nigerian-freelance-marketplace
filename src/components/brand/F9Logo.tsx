// src/components/brand/F9Logo.tsx
// F9 Logo Component with multiple variants
'use client';

import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/branding';

interface F9LogoProps {
  variant?: 'full' | 'icon' | 'text' | 'stacked';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  animated?: boolean;
}

export function F9Logo({ 
  variant = 'full', 
  size = 'md',
  showTagline = false,
  className,
  animated = false,
}: F9LogoProps) {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
    xl: 'h-12',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const taglineSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
    xl: 'text-base',
  };

  if (variant === 'icon') {
    return (
      <div 
        className={cn(
          sizeClasses[size],
          'aspect-square rounded-lg bg-linear-to-br from-red-600 via-blue-600 to-purple-600',
          'flex items-center justify-center shadow-lg',
          animated && 'hover:scale-110 transition-transform duration-200',
          className
        )}
      >
        <span className="text-white font-bold" style={{ fontSize: '60%' }}>
          {BRAND.SHORT_NAME}
        </span>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={cn('flex flex-col', className)}>
        <span 
          className={cn(
            textSizes[size],
            'font-bold bg-linear-to-r from-red-600 via-blue-600 to-purple-600 bg-clip-text text-transparent',
            animated && 'hover:scale-105 transition-transform duration-200'
          )}
        >
          {BRAND.SHORT_NAME}
        </span>
        {showTagline && (
          <span className={cn(taglineSizes[size], 'text-gray-600 italic')}>
            {BRAND.TAGLINE}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={cn('flex flex-col items-center text-center', className)}>
        <div 
          className={cn(
            sizeClasses[size],
            'aspect-square rounded-lg bg-linear-to-br from-red-600 via-blue-600 to-purple-600',
            'flex items-center justify-center shadow-lg mb-2',
            animated && 'hover:scale-110 transition-transform duration-200'
          )}
        >
          <span className="text-white font-bold" style={{ fontSize: '60%' }}>
            {BRAND.SHORT_NAME}
          </span>
        </div>
        <span className={cn(textSizes[size], 'font-bold text-gray-900')}>
          {BRAND.SHORT_NAME}
        </span>
        <span className={cn(taglineSizes[size], 'text-gray-600 italic')}>
          {BRAND.TAGLINE}
        </span>
      </div>
    );
  }

  // Default: full logo with icon and text
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div 
        className={cn(
          sizeClasses[size],
          'aspect-square rounded-lg bg-linear-to-br from-red-600 via-blue-600 to-purple-600',
          'flex items-center justify-center shadow-lg',
          animated && 'hover:scale-110 transition-transform duration-200'
        )}
      >
        <span className="text-white font-bold" style={{ fontSize: '60%' }}>
          {BRAND.SHORT_NAME}
        </span>
      </div>
      <div className="flex flex-col">
        <span className={cn(textSizes[size], 'font-bold text-gray-900 leading-none')}>
          {BRAND.SHORT_NAME}
        </span>
        {showTagline && (
          <span className={cn(taglineSizes[size], 'text-gray-600 italic leading-tight')}>
            {BRAND.TAGLINE}
          </span>
        )}
      </div>
    </div>
  );
}

// Animated loading logo
export function F9LoadingLogo() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <div className="h-16 w-16 rounded-lg bg-linear-to-br from-red-600 via-blue-600 to-purple-600 flex items-center justify-center shadow-xl animate-pulse">
          <span className="text-white font-bold text-2xl">
            {BRAND.SHORT_NAME}
          </span>
        </div>
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span className="text-sm text-gray-600 italic animate-pulse">
            {BRAND.TAGLINE}
          </span>
        </div>
      </div>
    </div>
  );
}