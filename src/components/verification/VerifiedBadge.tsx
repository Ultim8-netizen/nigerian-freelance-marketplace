// src/components/verification/VerifiedBadge.tsx
'use client';

import { Shield, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getTrustLevelByScore } from '@/lib/trust/trust-score';

// --- Existing Verified Badge Components ---

interface VerifiedBadgeProps {
  variant?: 'default' | 'compact' | 'icon-only';
  showTooltip?: boolean;
  className?: string;
}

export function VerifiedBadge({
  variant = 'default',
  showTooltip = true,
  className
}: VerifiedBadgeProps) {
  const badge = (
    <Badge
      className={`bg-blue-600 hover:bg-blue-700 text-white ${className || ''}`}
      variant="default"
    >
      {variant === 'icon-only' ? (
        <Shield className="w-3 h-3" />
      ) : (
        <>
          <Shield className="w-3 h-3 mr-1" />
          {variant === 'compact' ? 'Verified' : 'Identity Verified'}
        </>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-500" />
            <span>Liveness Verified User</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Inline verified icon for profiles
export function VerifiedIcon({ size = 16 }: { size?: number }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="inline-flex items-center justify-center bg-blue-600 rounded-full text-white"
            style={{ width: size, height: size }}
          >
            <Shield
              className="w-full h-full p-0.5"
              style={{ width: size * 0.6, height: size * 0.6 }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <span>Identity Verified</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Profile header badge (larger, more prominent)
export function ProfileVerifiedBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
      <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
        <Shield className="w-3 h-3 text-white" />
      </div>
      <span className="text-sm font-medium text-blue-900">
        Identity Verified
      </span>
    </div>
  );
}

// --- New Trust Score Components ---

interface TrustBadgeProps {
  score: number;
  level?: string; // Optional as we calculate it from score
  showTooltip?: boolean;
  className?: string;
}

export function TrustBadge({ score, showTooltip = true, className }: TrustBadgeProps) {
  const levelInfo = getTrustLevelByScore(score);

  const colorClasses = {
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
    blue: 'bg-blue-600 text-white border-blue-700',
    green: 'bg-green-600 text-white border-green-700',
    purple: 'bg-purple-600 text-white border-purple-700',
    gold: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-yellow-600',
  };

  const badgeColor = colorClasses[levelInfo.color as keyof typeof colorClasses] || colorClasses.gray;

  const badge = (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-semibold text-sm ${badgeColor} ${className || ''}`}
    >
      <Shield className="w-4 h-4" />
      <span>{levelInfo.badge}</span>
      <span className="text-xs opacity-80">({score})</span>
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2 max-w-xs">
            <p className="font-semibold text-base">{levelInfo.label}</p>
            <p className="text-xs text-muted-foreground">Trust Score: {score}/100</p>
            <div className="text-xs">
              <p className="font-medium mb-1">Benefits:</p>
              <ul className="list-disc list-inside space-y-1">
                {levelInfo.benefits.map((benefit: string, i: number) => (
                  <li key={i}>{benefit}</li>
                ))}
              </ul>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact trust indicator for profile cards
export function TrustIndicator({ score }: { score: number }) {
  const level = getTrustLevelByScore(score);
  const percentage = Math.min((score / 100) * 100, 100);

  // Explicitly map colors to ensure Tailwind doesn't purge them
  const barColors: Record<string, string> = {
    gray: 'bg-gray-400',
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
    gold: 'bg-gradient-to-r from-yellow-400 to-orange-500',
  };

  const barColor = barColors[level.color as keyof typeof barColors] || barColors.gray;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-600">{score}</span>
    </div>
  );
}