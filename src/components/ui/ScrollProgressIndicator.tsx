'use client';
import { useSyncExternalStore } from 'react';
import { BRAND } from '@/lib/branding';

/**
 * Scroll Progress Indicator Component
 * Displays a fixed progress bar at the top of the page showing scroll progress.
 * Uses useSyncExternalStore for hydration-safe client-side rendering.
 */

// Stable subscribe function with RAF optimization
const subscribe = (callback: () => void) => {
  let rafId: number | null = null;

  const handleScroll = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(callback);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', handleScroll);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  };
};

// Get current scroll progress
const getSnapshot = () => {
  const winScroll = document.documentElement.scrollTop;
  const height =
    document.documentElement.scrollHeight -
    document.documentElement.clientHeight;

  return height > 0 ? (winScroll / height) * 100 : 0;
};

// Server snapshot must return same value as client on hydration
const getServerSnapshot = () => 0;

export function ScrollProgressIndicator() {
  const scrollProgress = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return (
    <div
      className="fixed top-0 left-0 h-1 w-full pointer-events-none z-50"
      role="progressbar"
      aria-valuenow={Math.round(scrollProgress)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ backgroundColor: 'transparent' }}
    >
      <div
        className="h-full transition-all duration-150 ease-out"
        style={{
          width: `${scrollProgress}%`,
          background: `linear-gradient(to right, ${BRAND.COLORS.GRADIENT_START}, ${BRAND.COLORS.GRADIENT_MID}, ${BRAND.COLORS.GRADIENT_END})`,
        }}
      />
    </div>
  );
}