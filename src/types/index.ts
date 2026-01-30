/**
 * Convenience Type Exports
 * 
 * This file re-exports types from the auto-generated database.types.ts
 * with convenient named exports, making them easier to use throughout the app.
 * 
 * Keep the auto-generated database.types.ts as the source of truth,
 * this file just provides developer-friendly aliases.
 */

// Re-export the Database type and helper generics from database.types.ts
import type { Database, Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes } from './database.types';

export type { Database, Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes };

// ============================================================================
// CONVENIENCE NAMED EXPORTS (derived from Database type)
// ============================================================================

// These are auto-generated, derived from Database['public']['Tables']
// They're just easier to use than Database['public']['Tables']['profiles']['Row']

export type Profile = Tables<'profiles'>;
export type Service = Tables<'services'>;
export type ServicePackage = Tables<'service_packages'>;
export type Job = Tables<'jobs'>;
export type Proposal = Tables<'proposals'>;
export type Order = Tables<'orders'>;
export type Transaction = Tables<'transactions'>;
export type Escrow = Tables<'escrow'>;
export type Wallet = Tables<'wallets'>;
export type Withdrawal = Tables<'withdrawals'>;
export type Conversation = Tables<'conversations'>;
export type Message = Tables<'messages'>;
export type Notification = Tables<'notifications'>;
export type Dispute = Tables<'disputes'>;
export type Review = Tables<'reviews'>;
export type VerificationDocument = Tables<'verification_documents'>;
export type Product = Tables<'products'>;
export type ProductOrder = Tables<'product_orders'>;
export type ProductReview = Tables<'product_reviews'>;
export type MarketplaceOrder = Tables<'marketplace_orders'>;
export type MarketplaceReview = Tables<'marketplace_reviews'>;
export type LivenessVerification = Tables<'liveness_verifications'>;
export type TrustScoreEvent = Tables<'trust_score_events'>;
export type UserLocation = Tables<'user_locations'>;
export type SupportTicket = Tables<'support_tickets'>;
export type ArtifactStorage = Tables<'artifact_storage'>;
export type AuditLog = Tables<'audit_logs'>;
export type SecurityLog = Tables<'security_logs'>;
export type UserDevice = Tables<'user_devices'>;
export type WebhookLog = Tables<'webhook_logs'>;
export type CloudinaryUsage = Tables<'cloudinary_usage'>;
export type PlatformRevenue = Tables<'platform_revenue'>;

// ============================================================================
// INSERT TYPES (for creating records)
// ============================================================================

export type ProfileInsert = TablesInsert<'profiles'>;
export type ServiceInsert = TablesInsert<'services'>;
export type ServicePackageInsert = TablesInsert<'service_packages'>;
export type JobInsert = TablesInsert<'jobs'>;
export type ProposalInsert = TablesInsert<'proposals'>;
export type OrderInsert = TablesInsert<'orders'>;
export type TransactionInsert = TablesInsert<'transactions'>;
export type EscrowInsert = TablesInsert<'escrow'>;
export type WalletInsert = TablesInsert<'wallets'>;
export type WithdrawalInsert = TablesInsert<'withdrawals'>;
export type ConversationInsert = TablesInsert<'conversations'>;
export type MessageInsert = TablesInsert<'messages'>;
export type NotificationInsert = TablesInsert<'notifications'>;
export type DisputeInsert = TablesInsert<'disputes'>;
export type ReviewInsert = TablesInsert<'reviews'>;
export type VerificationDocumentInsert = TablesInsert<'verification_documents'>;
export type ProductInsert = TablesInsert<'products'>;
export type ProductOrderInsert = TablesInsert<'product_orders'>;
export type ProductReviewInsert = TablesInsert<'product_reviews'>;
export type MarketplaceOrderInsert = TablesInsert<'marketplace_orders'>;
export type MarketplaceReviewInsert = TablesInsert<'marketplace_reviews'>;
export type LivenessVerificationInsert = TablesInsert<'liveness_verifications'>;
export type TrustScoreEventInsert = TablesInsert<'trust_score_events'>;
export type UserLocationInsert = TablesInsert<'user_locations'>;
export type SupportTicketInsert = TablesInsert<'support_tickets'>;
export type ArtifactStorageInsert = TablesInsert<'artifact_storage'>;
export type AuditLogInsert = TablesInsert<'audit_logs'>;
export type SecurityLogInsert = TablesInsert<'security_logs'>;
export type UserDeviceInsert = TablesInsert<'user_devices'>;
export type WebhookLogInsert = TablesInsert<'webhook_logs'>;
export type CloudinaryUsageInsert = TablesInsert<'cloudinary_usage'>;
export type PlatformRevenueInsert = TablesInsert<'platform_revenue'>;

