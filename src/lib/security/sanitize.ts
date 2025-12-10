// src/lib/security/sanitize.ts
// PRODUCTION-READY: Comprehensive input sanitization and XSS prevention

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content with configurable security levels
 */
export function sanitizeHtml(
  dirty: string,
  level: 'strict' | 'moderate' | 'permissive' = 'moderate'
): string {
  const configs = {
    strict: {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false,
    },
    moderate: {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
    },
    permissive: {
      ALLOWED_TAGS: [
        'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOW_DATA_ATTR: false,
    },
  };

  return DOMPurify.sanitize(dirty, {
    ...configs[level],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    RETURN_TRUSTED_TYPE: false,
  });
}

/**
 * Sanitize plain text by escaping HTML entities
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Sanitize URL to prevent XSS via javascript: or data: protocols
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ];
  
  if (dangerousProtocols.some(protocol => trimmed.startsWith(protocol))) {
    return '';
  }
  
  // Only allow http, https, mailto, tel
  const allowedProtocols = /^(https?|mailto|tel):/i;
  if (!trimmed.match(allowedProtocols) && !trimmed.startsWith('/') && !trimmed.startsWith('#')) {
    return '';
  }
  
  return url;
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
    .replace(/\.{2,}/g, '.') // Remove multiple dots
    .replace(/^\.+/, '') // Remove leading dots
    .slice(0, 255); // Limit length
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';
  
  return query
    .replace(/[<>'"]/g, '') // Remove HTML chars
    .replace(/[\\]/g, '') // Remove backslashes
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .slice(0, 200); // Limit length
}

/**
 * Sanitize object recursively (for form data)
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  textFields: (keyof T)[],
  htmlFields: (keyof T)[] = []
): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    const value = sanitized[key];
    
    if (typeof value === 'string') {
      if (htmlFields.includes(key as keyof T)) {
        sanitized[key] = sanitizeHtml(value) as any;
      } else if (textFields.includes(key as keyof T)) {
        sanitized[key] = sanitizeText(value) as any;
      }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      ) as any;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, textFields, htmlFields) as any;
    }
  }
  
  return sanitized;
}

/**
 * Remove null bytes (potential for SQL injection bypass)
 */
export function removeNullBytes(input: string): string {
  return input.replace(/\0/g, '');
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.@_+-]/g, '') // Allow only valid email chars
    .slice(0, 255);
}

/**
 * Sanitize phone number (Nigerian format)
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digits except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Normalize to +234 format if it's 11 digits starting with 0
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+234${cleaned.slice(1)}`;
  }
  
  // Add + if it starts with 234
  if (cleaned.startsWith('234') && cleaned.length === 13) {
    return `+${cleaned}`;
  }
  
  return cleaned;
}

/**
 * Sanitize currency amount
 */
export function sanitizeCurrency(amount: string | number): number {
  if (typeof amount === 'number') {
    return Math.max(0, Math.round(amount * 100) / 100);
  }
  
  const cleaned = amount.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed * 100) / 100);
}

/**
 * Sanitize JSON string safely
 */
export function sanitizeJson<T>(jsonString: string): T | null {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Check for prototype pollution
    if (parsed && typeof parsed === 'object') {
      if ('__proto__' in parsed || 'constructor' in parsed || 'prototype' in parsed) {
        console.warn('Potential prototype pollution attempt detected');
        return null;
      }
    }
    
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Comprehensive sanitization for user-generated content
 */
export function sanitizeUserContent(input: {
  title?: string;
  description?: string;
  tags?: string[];
  urls?: string[];
}): typeof input {
  return {
    title: input.title ? sanitizeText(input.title) : undefined,
    description: input.description ? sanitizeHtml(input.description) : undefined,
    tags: input.tags?.map(tag => sanitizeText(tag).toLowerCase()) || [],
    urls: input.urls?.map(url => sanitizeUrl(url)).filter(Boolean) || [],
  };
}

/**
 * Strip all HTML tags (for preview/excerpt generation)
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  
  return html
    .replace(/<[^>]*>/g, '') // Remove all tags
    .replace(/&nbsp;/g, ' ') // Replace nbsp
    .replace(/&[a-z]+;/gi, ' ') // Replace entities
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Sanitize for database LIKE queries (escape special chars)
 */
export function sanitizeLikeQuery(query: string): string {
  if (!query) return '';
  
  return query
    .replace(/[%_\\]/g, '\\$&') // Escape LIKE special chars
    .trim()
    .slice(0, 100);
}

/**
 * Validate and sanitize UUID
 */
export function sanitizeUuid(uuid: string): string | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuid || !uuidRegex.test(uuid)) {
    return null;
  }
  
  return uuid.toLowerCase();
}

/**
 * Content Security Policy (CSP) safe inline script
 */
export function createCspSafeInlineScript(content: string): string {
  // Remove any existing script tags
  const cleaned = content.replace(/<\/?script[^>]*>/gi, '');
  
  // Escape for safe inline usage
  return cleaned
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Rate limit key sanitization
 */
export function sanitizeRateLimitKey(key: string): string {
  return key
    .replace(/[^a-zA-Z0-9:_-]/g, '_')
    .slice(0, 100);
}