// src/lib/validations.ts
// Enhanced Zod validation schemas with smart UX innovations and comprehensive security
// Zod v4 compatible - all deprecation warnings resolved

import { z } from 'zod';

// ============================================================================
// SHARED CONSTANTS & UTILITIES
// ============================================================================

export const NIGERIAN_PHONE_REGEX = /^(\+234|0)[789]\d{9}$/;

// Password strength requirements with real-time feedback capability
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIREMENTS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[^A-Za-z0-9]/,
} as const;

// Nigerian currency constraints
export const NAIRA_CONSTRAINTS = {
  MIN_PRICE: 1000,
  MIN_WITHDRAWAL: 5000,
  MAX_PRICE: 10_000_000, // 10 million naira cap for safety
} as const;

// Popular Nigerian banks for autocomplete/suggestions
export const NIGERIAN_BANKS = [
  'Access Bank', 'GTBank', 'First Bank', 'UBA', 'Zenith Bank',
  'Ecobank', 'Fidelity Bank', 'Union Bank', 'Stanbic IBTC',
  'Sterling Bank', 'Wema Bank', 'Polaris Bank', 'Keystone Bank'
] as const;

// ============================================================================
// SMART VALIDATION HELPERS
// ============================================================================

/**
 * Enhanced password strength calculator
 * Returns: { score: 0-100, feedback: string[], isStrong: boolean }
 */
export const calculatePasswordStrength = (password: string) => {
  let score = 0;
  const feedback: string[] = [];

  // Length scoring
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety
  if (PASSWORD_REQUIREMENTS.uppercase.test(password)) {
    score += 15;
  } else {
    feedback.push('Add uppercase letters');
  }

  if (PASSWORD_REQUIREMENTS.lowercase.test(password)) {
    score += 15;
  } else {
    feedback.push('Add lowercase letters');
  }

  if (PASSWORD_REQUIREMENTS.number.test(password)) {
    score += 15;
  } else {
    feedback.push('Add numbers');
  }

  if (PASSWORD_REQUIREMENTS.special.test(password)) {
    score += 15;
  } else {
    feedback.push('Add special characters');
  }

  // Penalize common patterns
  const commonPatterns = ['12345', 'password', 'qwerty', 'abcde'];
  const hasCommonPattern = commonPatterns.some(p => 
    password.toLowerCase().includes(p)
  );
  if (hasCommonPattern) {
    score -= 20;
    feedback.push('Avoid common patterns');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    feedback,
    isStrong: score >= 70 && feedback.length === 0
  };
};

/**
 * Smart phone number formatter with suggestions
 */
export const formatPhoneNumber = (input: string): {
  formatted: string;
  isValid: boolean;
  suggestion?: string;
} => {
  const cleaned = input.replace(/\D/g, '');
  
  // Check if starts with 0 (local format)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return {
      formatted: `+234${cleaned.slice(1)}`,
      isValid: NIGERIAN_PHONE_REGEX.test(cleaned),
      suggestion: 'Converted to international format'
    };
  }
  
  // Check if starts with 234 (missing +)
  if (cleaned.startsWith('234') && cleaned.length === 13) {
    return {
      formatted: `+${cleaned}`,
      isValid: true,
      suggestion: 'Added country code prefix'
    };
  }

  return {
    formatted: input,
    isValid: NIGERIAN_PHONE_REGEX.test(input)
  };
};

/**
 * Validates Nigerian bank account number format
 */
const validateNigerianAccountNumber = (accountNumber: string): boolean => {
  return /^\d{10}$/.test(accountNumber);
};

/**
 * Sanitizes string input by trimming and normalizing whitespace
 */
const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, ' ');
};

/**
 * Smart name validator with helpful suggestions
 */
export const validateFullName = (name: string): { 
  isValid: boolean; 
  suggestion?: string 
} => {
  const parts = name.trim().split(/\s+/);
  
  if (parts.length < 2) {
    return {
      isValid: false,
      suggestion: 'Please include both first and last name'
    };
  }

  // Check for suspicious patterns
  if (parts.some(p => p.length === 1 && p !== p.toUpperCase())) {
    return {
      isValid: true,
      suggestion: 'Did you mean to use an initial? Consider spelling out your full name'
    };
  }

  return { isValid: true };
};

/**
 * Budget range validator with smart suggestions
 */
export const validateBudgetRange = (min?: number, max?: number, type?: string) => {
  if (type === 'negotiable') return { isValid: true };
  if (!min || !max) return { isValid: true };

  const range = max - min;
  const avgBudget = (min + max) / 2;

  if (range < avgBudget * 0.1) {
    return {
      isValid: true,
      suggestion: 'Narrow budget range may limit proposals. Consider widening it by 20-30%.'
    };
  }

  if (range > avgBudget * 2) {
    return {
      isValid: true,
      suggestion: 'Wide budget range detected. This may attract varied proposals.'
    };
  }

  return { isValid: true };
};

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

