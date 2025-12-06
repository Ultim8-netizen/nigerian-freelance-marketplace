// ============================================================================
// src/components/ui/spinner.tsx
// Premium typing loader: "freelance9ja▌"
// ============================================================================

import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "font-mono text-blue-600 text-lg whitespace-nowrap flex items-center",
        className
      )}
    >
      <span className="typing-animation overflow-hidden border-r-2 border-blue-600 pr-1">
        freelance9ja
      </span>
    </div>
  );
}
