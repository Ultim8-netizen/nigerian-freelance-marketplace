// src/components/ui/badge.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Badge component with comprehensive variant system
 * Supports dismissible badges, dot indicators, and size variations
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gray-900 text-gray-50 hover:bg-gray-900/80 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/80',
        primary:
          'border-transparent bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
        secondary:
          'border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80 dark:bg-gray-800 dark:text-gray-50 dark:hover:bg-gray-800/80',
        destructive:
          'border-transparent bg-red-500 text-gray-50 hover:bg-red-600 dark:bg-red-900 dark:text-gray-50 dark:hover:bg-red-900/80',
        outline: 
          'text-gray-950 border-gray-300 bg-transparent hover:bg-gray-50 dark:text-gray-50 dark:border-gray-700 dark:hover:bg-gray-800',
        success:
          'border-transparent bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700',
        warning:
          'border-transparent bg-yellow-500 text-white hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700',
        info:
          'border-transparent bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700',
        purple:
          'border-transparent bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700',
        pink:
          'border-transparent bg-pink-500 text-white hover:bg-pink-600 dark:bg-pink-600 dark:hover:bg-pink-700',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        default: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
      rounded: {
        default: 'rounded-full',
        square: 'rounded-md',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      rounded: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Show a dot indicator before the content
   */
  dot?: boolean;
  
  /**
   * Make the badge dismissible with a close button
   */
  dismissible?: boolean;
  
  /**
   * Callback when badge is dismissed
   */
  onDismiss?: () => void;
  
  /**
   * Icon to display before content
   */
  icon?: React.ReactNode;
}

function Badge({ 
  className, 
  variant, 
  size,
  rounded,
  dot = false,
  dismissible = false,
  onDismiss,
  icon,
  children,
  ...props 
}: BadgeProps) {
  const [dismissed, setDismissed] = React.useState(false);
  
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    onDismiss?.();
  };
  
  if (dismissed) return null;
  
  return (
    <div 
      className={cn(badgeVariants({ variant, size, rounded }), className)} 
      {...props}
    >
      {dot && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {icon && (
        <span className="inline-flex items-center">{icon}</span>
      )}
      {children}
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center justify-center ml-1 hover:opacity-70 transition-opacity focus:outline-none"
          aria-label="Dismiss badge"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// SPECIALIZED BADGE COMPONENTS
// ============================================================================

/**
 * Status badge with predefined states
 */
export interface StatusBadgeProps extends Omit<BadgeProps, 'variant' | 'dot'> {
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'error' | 'draft';
}

export function StatusBadge({ status, ...props }: StatusBadgeProps) {
  const statusConfig = {
    active: { variant: 'success' as const, label: 'Active', dot: true },
    inactive: { variant: 'secondary' as const, label: 'Inactive', dot: false },
    pending: { variant: 'warning' as const, label: 'Pending', dot: true },
    completed: { variant: 'success' as const, label: 'Completed', dot: false },
    error: { variant: 'destructive' as const, label: 'Error', dot: true },
    draft: { variant: 'secondary' as const, label: 'Draft', dot: false },
  };
  
  const config = statusConfig[status];
  
  return (
    <Badge variant={config.variant} dot={config.dot} {...props}>
      {config.label}
    </Badge>
  );
}

/**
 * Count badge for notifications
 */
export interface CountBadgeProps extends Omit<BadgeProps, 'children'> {
  count: number;
  max?: number;
  showZero?: boolean;
}

export function CountBadge({ 
  count, 
  max = 99, 
  showZero = false,
  variant = 'destructive',
  size = 'sm',
  ...props 
}: CountBadgeProps) {
  if (!showZero && count === 0) return null;
  
  const displayCount = count > max ? `${max}+` : count;
  
  return (
    <Badge variant={variant} size={size} {...props}>
      {displayCount}
    </Badge>
  );
}

/**
 * Badge group for multiple badges
 */
export interface BadgeGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum number of badges to show before collapsing
   */
  max?: number;
  /**
   * Show count of hidden badges
   */
  showMore?: boolean;
}

export function BadgeGroup({ 
  children, 
  className, 
  max,
  showMore = true,
  ...props 
}: BadgeGroupProps) {
  const badges = React.Children.toArray(children);
  const visibleBadges = max ? badges.slice(0, max) : badges;
  const hiddenCount = max ? badges.length - max : 0;
  
  return (
    <div 
      className={cn('inline-flex flex-wrap items-center gap-1.5', className)} 
      {...props}
    >
      {visibleBadges}
      {showMore && hiddenCount > 0 && (
        <Badge variant="secondary" size="sm">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}

/**
 * Interactive badge with click handler
 */
export interface InteractiveBadgeProps extends BadgeProps {
  onClick?: () => void;
  active?: boolean;
}

export function InteractiveBadge({ 
  onClick, 
  active = false,
  className,
  ...props 
}: InteractiveBadgeProps) {
  return (
    <Badge
      className={cn(
        'cursor-pointer hover:scale-105 active:scale-95',
        active && 'ring-2 ring-offset-2',
        className
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      {...props}
    />
  );
}

/**
 * Gradient badge with custom colors
 */
export interface GradientBadgeProps extends Omit<BadgeProps, 'variant'> {
  from: string;
  to: string;
}

export function GradientBadge({ 
  from, 
  to, 
  className,
  ...props 
}: GradientBadgeProps) {
  return (
    <Badge
      className={cn(
        'bg-linear-to-r text-white border-transparent',
        className
      )}
      style={{
        backgroundImage: `linear-gradient(to right, ${from}, ${to})`,
      }}
      {...props}
    />
  );
}

/**
 * Animated pulse badge for live indicators
 */
export function LiveBadge(props: Omit<BadgeProps, 'dot' | 'variant'>) {
  return (
    <Badge 
      variant="destructive" 
      dot 
      className="animate-pulse"
      {...props}
    >
      LIVE
    </Badge>
  );
}

/**
 * New badge with pulsing animation
 */
export function NewBadge(props: Omit<BadgeProps, 'variant'>) {
  return (
    <Badge 
      variant="info" 
      className="animate-pulse"
      {...props}
    >
      NEW
    </Badge>
  );
}

export { Badge, badgeVariants };