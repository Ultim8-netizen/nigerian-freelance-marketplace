// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes with proper precedence
 * Uses clsx for conditional classes and tailwind-merge for deduplication
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// CURRENCY & NUMBER FORMATTING
// ============================================================================

/**
 * Format currency in Nigerian Naira with flexible options
 */
export function formatNaira(amount: number, options?: {
  showDecimals?: boolean;
  compact?: boolean;
}): string {
  const { showDecimals = false, compact = false } = options || {};
  
  if (compact && amount >= 1000000) {
    const millions = amount / 1000000;
    return `₦${millions.toFixed(1)}M`;
  }
  
  if (compact && amount >= 1000) {
    const thousands = amount / 1000;
    return `₦${thousands.toFixed(1)}K`;
  }
  
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

/**
 * Format currency with multi-currency support
 */
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

/**
 * Format numbers with commas and optional suffix
 */
export function formatNumber(num: number, options?: {
  compact?: boolean;
  suffix?: string;
}): string {
  const { compact = false, suffix = '' } = options || {};
  
  if (compact) {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B${suffix}`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M${suffix}`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K${suffix}`;
  }
  
  return new Intl.NumberFormat('en-NG').format(num) + suffix;
}

// ============================================================================
// FINANCIAL CALCULATIONS
// ============================================================================

/**
 * Calculate platform fee from amount
 */
export function calculatePlatformFee(
  amount: number, 
  feePercentage: number = 10
): number {
  return Math.round(amount * (feePercentage / 100));
}

/**
 * Calculate freelancer earnings after platform fee
 */
export function calculateFreelancerEarnings(
  amount: number, 
  feePercentage: number = 10
): number {
  return amount - calculatePlatformFee(amount, feePercentage);
}

/**
 * Calculate total with tax
 */
export function calculateWithTax(
  amount: number,
  taxRate: number = 7.5
): { subtotal: number; tax: number; total: number } {
  const tax = Math.round(amount * (taxRate / 100));
  return {
    subtotal: amount,
    tax,
    total: amount + tax,
  };
}

// ============================================================================
// DATE & TIME FORMATTING
// ============================================================================

/**
 * Format relative time with smart precision
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  const years = Math.floor(diffInSeconds / 31536000);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Format date in readable format
 */
export function formatDate(date: Date | string, format: 'short' | 'long' = 'long'): string {
  const d = new Date(date);
  
  if (format === 'short') {
    return new Intl.DateTimeFormat('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }
  
  return new Intl.DateTimeFormat('en-NG', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-NG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

// ============================================================================
// TEXT MANIPULATION
// ============================================================================

/**
 * Truncate text with ellipsis and word boundary awareness
 */
export function truncateText(
  text: string, 
  maxLength: number,
  options?: { useWordBoundary?: boolean }
): string {
  const { useWordBoundary = true } = options || {};
  
  if (text.length <= maxLength) return text;
  
  const truncated = text.slice(0, maxLength);
  
  if (useWordBoundary) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      return truncated.slice(0, lastSpace) + '...';
    }
  }
  
  return truncated + '...';
}

/**
 * Generate initials from name (handles multiple names)
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Slugify text for URLs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Highlight search terms in text
 */
export function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate Nigerian phone number
 */
export function isValidNigerianPhone(phone: string): boolean {
  return /^(\+234|0)[789]\d{9}$/.test(phone.replace(/\s/g, ''));
}

/**
 * Normalize Nigerian phone to international format
 */
export function normalizeNigerianPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, '');
  
  if (cleaned.startsWith('0')) {
    return '+234' + cleaned.slice(1);
  }
  if (cleaned.startsWith('234')) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('+234')) {
    return cleaned;
  }
  
  return phone;
}

/**
 * Check if value is empty (null, undefined, empty string, array, or object)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// ============================================================================
// ID & CODE GENERATION
// ============================================================================

/**
 * Generate unique order number with date prefix
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  return `ORD-${year}${month}${day}-${random}`;
}

/**
 * Generate random ID with customizable length
 */
export function generateId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Generate reference code (e.g., for transactions)
 */
export function generateReference(prefix: string = 'REF'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function with leading/trailing options
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options?: { leading?: boolean; trailing?: boolean }
): (...args: Parameters<T>) => void {
  const { leading = false, trailing = true } = options || {};
  let timeout: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (leading && now - lastCallTime > wait) {
      func(...args);
    }
    
    if (timeout) clearTimeout(timeout);
    
    if (trailing) {
      timeout = setTimeout(() => {
        func(...args);
        lastCallTime = Date.now();
      }, wait);
    }
    
    lastCallTime = now;
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
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

/**
 * Retry async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
  }
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options || {};
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        await sleep(delay * Math.pow(backoff, attempt - 1));
      }
    }
  }
  
  throw lastError!;
}

// ============================================================================
// ARRAY & OBJECT UTILITIES
// ============================================================================

/**
 * Group array items by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick specific keys from object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce((result, key) => {
    if (key in obj) result[key] = obj[key];
    return result;
  }, {} as Pick<T, K>);
}

/**
 * Omit specific keys from object
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Generate consistent color from string (for avatars, tags, etc.)
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Get contrast color (black or white) for background
 */
export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}