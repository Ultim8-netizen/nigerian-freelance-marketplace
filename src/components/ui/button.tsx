// src/components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

/**
 * Button component with comprehensive variant system
 * Supports composition via asChild prop, loading states, and icon positioning
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950 dark:focus-visible:ring-gray-300 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 
          'bg-gray-900 text-gray-50 hover:bg-gray-900/90 shadow hover:shadow-md dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90',
        primary:
          'bg-blue-600 text-white hover:bg-blue-700 shadow hover:shadow-md dark:bg-blue-500 dark:hover:bg-blue-600',
        destructive:
          'bg-red-600 text-gray-50 hover:bg-red-700 shadow hover:shadow-md dark:bg-red-900 dark:text-gray-50 dark:hover:bg-red-900/90',
        outline:
          'border border-gray-200 bg-white hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-800 dark:hover:text-gray-50',
        secondary:
          'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-50 dark:hover:bg-gray-700',
        ghost: 
          'hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-50',
        link: 
          'text-gray-900 underline-offset-4 hover:underline dark:text-gray-50',
        success:
          'bg-green-600 text-white hover:bg-green-700 shadow hover:shadow-md dark:bg-green-500 dark:hover:bg-green-600',
        warning:
          'bg-yellow-500 text-white hover:bg-yellow-600 shadow hover:shadow-md dark:bg-yellow-600 dark:hover:bg-yellow-700',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base',
        xl: 'h-12 rounded-md px-10 text-lg',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Render as child component (composition pattern)
   */
  asChild?: boolean;
  
  /**
   * Show loading state with spinner
   */
  loading?: boolean;
  
  /**
   * Icon to display before content
   */
  leftIcon?: React.ReactNode;
  
  /**
   * Icon to display after content
   */
  rightIcon?: React.ReactNode;
  
  /**
   * Make button full width
   */
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { 
      className, 
      variant, 
      size, 
      asChild = false, 
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth,
      disabled,
      children,
      ...props 
    }, 
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner className="h-4 w-4" />}
        {!loading && leftIcon && <span className="inline-flex">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="inline-flex">{rightIcon}</span>}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };

// ============================================================================
// SPECIALIZED BUTTON COMPONENTS
// ============================================================================

/**
 * Icon button with consistent sizing
 */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'leftIcon' | 'rightIcon'> & { icon: React.ReactNode }
>(({ icon, className, size = 'icon', ...props }, ref) => {
  return (
    <Button 
      ref={ref} 
      size={size} 
      className={cn('p-0', className)} 
      {...props}
    >
      {icon}
    </Button>
  );
});

IconButton.displayName = 'IconButton';

/**
 * Button group for related actions
 */
export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation = 'horizontal', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex',
          orientation === 'horizontal' 
            ? 'flex-row [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:last-child)]:border-r-0' 
            : 'flex-col [&>button]:rounded-none [&>button:first-child]:rounded-t-md [&>button:last-child]:rounded-b-md [&>button:not(:last-child)]:border-b-0',
          className
        )}
        role="group"
        {...props}
      >
        {children}
      </div>
    );
  }
);

ButtonGroup.displayName = 'ButtonGroup';

/**
 * Loading button with automatic state management
 */
export const LoadingButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { loadingText?: string }
>(({ children, loadingText, loading, ...props }, ref) => {
  return (
    <Button ref={ref} loading={loading} {...props}>
      {loading && loadingText ? loadingText : children}
    </Button>
  );
});

LoadingButton.displayName = 'LoadingButton';