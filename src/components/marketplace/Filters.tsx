'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DollarSign, Filter, MapPin, Package } from 'lucide-react';
import { NIGERIAN_STATES } from '@/types/location.types';

const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Books & Stationery',
  'Home & Kitchen',
  'Sports & Outdoors',
  'Beauty & Health',
  'Food & Drinks',
  'Other',
];

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'used', label: 'Used' },
];

interface MarketplaceFiltersProps {
  currentFilters: {
    search?: string;
    category?: string;
    condition?: string;
    min_price?: string;
    max_price?: string;
    state?: string;
  };
}

export function MarketplaceFilters({ currentFilters }: MarketplaceFiltersProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const [filters, setFilters] = useState({
    search: currentFilters.search || '',
    category: currentFilters.category || '',
    condition: currentFilters.condition || '',
    min_price: currentFilters.min_price || '',
    max_price: currentFilters.max_price || '',
    state: currentFilters.state || '',
  });

  const handleApply = () => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    router.push(`/marketplace?${params.toString()}`);
  };

  const handleClear = () => {
    setFilters({
      search: '',
      category: '',
      condition: '',
      min_price: '',
      max_price: '',
      state: '',
    });
    router.push('/marketplace');
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden mb-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Filter className="w-4 h-4 mr-2" />
          {isExpanded ? 'Hide Filters' : 'Show Filters'}
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
              Active
            </span>
          )}
        </Button>
      </div>

      {/* Filters Card */}
      <Card className={`p-4 space-y-6 ${isExpanded ? 'block' : 'hidden lg:block'}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-xs"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Categories</option>
            {PRODUCT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Condition */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Condition
          </label>
          <div className="space-y-2">
            {CONDITION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="condition"
                  value={option.value}
                  checked={filters.condition === option.value}
                  onChange={(e) => setFilters({ ...filters, condition: e.target.value })}
                  className="w-4 h-4"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
            {filters.condition && (
              <button
                onClick={() => setFilters({ ...filters, condition: '' })}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Price Range (₦)
          </label>
          <div className="space-y-2">
            <Input
              type="number"
              placeholder="Min price"
              value={filters.min_price}
              onChange={(e) => setFilters({ ...filters, min_price: e.target.value })}
              min="0"
              step="1000"
            />
            <Input
              type="number"
              placeholder="Max price"
              value={filters.max_price}
              onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
              min="0"
              step="1000"
            />
          </div>
          
          {/* Quick Price Buttons */}
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setFilters({ ...filters, min_price: '', max_price: '10000' })}
            >
              Under ₦10k
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setFilters({ ...filters, min_price: '10000', max_price: '50000' })}
            >
              ₦10k - ₦50k
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setFilters({ ...filters, min_price: '50000', max_price: '' })}
            >
              ₦50k+
            </Button>
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location
          </label>
          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All States</option>
            {NIGERIAN_STATES.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Find products near you
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-4 border-t">
          <Button onClick={handleApply} className="w-full">
            Apply Filters
          </Button>
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={handleClear}
              className="w-full"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}