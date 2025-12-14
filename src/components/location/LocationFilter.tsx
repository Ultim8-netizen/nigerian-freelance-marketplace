// src/components/location/LocationFilter.tsx
// Filter jobs/services by location

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NIGERIAN_STATES, MAJOR_CITIES, type LocationFilter } from '@/types/location.types';
import { MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationFilterProps {
  currentFilter?: LocationFilter;
  onFilterChange: (filter: LocationFilter | null) => void;
  className?: string;
}

export function LocationFilter({
  currentFilter,
  onFilterChange,
  className,
}: LocationFilterProps) {
  const [showFilter, setShowFilter] = useState(!!currentFilter);
  
  // FIX 1: Explicitly type `state` as `string`. This allows the empty string ('')
  // for "All States" without causing conflicts with the strict union type
  // that `currentFilter?.state` would otherwise enforce on the state variable.
  const [state, setState] = useState<string>(currentFilter?.state || '');
  const [city, setCity] = useState(currentFilter?.city || '');
  const [remoteOk, setRemoteOk] = useState(currentFilter?.remote_ok || false);

  // Use type assertion to safely access MAJOR_CITIES based on the current state string
  const cities = state ? MAJOR_CITIES[state as keyof typeof MAJOR_CITIES] || [] : [];

  const handleApply = () => {
    if (!state && !remoteOk) {
      onFilterChange(null);
      setShowFilter(false);
      return;
    }

    // FIX 2: Use type assertions when assigning `state` and `city` to `LocationFilter`.
    // We confirm to TypeScript that if these values are not empty, they conform to the
    // strict union types expected by the LocationFilter interface, as the
    // options in the `<select>` element enforce this constraint at runtime.
    const filter: LocationFilter = {
      state: (state || undefined) as LocationFilter['state'],
      city: (city || undefined) as LocationFilter['city'],
      remote_ok: remoteOk,
    };

    onFilterChange(filter);
    setShowFilter(false);
  };

  const handleClear = () => {
    setState('');
    setCity('');
    setRemoteOk(false);
    onFilterChange(null);
    setShowFilter(false);
  };

  if (!showFilter) {
    return (
      <Button
        variant="outline"
        onClick={() => setShowFilter(true)}
        className={cn('gap-2', className)}
      >
        <MapPin className="w-4 h-4" />
        {currentFilter ? 'Location: ' + currentFilter.state : 'Filter by Location'}
      </Button>
    );
  }

  return (
    <div className={cn('bg-white border rounded-lg p-4 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filter by Location</h3>
        <button onClick={() => setShowFilter(false)}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">State</label>
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setCity(''); // Reset city
            }}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">All States</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {state && cities.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">All Cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="remote-ok"
            checked={remoteOk}
            onChange={(e) => setRemoteOk(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="remote-ok" className="text-sm">
            Include remote work
          </label>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleApply} className="flex-1">
            Apply Filter
          </Button>
          <Button onClick={handleClear} variant="outline">
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}