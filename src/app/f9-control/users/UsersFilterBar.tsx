'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

const ROLES   = ['client', 'freelancer', 'both', 'admin'];
const STATUSES = ['active', 'suspended', 'banned'];
const VERIFIED = [
  { value: 'liveness', label: 'Liveness Verified' },
  { value: 'identity', label: 'Identity Verified' },
  { value: 'student',  label: 'Student Verified'  },
  { value: 'none',     label: 'Unverified'        },
];

export function UsersFilterBar() {
  const router     = useRouter();
  const pathname   = usePathname();
  const params     = useSearchParams();

  const push = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page'); // reset pagination on filter change
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  const clear = () => router.push(pathname);

  const val = (key: string) => params.get(key) ?? '';

  const hasFilters = ['q', 'role', 'status', 'verified', 'location',
    'university', 'trust_min', 'trust_max'].some((k) => params.has(k));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      {/* Row 1 — text searches */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Search by name…"
          defaultValue={val('q')}
          onChange={(e) => push('q', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by location…"
          defaultValue={val('location')}
          onChange={(e) => push('location', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by university…"
          defaultValue={val('university')}
          onChange={(e) => push('university', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Row 2 — dropdowns + trust score range */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        {/* Role */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
          <select
            value={val('role')}
            onChange={(e) => push('role', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r} className="capitalize">{r}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={val('status')}
            onChange={(e) => push('status', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
        </div>

        {/* Verification */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Verification</label>
          <select
            value={val('verified')}
            onChange={(e) => push('verified', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Any</option>
            {VERIFIED.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Trust score range */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Trust Score ≥</label>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="0"
            defaultValue={val('trust_min')}
            onChange={(e) => push('trust_min', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Trust Score ≤</label>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="100"
            defaultValue={val('trust_max')}
            onChange={(e) => push('trust_max', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Clear */}
      {hasFilters && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clear}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}