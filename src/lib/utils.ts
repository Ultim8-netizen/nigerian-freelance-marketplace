// src/lib/utils.ts
// Utility functions

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM dd, yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function calculatePlatformFee(amount: number, feePercentage: number = 10): number {
  return Math.round(amount * (feePercentage / 100));
}

export function calculateFreelancerEarnings(amount: number, feePercentage: number = 10): number {
  return amount - calculatePlatformFee(amount, feePercentage);
}

export function generateOrderNumber(): string {
  const date = format(new Date(), 'yyyyMMdd');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ORD-${date}-${random}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidNigerianPhone(phone: string): boolean {
  return /^(\+234|0)[789]\d{9}$/.test(phone);
}

export function normalizeNigerianPhone(phone: string): string {
  // Convert to +234 format
  if (phone.startsWith('0')) {
    return '+234' + phone.slice(1);
  }
  if (phone.startsWith('234')) {
    return '+' + phone;
  }
  return phone;
}
