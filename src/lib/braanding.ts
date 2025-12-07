// src/lib/branding.ts
// F9 Brand Constants - Single source of truth for all branding

export const BRAND = {
  // Core Identity
  NAME: 'F9',
  SHORT_NAME: 'F9',
  TAGLINE: 'Hustle Forward',
  FULL_NAME: 'F9 - Hustle Forward',
  
  // Descriptors
  DESCRIPTION: 'Nigeria\'s Premier Student Freelance Marketplace',
  DESCRIPTION_LONG: 'F9 connects talented Nigerian students with clients nationwide. Find services, post jobs, and grow your hustle - all in one platform built for Nigeria.',
  
  // Domain & URLs
  DOMAIN: 'f9.ng',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://f9.ng',
  
  // Social
  TWITTER: '@F9Nigeria',
  INSTAGRAM: '@f9.ng',
  LINKEDIN: 'f9-marketplace',
  
  // Contact
  SUPPORT_EMAIL: 'support@f9.ng',
  LEGAL_EMAIL: 'legal@f9.ng',
  PRESS_EMAIL: 'press@f9.ng',
  
  // Legal Entity
  LEGAL_NAME: 'F9 Marketplace Limited',
  RC_NUMBER: 'RC-XXXXXX', // Replace with actual RC number
  
  // Marketing Copy
  HERO_HEADLINE: '⚡ Hustle Forward with F9',
  HERO_SUBHEADLINE: 'Nigeria\'s #1 student freelance marketplace',
  CTA_PRIMARY: 'Start Hustling',
  CTA_SECONDARY: 'Explore Services',
  
  // Meta Tags
  META_TITLE: 'F9 - Hustle Forward | Nigeria\'s Premier Student Freelance Marketplace',
  META_DESCRIPTION: 'Connect with talented Nigerian students. Post jobs, hire freelancers, or offer your skills. Secure payments, verified users, built for Nigeria.',
  META_KEYWORDS: 'freelance nigeria, nigerian freelancers, student jobs nigeria, hire students, freelance marketplace',
  
  // Open Graph
  OG_IMAGE: '/og-image.png', // 1200x630
  OG_TYPE: 'website',
  
  // Colors (from logo/brand guide)
  COLORS: {
    PRIMARY: '#EF4444', // Red
    SECONDARY: '#3B82F6', // Blue
    TERTIARY: '#A855F7', // Purple
    GRADIENT_START: '#EF4444', // Red
    GRADIENT_MID: '#3B82F6', // Blue
    GRADIENT_END: '#A855F7', // Purple
    SUCCESS: '#10B981',
    ERROR: '#DC2626',
  },
  
  // Typography
  FONTS: {
    HEADING: 'var(--font-geist-sans)',
    BODY: 'var(--font-geist-sans)',
    MONO: 'var(--font-geist-mono)',
  },
} as const;

// Type-safe brand access
export type Brand = typeof BRAND;

// Helper functions
export const getBrandName = (variant: 'short' | 'full' | 'tagline' = 'short'): string => {
  switch (variant) {
    case 'short': return BRAND.SHORT_NAME;
    case 'full': return BRAND.FULL_NAME;
    case 'tagline': return `${BRAND.NAME} - ${BRAND.TAGLINE}`;
    default: return BRAND.NAME;
  }
};

export const getBrandEmail = (type: 'support' | 'legal' | 'press' = 'support'): string => {
  switch (type) {
    case 'support': return BRAND.SUPPORT_EMAIL;
    case 'legal': return BRAND.LEGAL_EMAIL;
    case 'press': return BRAND.PRESS_EMAIL;
    default: return BRAND.SUPPORT_EMAIL;
  }
};

export const getMetaTags = () => ({
  title: BRAND.META_TITLE,
  description: BRAND.META_DESCRIPTION,
  keywords: BRAND.META_KEYWORDS,
  openGraph: {
    type: BRAND.OG_TYPE,
    title: BRAND.META_TITLE,
    description: BRAND.META_DESCRIPTION,
    images: [{ url: BRAND.OG_IMAGE }],
  },
  twitter: {
    card: 'summary_large_image',
    site: BRAND.TWITTER,
    title: BRAND.META_TITLE,
    description: BRAND.META_DESCRIPTION,
    images: [BRAND.OG_IMAGE],
  },
});