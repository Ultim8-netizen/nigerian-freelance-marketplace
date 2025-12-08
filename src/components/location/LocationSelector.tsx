// src/components/location/LocationSelector.tsx
// Enhanced location selector with auto-detect, university support, and manual selection

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  NIGERIAN_STATES, 
  MAJOR_CITIES,
  NIGERIAN_UNIVERSITIES,
  type NigerianState,
  type UserLocation 
} from '@/types/location.types';
import { 
  detectBrowserLocation, 
  detectIPLocation 
} from '@/lib/location/detector';
import { MapPin, Loader2, Navigation, School, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationSelectorProps {
  currentLocation?: UserLocation;
  onLocationSet: (location: UserLocation) => void;
  isLoading?: boolean;
  className?: string;
}

export function LocationSelector({
  currentLocation,
  onLocationSet,
  isLoading = false,
  className,
}: LocationSelectorProps) {
  const [selectedState, setSelectedState] = useState<NigerianState | ''>(
    currentLocation?.state || ''
  );
  const [selectedCity, setSelectedCity] = useState(currentLocation?.city || '');
  const [customCity, setCustomCity] = useState('');
  const [isStudent, setIsStudent] = useState(!!currentLocation?.university);
  const [selectedUniversity, setSelectedUniversity] = useState(currentLocation?.university || '');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  const cities = selectedState ? MAJOR_CITIES[selectedState] || [] : [];
  const showCustomCity = selectedCity === 'other';
  
  // Filter universities by selected state
  const availableUniversities = selectedState
    ? NIGERIAN_UNIVERSITIES.filter((uni) => uni.state === selectedState)
    : [];

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    setDetectionError(null);

    try {
      // Try browser geolocation first
      const browserResult = await detectBrowserLocation();

      if (browserResult.state) {
        setSelectedState(browserResult.state);
        setSelectedCity(browserResult.city || '');
        setDetectionError(null);
      } else {
        // Fallback to IP detection
        const ipResult = await detectIPLocation();

        if (ipResult.state) {
          setSelectedState(ipResult.state);
          setSelectedCity(ipResult.city || '');
          setDetectionError(null);
        } else {
          setDetectionError(
            'Could not detect your location. Please select manually.'
          );
        }
      }
    } catch (error) {
      console.error('Location detection error:', error);
      setDetectionError('Location detection failed. Please select manually.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleStateChange = (state: NigerianState | '') => {
    setSelectedState(state);
    setSelectedCity(''); // Reset city when state changes
    setCustomCity('');
    setSelectedUniversity(''); // Reset university when state changes
  };

  const handleManualSubmit = () => {
    if (!selectedState) return;
    if (isStudent && !selectedUniversity && availableUniversities.length > 0) {
      setDetectionError('Please select your university or uncheck &quot;I&apos;m a student&quot;');
      return;
    }

    const finalCity = showCustomCity ? customCity : selectedCity || undefined;

    const location: UserLocation = {
      state: selectedState,
      city: finalCity,
      university: isStudent && selectedUniversity ? selectedUniversity : undefined,
      detection_method: 'manual',
      last_updated: new Date().toISOString(),
    };

    onLocationSet(location);
  };

  const isValid = 
    selectedState && 
    (!showCustomCity || customCity) && 
    (!isStudent || selectedUniversity || availableUniversities.length === 0);

  return (
    <Card className={cn('p-6', className)}>
      <div className="space-y-4">
        {/* Header with Auto-detect */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Your Location
          </h3>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoDetect}
            disabled={isDetecting || isLoading}
          >
            {isDetecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Detecting...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 mr-2" />
                Auto-detect
              </>
            )}
          </Button>
        </div>

        {/* Detection Error */}
        {detectionError && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{detectionError}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Student Toggle */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="is-student"
              checked={isStudent}
              onChange={(e) => {
                setIsStudent(e.target.checked);
                if (!e.target.checked) {
                  setSelectedUniversity('');
                }
              }}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={isDetecting || isLoading}
            />
            <label htmlFor="is-student" className="flex items-center gap-2 cursor-pointer flex-1">
              <School className="w-5 h-5 text-gray-600" />
              <div>
                <div className="font-medium">I&apos;m a student</div>
                <div className="text-xs text-gray-500">
                  Connect with your campus community
                </div>
              </div>
            </label>
          </div>

          {/* State Selection */}
          <div>
            <label htmlFor="state" className="block text-sm font-medium mb-2">
              State <span className="text-red-500">*</span>
            </label>
            <select
              id="state"
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value as NigerianState)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isDetecting || isLoading}
              required
            >
              <option value="">Select your state</option>
              {NIGERIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          {/* University Selection (if student) */}
          {isStudent && selectedState && (
            <div>
              <label htmlFor="university" className="block text-sm font-medium mb-2">
                University/Institution {availableUniversities.length > 0 && <span className="text-red-500">*</span>}
              </label>
              {availableUniversities.length > 0 ? (
                <>
                  <select
                    id="university"
                    value={selectedUniversity}
                    onChange={(e) => setSelectedUniversity(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={isStudent}
                    disabled={isDetecting || isLoading}
                  >
                    <option value="">Select your institution</option>
                    {availableUniversities.map((uni) => (
                      <option key={uni.name} value={uni.name}>
                        {uni.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This helps you find services and opportunities on your campus
                  </p>
                </>
              ) : (
                <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md border border-gray-200">
                  No universities listed for {selectedState}. You can still continue.
                </div>
              )}
            </div>
          )}

          {/* City Selection */}
          {selectedState && (
            <div>
              <label htmlFor="city" className="block text-sm font-medium mb-2">
                City/Area (Optional)
              </label>
              {cities.length > 0 ? (
                <select
                  id="city"
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    if (e.target.value !== 'other') {
                      setCustomCity('');
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isDetecting || isLoading}
                >
                  <option value="">Select city (optional)</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                  <option value="other">Other (specify)</option>
                </select>
              ) : (
                <Input
                  type="text"
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  placeholder="Enter your city/area"
                  disabled={isDetecting || isLoading}
                  maxLength={50}
                />
              )}
            </div>
          )}

          {/* Custom City Input */}
          {showCustomCity && (
            <div>
              <label htmlFor="custom-city" className="block text-sm font-medium mb-2">
                Specify City/Area
              </label>
              <Input
                id="custom-city"
                type="text"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="Enter your city/area"
                disabled={isDetecting || isLoading}
                maxLength={50}
              />
            </div>
          )}

          {/* Location Preview */}
          {selectedState && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Your location will show as:
                  </p>
                  <p className="text-sm text-blue-700">
                    {[
                      showCustomCity ? customCity : selectedCity,
                      selectedState,
                      isStudent && selectedUniversity,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {!selectedCity && !customCity && !selectedUniversity && (
                    <p className="text-xs text-blue-600 mt-1">
                      Just &quot;{selectedState}&quot; - very general
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleManualSubmit}
            disabled={!isValid || isDetecting || isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Set Location
              </>
            )}
          </Button>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded text-sm">
          <p className="font-medium mb-1">Privacy Notice</p>
          <p className="text-xs">
            We only store your approximate city/state. Precise GPS coordinates
            are never saved permanently. You can change this anytime in your profile settings.
          </p>
        </div>
      </div>
    </Card>
  );
}