// src/types/database.types.ts
// Core type definitions for the entire application

export type UserType = 'freelancer' | 'client' | 'both';
export type AccountStatus = 'active' | 'suspended' | 'banned';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type DocumentType = 'nin' | 'student_id' | 'utility_bill';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  phone_verified: boolean;
  user_type: UserType;
  bio: string | null;
  profile_image_url: string | null;
  location: string | null;
  university: string | null;
  email_verified: boolean;
  identity_verified: boolean;
  liveness_verified: boolean;
  student_verified: boolean;
  freelancer_rating: number;
  client_rating: number;
  total_jobs_completed: number;
  total_jobs_posted: number;
  account_status: AccountStatus;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  freelancer_id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  base_price: number;
  currency: string;
  delivery_days: number;
  revisions_included: number;
  images: string[] | null;
  portfolio_links: string[] | null;
  requirements: string | null;
  is_active: boolean;
  views_count: number;
  orders_count: number;
  created_at: string;
  updated_at: string;
  freelancer?: Profile;
  packages?: ServicePackage[];
}

export interface ServicePackage {
  id: string;
  service_id: string;
  package_type: 'basic' | 'standard' | 'premium';
  name: string;
  description: string | null;
  price: number;
  delivery_days: number;
  features: string[] | null;
  revisions: number;
}

export type BudgetType = 'fixed' | 'hourly' | 'negotiable';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'expert' | 'any';
export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';

