// src/components/onboarding/LocationSetup.tsx
// Onboarding step for new users to set location (improved)

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationSelector } from '@/components/location/LocationSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type UserLocation } from '@/types/location.types';
import { MapPin, Users, Briefcase, Shield, Loader2 } from 'lucide-react';

export function LocationSetupStep() {
  const router = useRouter();
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [error, setError] = useState('');

  const handleLocationSet = async (loc: UserLocation) => {
    setLocation(loc);
    setError('');
    setIsSaving(true);

    try {
      const response = await fetch('/api/profile/location', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc),
      });

      const result = await response.json();

      if (response.ok) {
        // Small delay for better UX
        await new Promise((resolve) => setTimeout(resolve, 500));
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(result.error || 'Failed to save location');
      }
    } catch (error) {
      console.error('Failed to save location:', error);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    // Continue to dashboard without setting location
    await new Promise((resolve) => setTimeout(resolve, 300));
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Where Are You Based?</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Help us connect you with opportunities and people in your area. Your location helps build a stronger local community.
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-6 md:p-8 mb-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <LocationSelector 
            onLocationSet={handleLocationSet}
            isLoading={isSaving}
          />

          {/* Skip Option */}
          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-gray-600 mb-3">
              Not ready to share your location?
            </p>
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={isSkipping || isSaving}
              className="text-gray-600 hover:text-gray-900"
            >
              {isSkipping ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Continuing...
                </>
              ) : (
                'Skip for now'
              )}
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              You can always add this later in your profile settings
            </p>
          </div>
        </Card>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4 bg-white">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Connect Locally</h3>
                <p className="text-sm text-gray-600">
                  Find students and freelancers on your campus or in your city
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Relevant Opportunities</h3>
                <p className="text-sm text-gray-600">
                  See services and gigs that are available in your area
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Faster Meetups</h3>
                <p className="text-sm text-gray-600">
                  Easily coordinate in-person meetings when needed
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Your Privacy Matters</h3>
                <p className="text-sm text-gray-600">
                  We only show your state, never your exact address
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Student-Specific Context */}
        <Card className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎓</div>
            <div>
              <h3 className="font-semibold mb-1">Built for Nigerian Students</h3>
              <p className="text-sm text-blue-100">
                Whether you're in Lagos, Abuja, Ibadan, or anywhere else, connecting with your local student community helps everyone thrive. Find study partners, share notes, offer services, or hire talented peers on your campus.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}