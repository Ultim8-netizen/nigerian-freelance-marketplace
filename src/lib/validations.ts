// src/lib/validations.ts
// Zod validation schemas

import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone_number: z.string().regex(/^(\+234|0)[789]\d{9}$/, 'Invalid Nigerian phone number'),
  user_type: z.enum(['freelancer', 'client', 'both']),
  university: z.string().optional(),
  location: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const serviceSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters'),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  base_price: z.number().min(1000, 'Minimum price is ₦1,000'),
  delivery_days: z.number().min(1).max(90),
  revisions_included: z.number().min(0).max(10),
  requirements: z.string().optional(),
});

export const jobSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters'),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  category: z.string().min(1, 'Category is required'),
  budget_type: z.enum(['fixed', 'hourly', 'negotiable']),
  budget_min: z.number().optional(),
  budget_max: z.number().optional(),
  experience_level: z.enum(['beginner', 'intermediate', 'expert', 'any']),
  deadline: z.string().optional(),
});

export const proposalSchema = z.object({
  job_id: z.string().uuid(),
  cover_letter: z.string().min(100, 'Cover letter must be at least 100 characters'),
  proposed_price: z.number().min(1000, 'Minimum price is ₦1,000'),
  delivery_days: z.number().min(1).max(90),
});

export const withdrawalSchema = z.object({
  amount: z.number().min(5000, 'Minimum withdrawal is ₦5,000'),
  bank_name: z.string().min(1, 'Bank name is required'),
  account_number: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
  account_name: z.string().min(1, 'Account name is required'),
});