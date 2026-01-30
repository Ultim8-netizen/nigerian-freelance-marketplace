export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      artifact_storage: {
        Row: {
          created_at: string | null
          id: string
          key: string
          shared: boolean | null
          updated_at: string | null
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          shared?: boolean | null
          updated_at?: string | null
          user_id: string
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          shared?: boolean | null
          updated_at?: string | null
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifact_storage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cloudinary_usage: {
        Row: {
          bandwidth: number
          created_at: string | null
          id: string
          last_checked: string
          storage: number
          transformations: number
          updated_at: string | null
        }
        Insert: {
          bandwidth?: number
          created_at?: string | null
          id?: string
          last_checked?: string
          storage?: number
          transformations?: number
          updated_at?: string | null
        }
        Update: {
          bandwidth?: number
          created_at?: string | null
          id?: string
          last_checked?: string
          storage?: number
          transformations?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          order_id: string | null
          participant_1: string
          participant_2: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          participant_1: string
          participant_2: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          participant_1?: string
          participant_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          against: string
          created_at: string | null
          description: string
          evidence: Json | null
          id: string
          order_id: string | null
          raised_by: string
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          against: string
          created_at?: string | null
          description: string
          evidence?: Json | null
          id?: string
          order_id?: string | null
          raised_by: string
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          against?: string
          created_at?: string | null
          description?: string
          evidence?: Json | null
          id?: string
          order_id?: string | null
          raised_by?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_against_fkey"
            columns: ["against"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          order_id: string | null
          released_at: string | null
          status: string | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          order_id?: string | null
          released_at?: string | null
          status?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          order_id?: string | null
          released_at?: string | null
          status?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attachments: Json | null
          budget_max: number | null
          budget_min: number | null
          budget_type: string
          category: string
          client_id: string
          created_at: string | null
          deadline: string | null
          description: string
          estimated_duration: string | null
          experience_level: string | null
          id: string
          job_location: string | null
          location_required: boolean | null
          proposals_count: number | null
          remote_ok: boolean | null
          required_skills: string[] | null
          status: string | null
          subcategory: string | null
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          attachments?: Json | null
          budget_max?: number | null
          budget_min?: number | null
          budget_type: string
          category: string
          client_id: string
          created_at?: string | null
          deadline?: string | null
          description: string
          estimated_duration?: string | null
          experience_level?: string | null
          id?: string
          job_location?: string | null
          location_required?: boolean | null
          proposals_count?: number | null
          remote_ok?: boolean | null
          required_skills?: string[] | null
          status?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          attachments?: Json | null
          budget_max?: number | null
          budget_min?: number | null
          budget_type?: string
          category?: string
          client_id?: string
          created_at?: string | null
          deadline?: string | null
          description?: string
          estimated_duration?: string | null
          experience_level?: string | null
          id?: string
          job_location?: string | null
          location_required?: boolean | null
          proposals_count?: number | null
          remote_ok?: boolean | null
          required_skills?: string[] | null
          status?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      liveness_verifications: {
        Row: {
          all_challenges_passed: boolean
          challenges: Json
          created_at: string | null
          face_confidence: number | null
          face_detected: boolean
          id: string
          rejection_reason: string | null
          updated_at: string | null
          user_id: string
          verification_status: string | null
          verified_at: string | null
          video_id: string
        }
        Insert: {
          all_challenges_passed: boolean
          challenges: Json
          created_at?: string | null
          face_confidence?: number | null
          face_detected: boolean
          id?: string
          rejection_reason?: string | null
          updated_at?: string | null
          user_id: string
          verification_status?: string | null
          verified_at?: string | null
          video_id: string
        }
        Update: {
          all_challenges_passed?: boolean
          challenges?: Json
          created_at?: string | null
          face_confidence?: number | null
          face_detected?: boolean
          id?: string
          rejection_reason?: string | null
          updated_at?: string | null
          user_id?: string
          verification_status?: string | null
          verified_at?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liveness_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          buyer_id: string
          cancelled_at: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_address: Json
          delivery_fee: number
          id: string
          order_number: string
          paid_at: string | null
          payment_method: string
          product_id: string
          quantity: number
          seller_id: string
          shipped_at: string | null
          status: string
          status_notes: string | null
          subtotal: number
          total_amount: number
          tracking_number: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          cancelled_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_address: Json
          delivery_fee?: number
          id?: string
          order_number: string
          paid_at?: string | null
          payment_method: string
          product_id: string
          quantity: number
          seller_id: string
          shipped_at?: string | null
          status?: string
          status_notes?: string | null
          subtotal: number
          total_amount: number
          tracking_number?: string | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          cancelled_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_address?: Json
          delivery_fee?: number
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_method?: string
          product_id?: string
          quantity?: number
          seller_id?: string
          shipped_at?: string | null
          status?: string
          status_notes?: string | null
          subtotal?: number
          total_amount?: number
          tracking_number?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_reviews: {
        Row: {
          communication: number | null
          created_at: string | null
          delivery_speed: number | null
          id: string
          images: string[] | null
          order_id: string
          product_id: string
          product_quality: number | null
          rating: number
          review_text: string
          reviewer_id: string
          seller_id: string
        }
        Insert: {
          communication?: number | null
          created_at?: string | null
          delivery_speed?: number | null
          id?: string
          images?: string[] | null
          order_id: string
          product_id: string
          product_quality?: number | null
          rating: number
          review_text: string
          reviewer_id: string
          seller_id: string
        }
        Update: {
          communication?: number | null
          created_at?: string | null
          delivery_speed?: number | null
          id?: string
          images?: string[] | null
          order_id?: string
          product_id?: string
          product_quality?: number | null
          rating?: number
          review_text?: string
          reviewer_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          conversation_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message_text: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          client_id: string
          client_rating: number | null
          client_review: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_date: string
          delivery_files: Json | null
          delivery_note: string | null
          description: string
          freelancer_earnings: number
          freelancer_id: string
          freelancer_rating: number | null
          freelancer_review: string | null
          id: string
          job_id: string | null
          max_revisions: number | null
          order_number: string
          platform_fee: number
          proposal_id: string | null
          revision_count: number | null
          service_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          client_id: string
          client_rating?: number | null
          client_review?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_date: string
          delivery_files?: Json | null
          delivery_note?: string | null
          description: string
          freelancer_earnings: number
          freelancer_id: string
          freelancer_rating?: number | null
          freelancer_review?: string | null
          id?: string
          job_id?: string | null
          max_revisions?: number | null
          order_number: string
          platform_fee: number
          proposal_id?: string | null
          revision_count?: number | null
          service_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          client_rating?: number | null
          client_review?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_date?: string
          delivery_files?: Json | null
          delivery_note?: string | null
          description?: string
          freelancer_earnings?: number
          freelancer_id?: string
          freelancer_rating?: number | null
          freelancer_review?: string | null
          id?: string
          job_id?: string | null
          max_revisions?: number | null
          order_number?: string
          platform_fee?: number
          proposal_id?: string | null
          revision_count?: number | null
          service_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_revenue: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          metadata: Json | null
          revenue_type: string
          source_user_id: string | null
          transaction_ref: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          revenue_type: string
          source_user_id?: string | null
          transaction_ref?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          revenue_type?: string
          source_user_id?: string | null
          transaction_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_revenue_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_orders: {
        Row: {
          buyer_id: string | null
          buyer_notes: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_method: string | null
          id: string
          order_number: string
          product_id: string | null
          quantity: number | null
          seller_id: string | null
          status: string | null
          total_amount: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          buyer_id?: string | null
          buyer_notes?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_method?: string | null
          id?: string
          order_number: string
          product_id?: string | null
          quantity?: number | null
          seller_id?: string | null
          status?: string | null
          total_amount: number
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string | null
          buyer_notes?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_method?: string | null
          id?: string
          order_number?: string
          product_id?: string | null
          quantity?: number | null
          seller_id?: string | null
          status?: string | null
          total_amount?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          buyer_id: string | null
          created_at: string | null
          id: string
          images: string[] | null
          is_verified_purchase: boolean | null
          order_id: string | null
          product_id: string | null
          product_rating: number | null
          review_text: string | null
          seller_rating: number | null
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          images?: string[] | null
          is_verified_purchase?: boolean | null
          order_id?: string | null
          product_id?: string | null
          product_rating?: number | null
          review_text?: string | null
          seller_rating?: number | null
        }
        Update: {
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          images?: string[] | null
          is_verified_purchase?: boolean | null
          order_id?: string | null
          product_id?: string | null
          product_rating?: number | null
          review_text?: string | null
          seller_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "product_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          condition: string | null
          created_at: string | null
          delivery_options: string[] | null
          description: string
          id: string
          images: string[] | null
          is_active: boolean | null
          location: string | null
          price: number
          sales_count: number | null
          seller_id: string | null
          stock_status: string | null
          subcategory: string | null
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          category: string
          condition?: string | null
          created_at?: string | null
          delivery_options?: string[] | null
          description: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          location?: string | null
          price: number
          sales_count?: number | null
          seller_id?: string | null
          stock_status?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          category?: string
          condition?: string | null
          created_at?: string | null
          delivery_options?: string[] | null
          description?: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          location?: string | null
          price?: number
          sales_count?: number | null
          seller_id?: string | null
          stock_status?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string | null
          bio: string | null
          client_rating: number | null
          created_at: string | null
          email: string
          email_verified: boolean | null
          freelancer_rating: number | null
          full_name: string
          id: string
          identity_verified: boolean | null
          liveness_verified: boolean | null
          liveness_verified_at: string | null
          location: string | null
          notification_settings: Json | null
          onboarding_completed: boolean | null
          phone_number: string | null
          phone_verified: boolean | null
          profile_image_url: string | null
          student_verified: boolean | null
          suspension_reason: string | null
          theme_preference: string | null
          total_jobs_completed: number | null
          total_jobs_posted: number | null
          trust_level: string | null
          trust_score: number | null
          university: string | null
          updated_at: string | null
          user_type: string | null
        }
        Insert: {
          account_status?: string | null
          bio?: string | null
          client_rating?: number | null
          created_at?: string | null
          email: string
          email_verified?: boolean | null
          freelancer_rating?: number | null
          full_name: string
          id: string
          identity_verified?: boolean | null
          liveness_verified?: boolean | null
          liveness_verified_at?: string | null
          location?: string | null
          notification_settings?: Json | null
          onboarding_completed?: boolean | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_image_url?: string | null
          student_verified?: boolean | null
          suspension_reason?: string | null
          theme_preference?: string | null
          total_jobs_completed?: number | null
          total_jobs_posted?: number | null
          trust_level?: string | null
          trust_score?: number | null
          university?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Update: {
          account_status?: string | null
          bio?: string | null
          client_rating?: number | null
          created_at?: string | null
          email?: string
          email_verified?: boolean | null
          freelancer_rating?: number | null
          full_name?: string
          id?: string
          identity_verified?: boolean | null
          liveness_verified?: boolean | null
          liveness_verified_at?: string | null
          location?: string | null
          notification_settings?: Json | null
          onboarding_completed?: boolean | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_image_url?: string | null
          student_verified?: boolean | null
          suspension_reason?: string | null
          theme_preference?: string | null
          total_jobs_completed?: number | null
          total_jobs_posted?: number | null
          trust_level?: string | null
          trust_score?: number | null
          university?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          cover_letter: string
          created_at: string | null
          delivery_days: number
          freelancer_id: string
          id: string
          job_id: string
          portfolio_items: Json | null
          proposed_price: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          cover_letter: string
          created_at?: string | null
          delivery_days: number
          freelancer_id: string
          id?: string
          job_id: string
          portfolio_items?: Json | null
          proposed_price: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          cover_letter?: string
          created_at?: string | null
          delivery_days?: number
          freelancer_id?: string
          id?: string
          job_id?: string
          portfolio_items?: Json | null
          proposed_price?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          communication_rating: number | null
          created_at: string | null
          id: string
          is_public: boolean | null
          order_id: string | null
          professionalism_rating: number | null
          quality_rating: number | null
          rating: number
          review_text: string | null
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          order_id?: string | null
          professionalism_rating?: number | null
          quality_rating?: number | null
          rating: number
          review_text?: string | null
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          order_id?: string | null
          professionalism_rating?: number | null
          quality_rating?: number | null
          rating?: number
          review_text?: string | null
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_logs: {
        Row: {
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          delivery_days: number
          description: string | null
          features: Json | null
          id: string
          name: string
          package_type: string
          price: number
          revisions: number | null
          service_id: string | null
        }
        Insert: {
          delivery_days: number
          description?: string | null
          features?: Json | null
          id?: string
          name: string
          package_type: string
          price: number
          revisions?: number | null
          service_id?: string | null
        }
        Update: {
          delivery_days?: number
          description?: string | null
          features?: Json | null
          id?: string
          name?: string
          package_type?: string
          price?: number
          revisions?: number | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number
          category: string
          created_at: string | null
          currency: string | null
          delivery_days: number
          description: string
          freelancer_id: string
          id: string
          images: Json | null
          is_active: boolean | null
          location_required: boolean | null
          orders_count: number | null
          portfolio_links: string[] | null
          remote_ok: boolean | null
          requirements: string | null
          revisions_included: number | null
          service_location: string | null
          subcategory: string | null
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          base_price: number
          category: string
          created_at?: string | null
          currency?: string | null
          delivery_days: number
          description: string
          freelancer_id: string
          id?: string
          images?: Json | null
          is_active?: boolean | null
          location_required?: boolean | null
          orders_count?: number | null
          portfolio_links?: string[] | null
          remote_ok?: boolean | null
          requirements?: string | null
          revisions_included?: number | null
          service_location?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          base_price?: number
          category?: string
          created_at?: string | null
          currency?: string | null
          delivery_days?: number
          description?: string
          freelancer_id?: string
          id?: string
          images?: Json | null
          is_active?: boolean | null
          location_required?: boolean | null
          orders_count?: number | null
          portfolio_links?: string[] | null
          remote_ok?: boolean | null
          requirements?: string | null
          revisions_included?: number | null
          service_location?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string | null
          description: string
          id: string
          priority: string | null
          resolved_at: string | null
          status: string | null
          subject: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          flutterwave_response: Json | null
          flutterwave_tx_ref: string | null
          id: string
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          status: string | null
          transaction_ref: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          flutterwave_response?: Json | null
          flutterwave_tx_ref?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          transaction_ref: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          flutterwave_response?: Json | null
          flutterwave_tx_ref?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          transaction_ref?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_score_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          new_score: number
          notes: string | null
          previous_score: number
          related_entity_id: string | null
          related_entity_type: string | null
          score_change: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          new_score: number
          notes?: string | null
          previous_score: number
          related_entity_id?: string | null
          related_entity_type?: string | null
          score_change: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          new_score?: number
          notes?: string | null
          previous_score?: number
          related_entity_id?: string | null
          related_entity_type?: string | null
          score_change?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_score_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          device_fingerprint: string
          device_info: Json | null
          first_seen_at: string | null
          id: string
          ip_address: unknown
          last_seen_at: string | null
          user_id: string | null
        }
        Insert: {
          device_fingerprint: string
          device_info?: Json | null
          first_seen_at?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string | null
          user_id?: string | null
        }
        Update: {
          device_fingerprint?: string
          device_info?: Json | null
          first_seen_at?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          area: string | null
          city: string | null
          coordinates: Json | null
          detection_method: string | null
          id: string
          last_updated: string | null
          state: string
          university: string | null
          user_id: string
        }
        Insert: {
          area?: string | null
          city?: string | null
          coordinates?: Json | null
          detection_method?: string | null
          id?: string
          last_updated?: string | null
          state: string
          university?: string | null
          user_id: string
        }
        Update: {
          area?: string | null
          city?: string | null
          coordinates?: Json | null
          detection_method?: string | null
          id?: string
          last_updated?: string | null
          state?: string
          university?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_documents: {
        Row: {
          created_at: string | null
          document_type: string
          document_url: string
          id: string
          rejection_reason: string | null
          user_id: string | null
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          document_url: string
          id?: string
          rejection_reason?: string | null
          user_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          document_url?: string
          id?: string
          rejection_reason?: string | null
          user_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          account_name: string | null
          account_number: string | null
          balance: number | null
          bank_name: string | null
          created_at: string | null
          id: string
          pending_clearance: number | null
          total_earned: number | null
          total_withdrawn: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          balance?: number | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          pending_clearance?: number | null
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          balance?: number | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          pending_clearance?: number | null
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          error: string | null
          event: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          verified: boolean
        }
        Insert: {
          error?: string | null
          event: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          received_at: string
          verified: boolean
        }
        Update: {
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          account_name: string
          account_number: string
          amount: number
          bank_name: string
          created_at: string | null
          failure_reason: string | null
          flutterwave_transfer_id: string | null
          id: string
          processed_at: string | null
          status: string | null
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          amount: number
          bank_name: string
          created_at?: string | null
          failure_reason?: string | null
          flutterwave_transfer_id?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          amount?: number
          bank_name?: string
          created_at?: string | null
          failure_reason?: string | null
          flutterwave_transfer_id?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_trust_score_event: {
        Args: {
          p_event_type: string
          p_notes?: string
          p_related_entity_id?: string
          p_related_entity_type?: string
          p_score_change: number
          p_user_id: string
        }
        Returns: undefined
      }
      calculate_trust_score: { Args: { p_user_id: string }; Returns: number }
      complete_order_with_payment: {
        Args: {
          p_client_rating: number
          p_client_review?: string
          p_communication_rating?: number
          p_order_id: string
          p_professionalism_rating?: number
          p_quality_rating?: number
        }
        Returns: Json
      }
      get_cloudinary_usage_stats: {
        Args: never
        Returns: {
          current_value: string
          limit_value: string
          metric: string
          percentage: number
          status: string
        }[]
      }
      get_escrow_total: { Args: never; Returns: number }
      get_trust_level_requirements: {
        Args: { p_trust_level: string }
        Returns: {
          features: string[]
          min_score: number
          required_jobs: number
          required_rating: number
        }[]
      }
      get_user_stats: {
        Args: { p_user_id: string }
        Returns: {
          active_orders: number
          avg_rating: number
          completed_orders: number
          total_earned: number
          total_orders: number
          total_spent: number
        }[]
      }
      increment_job_views: { Args: { p_job_id: string }; Returns: undefined }
      increment_jobs_completed: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      increment_proposals_count: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      increment_service_orders: {
        Args: { p_service_id: string }
        Returns: undefined
      }
      increment_service_views: {
        Args: { p_service_id: string }
        Returns: undefined
      }
      process_pending_clearances: {
        Args: never
        Returns: {
          processed_count: number
        }[]
      }
      process_successful_payment: {
        Args: {
          p_amount: number
          p_flw_tx_id: string
          p_order_id: string
          p_transaction_id: string
        }
        Returns: Json
      }
      release_escrow_to_wallet: {
        Args: { p_amount: number; p_freelancer_id: string }
        Returns: undefined
      }
      update_freelancer_rating: {
        Args: { p_freelancer_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
