import { useSyncExternalStore } from 'react';
import { BRAND } from '@/lib/branding';

/**
 * Scroll Progress Indicator Component
 * * Displays a fixed progress bar at the top of the page showing scroll progress.
 * Uses useSyncExternalStore for hydration-safe client-side rendering.
 */

// Stable subscribe function
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
  if (typeof window === 'undefined') return 0;
  
  const winScroll = document.documentElement.scrollTop;
  const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  
  return height > 0 ? (winScroll / height) * 100 : 0;
};

const getServerSnapshot = () => 0;

export function ScrollProgressIndicator() {
  const scrollProgress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div 
      className="fixed top-0 left-0 w-full h-1 z-9999 bg-black/5 pointer-events-none"
      role="progressbar"
      aria-valuenow={scrollProgress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full transition-all duration-150 ease-out"
        style={{
          width: `${scrollProgress}%`,
          // Correctly accessing the F9 brand colors
          background: `linear-gradient(to right, ${BRAND.COLORS.GRADIENT_START}, ${BRAND.COLORS.GRADIENT_MID}, ${BRAND.COLORS.GRADIENT_END})`,
        }}
      />
    </div>
  );
}