export interface Job {
  id: string;
  client_id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_type: BudgetType;
  required_skills: string[] | null;
  experience_level: ExperienceLevel;
  deadline: string | null;
  estimated_duration: string | null;
  attachments: string[] | null;
  status: JobStatus;
  views_count: number;
  proposals_count: number;
  created_at: string;
  updated_at: string;
  client?: Profile;
  proposals?: Proposal[];
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Proposal {
  id: string;
  job_id: string;
  freelancer_id: string;
  cover_letter: string;
  proposed_price: number;
  delivery_days: number;
  portfolio_items: object[] | null;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
  freelancer?: Profile;
  job?: Job;
}

export type OrderStatus = 
  | 'pending_payment'
  | 'awaiting_delivery'
  | 'delivered'
  | 'revision_requested'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

export interface Order {
  id: string;
  order_number: string;
  client_id: string;
  freelancer_id: string;
  job_id: string | null;
  service_id: string | null;
  proposal_id: string | null;
  title: string;
  description: string;
  amount: number;
  platform_fee: number;
  freelancer_earnings: number;
  delivery_date: string;
  delivered_at: string | null;
  status: OrderStatus;
  delivery_files: string[] | null;
  delivery_note: string | null;
  revision_count: number;
  max_revisions: number;
  client_rating: number | null;
  freelancer_rating: number | null;
  client_review: string | null;
  freelancer_review: string | null;
  created_at: string;
  updated_at: string;
  client?: Profile;
  freelancer?: Profile;
  service?: Service;
  job?: Job;
}

export type TransactionType = 'payment' | 'refund' | 'withdrawal' | 'platform_fee';
export type TransactionStatus = 'pending' | 'successful' | 'failed' | 'cancelled';

export interface Transaction {
  id: string;
  order_id: string;
  transaction_ref: string;
  flutterwave_tx_ref: string | null;
  amount: number;
  currency: string;
  transaction_type: TransactionType;
  payment_method: string | null;
  status: TransactionStatus;
  flutterwave_response: unknown;
  paid_at: string | null;
  created_at: string;
}

export type EscrowStatus = 'held' | 'released_to_freelancer' | 'refunded_to_client' | 'disputed';

export interface Escrow {
  id: string;
  order_id: string;
  transaction_id: string;
  amount: number;
  status: EscrowStatus;
  released_at: string | null;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  pending_clearance: number;
  total_earned: number;
  total_withdrawn: number;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  created_at: string;
  updated_at: string;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Withdrawal {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: WithdrawalStatus;
  flutterwave_transfer_id: string | null;
  failure_reason: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  order_id: string | null;
  participant_1: string;
  participant_2: string;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string | null;
  attachments: object[] | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender?: Profile;
}

export type DisputeStatus = 
  | 'open'
  | 'under_review'
  | 'resolved_client'
  | 'resolved_freelancer'
  | 'resolved_split'
  | 'closed';

export interface Dispute {
  id: string;
  order_id: string;
  raised_by: string;
  against: string;
  reason: string;
  description: string;
  evidence: object[] | null;
  status: DisputeStatus;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  order?: Order;
}

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  review_text: string | null;
  communication_rating: number | null;
  quality_rating: number | null;
  professionalism_rating: number | null;
  is_public: boolean;
  created_at: string;
  reviewer?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateServiceRequest {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  base_price: number;
  delivery_days: number;
  revisions_included: number;
  images?: string[];
  portfolio_links?: string[];
  requirements?: string;
  packages?: Omit<ServicePackage, 'id' | 'service_id'>[];
}

export interface CreateJobRequest {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  budget_min?: number;
  budget_max?: number;
  budget_type: BudgetType;
  required_skills?: string[];
  experience_level: ExperienceLevel;
  deadline?: string;
  estimated_duration?: string;
  attachments?: string[];
}

export interface CreateProposalRequest {
  job_id: string;
  cover_letter: string;
  proposed_price: number;
  delivery_days: number;
  portfolio_items?: object[];
}

export interface CreateOrderRequest {
  freelancer_id: string;
  service_id?: string;
  job_id?: string;
  proposal_id?: string;
  title: string;
  description: string;
  amount: number;
  delivery_days: number;
}

export interface PaymentInitiateRequest {
  order_id: string;
  amount: number;
  email: string;
  phone_number: string;
  full_name: string;
}

export interface WithdrawalRequest {
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SearchFilters {
  category?: string;
  min_price?: number;
  max_price?: number;
  delivery_days?: number;
  rating_min?: number;
  verified_only?: boolean;
  sort_by?: 'price' | 'rating' | 'recent' | 'popular';
  page?: number;
  per_page?: number;
}

// ============================================================================
// FORM VALIDATION SCHEMAS (for Zod)
// ============================================================================

export interface RegisterFormData {
  email: string;
  password: string;
  full_name: string;
  phone_number: string;
  user_type: UserType;
  university?: string;
  location?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface ProfileUpdateFormData {
  full_name?: string;
  bio?: string;
  location?: string;
  university?: string;
  phone_number?: string;
}

// ============================================================================
// CATEGORY & BANK CONSTANTS
// ============================================================================

export const CATEGORIES = [
  'Graphics & Design',
  'Digital Marketing',
  'Writing & Translation',
  'Video & Animation',
  'Music & Audio',
  'Programming & Tech',
  'Data',
  'Business',
  'Lifestyle',
  'Photography',
  'Academic',
  'Local Services',
  'Other'
] as const;

export type Category = typeof CATEGORIES[number];

export const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Access Bank (Diamond)' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank For Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' }
] as const;

// ============================================================================
// SUPABASE TYPE MAPPING
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface WebhookLog {
  id: number;
  provider: string;
  event: string;
  verified: boolean;
  payload: Json;
  notes: string | null;
  received_at: string;
  ip_address: string | null;
}

// This is the interface Supabase expects
export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: Transaction;
        Insert: Partial<Transaction>;
        Update: Partial<Transaction>;
      };
      webhook_logs: {
        Row: WebhookLog;
        Insert: Omit<WebhookLog, 'id'>;
        Update: Partial<WebhookLog>;
      };
      // Map other tables here as you need them in the future
    };
    Functions: {
      process_successful_payment: {
        Args: {
          p_transaction_id: string;
          p_order_id: string;
          p_flw_tx_id: number;
          p_amount: number;
        };
        Returns: void;
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
  };
}