/**
 * Registration schema with enhanced password security and field validation
 * Uses Zod v4 compatible syntax with pipe for email validation
 */
export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z.email({ error: 'Invalid email address' })
    )
    .pipe(
      z.string()
        .max(255, { error: 'Email is too long' })
        .refine((email) => {
          // Warn about disposable email domains
          const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
          return !disposableDomains.some(d => email.endsWith(d));
        }, {
          message: 'Please use a permanent email address for account security'
        })
    ),
  
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` })
    .max(128, { error: 'Password is too long' })
    .regex(PASSWORD_REQUIREMENTS.uppercase, { error: 'Must contain at least one uppercase letter' })
    .regex(PASSWORD_REQUIREMENTS.lowercase, { error: 'Must contain at least one lowercase letter' })
    .regex(PASSWORD_REQUIREMENTS.number, { error: 'Must contain at least one number' })
    .regex(PASSWORD_REQUIREMENTS.special, { error: 'Must contain at least one special character' })
    .refine((pwd) => {
      const strength = calculatePasswordStrength(pwd);
      return strength.isStrong;
    }, {
      message: 'Password is not strong enough. Try making it longer or more complex.'
    }),
  
  full_name: z
    .string()
    .min(2, { error: 'Name must be at least 2 characters' })
    .max(100, { error: 'Name is too long' })
    .transform(sanitizeString)
    .refine((name) => {
      const validation = validateFullName(name);
      return validation.isValid;
    }, {
      message: 'Please provide both first and last name',
    }),
  
  phone_number: z
    .string()
    .regex(NIGERIAN_PHONE_REGEX, { error: 'Invalid Nigerian phone number (format: +234XXXXXXXXXX or 0XXXXXXXXXX)' })
    .transform((phone) => {
      // Auto-normalize to +234 format
      return phone.startsWith('0') ? `+234${phone.slice(1)}` : phone;
    }),
  
  user_type: z.enum(['freelancer', 'client', 'both'], {
    message: 'Please select a valid user type',
  }),
  
  university: z
    .string()
    .max(200, { error: 'University name is too long' })
    .transform(sanitizeString)
    .optional(),
  
  location: z
    .string()
    .max(100, { error: 'Location is too long' })
    .transform(sanitizeString)
    .optional(),
});

/**
 * Login schema with rate limiting awareness
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Invalid email address' })),
  
  password: z
    .string()
    .min(1, { error: 'Password is required' }),
  
  remember_me: z.boolean().default(false),
});

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Invalid email address' })),
});

/**
 * Password reset confirmation schema with strength validation
 */
export const passwordResetSchema = z.object({
  token: z.string().min(1, { error: 'Reset token is required' }),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` })
    .max(128, { error: 'Password is too long' })
    .regex(PASSWORD_REQUIREMENTS.uppercase, { error: 'Must contain at least one uppercase letter' })
    .regex(PASSWORD_REQUIREMENTS.lowercase, { error: 'Must contain at least one lowercase letter' })
    .regex(PASSWORD_REQUIREMENTS.number, { error: 'Must contain at least one number' })
    .regex(PASSWORD_REQUIREMENTS.special, { error: 'Must contain at least one special character' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ============================================================================
// SERVICE & JOB SCHEMAS
// ============================================================================

/**
 * Service creation/update schema with smart pricing suggestions
 */
export const serviceSchema = z.object({
  title: z
    .string()
    .min(10, { error: 'Title must be at least 10 characters' })
    .max(200, { error: 'Title is too long' })
    .transform(sanitizeString)
    .refine((title) => {
      // Encourage descriptive titles
      const wordCount = title.split(/\s+/).length;
      return wordCount >= 3;
    }, {
      message: 'Use at least 3 words for a clear, searchable title'
    }),
  
  description: z
    .string()
    .min(50, { error: 'Description must be at least 50 characters' })
    .max(5000, { error: 'Description is too long' })
    .transform(sanitizeString)
    .refine((desc) => {
      // Encourage detailed descriptions
      const wordCount = desc.split(/\s+/).length;
      return wordCount >= 30;
    }, {
      message: 'Add more details (aim for 30+ words) to attract clients'
    }),
  
  category: z
    .string()
    .min(1, { error: 'Category is required' })
    .max(100, { error: 'Category name is too long' }),
  
  subcategory: z
    .string()
    .max(100, { error: 'Subcategory name is too long' })
    .optional(),
  
  base_price: z
    .number()
    .int({ error: 'Price must be a whole number' })
    .min(NAIRA_CONSTRAINTS.MIN_PRICE, { error: `Minimum price is ₦${NAIRA_CONSTRAINTS.MIN_PRICE.toLocaleString()}` })
    .max(NAIRA_CONSTRAINTS.MAX_PRICE, { error: `Maximum price is ₦${NAIRA_CONSTRAINTS.MAX_PRICE.toLocaleString()}` }),
  
  delivery_days: z
    .number()
    .int({ error: 'Delivery days must be a whole number' })
    .min(1, { error: 'Minimum delivery time is 1 day' })
    .max(90, { error: 'Maximum delivery time is 90 days' }),
  
  revisions_included: z
    .number()
    .int({ error: 'Revisions must be a whole number' })
    .min(0, { error: 'Revisions cannot be negative' })
    .max(10, { error: 'Maximum 10 revisions allowed' }),
  
  requirements: z
    .string()
    .max(2000, { error: 'Requirements text is too long' })
    .transform(sanitizeString)
    .optional(),
  
  tags: z
    .array(z.string().max(50))
    .max(10, { error: 'Maximum 10 tags allowed' })
    .refine((tags) => {
      return tags.length >= 3;
    }, {
      message: 'Add at least 3 tags to improve discoverability'
    })
    .optional(),
});

/**
 * Job posting schema with budget validation and smart suggestions
 */
export const jobSchema = z.object({
  title: z
    .string()
    .min(10, { error: 'Title must be at least 10 characters' })
    .max(200, { error: 'Title is too long' })
    .transform(sanitizeString),
  
  description: z
    .string()
    .min(50, { error: 'Description must be at least 50 characters' })
    .max(10000, { error: 'Description is too long' })
    .transform(sanitizeString)
    .refine((desc) => {
      const hasDeliverables = /deliverable|requirement|need|must|should/i.test(desc);
      return hasDeliverables;
    }, {
      message: 'Consider adding clear deliverables and requirements to attract quality proposals'
    }),
  
  category: z
    .string()
    .min(1, { error: 'Category is required' })
    .max(100, { error: 'Category name is too long' }),
  
  budget_type: z.enum(['fixed', 'hourly', 'negotiable'], {
    message: 'Please select a valid budget type',
  }),
  
  budget_min: z
    .number()
    .int({ error: 'Budget must be a whole number' })
    .min(NAIRA_CONSTRAINTS.MIN_PRICE, { error: `Minimum budget is ₦${NAIRA_CONSTRAINTS.MIN_PRICE.toLocaleString()}` })
    .max(NAIRA_CONSTRAINTS.MAX_PRICE, { error: `Maximum budget is ₦${NAIRA_CONSTRAINTS.MAX_PRICE.toLocaleString()}` })
    .optional(),
  
  budget_max: z
    .number()
    .int({ error: 'Budget must be a whole number' })
    .min(NAIRA_CONSTRAINTS.MIN_PRICE, { error: `Minimum budget is ₦${NAIRA_CONSTRAINTS.MIN_PRICE.toLocaleString()}` })
    .max(NAIRA_CONSTRAINTS.MAX_PRICE, { error: `Maximum budget is ₦${NAIRA_CONSTRAINTS.MAX_PRICE.toLocaleString()}` })
    .optional(),
  
  experience_level: z.enum(['beginner', 'intermediate', 'expert', 'any'], {
    message: 'Please select a valid experience level',
  }),
  
  deadline: z
    .string()
    .datetime({ error: 'Invalid deadline format' })
    .optional()
    .refine(
      (date) => {
        if (!date) return true;
        const deadline = new Date(date);
        const now = new Date();
        const daysDiff = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff > 0;
      },
      { message: 'Deadline must be in the future' }
    )
    .refine(
      (date) => {
        if (!date) return true;
        const deadline = new Date(date);
        const now = new Date();
        const daysDiff = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff >= 2;
      },
      { message: 'Consider setting a deadline at least 2 days away to receive quality proposals' }
    ),
  
  skills_required: z
    .array(z.string().max(50))
    .min(1, { error: 'At least one skill is required' })
    .max(15, { error: 'Maximum 15 skills allowed' })
    .optional(),
}).refine(
  (data) => {
    if (data.budget_type !== 'negotiable' && data.budget_min && data.budget_max) {
      return data.budget_max >= data.budget_min;
    }
    return true;
  },
  {
    message: 'Maximum budget must be greater than or equal to minimum budget',
    path: ['budget_max'],
  }
);

// ============================================================================
// PROPOSAL & TRANSACTION SCHEMAS
// ============================================================================

/**
 * Proposal submission schema with quality checks
 */
export const proposalSchema = z.object({
  job_id: z
    .string()
    .uuid({ error: 'Invalid job ID format' }),
  
  cover_letter: z
    .string()
    .min(100, { error: 'Cover letter must be at least 100 characters' })
    .max(3000, { error: 'Cover letter is too long' })
    .transform(sanitizeString)
    .refine((letter) => {
      // Check for personalization
      const hasPersonalization = /\b(your|you|project|specifically)\b/i.test(letter);
      return hasPersonalization;
    }, {
      message: 'Personalize your cover letter by addressing the client\'s specific needs'
    })
    .refine((letter) => {
      // Discourage generic templates
      const genericPhrases = ['dear sir/madam', 'to whom it may concern', 'i am writing to'];
      const hasGeneric = genericPhrases.some(p => letter.toLowerCase().includes(p));
      return !hasGeneric;
    }, {
      message: 'Avoid generic phrases. Write a specific, personalized proposal.'
    }),
  
  proposed_price: z
    .number()
    .int({ error: 'Price must be a whole number' })
    .min(NAIRA_CONSTRAINTS.MIN_PRICE, { error: `Minimum price is ₦${NAIRA_CONSTRAINTS.MIN_PRICE.toLocaleString()}` })
    .max(NAIRA_CONSTRAINTS.MAX_PRICE, { error: `Maximum price is ₦${NAIRA_CONSTRAINTS.MAX_PRICE.toLocaleString()}` }),
  
  delivery_days: z
    .number()
    .int({ error: 'Delivery days must be a whole number' })
    .min(1, { error: 'Minimum delivery time is 1 day' })
    .max(90, { error: 'Maximum delivery time is 90 days' })
    .refine((days) => days >= 3, {
      message: 'Consider offering at least 3 days to ensure quality work'
    }),
  
  portfolio_links: z
    .array(z.string().url({ error: 'Invalid URL format' }))
    .max(5, { error: 'Maximum 5 portfolio links allowed' })
    .refine((links) => links.length >= 1, {
      message: 'Include at least one portfolio link to strengthen your proposal'
    })
    .optional(),
});

/**
 * Withdrawal request schema with Nigerian bank validation and smart checks
 */
export const withdrawalSchema = z.object({
  amount: z
    .number()
    .int({ error: 'Amount must be a whole number' })
    .min(NAIRA_CONSTRAINTS.MIN_WITHDRAWAL, { error: `Minimum withdrawal is ₦${NAIRA_CONSTRAINTS.MIN_WITHDRAWAL.toLocaleString()}` })
    .max(NAIRA_CONSTRAINTS.MAX_PRICE, { error: `Maximum withdrawal is ₦${NAIRA_CONSTRAINTS.MAX_PRICE.toLocaleString()}` }),
  
  bank_name: z
    .string()
    .min(1, { error: 'Bank name is required' })
    .max(100, { error: 'Bank name is too long' })
    .transform(sanitizeString)
    .refine((bank) => {
      // Suggest correct bank names
      const bankLower = bank.toLowerCase();
      return NIGERIAN_BANKS.some(b => bankLower.includes(b.toLowerCase().split(' ')[0]));
    }, {
      message: 'Please select a valid Nigerian bank from the list'
    }),
  
  account_number: z
    .string()
    .refine(validateNigerianAccountNumber, {
      message: 'Account number must be exactly 10 digits',
    }),
  
  account_name: z
    .string()
    .min(1, { error: 'Account name is required' })
    .max(100, { error: 'Account name is too long' })
    .transform(sanitizeString)
    .refine((name) => {
      // Ensure account name looks legitimate
      return name.split(/\s+/).length >= 2;
    }, {
      message: 'Please provide the full account name as shown on your bank account'
    }),
  
  narration: z
    .string()
    .max(200, { error: 'Narration is too long' })
    .transform(sanitizeString)
    .optional(),
});

// ============================================================================
// REVIEW & RATING SCHEMAS
// ============================================================================

/**
 * Review submission schema with quality encouragement
 */
export const reviewSchema = z.object({
  order_id: z
    .string()
    .uuid({ error: 'Invalid order ID format' }),
  
  rating: z
    .number()
    .int({ error: 'Rating must be a whole number' })
    .min(1, { error: 'Minimum rating is 1' })
    .max(5, { error: 'Maximum rating is 5' }),
  
  comment: z
    .string()
    .min(10, { error: 'Review must be at least 10 characters' })
    .max(1000, { error: 'Review is too long' })
    .transform(sanitizeString)
    .refine((comment) => {
      const wordCount = comment.split(/\s+/).length;
      return wordCount >= 5;
    }, {
      message: 'Please write at least 5 words to help others understand your experience'
    })
    .optional(),
  
  would_recommend: z.boolean().optional(),
}).refine((data) => {
  // Low ratings should have comments
  if (data.rating <= 3 && (!data.comment || data.comment.length < 20)) {
    return false;
  }
  return true;
}, {
  message: 'Please provide detailed feedback for ratings below 4 stars',
  path: ['comment']
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type ProposalInput = z.infer<typeof proposalSchema>;
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;