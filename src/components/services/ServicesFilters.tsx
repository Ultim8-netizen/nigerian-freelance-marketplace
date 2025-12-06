// src/components/services/ServicesFilters.tsx
// Filter sidebar for services browse page

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { SERVICE_CATEGORIES } from '@/types/service-categories';
import { NIGERIAN_STATES } from '@/types/location.types';
import { Search, MapPin, DollarSign, Filter } from 'lucide-react';

interface ServicesFiltersProps {
  currentFilters: {
    search?: string;
    category?: string;
    min_price?: string;
    max_price?: string;
    state?: string;
    city?: string;
  };
}

export function ServicesFilters({ currentFilters }: ServicesFiltersProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const [filters, setFilters] = useState({
    search: currentFilters.search || '',
    category: currentFilters.category || '',
    min_price: currentFilters.min_price || '',
    max_price: currentFilters.max_price || '',
    state: currentFilters.state || '',
  });

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    
    if (filters.search) params.set('search', filters.search);
    if (filters.category) params.set('category', filters.category);
    if (filters.min_price) params.set('min_price', filters.min_price);
    if (filters.max_price) params.set('max_price', filters.max_price);
    if (filters.state) params.set('state', filters.state);

    router.push(`/services?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      category: '',
      min_price: '',
      max_price: '',
      state: '',
    });
    router.push('/services');
  };

  return (
    <>
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden mb-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Filter className="w-4 h-4 mr-2" />
          {isExpanded ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      {/* Filters Card */}
      <Card
        className={`p-4 space-y-6 ${
          isExpanded ? 'block' : 'hidden lg:block'
        }`}
      >
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </h3>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search Services
          </label>
          <Input
            type="text"
            placeholder="What are you looking for?"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Categories</option>
            {Object.entries(SERVICE_CATEGORIES).map(([key, cat]) => (
              <optgroup key={key} label={cat.label}>
                {cat.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Price Range (₦)
          </label>
          <div className="space-y-2">
            <Input
              type="number"
              placeholder="Min price"
              value={filters.min_price}
              onChange={(e) =>
                setFilters({ ...filters, min_price: e.target.value })
              }
              min="0"
              step="500"
            />
            <Input
              type="number"
              placeholder="Max price"
              value={filters.max_price}
              onChange={(e) =>
                setFilters({ ...filters, max_price: e.target.value })
              }
              min="0"
              step="500"
            />
          </div>
          {/* Quick price ranges */}
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() =>
                setFilters({ ...filters, min_price: '', max_price: '5000' })
              }
            >
              Under ₦5k
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() =>
                setFilters({ ...filters, min_price: '5000', max_price: '20000' })
              }
            >
              ₦5k - ₦20k
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() =>
                setFilters({ ...filters, min_price: '20000', max_price: '' })
              }
            >
              ₦20k+
            </Button>
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location (Proximity)
          </label>
          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Locations</option>
            {NIGERIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Find services near you
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-4 border-t">
          <Button className="w-full" onClick={handleApplyFilters}>
            Apply Filters
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleClearFilters}
          >
            Clear All
          </Button>
        </div>
      </Card>
    </>
  );
}