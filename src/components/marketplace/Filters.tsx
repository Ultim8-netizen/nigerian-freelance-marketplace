'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DollarSign, Filter, MapPin, Package, X } from 'lucide-react';
import { NIGERIAN_STATES } from '@/types/location.types';

const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Textbooks',
  'Books & Stationery',
  'Home & Kitchen',
  'Furniture',
  'Sports & Outdoors',
  'Beauty & Health',
  'Food & Drinks',
  'Services',
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

  const removeFilter = (key: string) => {
    setFilters({ ...filters, [key]: '' });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden mb-4">
        <Button
          variant="outline"
          className="w-full bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Filter className="w-4 h-4 mr-2" />
          {isExpanded ? 'Hide Filters' : 'Show Filters'}
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full font-medium">
              Active
            </span>
          )}
        </Button>
      </div>

      {/* Filters Card */}
      <Card className={`p-6 bg-white border-gray-200 ${isExpanded ? 'block' : 'hidden lg:block'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {PRODUCT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Condition */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Condition
          </label>
          <div className="space-y-2">
            {CONDITION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <input
                  type="radio"
                  name="condition"
                  value={option.value}
                  checked={filters.condition === option.value}
                  onChange={(e) => setFilters({ ...filters, condition: e.target.value })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{option.label}</span>
              </label>
            ))}
            {filters.condition && (
              <button
                onClick={() => setFilters({ ...filters, condition: '' })}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>

        {/* Price Range */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
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
              className="text-gray-700 border-gray-200"
            />
            <Input
              type="number"
              placeholder="Max price"
              value={filters.max_price}
              onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
              min="0"
              step="1000"
              className="text-gray-700 border-gray-200"
            />
          </div>
          
          {/* Quick Price Buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => setFilters({ ...filters, min_price: '', max_price: '10000' })}
            >
              Under ₦10k
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => setFilters({ ...filters, min_price: '10000', max_price: '50000' })}
            >
              ₦10k - ₦50k
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => setFilters({ ...filters, min_price: '50000', max_price: '' })}
            >
              ₦50k+
            </Button>
          </div>
        </div>

        {/* Location */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location
          </label>
          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All States</option>
            {NIGERIAN_STATES.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Find products near you
          </p>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Active Filters</h4>
            <div className="flex flex-wrap gap-2">
              {filters.category && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 text-sm">
                  <span className="font-medium">{filters.category}</span>
                  <button
                    onClick={() => removeFilter('category')}
                    className="hover:text-blue-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {filters.condition && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 text-sm">
                  <span className="font-medium capitalize">{filters.condition.replace('_', ' ')}</span>
                  <button
                    onClick={() => removeFilter('condition')}
                    className="hover:text-purple-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {(filters.min_price || filters.max_price) && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm">
                  <span className="font-medium">
                    {filters.min_price && `₦${filters.min_price}`}
                    {filters.min_price && filters.max_price && ' - '}
                    {filters.max_price && `₦${filters.max_price}`}
                  </span>
                  <button
                    onClick={() => setFilters({ ...filters, min_price: '', max_price: '' })}
                    className="hover:text-green-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {filters.state && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg border border-orange-200 text-sm">
                  <span className="font-medium">{filters.state}</span>
                  <button
                    onClick={() => removeFilter('state')}
                    className="hover:text-orange-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button 
            onClick={handleApply} 
            className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-md"
          >
            Apply Filters
          </Button>
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={handleClear}
              className="w-full text-gray-700 border-gray-200 hover:bg-gray-50"
            >
              Clear All Filters
            </Button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 leading-relaxed">
            Use filters to narrow down your search. You can combine multiple filters 
            to find exactly what you are looking for.
          </p>
        </div>
      </Card>
    </>
  );
}