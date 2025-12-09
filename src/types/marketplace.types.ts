export interface Product {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  condition: 'new' | 'like_new' | 'used';
  images: string[];
  delivery_options: string[];
  is_active: boolean;
  rating: number;
  reviews_count: number;
  views_count: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
  seller?: {
    id: string;
    full_name: string;
    profile_image_url?: string;
    freelancer_rating: number;
    total_jobs_completed: number;
    identity_verified: boolean;
    location?: string;
    created_at: string;
  };
}

export interface MarketplaceOrder {
  id: string;
  order_number: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  delivery_address: {
    full_name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    landmark?: string;
  };
  tracking_number?: string;
  status: 'pending_payment' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  payment_method: 'card' | 'bank_transfer' | 'wallet';
  status_notes?: string;
  created_at: string;
  updated_at: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
}

export interface MarketplaceReview {
  id: string;
  reviewer_id: string;
  seller_id: string;
  product_id: string;
  order_id: string;
  rating: number;
  review_text: string;
  product_quality?: number;
  delivery_speed?: number;
  communication?: number;
  images?: string[];
  created_at: string;
  reviewer?: {
    full_name: string;
    profile_image_url?: string;
  };
}