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
          Your identity has been successfully verified. You now have a verified badge that   
          helps you stand out and win more clients. This verification is 100% free, forever.
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