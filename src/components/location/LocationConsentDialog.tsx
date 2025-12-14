// src/components/location/LocationConsentDialog.tsx
// Explicit user consent for location detection

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Shield, Info, CheckCircle } from 'lucide-react';

interface LocationConsentDialogProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function LocationConsentDialog({
  onAccept,
  onDecline,
}: LocationConsentDialogProps) {
  const [hasReadDetails, setHasReadDetails] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Location Access Request
            </h2>
            <p className="text-gray-600">
              We would like to help you connect with people and opportunities in
              your area
            </p>
          </div>
        </div>

        {/* What We Collect */}
        <div className="space-y-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              What We will Collect
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <span>
                  <strong>Your approximate location</strong> (city and state only)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <span>
                  <strong>Temporary GPS coordinates</strong> (only used for detection, never stored permanently)
                </span>
              </li>
            </ul>
          </div>

          {/* Privacy Guarantees */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Your Privacy is Protected
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ We only store your city/state, not your exact address</li>
              <li>✓ Precise GPS coordinates are discarded immediately after detection</li>
              <li>✓ You can change or remove your location anytime</li>
              <li>✓ Your location is never shared without your permission</li>
            </ul>
          </div>

          {/* Third-Party Disclosure */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-sm text-yellow-900">
              Third-Party Services
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              To convert GPS coordinates to a city/state name, we use:
            </p>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>
                • <strong>OpenStreetMap Nominatim</strong> - Free, open-source
                geocoding service
              </li>
              <li className="text-xs text-gray-600 ml-4">
                Only your coordinates are sent (no personal information)
              </li>
              <li className="text-xs text-gray-600 ml-4">
                Read their privacy policy:{' '}
                <a
                  href="https://operations.osmfoundation.org/policies/nominatim/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  OSM Nominatim Usage Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Why We Need This */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Why This Helps You</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>
                🎓 <strong>Find campus opportunities:</strong> Connect with
                students at your university
              </li>
              <li>
                📍 <strong>Local services:</strong> Discover freelancers and
                services in your city
              </li>
              <li>
                🤝 <strong>Easier meetups:</strong> Coordinate in-person work
                when needed
              </li>
              <li>
                🎯 <strong>Relevant jobs:</strong> See opportunities available
                in your area
              </li>
            </ul>
          </div>

          {/* Confirmation Checkbox */}
          <div className="border-t pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasReadDetails}
                onChange={(e) => setHasReadDetails(e.target.checked)}
                className="mt-1 w-5 h-5 rounded"
              />
              <span className="text-sm text-gray-700">
                I understand that my approximate location (city/state) will be
                stored, and that temporary GPS coordinates will be sent to
                OpenStreetMap&apos Nominatim service for geocoding (and immediately
                discarded after).
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onAccept}
            disabled={!hasReadDetails}
            className="flex-1"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Allow Location Access
          </Button>
          <Button onClick={onDecline} variant="outline" className="flex-1">
            Skip for Now
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          You can always add or change your location later in Profile Settings
        </p>
      </Card>
    </div>
  );
}