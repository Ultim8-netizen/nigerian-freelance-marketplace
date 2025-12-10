// src/components/verification/NINVerificationCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Info,
  Lock,
  Star,
  TrendingUp
} from 'lucide-react';

interface VerificationStatus {
  is_verified: boolean;
  status: 'not_started' | 'pending' | 'approved' | 'rejected';
  verification_date?: string;
  nin_last_four?: string;
  latest_request?: {
    id: string;
    status: string;
    created_at: string;
    rejection_reason?: string;
  } | null;
  cost: number;
}

export function NINVerificationCard() {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [nin, setNin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/verification/nin/status');
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate NIN format
    const cleanedNIN = nin.replace(/[\s-]/g, '');
    if (!/^\d{11}$/.test(cleanedNIN)) {
      setError('NIN must be exactly 11 digits');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/verification/nin/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nin: cleanedNIN }),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to payment
        window.location.href = result.data.payment_link;
      } else {
        setError(result.error || 'Verification initiation failed');
      }
    } catch (error: any) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatNIN = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const truncated = cleaned.slice(0, 11);
    
    // Format as XXX-XXXX-XXXX
    if (truncated.length <= 3) return truncated;
    if (truncated.length <= 7) {
      return `${truncated.slice(0, 3)}-${truncated.slice(3)}`;
    }
    return `${truncated.slice(0, 3)}-${truncated.slice(3, 7)}-${truncated.slice(7)}`;
  };

  const handleNINChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNIN(e.target.value);
    setNin(formatted);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Card>
    );
  }

  // Already verified
  if (status?.is_verified) {
    return (
      <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-green-900">
                Identity Verified
              </h3>
              <Badge className="bg-green-600 text-white">
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            </div>
            <p className="text-sm text-green-700 mb-3">
              Your NIN has been successfully verified. You now have a verified badge on your profile.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-green-600">
              <span>• Enhanced profile visibility</span>
              <span>• Increased client trust</span>
              <span>• Priority in search results</span>
            </div>
            {status.nin_last_four && (
              <p className="text-xs text-green-600 mt-3">
                NIN: *******{status.nin_last_four}
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Pending verification
  if (status?.status === 'pending') {
    return (
      <Card className="p-6 bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shrink-0">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Verification In Progress
            </h3>
            <p className="text-sm text-yellow-700 mb-3">
              Your NIN is being verified. This usually takes a few minutes.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              className="text-yellow-700 border-yellow-300"
            >
              Check Status
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Rejected - allow retry
  if (status?.status === 'rejected' && status.latest_request) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Verification Failed
            </h3>
            <p className="text-sm text-red-700 mb-2">
              {status.latest_request.rejection_reason || 'The NIN provided could not be verified.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus({ ...status, status: 'not_started' })}
              className="text-red-700 border-red-300"
            >
              Try Again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Not started - show verification form
  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-1">Identity Verification</h3>
          <p className="text-sm text-gray-600">
            Verify with NIN: <span className="font-semibold text-blue-600">₦{status?.cost || 150}</span>
          </p>
        </div>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
          <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Earn Trust</p>
            <p className="text-xs text-blue-700">Verified badge on profile</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-900">Get Priority</p>
            <p className="text-xs text-purple-700">Higher in search results</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
          <Star className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-900">One-time Fee</p>
            <p className="text-xs text-green-700">Permanent badge</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="nin" className="block text-sm font-medium mb-2">
            National Identification Number (NIN)
          </label>
          <Input
            id="nin"
            type="text"
            value={nin}
            onChange={handleNINChange}
            placeholder="123-4567-8901"
            maxLength={13}
            disabled={isSubmitting}
            className="text-lg tracking-wider"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter your 11-digit NIN
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || nin.replace(/\D/g, '').length !== 11}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Lock className="w-5 h-5 mr-2" />
              Pay ₦{status?.cost || 150} & Verify
            </>
          )}
        </Button>
      </form>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">
              💡 Why the fee?
            </p>
            <p className="text-xs text-gray-600">
              Your NIN is verified through Youverify's secure system. 
              The ₦150 fee covers the processing cost—nothing more. 
              This is a one-time payment for permanent verification.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <Lock className="w-3 h-3" />
        <span>Your data is encrypted and secure. We never store your full NIN.</span>
      </div>
    </Card>
  );
}