// ============================================================================
// UPDATE TYPES (for updating records)
// ============================================================================

export type ProfileUpdate = TablesUpdate<'profiles'>;
export type ServiceUpdate = TablesUpdate<'services'>;
export type ServicePackageUpdate = TablesUpdate<'service_packages'>;
export type JobUpdate = TablesUpdate<'jobs'>;
export type ProposalUpdate = TablesUpdate<'proposals'>;
export type OrderUpdate = TablesUpdate<'orders'>;
export type TransactionUpdate = TablesUpdate<'transactions'>;
export type EscrowUpdate = TablesUpdate<'escrow'>;
export type WalletUpdate = TablesUpdate<'wallets'>;
export type WithdrawalUpdate = TablesUpdate<'withdrawals'>;
export type ConversationUpdate = TablesUpdate<'conversations'>;
export type MessageUpdate = TablesUpdate<'messages'>;
export type NotificationUpdate = TablesUpdate<'notifications'>;
export type DisputeUpdate = TablesUpdate<'disputes'>;
export type ReviewUpdate = TablesUpdate<'reviews'>;
export type VerificationDocumentUpdate = TablesUpdate<'verification_documents'>;
export type ProductUpdate = TablesUpdate<'products'>;
export type ProductOrderUpdate = TablesUpdate<'product_orders'>;
export type ProductReviewUpdate = TablesUpdate<'product_reviews'>;
export type MarketplaceOrderUpdate = TablesUpdate<'marketplace_orders'>;
export type MarketplaceReviewUpdate = TablesUpdate<'marketplace_reviews'>;
export type LivenessVerificationUpdate = TablesUpdate<'liveness_verifications'>;
export type TrustScoreEventUpdate = TablesUpdate<'trust_score_events'>;
export type UserLocationUpdate = TablesUpdate<'user_locations'>;
export type SupportTicketUpdate = TablesUpdate<'support_tickets'>;
export type ArtifactStorageUpdate = TablesUpdate<'artifact_storage'>;
export type AuditLogUpdate = TablesUpdate<'audit_logs'>;
export type SecurityLogUpdate = TablesUpdate<'security_logs'>;
export type UserDeviceUpdate = TablesUpdate<'user_devices'>;
export type WebhookLogUpdate = TablesUpdate<'webhook_logs'>;
export type CloudinaryUsageUpdate = TablesUpdate<'cloudinary_usage'>;
export type PlatformRevenueUpdate = TablesUpdate<'platform_revenue'>;

// ============================================================================
// ENUMS & COMPOSITE TYPES (if your database uses them)
// ============================================================================


// You can add specific enum exports here if needed
// export type { SomeEnumName } from './database.types';

// ============================================================================
// CUSTOM FORM & UTILITY TYPES (not in auto-generated database.types)
// ============================================================================

/**
 * FIXED: RegisterFormData now includes all required fields with correct types
 * - full_name is required (not optional)
 * - phone_number, university, location are optional
 * - user_type includes 'both' option
 */
export type RegisterFormData = {
  email: string;
  password: string;
  full_name: string;
  phone_number?: string;
  user_type: 'freelancer' | 'client' | 'both';
  university?: string;
  location?: string;
};

export type LoginFormData = {
  email: string;
  password: string;
};

/**
 * FIXED: PaginatedResponse type now matches the actual API response structure
 * The API returns a nested pagination object, not flat properties
 */
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
};

// ============================================================================
// EXTENDED TYPES (for components that need relations)
// ============================================================================

// Re-export extended types from extended.types.ts
export type { 
  JobWithClient, 
  JobWithFullClient,
  OrderWithRelations,
  OrderWithFullRelations
} from './extended.types';