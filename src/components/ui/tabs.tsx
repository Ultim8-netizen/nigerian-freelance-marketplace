// src/components/ui/tabs.tsx
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// ============================================================================
// Context
// ============================================================================

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
  activationMode: 'automatic' | 'manual';
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

const useTabsContext = () => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
};

// ============================================================================
// Tabs Root
// ============================================================================

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual';
  dir?: 'ltr' | 'rtl';
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      defaultValue = '',
      value: controlledValue,
      onValueChange,
      children,
      className,
      orientation = 'horizontal',
      activationMode = 'automatic',
      dir = 'ltr',
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);

    const value = controlledValue ?? internalValue;
    const handleValueChange = React.useCallback(
      (newValue: string) => {
        if (controlledValue === undefined) {
          setInternalValue(newValue);
        }
        onValueChange?.(newValue);
      },
      [controlledValue, onValueChange]
    );

    const contextValue = React.useMemo(
      () => ({ value, onValueChange: handleValueChange, orientation, activationMode }),
      [value, handleValueChange, orientation, activationMode]
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div
          ref={ref}
          data-orientation={orientation}
          dir={dir}
          className={cn('w-full', className)}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

// ============================================================================
// Tabs List
// ============================================================================

const tabsListVariants = cva(
  'inline-flex items-center justify-center gap-1 p-1 rounded-lg transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 dark:bg-gray-800',
        outline: 'border border-gray-200 dark:border-gray-700 bg-transparent',
        pills: 'bg-transparent gap-2',
        underline: 'bg-transparent border-b border-gray-200 dark:border-gray-700',
      },
      size: {
        sm: 'h-9 text-sm',
        default: 'h-10',
        lg: 'h-12 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface TabsListProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tabsListVariants> {
  loop?: boolean;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className, variant, size, loop = true, ...props }, ref) => {
    const { orientation } = useTabsContext();
    const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
    const listRef = React.useRef<HTMLDivElement>(null);

    React.useImperativeHandle(ref, () => listRef.current!);

    const handleKeyDown = (event: React.KeyboardEvent) => {
      const triggers = Array.from(
        listRef.current?.querySelectorAll('[role="tab"]:not([disabled])') || []
      ) as HTMLElement[];

      if (triggers.length === 0) return;

      const currentIndex = focusedIndex >= 0 ? focusedIndex : 0;
      let nextIndex = currentIndex;

      const isHorizontal = orientation === 'horizontal';
      const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
      const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

      if (event.key === nextKey) {
        event.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= triggers.length) {
          nextIndex = loop ? 0 : triggers.length - 1;
        }
      } else if (event.key === prevKey) {
        event.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? triggers.length - 1 : 0;
        }
      } else if (event.key === 'Home') {
        event.preventDefault();
        nextIndex = 0;
      } else if (event.key === 'End') {
        event.preventDefault();
        nextIndex = triggers.length - 1;
      }

      if (nextIndex !== currentIndex) {
        setFocusedIndex(nextIndex);
        triggers[nextIndex]?.focus();
      }
    };

    return (
      <div
        ref={listRef}
        role="tablist"
        aria-orientation={orientation}
        onKeyDown={handleKeyDown}
        className={cn(
          tabsListVariants({ variant, size }),
          orientation === 'vertical' && 'flex-col items-stretch',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

// ============================================================================
// Tabs Trigger
// ============================================================================

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950 dark:focus-visible:ring-blue-400',
  {
    variants: {
      variant: {
        default: 'data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-900 dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-gray-50 dark:data-[state=inactive]:text-gray-400 dark:data-[state=inactive]:hover:bg-gray-800/50 dark:data-[state=inactive]:hover:text-gray-50',
        outline:
          'border border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=inactive]:hover:bg-gray-50 dark:data-[state=active]:bg-blue-950/20 dark:data-[state=active]:text-blue-400',
        pills:
          'rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=inactive]:text-gray-700 data-[state=inactive]:hover:bg-gray-100 dark:data-[state=active]:bg-blue-600 dark:data-[state=inactive]:text-gray-300 dark:data-[state=inactive]:hover:bg-gray-800',
        underline:
          'rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 dark:data-[state=active]:border-blue-400 dark:data-[state=active]:text-blue-400 dark:data-[state=inactive]:text-gray-400 dark:data-[state=inactive]:hover:text-gray-50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tabsTriggerVariants> {
  value: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  (
    { value: triggerValue, children, className, variant, disabled, icon, badge, ...props },
    ref
  ) => {
    const { value, onValueChange, activationMode } = useTabsContext();
    const isActive = value === triggerValue;

    const handleClick = () => {
      if (!disabled) {
        onValueChange(triggerValue);
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (activationMode === 'manual' && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        handleClick();
      }
    };

    const handleFocus = () => {
      if (activationMode === 'automatic' && !disabled) {
        onValueChange(triggerValue);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${triggerValue}`}
        data-state={isActive ? 'active' : 'inactive'}
        data-disabled={disabled ? '' : undefined}
        id={`trigger-${triggerValue}`}
        tabIndex={isActive ? 0 : -1}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        className={cn(tabsTriggerVariants({ variant }), 'gap-2', className)}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
        {badge && <span className="shrink-0">{badge}</span>}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

// ============================================================================
// Tabs Content
// ============================================================================

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
  keepMounted?: boolean;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  (
    { value: contentValue, children, className, forceMount, keepMounted, ...props },
    ref
  ) => {
    const { value } = useTabsContext();
    const isActive = value === contentValue;
    const [hasBeenActive, setHasBeenActive] = React.useState(isActive);

    React.useEffect(() => {
      if (isActive) {
        setHasBeenActive(true);
      }
    }, [isActive]);

    const shouldRender = forceMount || isActive || (keepMounted && hasBeenActive);

    if (!shouldRender) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        aria-labelledby={`trigger-${contentValue}`}
        id={`panel-${contentValue}`}
        tabIndex={0}
        hidden={!isActive}
        data-state={isActive ? 'active' : 'inactive'}
        className={cn(
          'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:ring-offset-gray-950 dark:focus-visible:ring-blue-400',
          !isActive && 'hidden',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';

// ============================================================================
// Compound Export
// ============================================================================

export const TabsRoot = Object.assign(Tabs, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});