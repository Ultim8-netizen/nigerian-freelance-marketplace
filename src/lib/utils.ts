// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// CURRENCY & NUMBER FORMATTING
// ============================================================================

export function formatNaira(amount: number, options?: {
  showDecimals?: boolean;
  compact?: boolean;
}): string {
  const { showDecimals = false, compact = false } = options || {};

  if (compact && amount >= 1000000) {
    return `₦${(amount / 1000000).toFixed(1)}M`;
  }
  if (compact && amount >= 1000) {
    return `₦${(amount / 1000).toFixed(1)}K`;
  }

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

export function formatCurrency(
  amount: number,
  currency: string = 'NGN',
  options?: { showDecimals?: boolean }
): string {
  const { showDecimals = true } = options || {};
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

export function formatNumber(num: number, options?: {
  compact?: boolean;
  suffix?: string;
}): string {
  const { compact = false, suffix = '' } = options || {};

  if (compact) {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B${suffix}`;
    if (num >= 1000000)    return `${(num / 1000000).toFixed(1)}M${suffix}`;
    if (num >= 1000)       return `${(num / 1000).toFixed(1)}K${suffix}`;
  }

  return new Intl.NumberFormat('en-NG').format(num) + suffix;
}

// ============================================================================
// FINANCIAL CALCULATIONS
// ============================================================================

/**
 * Calculate platform fee for a freelance/job order.
 * Uses Math.round — ₦0.something does not exist in Nigerian banking.
 * Always returns ≥ 0.
 *
 * @param amount      Gross order amount in kobo-free naira integers.
 * @param feePercent  Whole-number percentage (default: 10 = 10%).
 *                    Pass the value fetched from platform_config
 *                    (CONFIG_KEYS.FREELANCE_FEE_PERCENT).
 */
export function calculatePlatformFee(
  amount: number,
  feePercent: number = 10,
): number {
  if (amount <= 0) return 0;
  return Math.max(0, Math.round(amount * (feePercent / 100)));
}

/**
 * Calculate freelancer net earnings after the platform fee.
 * Always returns ≥ 0.
 *
 * @param amount      Gross order amount.
 * @param feePercent  Whole-number percentage (default: 10).
 */
export function calculateFreelancerEarnings(
  amount: number,
  feePercent: number = 10,
): number {
  if (amount <= 0) return 0;
  return Math.max(0, amount - calculatePlatformFee(amount, feePercent));
}

/**
 * Calculate platform fee for a physical marketplace order.
 * Uses Math.round — ₦0.something does not exist in Nigerian banking.
 * Always returns ≥ 0.
 *
 * @param amount      Gross total_amount (subtotal + delivery_fee).
 * @param feePercent  Whole-number percentage (default: 8 = 8%).
 *                    Pass the value fetched from platform_config
 *                    (CONFIG_KEYS.MARKETPLACE_FEE_PERCENT).
 */
export function calculateMarketplaceFee(
  amount: number,
  feePercent: number = 8,
): number {
  if (amount <= 0) return 0;
  return Math.max(0, Math.round(amount * (feePercent / 100)));
}

/**
 * Calculate seller net earnings after the marketplace platform fee.
 * Always returns ≥ 0.
 *
 * @param amount      Gross total_amount.
 * @param feePercent  Whole-number percentage (default: 8).
 */
export function calculateSellerEarnings(
  amount: number,
  feePercent: number = 8,
): number {
  if (amount <= 0) return 0;
  return Math.max(0, amount - calculateMarketplaceFee(amount, feePercent));
}

/**
 * Calculate total with tax
 */
export function calculateWithTax(
  amount: number,
  taxRate: number = 7.5
): { subtotal: number; tax: number; total: number } {
  const tax = Math.round(amount * (taxRate / 100));
  return { subtotal: amount, tax, total: amount + tax };
}

// ============================================================================
// DATE & TIME FORMATTING
// ============================================================================

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60)     return 'just now';
  if (diffInSeconds < 3600)   { const m = Math.floor(diffInSeconds / 60);     return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`; }
  if (diffInSeconds < 86400)  { const h = Math.floor(diffInSeconds / 3600);   return `${h} ${h === 1 ? 'hour' : 'hours'} ago`; }
  if (diffInSeconds < 604800) { const d = Math.floor(diffInSeconds / 86400);  return `${d} ${d === 1 ? 'day' : 'days'} ago`; }
  if (diffInSeconds < 2592000){ const w = Math.floor(diffInSeconds / 604800); return `${w} ${w === 1 ? 'week' : 'weeks'} ago`; }
  if (diffInSeconds < 31536000){ const mo = Math.floor(diffInSeconds / 2592000); return `${mo} ${mo === 1 ? 'month' : 'months'} ago`; }
  const y = Math.floor(diffInSeconds / 31536000);
  return `${y} ${y === 1 ? 'year' : 'years'} ago`;
}

export function formatDate(date: Date | string, format: 'short' | 'long' = 'long'): string {
  const d = new Date(date);
  if (format === 'short') {
    return new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  }
  return new Intl.DateTimeFormat('en-NG', { month: 'long', day: 'numeric', year: 'numeric' }).format(d);
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-NG', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(date));
}

// ============================================================================
// TEXT MANIPULATION
// ============================================================================

export function truncateText(text: string, maxLength: number, options?: { useWordBoundary?: boolean }): string {
  const { useWordBoundary = true } = options || {};
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  if (useWordBoundary) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}

export function getInitials(name: string): string {
  return name.split(' ').filter(n => n.length > 0).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  return text.replace(new RegExp(`(${query})`, 'gi'), '<mark>$1</mark>');
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidNigerianPhone(phone: string): boolean {
  return /^(\+234|0)[789]\d{9}$/.test(phone.replace(/\s/g, ''));
}

export function normalizeNigerianPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('0'))    return '+234' + cleaned.slice(1);
  if (cleaned.startsWith('234')) return '+' + cleaned;
  return phone;
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string')  return value.trim().length === 0;
  if (Array.isArray(value))       return value.length === 0;
  if (typeof value === 'object')  return Object.keys(value).length === 0;
  return false;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================================
// ID & CODE GENERATION
// ============================================================================

export function generateOrderNumber(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ORD-${date}-${random}`;
}

export function generateId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export function generateReference(prefix: string = 'REF'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T, wait: number, options?: { leading?: boolean; trailing?: boolean }
): (...args: Parameters<T>) => void {
  const { leading = false, trailing = true } = options || {};
  let timeout: NodeJS.Timeout | null = null;
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (leading && now - lastCallTime > wait) func(...args);
    if (timeout) clearTimeout(timeout);
    if (trailing) {
      timeout = setTimeout(() => { func(...args); lastCallTime = Date.now(); }, wait);
    }
    lastCallTime = now;
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T, limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export async function retry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; delay?: number; backoff?: number }
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options || {};
  let lastError: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) await sleep(delay * Math.pow(backoff, attempt - 1));
    }
  }
  throw lastError!;
}

// ============================================================================
// ARRAY & OBJECT UTILITIES
// ============================================================================

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce((result, key) => {
    if (key in obj) result[key] = obj[key];
    return result;
  }, {} as Pick<T, K>);
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 65%, 55%)`;
}

export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000000' : '#FFFFFF';
}