'use client';
import { useState, useEffect } from 'react';
import { BRAND } from '@/lib/branding';

/**
 * Scroll Progress Indicator Component
 * Displays a fixed progress bar at the top of the page showing scroll progress.
 * Uses mounted state for safe SSR hydration.
 */

export function ScrollProgressIndicator() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        const winScroll = document.documentElement.scrollTop;
        const height =
          document.documentElement.scrollHeight -
          document.documentElement.clientHeight;
        const progress = height > 0 ? (winScroll / height) * 100 : 0;
        setScrollProgress(progress);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  if (!mounted) return null;

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