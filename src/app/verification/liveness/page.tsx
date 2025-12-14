//src/app/verification/liveness/page.tsx
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import  LivenessVerificationCard from '@/components/verification/LivenessVerificationCard';
import { Card } from '@/components/ui/card';
import { Shield, Users, TrendingUp, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Liveness Verification | F9',
  description: 'Verify your identity to build trust and get priority visibility',
};

export default async function LivenessVerificationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/verification/liveness');
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 py-8 px-4">
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
                  Show you are a real, trustworthy person.
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
                <h3 className="font-semibold mb-1">Free Verification</h3>
                <p className="text-sm text-gray-600">
                  Get your lifetime verified badge at no cost. 
                  It is free, forever.
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
            <p className="text-2xl font-bold text-purple-600">Free</p>
            <p className="text-sm text-gray-600">Lifetime Badge</p>
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
              <h3 className="font-semibold mb-1">Is there a cost for verification?</h3>
              <p className="text-sm text-gray-600">
                No. Identity verification is completely free. We cover the cost of the secure liveness check API to help our community build trust.
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
                Usually within 2-5 minutes. You will receive a notification once 
                your identity is verified.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">What if verification fails?</h3>
              <p className="text-sm text-gray-600">
                If your liveness check cannot be verified, you can contact support. We will 
                investigate and help resolve the issue.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}