import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function VerificationFailedPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-8 text-center">
        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-red-900 mb-3">
          Verification Failed
        </h1>

        <p className="text-gray-700 mb-6">
          We could not verify your identity through liveness check. This could be due to:
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