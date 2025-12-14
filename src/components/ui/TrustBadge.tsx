// src/components/ui/TrustBadge.tsx
import { Shield, Star, Award, Crown, } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrustLevel = 'new' | 'verified' | 'trusted' | 'top_rated' | 'elite';

interface TrustBadgeProps {
  level: TrustLevel;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const levelConfig = {
  new: {
    icon: Shield,
    label: 'New User',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
  verified: {
    icon: Shield,
    label: 'Verified',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  trusted: {
    icon: Star,
    label: 'Trusted',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  top_rated: {
    icon: Award,
    label: 'Top Rated',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  elite: {
    icon: Crown,
    label: 'Elite',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
};

const sizeConfig = {
  sm: { icon: 'w-3 h-3', text: 'text-xs', padding: 'px-2 py-0.5' },
  md: { icon: 'w-4 h-4', text: 'text-sm', padding: 'px-3 py-1' },
  lg: { icon: 'w-5 h-5', text: 'text-base', padding: 'px-4 py-2' },
};

export function TrustBadge({
  level,
  score,
  size = 'md',
  showLabel = true,
  className,
}: TrustBadgeProps) {
  const config = levelConfig[level];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border',
        config.bgColor,
        config.borderColor,
        sizes.padding,
        className
      )}
    >
      <Icon className={cn(sizes.icon, config.color)} />
      {showLabel && (
        <span className={cn('font-semibold', config.color, sizes.text)}>
          {config.label}
        </span>
      )}
      {score !== undefined && (
        <span className={cn('font-medium opacity-70', sizes.text)}>
          {score}
        </span>
      )}
    </div>
  );
}

// Verification checkmark for profiles
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600',
        className
      )}
      title="Verified User"
    >
      <Shield className="w-3 h-3 text-white" />
    </div>
  );
}

// Trust score display
export function TrustScoreDisplay({ 
  score, 
  level 
}: { 
  score: number; 
  level: TrustLevel 
}) {
  const percentage = score;
  const config = levelConfig[level];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Trust Score</span>
        <TrustBadge level={level} score={score} size="sm" />
      </div>
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('absolute left-0 top-0 h-full transition-all duration-500', config.bgColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">
        {percentage < 25 && 'Build trust by completing jobs'}
        {percentage >= 25 && percentage < 40 && 'Keep delivering quality work!'}
        {percentage >= 40 && percentage < 70 && 'You\'re a trusted freelancer'}
        {percentage >= 70 && percentage < 90 && 'Top-tier performance!'}
        {percentage >= 90 && 'Elite status achieved 🎉'}
      </p>
    </div>
  );
}