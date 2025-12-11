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

// src/app/verification/liveness/page.tsx
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LivenessVerificationCard } from '@/components/verification/LivenessVerificationCard';
import { Card } from '@/components/ui/card';
import { Shield, Users, TrendingUp, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Liveness Verification | F9',
  description: 'Verify your identity to build trust and get priority visibility',
};

export default async function LivenessVerificationPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/verification/liveness');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Identity Verification</h1>
          <p className="text-gray-600">
            Get verified to stand out and win more clients
          </p>
        </div>

        {/* Main Verification Card */}
        <div className="mb-8">
          <LivenessVerificationCard />
        </div>

        {/* Why Verify Section */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Why Verify Your Identity?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Build Instant Trust</h3>
                <p className="text-sm text-gray-600">
                  Clients are 3x more likely to hire verified freelancers. 
                  Show you're a real, trustworthy person.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Get Priority Visibility</h3>
                <p className="text-sm text-gray-600">
                  Verified profiles appear higher in search results, 
                  giving you more exposure to potential clients.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Permanent Verification</h3>
                <p className="text-sm text-gray-600">
                  One-time ₦150 payment for a lifetime verified badge. 
                  No recurring fees, ever.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Your Data is Safe</h3>
                <p className="text-sm text-gray-600">
                  We use bank-grade encryption for your liveness check. 
                  Your biometric data is secure.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">3x</p>
            <p className="text-sm text-gray-600">More Client Trust</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">₦150</p>
            <p className="text-sm text-gray-600">One-time Fee</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">100%</p>
            <p className="text-sm text-gray-600">Secure & Private</p>
          </Card>
        </div>

        {/* FAQs */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-bold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Why do I need to pay ₦150?</h3>
              <p className="text-sm text-gray-600">
                The fee covers the cost of verifying your identity through our 
                secure liveness check API. We don't make profit from this—it's purely to cover 
                the verification service cost.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Is my biometric data safe?</h3>
              <p className="text-sm text-gray-600">
                Absolutely. We use bank-grade encryption and never store your 
                biometric data permanently. Only verification status is kept.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">How long does verification take?</h3>
              <p className="text-sm text-gray-600">
                Usually within 2-5 minutes. You'll receive a notification once 
                your identity is verified.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">What if verification fails?</h3>
              <p className="text-sm text-gray-600">
                If your liveness check cannot be verified, you can contact support. We'll 
                investigate and help resolve the issue.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// src/app/verification/liveness/success/page.tsx
import { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, Share2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Verification Successful | F9',
};

export default function VerificationSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-8 text-center">
        <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-green-900 mb-3">
          🎉 You're Verified!
        </h1>

        <p className="text-gray-700 mb-6">
          Your identity has been successfully verified through liveness check. You now have a 
          verified badge on your profile that will help you win more clients.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800 font-medium mb-2">
            What happens now?
          </p>
          <ul className="text-sm text-green-700 space-y-1 text-left">
            <li>✅ Your profile now shows a verified badge</li>
            <li>✅ You appear higher in search results</li>
            <li>✅ Clients will trust you more</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1" size="lg">
            <Link href="/dashboard/profile">
              View Profile
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1" size="lg">
            <Link href="/dashboard">
              Go to Dashboard
            </Link>
          </Button>
        </div>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600 mb-3">
            Share your verified status
          </p>
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share on Social Media
          </Button>
        </div>
      </Card>
    </div>
  );
}

// src/app/verification/liveness/failed/page.tsx
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function VerificationFailedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-8 text-center">
        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-red-900 mb-3">
          Verification Failed
        </h1>

        <p className="text-gray-700 mb-6">
          We couldn't verify your identity through liveness check. This could be due to:
        </p>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
          <ul className="text-sm text-red-700 space-y-2">
            <li>• Poor lighting conditions</li>
            <li>• Camera not detecting face properly</li>
            <li>• Temporary system issues</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/verification/liveness">
              Try Again
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/support">
              Contact Support
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}