-- all these have been run already on supabase. they ran succcesfully. the reason they are being kept here is for version control and tracking changes to the database schema over time. 

-- User profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT UNIQUE,
    phone_verified BOOLEAN DEFAULT FALSE,
    
    -- User type
    user_type TEXT CHECK (user_type IN ('freelancer', 'client', 'both')) DEFAULT 'both',
    
    -- Profile information
    bio TEXT,
    profile_image_url TEXT,
    location TEXT,
    university TEXT, -- For student verification
    
    -- Verification levels
    email_verified BOOLEAN DEFAULT FALSE,
    identity_verified BOOLEAN DEFAULT FALSE,
    nin_verified BOOLEAN DEFAULT FALSE,
    student_verified BOOLEAN DEFAULT FALSE,
    
    -- Reputation
    freelancer_rating DECIMAL(3,2) DEFAULT 0,
    client_rating DECIMAL(3,2) DEFAULT 0,
    total_jobs_completed INTEGER DEFAULT 0,
    total_jobs_posted INTEGER DEFAULT 0,
    
    -- Account status
    account_status TEXT CHECK (account_status IN ('active', 'suspended', 'banned')) DEFAULT 'active',
    suspension_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verification documents table
CREATE TABLE verification_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    document_type TEXT CHECK (document_type IN ('nin', 'student_id', 'utility_bill')) NOT NULL,
    document_url TEXT NOT NULL,
    verification_status TEXT CHECK (verification_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    rejection_reason TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FREELANCER SERVICES
-- ============================================================================

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    freelancer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Service details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'NGN',
    
    -- Delivery
    delivery_days INTEGER NOT NULL,
    revisions_included INTEGER DEFAULT 1,
    
    -- Portfolio
    images JSONB, -- Array of image URLs
    portfolio_links TEXT[],
    
    -- Requirements
    requirements TEXT, -- What client needs to provide
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Stats
    views_count INTEGER DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service packages (basic, standard, premium)
CREATE TABLE service_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    package_type TEXT CHECK (package_type IN ('basic', 'standard', 'premium')) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    delivery_days INTEGER NOT NULL,
    features JSONB, -- Array of features
    revisions INTEGER DEFAULT 1,
    UNIQUE(service_id, package_type)
);

-- JOB POSTINGS
-- ============================================================================

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Job details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    
    -- Budget
    budget_min DECIMAL(10,2),
    budget_max DECIMAL(10,2),
    budget_type TEXT CHECK (budget_type IN ('fixed', 'hourly', 'negotiable')) NOT NULL,
    
    -- Requirements
    required_skills TEXT[],
    experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'expert', 'any')),
    
    -- Timeline
    deadline TIMESTAMP WITH TIME ZONE,
    estimated_duration TEXT, -- "1-2 weeks", "1 month", etc.
    
    -- Attachments
    attachments JSONB, -- Array of file URLs
    
    -- Status
    status TEXT CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled', 'disputed')) DEFAULT 'open',
    
    -- Stats
    views_count INTEGER DEFAULT 0,
    proposals_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job proposals/bids
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    freelancer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Proposal details
    cover_letter TEXT NOT NULL,
    proposed_price DECIMAL(10,2) NOT NULL,
    delivery_days INTEGER NOT NULL,
    
    -- Portfolio
    portfolio_items JSONB,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')) DEFAULT 'pending',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(job_id, freelancer_id)
);

-- ORDERS AND TRANSACTIONS
-- ============================================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL,
    
    -- Parties
    client_id UUID REFERENCES profiles(id) NOT NULL,
    freelancer_id UUID REFERENCES profiles(id) NOT NULL,
    
    -- Source (either from job or direct service purchase)
    job_id UUID REFERENCES jobs(id),
    service_id UUID REFERENCES services(id),
    proposal_id UUID REFERENCES proposals(id),
    
    -- Order details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Pricing
    amount DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    freelancer_earnings DECIMAL(10,2) NOT NULL,
    
    -- Timeline
    delivery_date TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status TEXT CHECK (status IN (
        'pending_payment',
        'awaiting_delivery',
        'delivered',
        'revision_requested',
        'completed',
        'cancelled',
        'disputed',
        'refunded'
    )) DEFAULT 'pending_payment',
    
    -- Delivery
    delivery_files JSONB,
    delivery_note TEXT,
    revision_count INTEGER DEFAULT 0,
    max_revisions INTEGER DEFAULT 1,
    
    -- Ratings
    client_rating INTEGER CHECK (client_rating >= 1 AND client_rating <= 5),
    freelancer_rating INTEGER CHECK (freelancer_rating >= 1 AND freelancer_rating <= 5),
    client_review TEXT,
    freelancer_review TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_ref TEXT UNIQUE NOT NULL,
    flutterwave_tx_ref TEXT,
    
    -- Amounts
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'NGN',
    
    -- Type
    transaction_type TEXT CHECK (transaction_type IN (
        'payment',
        'refund',
        'withdrawal',
        'platform_fee'
    )) NOT NULL,
    
    -- Payment method
    payment_method TEXT,
    
    -- Status
    status TEXT CHECK (status IN (
        'pending',
        'successful',
        'failed',
        'cancelled'
    )) DEFAULT 'pending',
    
    -- Flutterwave response
    flutterwave_response JSONB,
    
    -- Timestamps
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escrow system
CREATE TABLE escrow (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
    transaction_id UUID REFERENCES transactions(id),
    
    amount DECIMAL(10,2) NOT NULL,
    status TEXT CHECK (status IN (
        'held',
        'released_to_freelancer',
        'refunded_to_client',
        'disputed'
    )) DEFAULT 'held',
    
    released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Freelancer wallet
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    
    balance DECIMAL(10,2) DEFAULT 0 CHECK (balance >= 0),
    pending_clearance DECIMAL(10,2) DEFAULT 0,
    total_earned DECIMAL(10,2) DEFAULT 0,
    total_withdrawn DECIMAL(10,2) DEFAULT 0,
    
    -- Bank details for withdrawal
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Withdrawal requests
CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    
    amount DECIMAL(10,2) NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    
    status TEXT CHECK (status IN (
        'pending',
        'processing',
        'completed',
        'failed',
        'cancelled'
    )) DEFAULT 'pending',
    
    flutterwave_transfer_id TEXT,
    failure_reason TEXT,
    
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MESSAGING SYSTEM
-- ============================================================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    
    participant_1 UUID REFERENCES profiles(id) NOT NULL,
    participant_2 UUID REFERENCES profiles(id) NOT NULL,
    
    last_message_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(participant_1, participant_2, order_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) NOT NULL,
    
    message_text TEXT,
    attachments JSONB,
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISPUTES AND SUPPORT
-- ============================================================================

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    raised_by UUID REFERENCES profiles(id) NOT NULL,
    against UUID REFERENCES profiles(id) NOT NULL,
    
    reason TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence JSONB, -- Screenshots, files, etc.
    
    status TEXT CHECK (status IN (
        'open',
        'under_review',
        'resolved_client',
        'resolved_freelancer',
        'resolved_split',
        'closed'
    )) DEFAULT 'open',
    
    resolution_notes TEXT,
    resolved_by UUID REFERENCES profiles(id), -- Admin user
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Support tickets
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    
    status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    
    assigned_to UUID REFERENCES profiles(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- REVIEWS AND RATINGS
-- ============================================================================

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    reviewer_id UUID REFERENCES profiles(id) NOT NULL,
    reviewee_id UUID REFERENCES profiles(id) NOT NULL,
    
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    review_text TEXT,
    
    -- Review categories
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
    
    is_public BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(order_id, reviewer_id)
);

-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL, -- 'order_update', 'new_message', 'payment_received', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    link TEXT, -- Where to navigate when clicked
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SECURITY AND FRAUD PREVENTION
-- ============================================================================

-- Device tracking
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    device_fingerprint TEXT NOT NULL,
    device_info JSONB,
    ip_address INET,
    
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suspicious activity log
CREATE TABLE security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    
    event_type TEXT NOT NULL,
    description TEXT,
    ip_address INET,
    metadata JSONB,
    
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_services_freelancer ON services(freelancer_id);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_active ON services(is_active);

CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_category ON jobs(category);

CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_freelancer ON orders(freelancer_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_proposals_job ON proposals(job_id);
CREATE INDEX idx_proposals_freelancer ON proposals(freelancer_id);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);

-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all, update only their own
CREATE POLICY "Public profiles viewable by all" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Services: Public read, owners can CUD
CREATE POLICY "Services viewable by all" ON services
    FOR SELECT USING (is_active = true OR freelancer_id = auth.uid());

CREATE POLICY "Freelancers can manage own services" ON services
    FOR ALL USING (freelancer_id = auth.uid());

-- Jobs: Public read, owners can manage
CREATE POLICY "Jobs viewable by all" ON jobs
    FOR SELECT USING (status = 'open' OR client_id = auth.uid());

CREATE POLICY "Clients can manage own jobs" ON jobs
    FOR ALL USING (client_id = auth.uid());

-- Orders: Participants only
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (client_id = auth.uid() OR freelancer_id = auth.uid());

-- Messages: Conversation participants only
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND (conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid())
        )
    );

-- Notifications: User's own only
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

    -- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE order_number_seq;

CREATE TRIGGER set_order_number BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();

    -- ============================================
-- LOCATION SUPPORT MIGRATION
-- ============================================

-- Ensure UUID extension (usually enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. Add simple location field to profiles
-- ============================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS location TEXT;

-- ============================================
-- 2. Create user_locations table
-- Stores detailed location breakdown per user
-- ============================================
CREATE TABLE IF NOT EXISTS user_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    state TEXT NOT NULL,
    city TEXT,
    area TEXT,
    coordinates JSONB,  -- e.g. { "lat": 6.5244, "lng": 3.3792 }
    detection_method TEXT CHECK (detection_method IN ('manual', 'browser', 'ip')),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Add location fields to services
-- ============================================
ALTER TABLE services
ADD COLUMN IF NOT EXISTS location_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS service_location TEXT,
ADD COLUMN IF NOT EXISTS remote_ok BOOLEAN DEFAULT TRUE;

-- ============================================
-- 4. Add location fields to jobs
-- ============================================
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS location_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS job_location TEXT,
ADD COLUMN IF NOT EXISTS remote_ok BOOLEAN DEFAULT TRUE;

-- ============================================
-- 5. Indexes for faster search & filtering
-- ============================================
CREATE INDEX IF NOT EXISTS idx_services_location 
    ON services(service_location);

CREATE INDEX IF NOT EXISTS idx_jobs_location 
    ON jobs(job_location);

CREATE INDEX IF NOT EXISTS idx_user_locations_state 
    ON user_locations(state);


-- ============================================================================
-- Add University Support to Location System
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Add university column to user_locations
ALTER TABLE user_locations 
ADD COLUMN IF NOT EXISTS university TEXT;

-- Step 2: Create index for university searches
CREATE INDEX IF NOT EXISTS idx_user_locations_university 
ON user_locations(university);

-- Step 3: Create function to sync profile.location from user_locations
CREATE OR REPLACE FUNCTION sync_profile_location() 
RETURNS TRIGGER AS $$
BEGIN
    -- Update profiles.location with formatted location string
    -- Format: "City, State" or just "State" if no city
    UPDATE profiles
    SET location = CASE 
        WHEN NEW.city IS NOT NULL AND NEW.city != '' 
            THEN CONCAT_WS(', ', NEW.city, NEW.state)
        ELSE NEW.state
    END,
    updated_at = NOW()
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to auto-sync location
DROP TRIGGER IF EXISTS sync_location_trigger ON user_locations;
CREATE TRIGGER sync_location_trigger
    AFTER INSERT OR UPDATE ON user_locations
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_location();

-- Step 5: Enable RLS on user_locations (if not already enabled)
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for user_locations
DROP POLICY IF EXISTS "Users can view own location" ON user_locations;
CREATE POLICY "Users can view own location" 
ON user_locations FOR SELECT 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own location" ON user_locations;
CREATE POLICY "Users can manage own location" 
ON user_locations FOR ALL 
USING (user_id = auth.uid());

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Check that the university column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_locations' 
AND column_name = 'university';

-- Check that the trigger was created
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'user_locations' 
AND trigger_name = 'sync_location_trigger';

-- ============================================================================
-- DONE!
-- ============================================================================
-- The university field is now added to user_locations
-- Location sync will automatically update profiles.location
-- ============================================================================

-- ============================================================================
-- VERIFICATION QUERIES - Run these to check your setup
-- ============================================================================

-- Check if all columns exist
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'services', 'jobs', 'user_locations')
AND column_name LIKE '%location%'
ORDER BY table_name, column_name;

-- Check indexes
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE '%location%';

-- ============================================================================
-- Supabase Database Functions
-- Run these in Supabase SQL Editor
-- ============================================================================

-- Function: Release escrow to wallet
CREATE OR REPLACE FUNCTION release_escrow_to_wallet(
    p_freelancer_id UUID,
    p_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
    UPDATE wallets
    SET 
        balance = balance + p_amount,
        total_earned = total_earned + p_amount,
        updated_at = NOW()
    WHERE user_id = p_freelancer_id;
    
    -- If wallet doesn't exist, create it
    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance, total_earned)
        VALUES (p_freelancer_id, p_amount, p_amount);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Update freelancer rating (recalculate from reviews)
CREATE OR REPLACE FUNCTION update_freelancer_rating(
    p_freelancer_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_avg_rating DECIMAL(3,2);
BEGIN
    SELECT AVG(rating)::DECIMAL(3,2)
    INTO v_avg_rating
    FROM reviews
    WHERE reviewee_id = p_freelancer_id;
    
    UPDATE profiles
    SET 
        freelancer_rating = COALESCE(v_avg_rating, 0),
        updated_at = NOW()
    WHERE id = p_freelancer_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment completed jobs count
CREATE OR REPLACE FUNCTION increment_jobs_completed(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET 
        total_jobs_completed = total_jobs_completed + 1,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment service orders count
CREATE OR REPLACE FUNCTION increment_service_orders(
    p_service_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE services
    SET 
        orders_count = orders_count + 1,
        updated_at = NOW()
    WHERE id = p_service_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment proposals count for job
CREATE OR REPLACE FUNCTION increment_proposals_count(
    p_job_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE jobs
    SET proposals_count = proposals_count + 1
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment service views
CREATE OR REPLACE FUNCTION increment_service_views(
    p_service_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE services
    SET views_count = views_count + 1
    WHERE id = p_service_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment job views
CREATE OR REPLACE FUNCTION increment_job_views(
    p_job_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE jobs
    SET views_count = views_count + 1
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Move pending clearance to available balance (after X days)
-- This should be run by a cron job daily
CREATE OR REPLACE FUNCTION process_pending_clearances()
RETURNS TABLE(processed_count INT) AS $$
DECLARE
    v_clearance_days INT := 7; -- 7 days clearance period
    v_count INT := 0;
BEGIN
    -- Move funds from pending_clearance to balance for completed orders older than 7 days
    UPDATE wallets w
    SET 
        balance = balance + pending_clearance,
        pending_clearance = 0,
        updated_at = NOW()
    WHERE EXISTS (
        SELECT 1 
        FROM orders o
        WHERE o.freelancer_id = w.user_id
        AND o.status = 'completed'
        AND o.updated_at < NOW() - INTERVAL '7 days'
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate escrow total
CREATE OR REPLACE FUNCTION get_escrow_total()
RETURNS DECIMAL AS $$
DECLARE
    v_total DECIMAL;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total
    FROM escrow
    WHERE status = 'held';
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Function: Get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE(
    total_orders INT,
    completed_orders INT,
    active_orders INT,
    total_spent DECIMAL,
    total_earned DECIMAL,
    avg_rating DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INT as total_orders,
        COUNT(*) FILTER (WHERE o.status = 'completed')::INT as completed_orders,
        COUNT(*) FILTER (WHERE o.status IN ('awaiting_delivery', 'delivered'))::INT as active_orders,
        COALESCE(SUM(o.amount) FILTER (WHERE o.client_id = p_user_id), 0) as total_spent,
        COALESCE(SUM(o.freelancer_earnings) FILTER (WHERE o.freelancer_id = p_user_id), 0) as total_earned,
        (
            SELECT AVG(rating)::DECIMAL(3,2)
            FROM reviews
            WHERE reviewee_id = p_user_id
        ) as avg_rating
    FROM orders o
    WHERE o.client_id = p_user_id OR o.freelancer_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION: Run these to test functions
-- ============================================================================

-- Test user stats
SELECT * FROM get_user_stats('YOUR_USER_ID_HERE');

-- Test escrow total
SELECT get_escrow_total();

-- Check if all functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
AND routine_schema = 'public'
AND routine_name IN (
    'release_escrow_to_wallet',
    'update_freelancer_rating',
    'increment_jobs_completed',
    'increment_service_orders',
    'increment_proposals_count',
    'process_pending_clearances'
)
ORDER BY routine_name;

-- ============================================================================
-- CRITICAL: Atomic Order Completion with Payment Release
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_order_with_payment(
  p_order_id UUID,
  p_client_rating INTEGER,
  p_client_review TEXT DEFAULT NULL,
  p_communication_rating INTEGER DEFAULT NULL,
  p_quality_rating INTEGER DEFAULT NULL,
  p_professionalism_rating INTEGER DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_escrow RECORD;
  v_result jsonb;
BEGIN
  -- Get order and validate
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'delivered' THEN
    RAISE EXCEPTION 'Order must be delivered before completion';
  END IF;

  -- Get escrow
  SELECT * INTO v_escrow FROM escrow WHERE order_id = p_order_id AND status = 'held';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escrow not found or already released';
  END IF;

  -- 1. Update order
  UPDATE orders
  SET 
    status = 'completed',
    client_rating = p_client_rating,
    client_review = p_client_review
  WHERE id = p_order_id;

  -- 2. Release escrow
  UPDATE escrow
  SET 
    status = 'released_to_freelancer',
    released_at = NOW()
  WHERE id = v_escrow.id;

  -- 3. Update freelancer wallet (move from pending to available)
  UPDATE wallets
  SET 
    balance = balance + v_order.freelancer_earnings,
    pending_clearance = GREATEST(0, pending_clearance - v_order.freelancer_earnings),
    total_earned = total_earned + v_order.freelancer_earnings
  WHERE user_id = v_order.freelancer_id;

  -- 4. Create review
  INSERT INTO reviews (
    order_id, reviewer_id, reviewee_id, rating, review_text,
    communication_rating, quality_rating, professionalism_rating
  )
  VALUES (
    p_order_id, v_order.client_id, v_order.freelancer_id,
    p_client_rating, p_client_review,
    p_communication_rating, p_quality_rating, p_professionalism_rating
  );

  -- 5. Update freelancer stats
  UPDATE profiles
  SET 
    total_jobs_completed = total_jobs_completed + 1,
    freelancer_rating = (
      SELECT AVG(rating)::NUMERIC(3,2)
      FROM reviews
      WHERE reviewee_id = v_order.freelancer_id
    )
  WHERE id = v_order.freelancer_id;

  -- 6. Update service orders count (if applicable)
  IF v_order.service_id IS NOT NULL THEN
    UPDATE services
    SET orders_count = orders_count + 1
    WHERE id = v_order.service_id;
  END IF;

  -- 7. Update job status (if applicable)
  IF v_order.job_id IS NOT NULL THEN
    UPDATE jobs
    SET status = 'completed'
    WHERE id = v_order.job_id;
  END IF;

  -- 8. Notify freelancer
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    v_order.freelancer_id,
    'order_completed',
    'Order Completed! 💰',
    '₦' || v_order.freelancer_earnings || ' added to your wallet for: ' || v_order.title,
    '/freelancer/orders/' || p_order_id
  );

  v_result := jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'amount_released', v_order.freelancer_earnings
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Order completion failed: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ============================================================================
-- CRITICAL: Atomic Payment Processing Function
-- ============================================================================
CREATE OR REPLACE FUNCTION process_successful_payment(
  p_transaction_id UUID,
  p_order_id UUID,
  p_flw_tx_id TEXT,
  p_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_result jsonb;
BEGIN
  -- Start transaction
  -- 1. Update transaction status
  UPDATE transactions
  SET 
    status = 'successful',
    flutterwave_tx_ref = p_flw_tx_id,
    paid_at = NOW()
  WHERE id = p_transaction_id;

  -- 2. Get order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- 3. Update order status
  UPDATE orders
  SET status = 'awaiting_delivery'
  WHERE id = p_order_id;

  -- 4. Create escrow record
  INSERT INTO escrow (order_id, transaction_id, amount, status)
  VALUES (p_order_id, p_transaction_id, p_amount, 'held');

  -- 5. Send notification to freelancer
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    v_order.freelancer_id,
    'new_order',
    'New Order Received! 🎉',
    'Payment confirmed. Start working on: ' || v_order.title,
    '/freelancer/orders/' || p_order_id
  );

  -- 6. Send notification to client
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    v_order.client_id,
    'payment_success',
    'Payment Successful ✓',
    'Your payment is secured in escrow for: ' || v_order.title,
    '/client/orders/' || p_order_id
  );

  v_result := jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'awaiting_delivery'
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Rollback handled automatically
  RAISE WARNING 'Payment processing failed: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES profiles(id),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  images TEXT[], -- Cloudinary URLs
  stock_status VARCHAR(20) DEFAULT 'available', -- available, sold_out
  condition VARCHAR(20), -- new, like_new, used
  delivery_options TEXT[], -- pickup, hostel_delivery, meetup
  location VARCHAR(200), -- seller campus location
  is_active BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;

CREATE TABLE product_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  product_id UUID REFERENCES products(id),
  buyer_id UUID REFERENCES profiles(id),
  seller_id UUID REFERENCES profiles(id),
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  delivery_method VARCHAR(50), -- pickup, delivery
  delivery_address TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  buyer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  order_id UUID REFERENCES product_orders(id),
  buyer_id UUID REFERENCES profiles(id),
  seller_rating INTEGER CHECK (seller_rating BETWEEN 1 AND 5),
  product_rating INTEGER CHECK (product_rating BETWEEN 1 AND 5),
  review_text TEXT,
  images TEXT[],
  is_verified_purchase BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_reviews_product ON product_reviews(product_id);

-- ============================================================================
-- MARKETPLACE ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  
  -- Parties
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Order Details
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 100),
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  
  -- Delivery Information
  delivery_address JSONB NOT NULL,
  tracking_number TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (
    status IN (
      'pending_payment',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    )
  ),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'bank_transfer', 'wallet')),
  status_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Indexes for marketplace orders
CREATE INDEX idx_marketplace_orders_buyer ON marketplace_orders(buyer_id);
CREATE INDEX idx_marketplace_orders_seller ON marketplace_orders(seller_id);
CREATE INDEX idx_marketplace_orders_product ON marketplace_orders(product_id);
CREATE INDEX idx_marketplace_orders_status ON marketplace_orders(status);
CREATE INDEX idx_marketplace_orders_created ON marketplace_orders(created_at DESC);

-- ============================================================================
-- MARKETPLACE REVIEWS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relations
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  
  -- Review Content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL CHECK (char_length(review_text) >= 10 AND char_length(review_text) <= 500),
  
  -- Detailed Ratings (Optional)
  product_quality INTEGER CHECK (product_quality >= 1 AND product_quality <= 5),
  delivery_speed INTEGER CHECK (delivery_speed >= 1 AND delivery_speed <= 5),
  communication INTEGER CHECK (communication >= 1 AND communication <= 5),
  
  -- Media
  images TEXT[] CHECK (array_length(images, 1) <= 5),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  UNIQUE(order_id) -- One review per order
);

-- Indexes for marketplace reviews
CREATE INDEX idx_marketplace_reviews_product ON marketplace_reviews(product_id);
CREATE INDEX idx_marketplace_reviews_seller ON marketplace_reviews(seller_id);
CREATE INDEX idx_marketplace_reviews_reviewer ON marketplace_reviews(reviewer_id);
CREATE INDEX idx_marketplace_reviews_created ON marketplace_reviews(created_at DESC);


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- Products Policies
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Sellers can view their own products"
  ON products FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Authenticated users can create products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own products"
  ON products FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own products"
  ON products FOR DELETE
  USING (auth.uid() = seller_id);

-- Marketplace Orders Policies
CREATE POLICY "Buyers can view their orders"
  ON marketplace_orders FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view orders for their products"
  ON marketplace_orders FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Authenticated users can create orders"
  ON marketplace_orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update their orders"
  ON marketplace_orders FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Buyers can cancel pending orders"
  ON marketplace_orders FOR UPDATE
  USING (
    auth.uid() = buyer_id 
    AND status IN ('pending_payment', 'confirmed')
  );

-- Marketplace Reviews Policies
CREATE POLICY "Anyone can view reviews"
  ON marketplace_reviews FOR SELECT
  USING (true);

CREATE POLICY "Buyers can create reviews for their orders"
  ON marketplace_reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Reviewers can update their own reviews"
  ON marketplace_reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);

  -- Performance indexes
CREATE INDEX IF NOT EXISTS idx_services_freelancer ON services(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_freelancer ON orders(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE INDEX IF NOT EXISTS idx_proposals_job ON proposals(job_id);
CREATE INDEX IF NOT EXISTS idx_proposals_freelancer ON proposals(freelancer_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- Secure your tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Example RLS policy
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

  -- Artifact Storage Table
CREATE TABLE IF NOT EXISTS artifact_storage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key, shared)
);

CREATE INDEX idx_artifact_storage_user ON artifact_storage(user_id);
CREATE INDEX idx_artifact_storage_key ON artifact_storage(key);
CREATE INDEX idx_artifact_storage_shared ON artifact_storage(shared);

-- RLS Policies
ALTER TABLE artifact_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own storage"
  ON artifact_storage FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can read shared storage"
  ON artifact_storage FOR SELECT
  USING (shared = true);

  CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  event TEXT NOT NULL,
  verified BOOLEAN NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX idx_webhook_logs_provider ON webhook_logs(provider);
CREATE INDEX idx_webhook_logs_received ON webhook_logs(received_at DESC);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Add verification fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nin_verification_status TEXT CHECK (nin_verification_status IN ('not_started', 'pending', 'approved', 'rejected')) DEFAULT 'not_started';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nin_verification_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nin_last_four TEXT; -- Last 4 digits for display

-- Create NIN verification requests table
CREATE TABLE IF NOT EXISTS nin_verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nin TEXT NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 150,
  transaction_ref TEXT UNIQUE NOT NULL,
  youverify_request_id TEXT,
  verification_status TEXT CHECK (verification_status IN ('pending', 'processing', 'approved', 'rejected', 'failed')) DEFAULT 'pending',
  verification_response JSONB,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_nin_verification_user ON nin_verification_requests(user_id);
CREATE INDEX idx_nin_verification_status ON nin_verification_requests(verification_status);
CREATE INDEX idx_nin_verification_transaction ON nin_verification_requests(transaction_ref);

-- RLS Policies
ALTER TABLE nin_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verification requests"
  ON nin_verification_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own verification requests"
  ON nin_verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_nin_verification_updated_at
  BEFORE UPDATE ON nin_verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add verification earnings to admin tracking (optional)
CREATE TABLE IF NOT EXISTS platform_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  revenue_type TEXT NOT NULL CHECK (revenue_type IN ('platform_fee', 'nin_verification', 'premium_feature')),
  amount NUMERIC(10, 2) NOT NULL,
  source_user_id UUID REFERENCES profiles(id),
  transaction_ref TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_platform_revenue_type ON platform_revenue(revenue_type);
CREATE INDEX idx_platform_revenue_date ON platform_revenue(created_at DESC);

-- Remove NIN verification columns from profiles
ALTER TABLE profiles 
DROP COLUMN IF EXISTS nin_verified,
DROP COLUMN IF EXISTS nin_verification_status,
DROP COLUMN IF EXISTS nin_verification_date,
DROP COLUMN IF EXISTS nin_last_four;

-- Verification: Check remaining columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name LIKE '%nin%';
-- Should return 0 rows

-- Drop the entire NIN verification requests table
DROP TABLE IF EXISTS nin_verification_requests CASCADE;

-- Remove NIN revenue tracking from platform_revenue
-- Option A: Remove NIN entries (if you want to keep other revenue data)
DELETE FROM platform_revenue 
WHERE revenue_type = 'nin_verification';

-- Option B: Update the check constraint (if table exists)
ALTER TABLE platform_revenue 
DROP CONSTRAINT IF EXISTS platform_revenue_revenue_type_check;

ALTER TABLE platform_revenue 
ADD CONSTRAINT platform_revenue_revenue_type_check 
CHECK (revenue_type IN ('platform_fee', 'premium_feature'));

-- Verification: Confirm tables are gone
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%nin%';

-- Add liveness verification fields to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS liveness_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS liveness_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trust_level TEXT CHECK (trust_level IN ('new', 'verified', 'trusted', 'top_rated', 'elite')) DEFAULT 'new';

-- Create liveness verification records table
CREATE TABLE IF NOT EXISTS liveness_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Video metadata (video stored locally on user device)
  video_id TEXT NOT NULL, -- Reference to IndexedDB
  challenges JSONB NOT NULL, -- Array of challenges completed
  
  -- Detection results
  face_detected BOOLEAN NOT NULL,
  all_challenges_passed BOOLEAN NOT NULL,
  face_confidence NUMERIC(3, 2),
  
  -- Payment info
  amount_paid NUMERIC(10, 2) DEFAULT 150,
  transaction_ref TEXT UNIQUE,
  
  -- Status
  verification_status TEXT CHECK (verification_status IN ('pending', 'processing', 'approved', 'rejected', 'failed')) DEFAULT 'pending',
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Create trust score history table
CREATE TABLE IF NOT EXISTS trust_score_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL, -- 'liveness_verified', 'order_completed', 'positive_review', etc.
  score_change INTEGER NOT NULL,
  previous_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  
  related_entity_type TEXT, -- 'order', 'review', 'verification'
  related_entity_id UUID,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_liveness_verifications_user ON liveness_verifications(user_id);
CREATE INDEX idx_liveness_verifications_status ON liveness_verifications(verification_status);
CREATE INDEX idx_trust_score_events_user ON trust_score_events(user_id);
CREATE INDEX idx_trust_score_events_type ON trust_score_events(event_type);

-- RLS Policies
ALTER TABLE liveness_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_score_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own liveness verifications"
  ON liveness_verifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own liveness verifications"
  ON liveness_verifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own trust score history"
  ON trust_score_events FOR SELECT
  USING (user_id = auth.uid());

-- Function to update trust level based on score
CREATE OR REPLACE FUNCTION update_trust_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trust_score >= 90 THEN
    NEW.trust_level = 'elite';
  ELSIF NEW.trust_score >= 70 THEN
    NEW.trust_level = 'top_rated';
  ELSIF NEW.trust_score >= 40 THEN
    NEW.trust_level = 'trusted';
  ELSIF NEW.trust_score >= 25 THEN
    NEW.trust_level = 'verified';
  ELSE
    NEW.trust_level = 'new';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update trust level
DROP TRIGGER IF EXISTS update_profile_trust_level ON profiles;
CREATE TRIGGER update_profile_trust_level
  BEFORE UPDATE OF trust_score ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_trust_level();

-- Function to add trust score event
CREATE OR REPLACE FUNCTION add_trust_score_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_score_change INTEGER,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_current_score INTEGER;
  v_new_score INTEGER;
BEGIN
  -- Get current score
  SELECT trust_score INTO v_current_score
  FROM profiles
  WHERE id = p_user_id;
  
  -- Calculate new score
  v_new_score := GREATEST(0, v_current_score + p_score_change);
  
  -- Update profile
  UPDATE profiles
  SET trust_score = v_new_score
  WHERE id = p_user_id;
  
  -- Log event
  INSERT INTO trust_score_events (
    user_id, event_type, score_change,
    previous_score, new_score,
    related_entity_type, related_entity_id,
    notes
  ) VALUES (
    p_user_id, p_event_type, p_score_change,
    v_current_score, v_new_score,
    p_related_entity_type, p_related_entity_id,
    p_notes
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRUST SCORE CALCULATION FUNCTIONS
-- ============================================================================

-- Function: Calculate trust score from events
CREATE OR REPLACE FUNCTION calculate_trust_score(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_score INTEGER;
BEGIN
  SELECT COALESCE(SUM(score_change), 0)
  INTO v_total_score
  FROM trust_score_events
  WHERE user_id = p_user_id;
  
  -- Cap score between 0 and 100
  RETURN GREATEST(0, LEAST(100, v_total_score));
END;
$$ LANGUAGE plpgsql;

-- Function: Add trust score event
CREATE OR REPLACE FUNCTION add_trust_score_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_score_change INTEGER,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_current_score INTEGER;
  v_new_score INTEGER;
BEGIN
  -- Get current score
  SELECT trust_score INTO v_current_score
  FROM profiles
  WHERE id = p_user_id;
  
  -- Calculate new score
  v_new_score := GREATEST(0, LEAST(100, v_current_score + p_score_change));
  
  -- Update profile
  UPDATE profiles
  SET 
    trust_score = v_new_score,
    trust_level = CASE
      WHEN v_new_score >= 90 THEN 'elite'
      WHEN v_new_score >= 70 THEN 'top_rated'
      WHEN v_new_score >= 40 THEN 'trusted'
      WHEN v_new_score >= 25 THEN 'verified'
      ELSE 'new'
    END
  WHERE id = p_user_id;
  
  -- Log event
  INSERT INTO trust_score_events (
    user_id, event_type, score_change,
    previous_score, new_score,
    related_entity_type, related_entity_id,
    notes
  ) VALUES (
    p_user_id, p_event_type, p_score_change,
    v_current_score, v_new_score,
    p_related_entity_type, p_related_entity_id,
    p_notes
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Get trust level requirements
CREATE OR REPLACE FUNCTION get_trust_level_requirements(p_trust_level TEXT)
RETURNS TABLE(
  min_score INTEGER,
  required_jobs INTEGER,
  required_rating NUMERIC,
  features TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE p_trust_level
      WHEN 'elite' THEN 90
      WHEN 'top_rated' THEN 70
      WHEN 'trusted' THEN 40
      WHEN 'verified' THEN 25
      ELSE 0
    END AS min_score,
    CASE p_trust_level
      WHEN 'elite' THEN 50
      WHEN 'top_rated' THEN 20
      WHEN 'trusted' THEN 5
      ELSE 0
    END AS required_jobs,
    CASE p_trust_level
      WHEN 'elite' THEN 4.8
      WHEN 'top_rated' THEN 4.5
      WHEN 'trusted' THEN 4.0
      ELSE 0.0
    END::NUMERIC AS required_rating,
    CASE p_trust_level
      WHEN 'elite' THEN ARRAY['Priority listing', 'Exclusive badge', 'Premium support']
      WHEN 'top_rated' THEN ARRAY['High visibility', 'Featured badge', 'Priority support']
      WHEN 'trusted' THEN ARRAY['Search boost', 'Trust badge']
      WHEN 'verified' THEN ARRAY['Basic verification badge']
      ELSE ARRAY['Limited visibility']
    END AS features;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATIC TRUST SCORE EVENTS
-- ============================================================================

-- Trigger: Award points for completed orders
CREATE OR REPLACE FUNCTION trigger_order_completion_trust_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Award freelancer for completion
    PERFORM add_trust_score_event(
      NEW.freelancer_id,
      'order_completed',
      2,
      'order',
      NEW.id,
      'Order completed successfully'
    );
    
    -- Award client for good review if 4+ stars
    IF NEW.client_rating >= 4 THEN
      PERFORM add_trust_score_event(
        NEW.client_id,
        'positive_client_behavior',
        1,
        'order',
        NEW.id,
        'Left positive review'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_completion_trust_score
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_order_completion_trust_score();

-- Trigger: Award points for positive reviews
CREATE OR REPLACE FUNCTION trigger_review_trust_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rating >= 4 THEN
    PERFORM add_trust_score_event(
      NEW.reviewee_id,
      'positive_review',
      3,
      'review',
      NEW.id,
      'Received ' || NEW.rating || '-star review'
    );
  ELSIF NEW.rating <= 2 THEN
    PERFORM add_trust_score_event(
      NEW.reviewee_id,
      'negative_review',
      -5,
      'review',
      NEW.id,
      'Received ' || NEW.rating || '-star review'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_trust_score
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_review_trust_score();

-- Trigger: Penalize late deliveries
CREATE OR REPLACE FUNCTION trigger_late_delivery_penalty()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND NEW.delivered_at > NEW.delivery_date THEN
    PERFORM add_trust_score_event(
      NEW.freelancer_id,
      'late_delivery',
      -3,
      'order',
      NEW.id,
      'Order delivered late'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER late_delivery_penalty
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_late_delivery_penalty();

  -- Ran this migration in Supabase SQL Editor
ALTER TABLE liveness_verifications 
DROP COLUMN IF EXISTS amount_paid,
DROP COLUMN IF EXISTS transaction_ref;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'liveness_verifications';

CREATE INDEX IF NOT EXISTS idx_liveness_verifications_user_status 
ON liveness_verifications(user_id, verification_status);

CREATE INDEX IF NOT EXISTS idx_liveness_verifications_created 
ON liveness_verifications(created_at DESC);

-- Create cloudinary_usage table
CREATE TABLE IF NOT EXISTS cloudinary_usage (
  id TEXT PRIMARY KEY DEFAULT 'global',
  transformations INTEGER NOT NULL DEFAULT 0,
  bandwidth BIGINT NOT NULL DEFAULT 0, -- bytes
  storage BIGINT NOT NULL DEFAULT 0, -- bytes
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default record
INSERT INTO cloudinary_usage (id, transformations, bandwidth, storage)
VALUES ('global', 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Create index for last_checked queries
CREATE INDEX IF NOT EXISTS idx_cloudinary_usage_last_checked 
ON cloudinary_usage(last_checked);

-- Enable RLS (optional - allows public read for monitoring dashboards)
ALTER TABLE cloudinary_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read usage stats
CREATE POLICY "Authenticated users can view Cloudinary usage"
  ON cloudinary_usage FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only service role can update (your backend)
CREATE POLICY "Service role can manage Cloudinary usage"
  ON cloudinary_usage FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_cloudinary_usage_updated_at
  BEFORE UPDATE ON cloudinary_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if table was created
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cloudinary_usage'
ORDER BY ordinal_position;

-- Check if default record exists
SELECT * FROM cloudinary_usage WHERE id = 'global';

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'cloudinary_usage';

-- ============================================================================
-- OPTIONAL: Admin function to get formatted usage stats
-- ============================================================================

CREATE OR REPLACE FUNCTION get_cloudinary_usage_stats()
RETURNS TABLE(
  metric TEXT,
  current_value TEXT,
  limit_value TEXT,
  percentage NUMERIC,
  status TEXT
) AS $$
DECLARE
  v_usage RECORD;
  v_gb CONSTANT BIGINT := 1024 * 1024 * 1024;
BEGIN
  SELECT * INTO v_usage FROM cloudinary_usage WHERE id = 'global';
  
  -- Transformations
  RETURN QUERY SELECT
    'Transformations'::TEXT,
    v_usage.transformations::TEXT,
    '25,000'::TEXT,
    ROUND((v_usage.transformations::NUMERIC / 25000) * 100, 2),
    CASE 
      WHEN v_usage.transformations > 20000 THEN 'warning'
      WHEN v_usage.transformations > 23000 THEN 'critical'
      ELSE 'ok'
    END::TEXT;
  
  -- Bandwidth
  RETURN QUERY SELECT
    'Bandwidth'::TEXT,
    ROUND(v_usage.bandwidth::NUMERIC / v_gb, 2)::TEXT || ' GB',
    '25 GB'::TEXT,
    ROUND((v_usage.bandwidth::NUMERIC / (25 * v_gb)) * 100, 2),
    CASE 
      WHEN v_usage.bandwidth > (20 * v_gb) THEN 'warning'
      WHEN v_usage.bandwidth > (23 * v_gb) THEN 'critical'
      ELSE 'ok'
    END::TEXT;
  
  -- Storage
  RETURN QUERY SELECT
    'Storage'::TEXT,
    ROUND(v_usage.storage::NUMERIC / v_gb, 2)::TEXT || ' GB',
    '25 GB'::TEXT,
    ROUND((v_usage.storage::NUMERIC / (25 * v_gb)) * 100, 2),
    CASE 
      WHEN v_usage.storage > (20 * v_gb) THEN 'warning'
      WHEN v_usage.storage > (23 * v_gb) THEN 'critical'
      ELSE 'ok'
    END::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT * FROM get_cloudinary_usage_stats();

Dev User Credentials:

Email: user@example.com
Password: password123
Starting Balance: ₦50,000

DO $$
DECLARE
  v_user_id UUID;
  v_identity_id UUID;
  v_existing_user UUID;
  v_existing_profile UUID;
  v_existing_wallet UUID;
  v_existing_identity UUID;
BEGIN
  -- Step 1: Check if user already exists in auth.users
  SELECT id INTO v_existing_user
  FROM auth.users
  WHERE email = 'user@example.com';

  IF v_existing_user IS NOT NULL THEN
    RAISE NOTICE '✅ User already exists with ID: %', v_existing_user;
    v_user_id := v_existing_user;
    
    -- Update password to ensure it's correct
    UPDATE auth.users
    SET 
      encrypted_password = crypt('password123', gen_salt('bf', 12)),
      email_confirmed_at = NOW(),
      updated_at = NOW()
    WHERE id = v_user_id;
    
    RAISE NOTICE '✅ Password updated for existing user';
  ELSE
    -- Step 2: Create new auth user
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'user@example.com',
      crypt('password123', gen_salt('bf', 12)),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Dev User"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
    
    RAISE NOTICE '✅ Auth user created with ID: %', v_user_id;
  END IF;

  -- Step 3: Delete any stray profile with same email (safety check)
  DELETE FROM public.profiles
  WHERE email = 'user@example.com' AND id != v_user_id;

  -- Step 3b: Check if profile exists for this user_id
  SELECT id INTO v_existing_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_existing_profile IS NOT NULL THEN
    -- Update existing profile
    UPDATE public.profiles
    SET
      email = 'user@example.com',
      full_name = 'Dev User',
      phone_number = '+2348012345678',
      phone_verified = true,
      user_type = 'both',
      bio = 'Development test user with full access to all features',
      university = 'University of Lagos',
      location = 'Lagos, Lagos',
      email_verified = true,
      identity_verified = true,
      student_verified = false,
      liveness_verified = false,
      freelancer_rating = 4.5,
      client_rating = 4.5,
      total_jobs_completed = 10,
      total_jobs_posted = 5,
      account_status = 'active',
      trust_score = 50,
      trust_level = 'verified',
      updated_at = NOW()
    WHERE id = v_user_id;
    
    RAISE NOTICE '✅ Profile updated';
  ELSE
    -- Insert new profile
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      phone_number,
      phone_verified,
      user_type,
      bio,
      university,
      location,
      email_verified,
      identity_verified,
      student_verified,
      liveness_verified,
      freelancer_rating,
      client_rating,
      total_jobs_completed,
      total_jobs_posted,
      account_status,
      trust_score,
      trust_level,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      'user@example.com',
      'Dev User',
      '+2348012345678',
      true,
      'both',
      'Development test user with full access to all features',
      'University of Lagos',
      'Lagos, Lagos',
      true,
      true,
      false,
      false,
      4.5,
      4.5,
      10,
      5,
      'active',
      50,
      'verified',
      NOW(),
      NOW()
    );
    
    RAISE NOTICE '✅ Profile created';
  END IF;

  -- Step 4: Handle wallet (check if exists, then update or insert)
  SELECT id INTO v_existing_wallet
  FROM public.wallets
  WHERE user_id = v_user_id;

  IF v_existing_wallet IS NOT NULL THEN
    -- Update existing wallet
    UPDATE public.wallets
    SET
      balance = 50000.00,
      pending_clearance = 0.00,
      total_earned = 0.00,
      total_withdrawn = 0.00,
      updated_at = NOW()
    WHERE user_id = v_user_id;
    
    RAISE NOTICE '✅ Wallet updated with ₦50,000';
  ELSE
    -- Insert new wallet
    INSERT INTO public.wallets (
      user_id,
      balance,
      pending_clearance,
      total_earned,
      total_withdrawn,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      50000.00,
      0.00,
      0.00,
      0.00,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE '✅ Wallet created with ₦50,000';
  END IF;

  -- Step 5: Handle identity record in auth.identities
  -- Check if identity already exists for this user
  SELECT id INTO v_existing_identity
  FROM auth.identities
  WHERE user_id = v_user_id AND provider = 'email';

  IF v_existing_identity IS NOT NULL THEN
    -- Update existing identity
    UPDATE auth.identities
    SET
      identity_data = jsonb_build_object(
        'sub', v_user_id::text,
        'email', 'user@example.com'
      ),
      last_sign_in_at = NOW(),
      updated_at = NOW()
    WHERE id = v_existing_identity;
    
    RAISE NOTICE '✅ Identity record updated';
  ELSE
    -- Generate identity ID first
    v_identity_id := gen_random_uuid();
    
    -- Insert new identity with REQUIRED provider_id column
    -- provider_id must be set to the identity id (Supabase requirement)
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      v_user_id,
      v_identity_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', 'user@example.com'
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
    
    RAISE NOTICE '✅ Identity record created with provider_id';
  END IF;

  -- Final success message
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '✅ DEV USER SETUP COMPLETE!';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Credentials:';
  RAISE NOTICE '  Email:    user@example.com';
  RAISE NOTICE '  Password: password123';
  RAISE NOTICE '  Balance:  ₦50,000';
  RAISE NOTICE '  User ID:  %', v_user_id;
  RAISE NOTICE '';
  RAISE NOTICE '🎉 You can now login at http://localhost:3000/login';
  RAISE NOTICE '';

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to create dev user: %', SQLERRM;
END $$;

-- Add the missing onboarding_completed column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to have this set to FALSE (or TRUE if you prefer)
UPDATE profiles 
SET onboarding_completed = FALSE 
WHERE onboarding_completed IS NULL;

-- Fix potential caching issues by reloading schema cache
NOTIFY pgrst, 'reload schema';

-- 1. Fix Profile Insertion Policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 2. Fix Profile Update Policy (ensure it exists)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- 3. Allow User Locations Insertion (Fixes location save error)
DROP POLICY IF EXISTS "Users can manage own location" ON user_locations;
CREATE POLICY "Users can manage own location" 
ON user_locations FOR ALL 
USING (user_id = auth.uid());

-- 4. Fix Wallet Creation (If needed)
DROP POLICY IF EXISTS "Users can create own wallet" ON wallets;
CREATE POLICY "Users can create own wallet" 
ON wallets FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Allow users to insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Allow users to insert their own location data
DROP POLICY IF EXISTS "Users can manage own location" ON user_locations;
CREATE POLICY "Users can manage own location" 
ON user_locations FOR ALL 
USING (user_id = auth.uid());

-- Allow users to insert their own profile row
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Allow users to insert their own location data
DROP POLICY IF EXISTS "Users can manage own location" ON user_locations;
CREATE POLICY "Users can manage own location" 
ON user_locations FOR ALL 
USING (user_id = auth.uid());

-- Migration: Add notification_settings and theme_preference to profiles table
-- This migration adds support for saving notification preferences and theme choices

-- Add notification_settings column (JSONB for flexibility)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "email_messages": true,
  "email_orders": true,
  "email_reviews": true,
  "push_notifications": true
}'::jsonb;

-- Add theme_preference column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS theme_preference TEXT CHECK (theme_preference IN ('light', 'dark', 'system'));

-- Add comment for notification_settings
COMMENT ON COLUMN profiles.notification_settings IS 'User notification preferences stored as JSON';

-- Add comment for theme_preference
COMMENT ON COLUMN profiles.theme_preference IS 'User preferred theme: light, dark, or system';

-- Create index on theme_preference for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_theme_preference ON profiles(theme_preference);

-- Update existing rows to have default notification settings if NULL
UPDATE profiles 
SET notification_settings = '{
  "email_messages": true,
  "email_orders": true,
  "email_reviews": true,
  "push_notifications": true
}'::jsonb
WHERE notification_settings IS NULL;

-- Verify the migration
DO $$
BEGIN
  -- Check if columns exist
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'notification_settings'
  ) THEN
    RAISE NOTICE 'notification_settings column added successfully';
  END IF;

  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'theme_preference'
  ) THEN
    RAISE NOTICE 'theme_preference column added successfully';
  END IF;
END $$;

ALTER TABLE profiles 
ALTER COLUMN id SET NOT NULL;

DO $$
DECLARE
  v_is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name = 'id';
  
  IF v_is_nullable = 'NO' THEN
    RAISE NOTICE '✅ profiles.id is correctly marked as NOT NULL';
  ELSE
    RAISE NOTICE '❌ profiles.id is still nullable - there may be data issues';
  END IF;
END $$;

DO $$
DECLARE
  v_null_count INT;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM profiles
  WHERE id IS NULL;
  
  IF v_null_count = 0 THEN
    RAISE NOTICE '✅ No NULL values found in profiles.id';
  ELSE
    RAISE NOTICE '⚠️  Found % NULL values in profiles.id', v_null_count;
  END IF;
END $$;

ALTER TABLE jobs
ALTER COLUMN client_id SET NOT NULL;

-- Check orders.client_id and orders.freelancer_id
ALTER TABLE orders
ALTER COLUMN client_id SET NOT NULL,
ALTER COLUMN freelancer_id SET NOT NULL;

-- Check proposals.job_id and proposals.freelancer_id
ALTER TABLE proposals
ALTER COLUMN job_id SET NOT NULL,
ALTER COLUMN freelancer_id SET NOT NULL;

-- Check services.freelancer_id
ALTER TABLE services
ALTER COLUMN freelancer_id SET NOT NULL;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIX: Ensure all PRIMARY KEY columns are explicitly NOT NULL
-- This forces Supabase to correctly generate non-nullable types
-- ============================================================================

-- Step 1: Profiles table - Ensure id is NOT NULL
ALTER TABLE profiles 
ALTER COLUMN id SET NOT NULL;

-- Step 2: Verify the constraint was applied
SELECT column_name, is_nullable 
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'id';

-- Step 3: Mark other critical columns as NOT NULL
ALTER TABLE jobs
ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE orders
ALTER COLUMN client_id SET NOT NULL,
ALTER COLUMN freelancer_id SET NOT NULL;

ALTER TABLE proposals
ALTER COLUMN job_id SET NOT NULL,
ALTER COLUMN freelancer_id SET NOT NULL;

ALTER TABLE services
ALTER COLUMN freelancer_id SET NOT NULL;

-- Step 4: Force Supabase to reload schema cache
-- This notifies PostgREST to clear its internal type cache
NOTIFY pgrst, 'reload schema';

-- Step 5: Verification - Check all columns are marked NOT NULL
SELECT 
  table_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'jobs', 'orders', 'proposals', 'services')
AND column_name IN ('id', 'client_id', 'freelancer_id', 'job_id')
ORDER BY table_name, column_name;

-- ============================================================================
-- SAFETY CHECK: Find NULL values before applying NOT NULL constraints
-- Run this FIRST to identify any data issues
-- ============================================================================

DO $$
DECLARE
  v_table_name TEXT;
  v_column_name TEXT;
  v_null_count INTEGER;
  v_total_issues INTEGER := 0;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'CHECKING FOR NULL VALUES IN COLUMNS THAT SHOULD BE NOT NULL';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Check profiles table
  RAISE NOTICE '📋 Checking PROFILES table...';
  
  SELECT COUNT(*) INTO v_null_count FROM profiles WHERE id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  profiles.id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_null_count FROM profiles WHERE email IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  profiles.email has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_null_count FROM profiles WHERE full_name IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  profiles.full_name has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_null_count FROM profiles WHERE user_type IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  profiles.user_type has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  -- Check jobs table
  RAISE NOTICE '';
  RAISE NOTICE '📋 Checking JOBS table...';
  
  SELECT COUNT(*) INTO v_null_count FROM jobs WHERE id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  jobs.id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_null_count FROM jobs WHERE client_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  jobs.client_id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_null_count FROM jobs WHERE title IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  jobs.title has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  -- Check orders table
  RAISE NOTICE '';
  RAISE NOTICE '📋 Checking ORDERS table...';
  
  SELECT COUNT(*) INTO v_null_count FROM orders WHERE id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  orders.id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_null_count FROM orders WHERE client_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  orders.client_id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_null_count FROM orders WHERE freelancer_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  orders.freelancer_id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  -- Check services table
  RAISE NOTICE '';
  RAISE NOTICE '📋 Checking SERVICES table...';
  
  SELECT COUNT(*) INTO v_null_count FROM services WHERE id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  services.id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_null_count FROM services WHERE freelancer_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  services.freelancer_id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  -- Check proposals table
  RAISE NOTICE '';
  RAISE NOTICE '📋 Checking PROPOSALS table...';
  
  SELECT COUNT(*) INTO v_null_count FROM proposals WHERE job_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  proposals.job_id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_null_count FROM proposals WHERE freelancer_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE NOTICE '  ⚠️  proposals.freelancer_id has % NULL values', v_null_count;
    v_total_issues := v_total_issues + v_null_count;
  END IF;

  -- Summary
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  IF v_total_issues = 0 THEN
    RAISE NOTICE '✅ NO NULL VALUES FOUND - Safe to apply NOT NULL constraints';
  ELSE
    RAISE NOTICE '⚠️  FOUND % TOTAL NULL VALUES', v_total_issues;
    RAISE NOTICE '   FIX THESE BEFORE APPLYING NOT NULL CONSTRAINTS';
  END IF;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- APPLY NOT NULL CONSTRAINTS
-- Run this AFTER safety check passes (no NULL values found)
-- This will make your database schema match TypeScript expectations
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'APPLYING NOT NULL CONSTRAINTS';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- ====================================================================
  -- PROFILES TABLE
  -- ====================================================================
  RAISE NOTICE '📋 Updating PROFILES table...';
  
  -- id (PRIMARY KEY - must be NOT NULL)
  ALTER TABLE profiles ALTER COLUMN id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ profiles.id SET NOT NULL';

  -- email (marked as NOT NULL in schema, ensuring it's enforced)
  ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ profiles.email SET NOT NULL';

  -- full_name (marked as NOT NULL in schema)
  ALTER TABLE profiles ALTER COLUMN full_name SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ profiles.full_name SET NOT NULL';

  -- user_type (has DEFAULT, should NOT be NULL)
  ALTER TABLE profiles ALTER COLUMN user_type SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ profiles.user_type SET NOT NULL';

  -- account_status (has DEFAULT, should NOT be NULL)
  ALTER TABLE profiles ALTER COLUMN account_status SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ profiles.account_status SET NOT NULL';

  -- ====================================================================
  -- JOBS TABLE
  -- ====================================================================
  RAISE NOTICE '';
  RAISE NOTICE '📋 Updating JOBS table...';
  
  -- id (PRIMARY KEY)
  ALTER TABLE jobs ALTER COLUMN id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ jobs.id SET NOT NULL';

  -- client_id (FOREIGN KEY - should NOT be NULL)
  ALTER TABLE jobs ALTER COLUMN client_id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ jobs.client_id SET NOT NULL';

  -- title (marked as NOT NULL)
  ALTER TABLE jobs ALTER COLUMN title SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ jobs.title SET NOT NULL';

  -- description (marked as NOT NULL)
  ALTER TABLE jobs ALTER COLUMN description SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ jobs.description SET NOT NULL';

  -- category (marked as NOT NULL)
  ALTER TABLE jobs ALTER COLUMN category SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ jobs.category SET NOT NULL';

  -- budget_type (marked as NOT NULL)
  ALTER TABLE jobs ALTER COLUMN budget_type SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ jobs.budget_type SET NOT NULL';

  -- ====================================================================
  -- SERVICES TABLE
  -- ====================================================================
  RAISE NOTICE '';
  RAISE NOTICE '📋 Updating SERVICES table...';
  
  -- id (PRIMARY KEY)
  ALTER TABLE services ALTER COLUMN id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ services.id SET NOT NULL';

  -- freelancer_id (FOREIGN KEY - should NOT be NULL)
  ALTER TABLE services ALTER COLUMN freelancer_id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ services.freelancer_id SET NOT NULL';

  -- title (marked as NOT NULL)
  ALTER TABLE services ALTER COLUMN title SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ services.title SET NOT NULL';

  -- description (marked as NOT NULL)
  ALTER TABLE services ALTER COLUMN description SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ services.description SET NOT NULL';

  -- category (marked as NOT NULL)
  ALTER TABLE services ALTER COLUMN category SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ services.category SET NOT NULL';

  -- base_price (marked as NOT NULL)
  ALTER TABLE services ALTER COLUMN base_price SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ services.base_price SET NOT NULL';

  -- delivery_days (marked as NOT NULL)
  ALTER TABLE services ALTER COLUMN delivery_days SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ services.delivery_days SET NOT NULL';

  -- ====================================================================
  -- ORDERS TABLE
  -- ====================================================================
  RAISE NOTICE '';
  RAISE NOTICE '📋 Updating ORDERS table...';
  
  -- id (PRIMARY KEY)
  ALTER TABLE orders ALTER COLUMN id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.id SET NOT NULL';

  -- order_number (UNIQUE NOT NULL)
  ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.order_number SET NOT NULL';

  -- client_id (FOREIGN KEY - marked as NOT NULL)
  ALTER TABLE orders ALTER COLUMN client_id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.client_id SET NOT NULL';

  -- freelancer_id (FOREIGN KEY - marked as NOT NULL)
  ALTER TABLE orders ALTER COLUMN freelancer_id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.freelancer_id SET NOT NULL';

  -- title (marked as NOT NULL)
  ALTER TABLE orders ALTER COLUMN title SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.title SET NOT NULL';

  -- description (marked as NOT NULL)
  ALTER TABLE orders ALTER COLUMN description SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.description SET NOT NULL';

  -- amount (marked as NOT NULL)
  ALTER TABLE orders ALTER COLUMN amount SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.amount SET NOT NULL';

  -- platform_fee (marked as NOT NULL)
  ALTER TABLE orders ALTER COLUMN platform_fee SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.platform_fee SET NOT NULL';

  -- freelancer_earnings (marked as NOT NULL)
  ALTER TABLE orders ALTER COLUMN freelancer_earnings SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.freelancer_earnings SET NOT NULL';

  -- delivery_date (marked as NOT NULL)
  ALTER TABLE orders ALTER COLUMN delivery_date SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ orders.delivery_date SET NOT NULL';

  -- ====================================================================
  -- PROPOSALS TABLE
  -- ====================================================================
  RAISE NOTICE '';
  RAISE NOTICE '📋 Updating PROPOSALS table...';
  
  -- id (PRIMARY KEY)
  ALTER TABLE proposals ALTER COLUMN id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ proposals.id SET NOT NULL';

  -- job_id (FOREIGN KEY - should NOT be NULL)
  ALTER TABLE proposals ALTER COLUMN job_id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ proposals.job_id SET NOT NULL';

  -- freelancer_id (FOREIGN KEY - should NOT be NULL)
  ALTER TABLE proposals ALTER COLUMN freelancer_id SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ proposals.freelancer_id SET NOT NULL';

  -- cover_letter (marked as NOT NULL)
  ALTER TABLE proposals ALTER COLUMN cover_letter SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ proposals.cover_letter SET NOT NULL';

  -- proposed_price (marked as NOT NULL)
  ALTER TABLE proposals ALTER COLUMN proposed_price SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ proposals.proposed_price SET NOT NULL';

  -- delivery_days (marked as NOT NULL)
  ALTER TABLE proposals ALTER COLUMN delivery_days SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ proposals.delivery_days SET NOT NULL';

  -- ====================================================================
  -- TRANSACTIONS TABLE
  -- ====================================================================
  RAISE NOTICE '';
  RAISE NOTICE '📋 Updating TRANSACTIONS table...';
  
  ALTER TABLE transactions ALTER COLUMN transaction_ref SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ transactions.transaction_ref SET NOT NULL';

  ALTER TABLE transactions ALTER COLUMN amount SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ transactions.amount SET NOT NULL';

  ALTER TABLE transactions ALTER COLUMN transaction_type SET NOT NULL;
  v_count := v_count + 1;
  RAISE NOTICE '  ✅ transactions.transaction_type SET NOT NULL';

  -- ====================================================================
  -- OTHER CORE TABLES
  -- ====================================================================
  RAISE NOTICE '';
  RAISE NOTICE '📋 Updating other core tables...';
  
  -- Wallets
  ALTER TABLE wallets ALTER COLUMN id SET NOT NULL;
  v_count := v_count + 1;
  
  -- Messages
  ALTER TABLE messages ALTER COLUMN sender_id SET NOT NULL;
  v_count := v_count + 1;
  
  -- Notifications
  ALTER TABLE notifications ALTER COLUMN type SET NOT NULL;
  ALTER TABLE notifications ALTER COLUMN title SET NOT NULL;
  ALTER TABLE notifications ALTER COLUMN message SET NOT NULL;
  v_count := v_count + 3;
  
  -- Reviews
  ALTER TABLE reviews ALTER COLUMN reviewer_id SET NOT NULL;
  ALTER TABLE reviews ALTER COLUMN reviewee_id SET NOT NULL;
  ALTER TABLE reviews ALTER COLUMN rating SET NOT NULL;
  v_count := v_count + 3;

  RAISE NOTICE '  ✅ Additional % constraints applied', 7;

  -- ====================================================================
  -- FORCE SUPABASE TO REGENERATE TYPES
  -- ====================================================================
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Notifying Supabase to reload schema...';
  NOTIFY pgrst, 'reload schema';

  -- Summary
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ SUCCESSFULLY APPLIED % NOT NULL CONSTRAINTS', v_count;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 NEXT STEPS:';
  RAISE NOTICE '1. Regenerate TypeScript types: npx supabase gen types typescript';
  RAISE NOTICE '2. Restart your dev server: npm run dev';
  RAISE NOTICE '3. The "!" operators in your code will still work (and are still needed)';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICATION: Check which columns are now NOT NULL
-- Run this AFTER applying constraints
-- ============================================================================

DO $$
DECLARE
  v_result RECORD;
  v_total_count INTEGER := 0;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'VERIFICATION: CHECKING NOT NULL CONSTRAINTS';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Query all NOT NULL columns in key tables
  FOR v_result IN
    SELECT 
      table_name,
      column_name,
      is_nullable,
      data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name IN (
      'profiles', 'jobs', 'services', 'orders', 'proposals', 
      'transactions', 'wallets', 'messages', 'notifications', 'reviews'
    )
    AND is_nullable = 'NO'
    ORDER BY table_name, ordinal_position
  LOOP
    IF v_result.table_name != COALESCE(LAG(v_result.table_name) OVER (), '') THEN
      RAISE NOTICE '';
      RAISE NOTICE '📋 %:', UPPER(v_result.table_name);
    END IF;
    
    RAISE NOTICE '  ✅ %.% (%) is NOT NULL', 
      v_result.table_name, 
      v_result.column_name, 
      v_result.data_type;
    
    v_total_count := v_total_count + 1;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ TOTAL: % columns are marked NOT NULL', v_total_count;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Database constraints successfully applied!';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- DETAILED VERIFICATION FOR KEY FIELDS
-- ============================================================================

SELECT 
  'profiles' as table_name,
  'id' as column_name,
  is_nullable,
  CASE WHEN is_nullable = 'NO' THEN '✅' ELSE '❌' END as status
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'id'

UNION ALL

SELECT 
  'profiles',
  'user_type',
  is_nullable,
  CASE WHEN is_nullable = 'NO' THEN '✅' ELSE '❌' END
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'user_type'

UNION ALL

SELECT 
  'jobs',
  'client_id',
  is_nullable,
  CASE WHEN is_nullable = 'NO' THEN '✅' ELSE '❌' END
FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'client_id'

UNION ALL

SELECT 
  'orders',
  'client_id',
  is_nullable,
  CASE WHEN is_nullable = 'NO' THEN '✅' ELSE '❌' END
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'client_id'

UNION ALL

SELECT 
  'orders',
  'freelancer_id',
  is_nullable,
  CASE WHEN is_nullable = 'NO' THEN '✅' ELSE '❌' END
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'freelancer_id';

-- ============================================================================
-- Migration: Add rating and reviews_count to products table
-- Run this in Supabase SQL Editor, then regenerate database.types.ts
-- ============================================================================

-- 1. Add columns to products
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rating        numeric(3, 2) DEFAULT 0    NOT NULL,
  ADD COLUMN IF NOT EXISTS reviews_count integer       DEFAULT 0    NOT NULL;

-- Constrain rating to valid range
ALTER TABLE public.products
  ADD CONSTRAINT products_rating_range CHECK (rating >= 0 AND rating <= 5);

  -- ----------------------------------------------------------------------------
-- 2. Back-fill from existing marketplace_reviews (safe if table is empty)
-- ----------------------------------------------------------------------------
UPDATE public.products p
SET
  reviews_count = sub.cnt,
  rating        = sub.avg_rating
FROM (
  SELECT
    product_id,
    COUNT(*)          AS cnt,
    ROUND(AVG(rating)::numeric, 2) AS avg_rating
  FROM public.marketplace_reviews
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id;

-- ----------------------------------------------------------------------------
-- 3. Function: recalculate rating + reviews_count for a single product
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  -- On DELETE the relevant id is in OLD; on INSERT/UPDATE it's in NEW
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;

  UPDATE public.products
  SET
    reviews_count = (
      SELECT COUNT(*)
      FROM   public.marketplace_reviews
      WHERE  product_id = v_product_id
    ),
    rating = COALESCE(
      (
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM   public.marketplace_reviews
        WHERE  product_id = v_product_id
      ),
      0
    )
  WHERE id = v_product_id;

  -- Triggers must return a row value
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Trigger: fires after any write to marketplace_reviews
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_recalculate_product_rating ON public.marketplace_reviews;

CREATE TRIGGER trg_recalculate_product_rating
AFTER INSERT OR UPDATE OR DELETE
ON public.marketplace_reviews
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_product_rating();

-- ----------------------------------------------------------------------------
-- 5. Index: speeds up the aggregate query inside the trigger
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_product_id
  ON public.marketplace_reviews (product_id);

-- ----------------------------------------------------------------------------
-- Verify: check the columns exist and back-fill worked
-- ----------------------------------------------------------------------------
SELECT
  id,
  title,
  rating,
  reviews_count
FROM public.products
ORDER BY reviews_count DESC
LIMIT 10;

-- Drop existing trigger and function first
DROP TRIGGER IF EXISTS enforce_f9_identity ON profiles;
DROP FUNCTION IF EXISTS prevent_f9_identity();

-- 1. RESERVE "F9" IDENTITY
CREATE OR REPLACE FUNCTION prevent_f9_identity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.full_name ILIKE 'f9' OR NEW.full_name ILIKE 'f-9' OR NEW.full_name ILIKE 'f 9' THEN
        RAISE EXCEPTION 'Reserved identity violation. You cannot use this name.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_f9_identity
    BEFORE INSERT OR UPDATE OF full_name ON profiles
    FOR EACH ROW EXECUTE FUNCTION prevent_f9_identity();

    -- 2. AUTOMATION CONFIGURATION TABLE
-- Controls for the automation engine (toggles and thresholds)
CREATE TABLE platform_config (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT true,
    value NUMERIC,
    string_value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Automation Rules
INSERT INTO platform_config (key, enabled, value, description) VALUES
    ('wallet_hold_hours', true, 24, 'Hours to hold withdrawal for new bank + no orders'),
    ('max_disputes_30d', true, 3, 'Max disputes before Level 1 advisory'),
    ('max_listing_unverified', true, 50000, 'Max listing price for Trust Score 40-59'),
    ('withdrawal_gate_threshold', false, 100000, 'Manual approval required above this amount');

    -- 3. CONTEST TICKETS
-- For users to dispute automated actions
CREATE TABLE contest_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action_contested TEXT NOT NULL,
    explanation TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'dismissed', 'reversed')) DEFAULT 'pending',
    reviewed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. STAFF ARCHITECTURE (Dormant)
CREATE TABLE staff_roles (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'moderator', 'financial_analyst', 'community_manager')),
    permissions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Accountability Log
CREATE TABLE admin_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES profiles(id),
    target_user_id UUID REFERENCES profiles(id),
    action_type TEXT NOT NULL,
    details TEXT,
    can_reverse_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
    is_reversed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure your main profile exists and is admin
-- NOTE: Replace 'your_email@f9.ng' with your actual admin email
UPDATE profiles SET user_type = 'admin' WHERE email = 'your_email@f9.ng';
INSERT INTO staff_roles (user_id, role) 
SELECT id, 'admin' FROM profiles WHERE email = 'your_email@f9.ng' ON CONFLICT DO NOTHING;

-- ==========================================
-- 1. F9 IDENTITY PROTECTION (Part 1 of Spec)
-- ==========================================

-- Trigger to prevent anyone from using "F9" variants
CREATE OR REPLACE FUNCTION protect_f9_identity()
RETURNS TRIGGER AS $$
BEGIN
    IF LOWER(NEW.full_name) IN ('f9', 'f 9', 'f-9', 'admin', 'administrator', 'ultim8') THEN
        RAISE EXCEPTION 'This identity is reserved for platform systems.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_f9_identity_signup
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_f9_identity();

-- ==========================================
-- 2. TRUST SCORE ENGINE (Part 2 of Spec)
-- ==========================================

-- Main function to adjust trust scores and update levels
CREATE OR REPLACE FUNCTION add_trust_score_event(
    p_user_id UUID, 
    p_event_type TEXT, 
    p_score_change INTEGER
)
RETURNS VOID AS $$
DECLARE
    current_score INTEGER;
    new_score INTEGER;
BEGIN
    SELECT trust_score INTO current_score FROM profiles WHERE id = p_user_id;
    
    -- Bound score between 0 and 100
    new_score := GREATEST(0, LEAST(100, current_score + p_score_change));
    
    UPDATE profiles 
    SET 
        trust_score = new_score,
        trust_level = CASE 
            WHEN new_score >= 80 THEN 'trusted'
            WHEN new_score >= 60 THEN 'verified'
            WHEN new_score >= 40 THEN 'standard'
            ELSE 'restricted'
        END,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Audit log for the change
    INSERT INTO security_logs (user_id, event_type, description, severity)
    VALUES (p_user_id, 'trust_update', p_event_type || ' (' || p_score_change || ')', 'low');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for the Automation Cron: Find frequent disputers
CREATE OR REPLACE FUNCTION find_frequent_disputers(since_date TIMESTAMPTZ)
RETURNS TABLE (id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT client_id FROM disputes
    WHERE created_at >= since_date
    GROUP BY client_id
    HAVING COUNT(id) >= 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. DORMANT STAFF SYSTEM (Part 6b)
-- ==========================================

CREATE TABLE IF NOT EXISTS staff_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) UNIQUE,
    role_type TEXT NOT NULL, -- 'moderator', 'finance', 'support'
    permissions JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES profiles(id),
    target_user_id UUID REFERENCES profiles(id),
    action_type TEXT NOT NULL,
    reason TEXT,
    reversible_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
    is_reversed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Only Admins can view/edit config and logs
CREATE POLICY "Admin full access" ON platform_config FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
);

CREATE POLICY "Admin logs access" ON admin_action_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- Users can view and create their own tickets
CREATE POLICY "User contest access" ON contest_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User contest create" ON contest_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin contest access" ON contest_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- 1. Function to find users with 3+ disputes in the last 30 days
CREATE OR REPLACE FUNCTION find_frequent_disputers(since_date TIMESTAMPTZ)
RETURNS TABLE (id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT client_id as id
    FROM disputes
    WHERE created_at >= since_date
    GROUP BY client_id
    HAVING COUNT(id) >= 3;
END;
$$;

-- 2. Robust Trust Score Update Function (Handles thresholds and history)
CREATE OR REPLACE FUNCTION add_trust_score_event(
    p_user_id UUID, 
    p_event_type TEXT, 
    p_score_change INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_score INTEGER;
    new_score INTEGER;
BEGIN
    -- Get current score
    SELECT trust_score INTO current_score FROM profiles WHERE id = p_user_id;
    
    -- Calculate new score with boundaries (0-100)
    new_score := GREATEST(0, LEAST(100, current_score + p_score_change));
    
    -- Update Profile
    UPDATE profiles 
    SET 
        trust_score = new_score,
        trust_level = CASE 
            WHEN new_score >= 80 THEN 'trusted'
            WHEN new_score >= 60 THEN 'verified'
            WHEN new_score >= 40 THEN 'standard'
            ELSE 'restricted'
        END,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log the change for Audit/Contest capability
    INSERT INTO security_logs (
        user_id, 
        event_type, 
        description, 
        severity
    ) VALUES (
        p_user_id, 
        'trust_score_change', 
        p_event_type || ': Change of ' || p_score_change || '. New score: ' || new_score,
        CASE WHEN p_score_change < 0 THEN 'medium' ELSE 'low' END
    );
END;
$$;

-- 3. Escrow Analytics Helper (For the Admin Finance Page)
CREATE OR REPLACE FUNCTION get_escrow_total()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT SUM(amount) FROM escrow WHERE status = 'held');
END;
$$;

-- 4. Ensure Contest Tickets table exists as per spec
CREATE TABLE IF NOT EXISTS contest_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    action_contested TEXT NOT NULL, -- e.g., 'Score Docked: excessive_disputes'
    explanation TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, resolved, dismissed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for contest tickets
ALTER TABLE contest_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own tickets" ON contest_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins have full access to tickets" ON contest_tickets
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

    ALTER TABLE admin_action_logs RENAME COLUMN staff_id TO admin_id;
ALTER TABLE admin_action_logs RENAME COLUMN details TO reason;
ALTER TABLE admin_action_logs RENAME COLUMN can_reverse_until TO reversible_until;

-- Add surrogate PK and rename column
ALTER TABLE staff_roles ADD COLUMN id UUID DEFAULT gen_random_uuid();
ALTER TABLE staff_roles RENAME COLUMN role TO role_type;
ALTER TABLE staff_roles RENAME COLUMN assigned_at TO created_at;

CREATE OR REPLACE FUNCTION add_trust_score_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_score_change INTEGER,
    p_related_entity_type TEXT DEFAULT NULL,
    p_related_entity_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current INTEGER;
    v_new INTEGER;
BEGIN
    SELECT trust_score INTO v_current FROM profiles WHERE id = p_user_id;
    v_new := GREATEST(0, LEAST(100, v_current + p_score_change));

    UPDATE profiles SET trust_score = v_new WHERE id = p_user_id;
    -- trust_level is handled by the update_profile_trust_level BEFORE trigger

    INSERT INTO trust_score_events (
        user_id, event_type, score_change,
        previous_score, new_score,
        related_entity_type, related_entity_id, notes
    ) VALUES (
        p_user_id, p_event_type, p_score_change,
        v_current, v_new,
        p_related_entity_type, p_related_entity_id, p_notes
    );
END;
$$;

DROP TRIGGER IF EXISTS enforce_f9_identity ON profiles;
DROP FUNCTION IF EXISTS prevent_f9_identity();

-- ============================================================================
-- FIX 5: Remove redundant trust_level assignment from add_trust_score_event
-- The BEFORE trigger `update_profile_trust_level` already handles this.
-- Keeping it in the function creates a misleading suggestion that the 
-- function controls trust_level — it does not, and never executes.
-- ============================================================================

CREATE OR REPLACE FUNCTION add_trust_score_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_score_change INTEGER,
    p_related_entity_type TEXT DEFAULT NULL,
    p_related_entity_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_score INTEGER;
    v_new_score     INTEGER;
BEGIN
    -- Get current score
    SELECT trust_score INTO v_current_score
    FROM profiles
    WHERE id = p_user_id;

    -- Clamp new score between 0 and 100
    v_new_score := GREATEST(0, LEAST(100, v_current_score + p_score_change));

    -- Update trust_score ONLY.
    -- trust_level is intentionally NOT set here.
    -- The BEFORE trigger `update_profile_trust_level` on profiles
    -- fires on UPDATE OF trust_score and sets trust_level authoritatively.
    UPDATE profiles
    SET
        trust_score = v_new_score,
        updated_at  = NOW()
    WHERE id = p_user_id;

    -- Write to trust_score_events for full audit trail
    INSERT INTO trust_score_events (
        user_id,
        event_type,
        score_change,
        previous_score,
        new_score,
        related_entity_type,
        related_entity_id,
        notes
    ) VALUES (
        p_user_id,
        p_event_type,
        p_score_change,
        v_current_score,
        v_new_score,
        p_related_entity_type,
        p_related_entity_id,
        p_notes
    );
END;
$$;

-- ============================================================================
-- VERIFY: Confirm the function no longer contains trust_level logic
-- Should return the function body — check it has no "trust_level" in the UPDATE
-- ============================================================================
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'add_trust_score_event'
AND pronargs = 6; -- confirms we're looking at the right overload

-- Check both overloads exist
SELECT
    p.proname                        AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pronargs                         AS param_count
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'add_trust_score_event'
ORDER BY pronargs;

-- ============================================================================
-- FIX: Drop the 3-param overload of add_trust_score_event.
-- The 6-param version already has DEFAULT NULL on params 4, 5, 6,
-- so calling it with just 3 args still works identically.
-- ============================================================================
DROP FUNCTION IF EXISTS public.add_trust_score_event(uuid, text, integer);

-- ============================================================================
-- VERIFY: Should now return exactly 1 row with 6 params
-- ============================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'add_trust_score_event';

    IF v_count = 1 THEN
        RAISE NOTICE '✅  Exactly 1 overload of add_trust_score_event exists (6-param). All callers will resolve to it.';
    ELSIF v_count = 0 THEN
        RAISE WARNING '❌  Function was dropped entirely — something went wrong.';
    ELSE
        RAISE WARNING '❌  Still % overloads found — manual inspection needed.', v_count;
    END IF;
END $$;

-- Step 1: Drop the old constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Step 2: Add new constraint that includes 'admin'
ALTER TABLE profiles 
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('freelancer', 'client', 'both', 'admin'));

-- Step 3: Now set your actual admin email
UPDATE profiles 
SET user_type = 'admin' 
WHERE email = 'your_actual_email@f9.ng'; -- replace with real email

-- Verify it worked (must return 1 row)
SELECT id, email, user_type FROM profiles WHERE user_type = 'admin';

-- Step 1: Populate id for any existing rows (can't make NOT NULL otherwise)
UPDATE staff_roles SET id = gen_random_uuid() WHERE id IS NULL;

-- Step 2: Make it NOT NULL
ALTER TABLE staff_roles ALTER COLUMN id SET NOT NULL;

-- Step 3: Drop the existing primary key
ALTER TABLE staff_roles DROP CONSTRAINT staff_roles_pkey;

-- Step 4: Make user_id a unique FK (not PK) instead
ALTER TABLE staff_roles ADD CONSTRAINT staff_roles_user_id_unique UNIQUE (user_id);

-- Step 5: Make id the new primary key
ALTER TABLE staff_roles ADD PRIMARY KEY (id);

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'staff_roles'
ORDER BY ordinal_position;

-- See all 5 policies currently active
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'contest_tickets'
ORDER BY policyname;

-- Drop the redundant second set (they duplicate what the first set already covers)
DROP POLICY IF EXISTS "Users can create their own tickets" ON contest_tickets;
DROP POLICY IF EXISTS "Admins have full access to tickets" ON contest_tickets;

-- Verify only 3 clean policies remain
SELECT policyname FROM pg_policies WHERE tablename = 'contest_tickets';
-- Expected: "User contest access", "User contest create", "Admin contest access"

-- ============================================================================
-- FIX 1: wallets — Add missing SELECT and UPDATE policies
-- ============================================================================

-- Users need to read their own balance (dashboard, withdrawal page, etc.)
CREATE POLICY "Users can view own wallet"
  ON wallets FOR SELECT
  USING (user_id = auth.uid());

-- Users need to update their own bank details (account_number, bank_name, etc.)
-- Note: balance/total_earned/pending_clearance are only modified by
-- SECURITY DEFINER functions (complete_order_with_payment, release_escrow_to_wallet)
-- which bypass RLS entirely, so this UPDATE policy is safe — it won't let
-- users manipulate their own balance directly from the client.
CREATE POLICY "Users can update own wallet"
  ON wallets FOR UPDATE
  USING (user_id = auth.uid());

-- Verify
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'wallets'
ORDER BY cmd, policyname;
-- Expected: INSERT (Users can create own wallet), SELECT (Users can view own wallet), UPDATE (Users can update own wallet)


-- ============================================================================
-- FIX 2: transactions — Add policies from scratch
-- Context: transactions are financial records. Users should be able to
-- read their own (for order history/receipts) but NEVER insert/update
-- directly — that must only happen via SECURITY DEFINER functions
-- (process_successful_payment) which bypass RLS.
-- ============================================================================

-- Users can view transactions that belong to their orders
-- (both as client who paid, and freelancer who earned)
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE client_id = auth.uid()
         OR freelancer_id = auth.uid()
    )
  );

-- No INSERT policy — transactions are only created by process_successful_payment()
-- which is SECURITY DEFINER and bypasses RLS. Direct client inserts are blocked
-- by the absence of an INSERT policy, which is correct and intentional.

-- No UPDATE policy — same reason. Transaction records are immutable from
-- the client perspective.

-- Verify
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'transactions'
ORDER BY cmd, policyname;
-- Expected: exactly 1 row — SELECT policy

-- ============================================================================
-- FIX 3: proposals — Add policies for both parties
-- Context: proposals involve two parties — the freelancer who submitted,
-- and the client who owns the job. Each needs appropriate access.
-- ============================================================================

-- Freelancers: full control over their own proposals
-- (create, view, withdraw/update status to 'withdrawn')
CREATE POLICY "Freelancers can manage own proposals"
  ON proposals FOR ALL
  USING (freelancer_id = auth.uid())
  WITH CHECK (freelancer_id = auth.uid());

-- Clients: read-only access to proposals on their jobs
-- (they need to see who bid, at what price, to accept/reject)
-- Clients do not INSERT proposals — only UPDATE status (accept/reject).
-- The UPDATE is handled by application logic calling the DB, so we
-- need a separate UPDATE policy for clients.
CREATE POLICY "Clients can view proposals on own jobs"
  ON proposals FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE client_id = auth.uid()
    )
  );

-- Clients need to update proposal status (accept / reject)
-- This is separate from SELECT so we can keep it tightly scoped.
CREATE POLICY "Clients can update proposals on own jobs"
  ON proposals FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE client_id = auth.uid()
    )
  );

-- Verify
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'proposals'
ORDER BY cmd, policyname;
-- Expected:
-- ALL   → Freelancers can manage own proposals
-- SELECT → Clients can view proposals on own jobs
-- UPDATE → Clients can update proposals on own jobs

-- ============================================================================
-- FIX 4: profiles — Drop the duplicate UPDATE policy
-- Two identical UPDATE policies exist:
--   "Users can update own profile"      → auth.uid() = id
--   "Users can update their own profile" → auth.uid() = id
-- They are functionally identical. Drop the second one.
-- ============================================================================

-- Check both exist before dropping (safe to run regardless)
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'UPDATE'
ORDER BY policyname;

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Verify only one UPDATE policy remains
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'UPDATE';
-- Expected: exactly 1 row — "Users can update own profile"

-- ============================================================================
-- FIX 5: Double wallet-credit guard — Database-level protection
-- Context: complete_order_with_payment() credits the wallet directly.
--          release_escrow_to_wallet() also credits the wallet.
-- If app code accidentally calls both for the same order, the freelancer
-- gets paid twice. We add a guard at the escrow level — once escrow is
-- released, any further release attempt is blocked.
-- ============================================================================

-- The escrow table already has status CHECK:
--   ('held', 'released_to_freelancer', 'refunded_to_client', 'disputed')
-- complete_order_with_payment already checks:
--   SELECT * FROM escrow WHERE order_id = p_order_id AND status = 'held'
--   and raises EXCEPTION 'Escrow not found or already released' if not found.
-- So the DB-level guard already EXISTS inside complete_order_with_payment.

-- The risk is only if app code calls release_escrow_to_wallet() DIRECTLY
-- (bypassing the atomic function) after complete_order_with_payment ran.
-- We close this by adding a trigger that blocks wallet credits on
-- already-released escrow rows.

CREATE OR REPLACE FUNCTION guard_against_double_wallet_credit()
RETURNS TRIGGER AS $$
BEGIN
  -- If escrow is already released or refunded, block any further
  -- status change that would imply another payout
  IF OLD.status IN ('released_to_freelancer', 'refunded_to_client')
     AND NEW.status IN ('released_to_freelancer', 'refunded_to_client') THEN
    RAISE EXCEPTION 
      'Double-payout blocked: escrow % is already in status %. Cannot change to %.',
      OLD.order_id, OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_double_escrow_release ON escrow;
CREATE TRIGGER prevent_double_escrow_release
  BEFORE UPDATE OF status ON escrow
  FOR EACH ROW
  EXECUTE FUNCTION guard_against_double_wallet_credit();

-- Additionally, make release_escrow_to_wallet itself aware of escrow state
-- so it cannot be called standalone without a valid held escrow:
CREATE OR REPLACE FUNCTION release_escrow_to_wallet(
    p_freelancer_id UUID,
    p_amount DECIMAL,
    p_order_id UUID  -- now required, used to verify escrow state
)
RETURNS VOID AS $$
DECLARE
  v_escrow_status TEXT;
BEGIN
    -- Verify escrow is still held before touching wallet
    SELECT status INTO v_escrow_status
    FROM escrow
    WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'release_escrow_to_wallet: No escrow record found for order %', p_order_id;
    END IF;

    IF v_escrow_status != 'held' THEN
        RAISE EXCEPTION 
          'release_escrow_to_wallet: Escrow for order % is already "%" — double-credit blocked.',
          p_order_id, v_escrow_status;
    END IF;

    -- Safe to proceed
    UPDATE wallets
    SET 
        balance = balance + p_amount,
        total_earned = total_earned + p_amount,
        updated_at = NOW()
    WHERE user_id = p_freelancer_id;
    
    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance, total_earned)
        VALUES (p_freelancer_id, p_amount, p_amount);
    END IF;
END;
$$ LANGUAGE plpgsql;

DO $verify$
DECLARE
  v_count INTEGER;
BEGIN
  -- FIX 1: wallets
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE tablename = 'wallets';
  RAISE NOTICE 'wallets policies: % (expected 3)', v_count;
  IF v_count = 3 THEN 
    RAISE NOTICE 'OK: wallets RLS complete';
  ELSE 
    RAISE WARNING 'FAIL: wallets has % policies, expected 3', v_count; 
  END IF;

  -- FIX 2: transactions
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE tablename = 'transactions';
  RAISE NOTICE 'transactions policies: % (expected 1)', v_count;
  IF v_count = 1 THEN 
    RAISE NOTICE 'OK: transactions RLS complete';
  ELSE 
    RAISE WARNING 'FAIL: transactions has % policies, expected 1', v_count; 
  END IF;

  -- FIX 3: proposals
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE tablename = 'proposals';
  RAISE NOTICE 'proposals policies: % (expected 3)', v_count;
  IF v_count = 3 THEN 
    RAISE NOTICE 'OK: proposals RLS complete';
  ELSE 
    RAISE WARNING 'FAIL: proposals has % policies, expected 3', v_count; 
  END IF;

  -- FIX 4: profiles UPDATE duplicate
  SELECT COUNT(*) INTO v_count 
  FROM pg_policies 
  WHERE tablename = 'profiles' AND cmd = 'UPDATE';
  RAISE NOTICE 'profiles UPDATE policies: % (expected 1)', v_count;
  IF v_count = 1 THEN 
    RAISE NOTICE 'OK: profiles UPDATE policy deduplicated';
  ELSE 
    RAISE WARNING 'FAIL: profiles has % UPDATE policies, expected 1', v_count; 
  END IF;

  -- FIX 5: double-credit trigger
  SELECT COUNT(*) INTO v_count 
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'escrow' 
    AND t.tgname = 'prevent_double_escrow_release';
  RAISE NOTICE 'escrow double-credit trigger: % (expected 1)', v_count;
  IF v_count = 1 THEN 
    RAISE NOTICE 'OK: double-credit guard in place';
  ELSE 
    RAISE WARNING 'FAIL: prevent_double_escrow_release trigger missing'; 
  END IF;

END $verify$;

-- withdrawals
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own withdrawals"
  ON withdrawals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own withdrawals"
  ON withdrawals FOR INSERT WITH CHECK (user_id = auth.uid());

-- security_logs (read-only for own entries; writes are internal only)
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own security logs"
  ON security_logs FOR SELECT USING (user_id = auth.uid());

-- user_devices
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own devices"
  ON user_devices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage own devices"
  ON user_devices FOR ALL USING (user_id = auth.uid());

-- support_tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tickets"
  ON support_tickets FOR ALL USING (user_id = auth.uid());

-- verification_documents
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own documents"
  ON verification_documents FOR ALL USING (user_id = auth.uid());

-- platform_revenue (admin only)
ALTER TABLE platform_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view revenue"
  ON platform_revenue FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- webhook_logs (admin only — no user should ever access this)
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view webhook logs"
  ON webhook_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- audit_logs (admin only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view audit logs"
  ON audit_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- product_orders and product_reviews (superseded, lock them down)
ALTER TABLE product_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anyone except service role. Intentional.

-- Inside process_successful_payment, after creating the escrow record,
-- add the freelancer earnings to pending_clearance (not balance yet)
CREATE OR REPLACE FUNCTION process_successful_payment(
  p_transaction_id UUID,
  p_order_id UUID,
  p_flw_tx_id TEXT,
  p_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_order RECORD;
  v_result jsonb;
BEGIN
  UPDATE transactions
  SET status = 'successful', flutterwave_tx_ref = p_flw_tx_id, paid_at = NOW()
  WHERE id = p_transaction_id;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  UPDATE orders SET status = 'awaiting_delivery' WHERE id = p_order_id;

  INSERT INTO escrow (order_id, transaction_id, amount, status)
  VALUES (p_order_id, p_transaction_id, p_amount, 'held');

  -- THIS WAS MISSING: load freelancer earnings into pending_clearance
  INSERT INTO wallets (user_id, pending_clearance)
  VALUES (v_order.freelancer_id, v_order.freelancer_earnings)
  ON CONFLICT (user_id) DO UPDATE
    SET pending_clearance = wallets.pending_clearance + v_order.freelancer_earnings,
        updated_at = NOW();

  INSERT INTO notifications (user_id, type, title, message, link) VALUES
    (v_order.freelancer_id, 'new_order', 'New Order Received!',
     'Payment confirmed. Start working on: ' || v_order.title,
     '/freelancer/orders/' || p_order_id),
    (v_order.client_id, 'payment_success', 'Payment Successful',
     'Your payment is secured in escrow for: ' || v_order.title,
     '/client/orders/' || p_order_id);

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', 'awaiting_delivery');

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Payment processing failed: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$func$;

ALTER TABLE staff_roles
ADD CONSTRAINT staff_roles_role_type_check
CHECK (role_type IN ('admin', 'moderator', 'financial_analyst', 'community_manager'));

-- One trigger function already exists: update_updated_at_column()
-- Just need to attach it to the missing tables

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_orders_updated_at
  BEFORE UPDATE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liveness_verifications_updated_at
  BEFORE UPDATE ON liveness_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contest_tickets_updated_at
  BEFORE UPDATE ON contest_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_config_updated_at
  BEFORE UPDATE ON platform_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  ALTER TABLE products ALTER COLUMN seller_id SET NOT NULL;

  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

  -- escrow
ALTER TABLE escrow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order participants can view escrow"
  ON escrow FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders
      WHERE client_id = auth.uid() OR freelancer_id = auth.uid()
    )
  );

-- reviews (respects is_public flag)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reviews viewable by all"
  ON reviews FOR SELECT USING (is_public = true);
CREATE POLICY "Users can view own reviews"
  ON reviews FOR SELECT
  USING (reviewee_id = auth.uid() OR reviewer_id = auth.uid());

-- conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view own conversations"
  ON conversations FOR SELECT
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid());
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- disputes
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dispute parties can view their disputes"
  ON disputes FOR SELECT
  USING (raised_by = auth.uid() OR against = auth.uid());
CREATE POLICY "Users can raise disputes"
  ON disputes FOR INSERT WITH CHECK (raised_by = auth.uid());
CREATE POLICY "Admins can manage all disputes"
  ON disputes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- staff_roles
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage staff roles"
  ON staff_roles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
CREATE POLICY "Staff can view own role"
  ON staff_roles FOR SELECT USING (user_id = auth.uid());

  CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "Participants can update own messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid());

  CREATE OR REPLACE FUNCTION update_wallet_on_withdrawal_complete()
RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE wallets
    SET total_withdrawn = total_withdrawn + NEW.amount,
        balance = GREATEST(0, balance - NEW.amount),
        updated_at = NOW()
    WHERE id = NEW.wallet_id;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER sync_wallet_on_withdrawal
  AFTER UPDATE OF status ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_wallet_on_withdrawal_complete();

  -- Redundant SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- artifact_storage missing updated_at trigger
CREATE TRIGGER update_artifact_storage_updated_at
  BEFORE UPDATE ON artifact_storage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- VERIFY first — confirm nothing currently calls the 2-param form
SELECT routine_name, specific_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'release_escrow_to_wallet';

-- FIX — drop the unsafe overload
DROP FUNCTION IF EXISTS public.release_escrow_to_wallet(uuid, numeric);

CREATE OR REPLACE FUNCTION public.find_frequent_disputers(since_date timestamp with time zone)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
    RETURN QUERY
    SELECT raised_by AS id          -- was: client_id (does not exist)
    FROM disputes
    WHERE created_at >= since_date
    GROUP BY raised_by
    HAVING COUNT(id) >= 3;
END;
$func$;

-- DROP the open UPDATE policy
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

-- Also lock down INSERT — wallets should be created by process_successful_payment,
-- not by a raw client INSERT. If you haven't already:
DROP POLICY IF EXISTS "Users can create own wallet" ON public.wallets;

-- Optionally re-add a narrow SELECT-only policy for the dashboard
-- (wallets are already SELECT-covered, so nothing else needed here)

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

-- Public read: only if the parent service is active (or owned by viewer)
CREATE POLICY "Service packages viewable if service is active"
ON public.service_packages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM services s
    WHERE s.id = service_packages.service_id
      AND (s.is_active = true OR s.freelancer_id = auth.uid())
  )
);

-- Write: only the service owner
CREATE POLICY "Freelancer can manage own service packages"
ON public.service_packages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM services s
    WHERE s.id = service_packages.service_id
      AND s.freelancer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM services s
    WHERE s.id = service_packages.service_id
      AND s.freelancer_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.complete_order_with_payment(
  p_order_id uuid,
  p_client_rating integer,
  p_client_review text DEFAULT NULL,
  p_communication_rating integer DEFAULT NULL,
  p_quality_rating integer DEFAULT NULL,
  p_professionalism_rating integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_order  RECORD;
  v_escrow RECORD;
  v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status != 'delivered' THEN
    RAISE EXCEPTION 'Order must be in delivered status before completion';
  END IF;

  SELECT * INTO v_escrow FROM escrow
  WHERE order_id = p_order_id AND status = 'held';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escrow not found or already released';
  END IF;

  -- 1. Complete the order
  UPDATE orders
  SET status        = 'completed',
      client_rating = p_client_rating,
      client_review = p_client_review
  WHERE id = p_order_id;

  -- 2. Release escrow record
  UPDATE escrow
  SET status      = 'released_to_freelancer',
      released_at = NOW()
  WHERE id = v_escrow.id;

  -- 3. DO NOT touch wallet here.
  --    pending_clearance was already loaded by process_successful_payment.
  --    process_pending_clearances() (cron) will move it to balance after 7 days.

  -- 4. Record the review
  INSERT INTO reviews (
    order_id, reviewer_id, reviewee_id, rating, review_text,
    communication_rating, quality_rating, professionalism_rating
  ) VALUES (
    p_order_id, v_order.client_id, v_order.freelancer_id,
    p_client_rating, p_client_review,
    p_communication_rating, p_quality_rating, p_professionalism_rating
  );

  -- 5. Update freelancer profile stats
  UPDATE profiles
  SET total_jobs_completed = total_jobs_completed + 1,
      freelancer_rating = (
        SELECT AVG(rating)::NUMERIC(3,2)
        FROM reviews WHERE reviewee_id = v_order.freelancer_id
      )
  WHERE id = v_order.freelancer_id;

  -- 6. Increment service order count
  IF v_order.service_id IS NOT NULL THEN
    UPDATE services SET orders_count = orders_count + 1
    WHERE id = v_order.service_id;
  END IF;

  -- 7. Close the linked job
  IF v_order.job_id IS NOT NULL THEN
    UPDATE jobs SET status = 'completed' WHERE id = v_order.job_id;
  END IF;

  -- 8. Notify freelancer (funds are pending clearance, not yet available)
  INSERT INTO notifications (user_id, type, title, message, link) VALUES (
    v_order.freelancer_id,
    'order_completed',
    'Order Completed! ⏳',
    '₦' || v_order.freelancer_earnings ||
      ' will clear to your wallet in 7 days for: ' || v_order.title,
    '/freelancer/orders/' || p_order_id
  );

  RETURN jsonb_build_object(
    'success',         true,
    'order_id',        p_order_id,
    'amount_clearing', v_order.freelancer_earnings
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Order completion failed: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_update_conversation_last_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();

CREATE POLICY "Participants can update own conversations"
ON public.conversations FOR UPDATE
USING ((participant_1 = auth.uid()) OR (participant_2 = auth.uid()));

-- product_orders: drop and re-add with CASCADE
ALTER TABLE public.product_orders
  DROP CONSTRAINT IF EXISTS product_orders_product_id_fkey,
  DROP CONSTRAINT IF EXISTS product_orders_buyer_id_fkey,
  DROP CONSTRAINT IF EXISTS product_orders_seller_id_fkey;

ALTER TABLE public.product_orders
  ADD CONSTRAINT product_orders_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  ADD CONSTRAINT product_orders_buyer_id_fkey
    FOREIGN KEY (buyer_id)   REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT product_orders_seller_id_fkey
    FOREIGN KEY (seller_id)  REFERENCES public.profiles(id) ON DELETE CASCADE;

-- product_reviews: cascade from order and product
ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_order_id_fkey,
  DROP CONSTRAINT IF EXISTS product_reviews_product_id_fkey,
  DROP CONSTRAINT IF EXISTS product_reviews_buyer_id_fkey;

ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_order_id_fkey
    FOREIGN KEY (order_id)   REFERENCES public.product_orders(id) ON DELETE CASCADE,
  ADD CONSTRAINT product_reviews_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id)       ON DELETE CASCADE,
  ADD CONSTRAINT product_reviews_buyer_id_fkey
    FOREIGN KEY (buyer_id)   REFERENCES public.profiles(id)       ON DELETE CASCADE;

    -- ────────────────────────────────────────────────────────────
-- SECTION 2: updated_at triggers
-- ────────────────────────────────────────────────────────────

CREATE TRIGGER update_product_orders_updated_at
  BEFORE UPDATE ON public.product_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ────────────────────────────────────────────────────────────
-- SECTION 3: product_reviews → recalculate products.rating
-- The existing recalculate_product_rating() function reads from
-- marketplace_reviews. We need a parallel function that reads
-- from product_reviews instead.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalculate_product_rating_from_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_product_id uuid;
BEGIN
  v_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;

  UPDATE public.products
  SET
    reviews_count = (
      SELECT COUNT(*)
      FROM   public.product_reviews
      WHERE  product_id = v_product_id
    ),
    rating = COALESCE(
      (
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM   public.product_reviews
        WHERE  product_id = v_product_id
      ),
      0
    )
  WHERE id = v_product_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$func$;

CREATE TRIGGER trg_recalculate_product_rating_from_reviews
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_product_rating_from_reviews();


-- ────────────────────────────────────────────────────────────
-- SECTION 4: order_number sequence for product_orders
-- Re-use the existing order_number_seq from orders, or create
-- a dedicated one. Using dedicated to avoid cross-table collisions.
-- ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS product_order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_product_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.order_number := 'PO-'
    || TO_CHAR(NOW(), 'YYYYMMDD')
    || '-'
    || LPAD(NEXTVAL('product_order_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$func$;

CREATE TRIGGER set_product_order_number
  BEFORE INSERT ON public.product_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_product_order_number();


-- ────────────────────────────────────────────────────────────
-- SECTION 5: RLS policies — product_orders
-- Pattern mirrors marketplace_orders exactly.
-- ────────────────────────────────────────────────────────────

-- Buyers can place orders
CREATE POLICY "Buyers can create product orders"
ON public.product_orders
FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

-- Buyers can view their own orders
CREATE POLICY "Buyers can view their product orders"
ON public.product_orders
FOR SELECT
USING (auth.uid() = buyer_id);

-- Sellers can view orders for their products
CREATE POLICY "Sellers can view product orders for their listings"
ON public.product_orders
FOR SELECT
USING (auth.uid() = seller_id);

-- Sellers can update order status (confirm, ship, etc.)
CREATE POLICY "Sellers can update product orders"
ON public.product_orders
FOR UPDATE
USING (auth.uid() = seller_id);

-- Buyers can cancel orders in early statuses
CREATE POLICY "Buyers can cancel pending product orders"
ON public.product_orders
FOR UPDATE
USING (
  auth.uid() = buyer_id
  AND status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text])
);

-- Admins can see everything
CREATE POLICY "Admins can manage all product orders"
ON public.product_orders
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- ────────────────────────────────────────────────────────────
-- SECTION 6: RLS policies — product_reviews
-- Pattern mirrors marketplace_reviews exactly.
-- ────────────────────────────────────────────────────────────

-- Anyone can read reviews (public trust signal)
CREATE POLICY "Anyone can view product reviews"
ON public.product_reviews
FOR SELECT
USING (true);

-- Only verified buyers (order exists + delivered) can write a review
CREATE POLICY "Buyers can create reviews for delivered orders"
ON public.product_reviews
FOR INSERT
WITH CHECK (
  auth.uid() = buyer_id
  AND EXISTS (
    SELECT 1 FROM public.product_orders po
    WHERE po.id        = product_reviews.order_id
      AND po.buyer_id  = auth.uid()
      AND po.status    = 'delivered'
  )
);

-- Reviewers can update their own review
CREATE POLICY "Buyers can update their own product reviews"
ON public.product_reviews
FOR UPDATE
USING (auth.uid() = buyer_id);

-- Reviewers can delete their own review
CREATE POLICY "Buyers can delete their own product reviews"
ON public.product_reviews
FOR DELETE
USING (auth.uid() = buyer_id);

-- Admins
CREATE POLICY "Admins can manage all product reviews"
ON public.product_reviews
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);


-- ────────────────────────────────────────────────────────────
-- SECTION 7: UNIQUE constraint — one review per order
-- Prevents duplicate reviews for the same product order.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_order_id_key UNIQUE (order_id);


-- ────────────────────────────────────────────────────────────
-- SECTION 8: trust score trigger for product reviews
-- Mirrors the trigger on the freelancer reviews table.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_product_review_trust_score()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
DECLARE
  v_seller_id uuid;
BEGIN
  -- Get the seller of the ordered product
  SELECT seller_id INTO v_seller_id
  FROM public.product_orders
  WHERE id = NEW.order_id;

  IF v_seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.rating >= 4 THEN
    PERFORM add_trust_score_event(
      v_seller_id,
      'positive_product_review',
      2,
      'product_review',
      NEW.id,
      'Received ' || NEW.rating || '-star product review'
    );
  ELSIF NEW.rating <= 2 THEN
    PERFORM add_trust_score_event(
      v_seller_id,
      'negative_product_review',
      -3,
      'product_review',
      NEW.id,
      'Received ' || NEW.rating || '-star product review'
    );
  END IF;

  RETURN NEW;
END;
$func$;

CREATE TRIGGER product_review_trust_score
  AFTER INSERT ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_product_review_trust_score();


-- ────────────────────────────────────────────────────────────
-- SECTION 9: Verification query
-- Run after applying to confirm everything is wired correctly.
-- ────────────────────────────────────────────────────────────

DO $verify$
DECLARE
  v_po_policies  int;
  v_pr_policies  int;
  v_po_triggers  int;
  v_pr_triggers  int;
BEGIN
  SELECT COUNT(*) INTO v_po_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'product_orders';

  SELECT COUNT(*) INTO v_pr_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'product_reviews';

  SELECT COUNT(*) INTO v_po_triggers FROM information_schema.triggers
  WHERE event_object_schema = 'public' AND event_object_table = 'product_orders';

  SELECT COUNT(*) INTO v_pr_triggers FROM information_schema.triggers
  WHERE event_object_schema = 'public' AND event_object_table = 'product_reviews';

  RAISE NOTICE 'product_orders  → policies: %, triggers: %', v_po_policies, v_po_triggers;
  RAISE NOTICE 'product_reviews → policies: %, triggers: %', v_pr_policies, v_pr_triggers;

  IF v_po_policies < 5 THEN
    RAISE WARNING 'product_orders may be missing policies (expected ≥5, got %)', v_po_policies;
  END IF;
  IF v_pr_policies < 4 THEN
    RAISE WARNING 'product_reviews may be missing policies (expected ≥4, got %)', v_pr_policies;
  END IF;
END;
$verify$;


-- ────────────────────────────────────────────────────────────
-- SECTION 1: FK CASCADE fixes
-- All 6 FKs were NO ACTION — change to CASCADE so that deleting
-- a product or profile cleans up orders and reviews automatically.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.product_orders
  DROP CONSTRAINT IF EXISTS product_orders_product_id_fkey,
  DROP CONSTRAINT IF EXISTS product_orders_buyer_id_fkey,
  DROP CONSTRAINT IF EXISTS product_orders_seller_id_fkey;

ALTER TABLE public.product_orders
  ADD CONSTRAINT product_orders_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id)  ON DELETE CASCADE,
  ADD CONSTRAINT product_orders_buyer_id_fkey
    FOREIGN KEY (buyer_id)   REFERENCES public.profiles(id)  ON DELETE CASCADE,
  ADD CONSTRAINT product_orders_seller_id_fkey
    FOREIGN KEY (seller_id)  REFERENCES public.profiles(id)  ON DELETE CASCADE;

ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_order_id_fkey,
  DROP CONSTRAINT IF EXISTS product_reviews_product_id_fkey,
  DROP CONSTRAINT IF EXISTS product_reviews_buyer_id_fkey;

ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_order_id_fkey
    FOREIGN KEY (order_id)   REFERENCES public.product_orders(id) ON DELETE CASCADE,
  ADD CONSTRAINT product_reviews_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id)       ON DELETE CASCADE,
  ADD CONSTRAINT product_reviews_buyer_id_fkey
    FOREIGN KEY (buyer_id)   REFERENCES public.profiles(id)       ON DELETE CASCADE;

DROP TRIGGER IF EXISTS update_product_orders_updated_at ON public.product_orders;

CREATE TRIGGER update_product_orders_updated_at
  BEFORE UPDATE ON public.product_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  CREATE OR REPLACE FUNCTION public.recalculate_product_rating_from_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_product_id uuid;
BEGIN
  v_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;

  UPDATE public.products
  SET
    reviews_count = (
      SELECT COUNT(*)
      FROM   public.product_reviews
      WHERE  product_id     = v_product_id
        AND  product_rating IS NOT NULL
    ),
    rating = COALESCE(
      (
        SELECT ROUND(AVG(product_rating)::numeric, 2)
        FROM   public.product_reviews
        WHERE  product_id     = v_product_id
          AND  product_rating IS NOT NULL
      ),
      0
    )
  WHERE id = v_product_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$func$;

DROP TRIGGER IF EXISTS trg_recalculate_product_rating_from_reviews ON public.product_reviews;

CREATE TRIGGER trg_recalculate_product_rating_from_reviews
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_product_rating_from_reviews();

  CREATE SEQUENCE IF NOT EXISTS product_order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_product_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.order_number := 'PO-'
    || TO_CHAR(NOW(), 'YYYYMMDD')
    || '-'
    || LPAD(NEXTVAL('product_order_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS set_product_order_number ON public.product_orders;

CREATE TRIGGER set_product_order_number
  BEFORE INSERT ON public.product_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_product_order_number();

  -- ────────────────────────────────────────────────────────────
-- SECTION 7: One review per order (UNIQUE)
-- Prevents a buyer from submitting multiple reviews for the
-- same product_order. Only add if it doesn't already exist.
-- ────────────────────────────────────────────────────────────

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_reviews_order_id_key'
      AND conrelid = 'public.product_reviews'::regclass
  ) THEN
    ALTER TABLE public.product_reviews
      ADD CONSTRAINT product_reviews_order_id_key UNIQUE (order_id);
    RAISE NOTICE 'Added UNIQUE constraint product_reviews_order_id_key';
  ELSE
    RAISE NOTICE 'UNIQUE constraint product_reviews_order_id_key already exists — skipped';
  END IF;
END;
$verify$;

-- ────────────────────────────────────────────────────────────
-- SECTION 9: is_verified_purchase auto-set on INSERT
-- Sets is_verified_purchase = true automatically when the
-- linked product_order exists and belongs to the buyer,
-- so the app never has to set this manually.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_verified_purchase_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.is_verified_purchase := EXISTS (
    SELECT 1
    FROM public.product_orders po
    WHERE po.id       = NEW.order_id
      AND po.buyer_id = NEW.buyer_id
      AND po.status   = 'delivered'
  );
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_set_verified_purchase
  BEFORE INSERT ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION set_verified_purchase_flag();

  -- ────────────────────────────────────────────────────────────
-- SECTION 10: Verification
-- Run after applying — confirms expected policy and trigger counts.
-- ────────────────────────────────────────────────────────────

DO $verify$
DECLARE
  v_po_policies  int;
  v_pr_policies  int;
  v_po_triggers  int;
  v_pr_triggers  int;
BEGIN
  SELECT COUNT(*) INTO v_po_policies FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_orders';
  SELECT COUNT(*) INTO v_pr_policies FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_reviews';
  SELECT COUNT(*) INTO v_po_triggers FROM information_schema.triggers
    WHERE event_object_schema = 'public' AND event_object_table = 'product_orders';
  SELECT COUNT(*) INTO v_pr_triggers FROM information_schema.triggers
    WHERE event_object_schema = 'public' AND event_object_table = 'product_reviews';

  RAISE NOTICE 'product_orders  → policies: % (expected 6), triggers: % (expected 1)', v_po_policies, v_po_triggers;
  RAISE NOTICE 'product_reviews → policies: % (expected 5), triggers: % (expected 3)', v_pr_policies, v_pr_triggers;

  IF v_po_policies < 6 THEN
    RAISE WARNING 'product_orders missing policies — check for errors above';
  END IF;
  IF v_pr_policies < 5 THEN
    RAISE WARNING 'product_reviews missing policies — check for errors above';
  END IF;
END;
$verify$;

CREATE OR REPLACE FUNCTION public.trigger_product_review_trust_score()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
DECLARE
  v_seller_id uuid;
BEGIN
  SELECT seller_id INTO v_seller_id
  FROM public.product_orders
  WHERE id = NEW.order_id;

  IF v_seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.product_rating >= 4 THEN
    PERFORM add_trust_score_event(
      v_seller_id,
      'positive_product_review',
      2,
      'product_review',
      NEW.id,
      'Received ' || NEW.product_rating || '-star product review'
    );
  ELSIF NEW.product_rating <= 2 THEN
    PERFORM add_trust_score_event(
      v_seller_id,
      'negative_product_review',
      -3,
      'product_review',
      NEW.id,
      'Received ' || NEW.product_rating || '-star product review'
    );
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS trg_recalculate_product_rating ON public.marketplace_reviews;

-- The recalculate_product_rating() function (marketplace variant) is now orphaned.
-- Drop it to avoid confusion. The correct function is
-- recalculate_product_rating_from_reviews() which remains.
DROP FUNCTION IF EXISTS public.recalculate_product_rating();

-- Step 1: add cleared_at to orders for per-order tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cleared_at timestamp with time zone;

-- Step 2: replace the function with a per-order scoped version
CREATE OR REPLACE FUNCTION public.process_pending_clearances()
RETURNS TABLE(processed_count integer)
LANGUAGE plpgsql
AS $body$
DECLARE
  v_count INT := 0;
  v_rec   RECORD;
BEGIN
  -- For each freelancer, sum only the earnings from orders that:
  --   (a) are completed
  --   (b) have not yet been cleared (cleared_at IS NULL)
  --   (c) completed more than 7 days ago (updated_at is set by trigger on status change)
  FOR v_rec IN
    SELECT
      freelancer_id,
      SUM(freelancer_earnings) AS clearable_amount
    FROM public.orders
    WHERE status      = 'completed'
      AND cleared_at  IS NULL
      AND updated_at  < NOW() - INTERVAL '7 days'
    GROUP BY freelancer_id
  LOOP
    -- Move that exact amount from pending_clearance to balance
    UPDATE public.wallets
    SET
      balance           = balance + v_rec.clearable_amount,
      pending_clearance = GREATEST(0, pending_clearance - v_rec.clearable_amount),
      updated_at        = NOW()
    WHERE user_id = v_rec.freelancer_id;

    -- Mark those orders as cleared so they are never double-released
    UPDATE public.orders
    SET cleared_at = NOW()
    WHERE freelancer_id = v_rec.freelancer_id
      AND status        = 'completed'
      AND cleared_at    IS NULL
      AND updated_at    < NOW() - INTERVAL '7 days';

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$body$;

-- Step 1: add a default so existing INSERT paths are safe immediately
ALTER TABLE public.profiles
  ALTER COLUMN trust_level SET DEFAULT 'new';

-- Step 2: backfill any existing NULLs
UPDATE public.profiles
SET trust_level = 'new'
WHERE trust_level IS NULL;

-- Step 3: extend the trigger to also fire on INSERT
DROP TRIGGER IF EXISTS update_profile_trust_level ON public.profiles;

CREATE TRIGGER update_profile_trust_level
  BEFORE INSERT OR UPDATE OF trust_score
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_trust_level();
-- update_trust_level() already exists and returns NEW with trust_level set

CREATE OR REPLACE FUNCTION public.decrement_job_proposals_count()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
BEGIN
  -- Hard DELETE
  IF TG_OP = 'DELETE' THEN
    UPDATE public.jobs
    SET proposals_count = GREATEST(0, proposals_count - 1)
    WHERE id = OLD.job_id;
    RETURN OLD;
  END IF;

  -- Status transition into withdrawn or cancelled
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status NOT IN ('withdrawn', 'cancelled')
       AND NEW.status IN ('withdrawn', 'cancelled') THEN
      UPDATE public.jobs
      SET proposals_count = GREATEST(0, proposals_count - 1)
      WHERE id = NEW.job_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS sync_proposals_count_decrement ON public.proposals;

CREATE TRIGGER sync_proposals_count_decrement
  AFTER DELETE OR UPDATE OF status
  ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION decrement_job_proposals_count();

CREATE OR REPLACE FUNCTION public.reverse_admin_action(
  p_log_id        uuid,
  p_ticket_id     uuid    DEFAULT NULL,
  p_reversed_by   uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  v_log RECORD;
BEGIN
  -- Load and validate the action log
  SELECT * INTO v_log
  FROM public.admin_action_logs
  WHERE id = p_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reverse_admin_action: log % not found', p_log_id;
  END IF;

  IF v_log.is_reversed THEN
    RAISE EXCEPTION 'reverse_admin_action: action % has already been reversed', p_log_id;
  END IF;

  IF v_log.reversible_until IS NOT NULL AND v_log.reversible_until < NOW() THEN
    RAISE EXCEPTION 'reverse_admin_action: reversal window for action % expired at %',
      p_log_id, v_log.reversible_until;
  END IF;

  -- Mark the action as reversed
  UPDATE public.admin_action_logs
  SET is_reversed = true
  WHERE id = p_log_id;

  -- Update the linked contest ticket if provided
  IF p_ticket_id IS NOT NULL THEN
    UPDATE public.contest_tickets
    SET
      status      = 'reversed',
      reviewed_by = p_reversed_by,
      updated_at  = NOW()
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
      RAISE WARNING 'reverse_admin_action: ticket % not found — log marked reversed anyway', p_ticket_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'log_id',         p_log_id,
    'action_type',    v_log.action_type,
    'target_user_id', v_log.target_user_id,
    'ticket_updated', p_ticket_id IS NOT NULL
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'reverse_admin_action failed: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$body$;

CREATE OR REPLACE FUNCTION public.validate_withdrawal_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  v_balance numeric;
BEGIN
  -- Fetch current spendable balance
  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'validate_withdrawal_balance: no wallet found for user %', NEW.user_id;
  END IF;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'validate_withdrawal_balance: withdrawal amount must be positive (got ₦%)', NEW.amount;
  END IF;

  IF NEW.amount > v_balance THEN
    RAISE EXCEPTION
      'validate_withdrawal_balance: insufficient balance — wallet has ₦% but withdrawal requests ₦%',
      v_balance, NEW.amount;
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS guard_withdrawal_balance ON public.withdrawals;

CREATE TRIGGER guard_withdrawal_balance
  BEFORE INSERT
  ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION validate_withdrawal_balance();

  DO $verify$
DECLARE
  v_col_exists    boolean;
  v_trig_exists   boolean;
  v_fn_exists     boolean;
BEGIN
  -- M-3: orders.cleared_at column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'cleared_at'
  ) INTO v_col_exists;
  ASSERT v_col_exists, 'FAIL: orders.cleared_at missing';

  -- M-5: profiles.trust_level default
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'trust_level' AND column_default IS NOT NULL
  ) INTO v_col_exists;
  ASSERT v_col_exists, 'FAIL: profiles.trust_level default missing';

  -- L-2: set_user_location_last_updated trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'user_locations' AND t.tgname = 'set_user_location_last_updated'
  ) INTO v_trig_exists;
  ASSERT v_trig_exists, 'FAIL: set_user_location_last_updated trigger missing';

  -- L-3: sync_proposals_count_decrement trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'proposals' AND t.tgname = 'sync_proposals_count_decrement'
  ) INTO v_trig_exists;
  ASSERT v_trig_exists, 'FAIL: sync_proposals_count_decrement trigger missing';

  -- L-4: reverse_admin_action function
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reverse_admin_action'
  ) INTO v_fn_exists;
  ASSERT v_fn_exists, 'FAIL: reverse_admin_action function missing';

  -- L-5: guard_withdrawal_balance trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'withdrawals' AND t.tgname = 'guard_withdrawal_balance'
  ) INTO v_trig_exists;
  ASSERT v_trig_exists, 'FAIL: guard_withdrawal_balance trigger missing';

  RAISE NOTICE 'All batch-2 checks passed.';
END;
$verify$;

-- Function: fires after a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone_number,
    user_type,
    university,
    location,
    account_status,
    trust_score,
    trust_level,
    identity_verified,
    student_verified,
    liveness_verified
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'user_type',
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'location',
    'active',
    0,
    'new',
    false,
    false,
    false
  );

  -- Create wallet for freelancers and 'both'
  IF (NEW.raw_user_meta_data->>'user_type') IN ('freelancer', 'both') THEN
    INSERT INTO public.wallets (
      user_id,
      balance,
      pending_clearance
    ) VALUES (
      NEW.id,
      0,
      0
    );
  END IF;

  RETURN NEW;
END;
$func$;

-- Trigger: attach to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

  ALTER TABLE transactions ADD COLUMN marketplace_order_id UUID REFERENCES marketplace_orders(id) ON DELETE CASCADE;
ALTER TABLE escrow ADD COLUMN marketplace_order_id UUID REFERENCES marketplace_orders(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.process_marketplace_payment(
  p_transaction_id uuid,
  p_order_id uuid,
  p_flw_tx_id text,
  p_amount numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order RECORD;
BEGIN
  UPDATE transactions SET status = 'successful', flutterwave_tx_ref = p_flw_tx_id, paid_at = NOW() WHERE id = p_transaction_id;
  SELECT * INTO v_order FROM marketplace_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Marketplace order not found'; END IF;
  
  UPDATE marketplace_orders SET status = 'confirmed', paid_at = NOW() WHERE id = p_order_id;
  INSERT INTO escrow (marketplace_order_id, transaction_id, amount, status) VALUES (p_order_id, p_transaction_id, p_amount, 'held');

  INSERT INTO notifications (user_id, type, title, message, link) VALUES
    (v_order.seller_id, 'new_marketplace_order', 'New Order Received! 🎉', 'Payment confirmed for your product.', '/marketplace/orders/' || p_order_id),
    (v_order.buyer_id, 'payment_success', 'Payment Successful ✓', 'Your payment is secured in escrow.', '/marketplace/orders/' || p_order_id);

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', 'confirmed');
END;
$$;


ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
 
-- Optional: index for the cron query performance
-- (filters on order_id IS NULL AND marketplace_order_id IS NULL AND recipient_user_id IS NOT NULL)
CREATE INDEX IF NOT EXISTS idx_transactions_recipient_unlinked
  ON public.transactions (recipient_user_id)
  WHERE order_id IS NULL AND marketplace_order_id IS NULL;


  ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS posting_suspended_until TIMESTAMPTZ DEFAULT NULL;
 
COMMENT ON COLUMN public.profiles.posting_suspended_until IS
  'When set and in the future, the user cannot create new service or product listings. '
  'Cleared automatically once the timestamp passes. Set to NOW()+72h after 3 consecutive '
  '1-star marketplace reviews. Does NOT affect account login or existing listings.';

  -- Migration: seed automation threshold rows into platform_config
-- Apply this before deploying the updated cron and earnings page.
-- ON CONFLICT DO NOTHING is safe to re-run — existing customised values
-- are never overwritten.

INSERT INTO public.platform_config (key, value, enabled, description) VALUES

  -- Cron: dispute auto-resolution
  -- How many days of inactivity before an open dispute is automatically
  -- resolved in the buyer's favour and escrow is refunded.
  ('dispute_auto_resolve_days',        7,   true,
   'Days of dispute inactivity before auto-resolution in buyer favour.'),

  -- Cron: frequent disputer window
  -- Rolling window (days) used to count how many disputes a user has raised.
  -- Users who hit 3+ disputes within this window receive a Level 1 advisory
  -- and a -15 trust score event.
  ('frequent_disputer_window_days',    30,  true,
   'Rolling window (days) for counting a user''s dispute count. 3+ = Level 1 advisory.'),

  -- Cron: unlinked transaction fraud check
  -- Lookback window (hours) when scanning for wallet credits that have no
  -- linked order_id or marketplace_order_id. 5+ unique external senders
  -- within this window triggers auto-suspension.
  ('unlinked_tx_window_hours',         24,  true,
   'Lookback window (hours) for unlinked transaction fraud check. 5+ unique senders = suspend.'),

  -- Earnings: wallet-funding hold
  -- If a freelancer''s wallet was funded within this many hours AND they
  -- have zero completed orders, their withdrawal is held for 24 hours.
  ('wallet_fund_hold_hours',           2,   true,
   'Hours after wallet funding that triggers a 24h withdrawal hold for accounts with no completed orders.'),

  -- Earnings: bank-details-change hold
  -- If bank details were configured/changed within this many hours AND the
  -- freelancer has zero completed orders, the withdrawal is held for 24 hours.
  ('bank_update_hold_hours',           48,  true,
   'Hours after bank details update that triggers a 24h withdrawal hold for accounts with no completed orders.')

ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS scheduled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'both';

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at
  ON public.notifications (scheduled_at)
  WHERE scheduled_at IS NOT NULL;


  -- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add suspended_until to profiles + lift_expired_suspensions()
-- Purpose : Support timed suspensions, enforce moderator 30-day cap,
--           and auto-lift suspensions when the deadline passes.
-- Safe    : All operations are additive or REPLACE — no data is destroyed.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Column ─────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.suspended_until IS
  'Null = indefinite suspension (admin only). Populated by suspendUser server action. '
  'Moderators are capped at 30 days server-side. Cleared automatically by the '
  'lift_expired_suspensions() cron function when now() > suspended_until.';

-- ── 2. Partial index — makes the cron lift query fast ─────────────────────────
--
-- Only indexes rows that are suspended with a finite deadline.
-- At steady state this index will be tiny (only currently-suspended timed users).

CREATE INDEX IF NOT EXISTS idx_profiles_suspended_until
  ON public.profiles (suspended_until)
  WHERE suspended_until IS NOT NULL;

-- ── 3. lift_expired_suspensions() — SECURITY DEFINER ─────────────────────────
--
-- Called by the POST /api/admin/automation/cron route as Rule 0.
-- Can also be invoked manually from the Supabase SQL editor:
--   SELECT * FROM lift_expired_suspensions();
--
-- Returns a table of lifted user_ids so the cron can log them individually.
--
-- Why SECURITY DEFINER?
--   profiles has RLS enabled. The cron calls this via the service-role client
--   (which already bypasses RLS), but keeping it SECURITY DEFINER makes it
--   safe to call from restricted contexts too (e.g. pg_cron, edge functions).
--
-- What it does:
--   1. Finds all profiles with account_status='suspended' AND
--      suspended_until IS NOT NULL AND suspended_until <= now().
--   2. Sets account_status='active', clears suspended_until and
--      suspension_reason so the profile is clean for the next admin action.
--   3. Returns the lifted user_ids. Notifications and audit logs are written
--      by the cron caller in TypeScript so they can be batched efficiently.

CREATE OR REPLACE FUNCTION public.lift_expired_suspensions()
RETURNS TABLE (lifted_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  RETURN QUERY
  UPDATE public.profiles
  SET
    account_status    = 'active',
    suspended_until   = NULL,
    suspension_reason = NULL,
    updated_at        = now()
  WHERE
    account_status  = 'suspended'
    AND suspended_until IS NOT NULL
    AND suspended_until <= now()
  RETURNING id;
END;
$func$;

COMMENT ON FUNCTION public.lift_expired_suspensions() IS
  'Clears expired timed suspensions. Called by the automation cron (Rule 0). '
  'Can also be run manually: SELECT * FROM lift_expired_suspensions();';

-- ── 4. Revoke public execute — only service role / postgres should call this ──

REVOKE EXECUTE ON FUNCTION public.lift_expired_suspensions() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lift_expired_suspensions() TO service_role;


-- ============================================================================
-- F9 — Admin Unblockable Status
-- Prevents suspension, banning, freezing, or trust score manipulation on
-- any profile where user_type = 'admin'.
-- Also adds the missing admin UPDATE policy on profiles (without which the
-- suspend/ban/freeze server actions silently failed for all targets via RLS).
-- ============================================================================

-- ── 1. Admin UPDATE policy (was missing — actions silently failed) ───────────
-- Allows the authenticated admin to update any profile row.
-- The guard trigger below (step 2) enforces the "unblockable" constraint
-- so we don't need to bake it into RLS WITH CHECK.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Admin can update user profiles'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Admin can update user profiles"
      ON public.profiles
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.user_type = 'admin'
        )
      )
    $pol$;
  END IF;
END;
$do$;


-- ── 2. Trigger function: block status changes on admin profiles ──────────────
CREATE OR REPLACE FUNCTION public.guard_admin_account_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Target row is an admin profile — block any attempt to alter
  -- account_status, suspension_reason, or suspended_until.
  IF OLD.user_type = 'admin' AND (
       NEW.account_status    IS DISTINCT FROM OLD.account_status    OR
       NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason OR
       NEW.suspended_until   IS DISTINCT FROM OLD.suspended_until
  ) THEN
    RAISE EXCEPTION
      'F9: Admin accounts are unblockable. account_status cannot be modified on admin profiles.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$func$;


-- ── 3. Attach trigger to profiles (BEFORE UPDATE, every row) ─────────────────
DROP TRIGGER IF EXISTS guard_admin_account_status ON public.profiles;

CREATE TRIGGER guard_admin_account_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_admin_account_status();



  -- migration_platform_config_consecutive_rating_suspension.sql
-- Adds two new admin-configurable thresholds for the consecutive low-rating
-- posting suspension rule implemented in api/marketplace/reviews/route.ts.
--
-- consecutive_low_rating_threshold:
--   Number of consecutive 1-star marketplace reviews required to trigger
--   a posting suspension on the seller. Default: 3.
--
-- posting_suspension_hours:
--   Duration of the posting suspension in hours. Default: 72.
--
-- ON CONFLICT DO NOTHING: safe to re-run; existing values are not overwritten.

INSERT INTO platform_config (key, value, enabled, description)
VALUES
  (
    'consecutive_low_rating_threshold',
    3,
    true,
    'Number of consecutive 1-star marketplace reviews required to trigger a posting suspension on the seller.'
  ),
  (
    'posting_suspension_hours',
    72,
    true,
    'Duration in hours of the posting suspension applied after consecutive 1-star reviews.'
  )
ON CONFLICT (key) DO NOTHING;


-- migration_platform_config_high_value_listing_hold.sql
-- Adds two new admin-configurable thresholds for the high-value new account
-- listing hold rule implemented in src/lib/trust/automation.ts.
--
-- high_value_listing_threshold:
--   Listing price (in Naira) above which a new-account hold is triggered.
--   Default: 100000 (₦100,000).
--
-- new_account_hold_days:
--   Account age window (in days) within which high-value listings are held
--   for admin review. Default: 7.
--
-- ON CONFLICT DO NOTHING: safe to re-run; existing values are not overwritten.

INSERT INTO platform_config (key, value, enabled, description)
VALUES
  (
    'high_value_listing_threshold',
    100000,
    true,
    'Listing price in Naira above which a new-account hold is applied pending admin review.'
  ),
  (
    'new_account_hold_days',
    7,
    true,
    'Account age in days within which listings above the high-value threshold are held for admin review.'
  )
ON CONFLICT (key) DO NOTHING;




-- migration_disputes_last_activity_at.sql
--
-- Adds disputes.last_activity_at — the authoritative timestamp for "when was
-- this dispute last active", used by the cron inactivity auto-resolve rule.
--
-- Problem this solves:
--   The cron was filtering on disputes.created_at to find "7-day silent"
--   disputes, but created_at is immutable after INSERT. A dispute with active
--   back-and-forth between both parties would be force-closed after 7 days
--   regardless of ongoing communication — directly violating the spec which
--   requires N days of SILENCE from both parties.
--
-- What resets last_activity_at:
--   1. trg_dispute_last_activity        — any UPDATE to the disputes row itself
--      (status change, evidence upload, resolution note, admin action).
--   2. trg_dispute_activity_on_message  — any new message sent in a
--      conversation whose order_id matches an open dispute's order_id.
--
-- Backfill:
--   Existing disputes are initialised to created_at so no row is ever NULL
--   and the cron filter works correctly from the moment the migration runs.

-- ── 1. Add column ─────────────────────────────────────────────────────────────
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- ── 2. Backfill existing rows ─────────────────────────────────────────────────
UPDATE disputes
SET last_activity_at = created_at
WHERE last_activity_at IS NULL;

-- ── 3. Apply NOT NULL + default after backfill ────────────────────────────────
ALTER TABLE disputes
  ALTER COLUMN last_activity_at SET NOT NULL,
  ALTER COLUMN last_activity_at SET DEFAULT NOW();

-- ── 4. Trigger function: reset on any dispute row update ──────────────────────
-- Fires BEFORE UPDATE so the new timestamp is written as part of the same
-- transaction that changes the dispute. Covers: status changes, resolution
-- notes, evidence additions, admin manual updates.

CREATE OR REPLACE FUNCTION reset_dispute_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_last_activity ON disputes;

CREATE TRIGGER trg_dispute_last_activity
  BEFORE UPDATE ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION reset_dispute_last_activity();

-- ── 5. Trigger function: reset on new message in linked conversation ───────────
-- Fires AFTER INSERT ON messages. Traverses:
--   messages.conversation_id → conversations.order_id → disputes.order_id
-- Only touches disputes with status = 'open' — resolved/closed disputes do
-- not need their activity clock updated.
-- conversation_id is NOT NULL on messages (schema constraint confirmed).
-- conversations.order_id is nullable — the JOIN is therefore INNER so
-- message threads with no linked order produce no dispute update.

CREATE OR REPLACE FUNCTION update_dispute_activity_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE disputes d
  SET    last_activity_at = NOW()
  FROM   conversations c
  WHERE  c.id         = NEW.conversation_id
    AND  c.order_id   IS NOT NULL
    AND  d.order_id   = c.order_id
    AND  d.status     = 'open';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_activity_on_message ON messages;

CREATE TRIGGER trg_dispute_activity_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_dispute_activity_on_message();


  ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS hold_release_at TIMESTAMPTZ;


  -- migrations/20260406_add_wallet_frozen.sql
-- Adds targeted wallet-freeze capability used by cron Rule 3 (suspicious
-- unlinked inflow detection). Freezing the wallet is the spec-correct action;
-- it leaves account_status untouched so the user can still log in and read
-- their suspension notice, but cannot withdraw or transact.
--
-- After running this migration, regenerate TypeScript types:
--   npx supabase gen types typescript --project-id <id> > src/types/database.types.ts

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS is_frozen   boolean                  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at   timestamp with time zone          DEFAULT NULL;

-- Index so the admin finance panel can cheaply query frozen wallets.
CREATE INDEX IF NOT EXISTS wallets_is_frozen_idx ON wallets (is_frozen)
  WHERE is_frozen = true;

COMMENT ON COLUMN wallets.is_frozen  IS 'True when the wallet has been frozen by automated fraud detection or admin action. Withdrawals and outbound transfers must be blocked while this flag is set.';
COMMENT ON COLUMN wallets.frozen_at  IS 'Timestamp when is_frozen was last set to true. NULL when wallet is not frozen.';


-- migrations/20260406_add_notification_dispatched_at.sql
--
-- Adds an idempotency sentinel to the notifications table used by cron Rule 5
-- (scheduled broadcast dispatch).
--
-- WHY THIS COLUMN IS NEEDED:
--   Scheduled notifications are inserted into the notifications table immediately
--   at authoring time with a future scheduled_at value. The in-app bell already
--   filters by scheduled_at <= now(), so in-app delivery (delivery_method='in_app')
--   is self-executing — no cron work needed.
--
--   F9 inbox delivery (delivery_method='inbox' or 'both') requires an actual row
--   insertion into conversations + messages via sendF9SystemMessage(). That cannot
--   happen at scheduling time; it must happen when scheduled_at arrives.
--
--   dispatched_at = NULL → not yet fired by the cron (eligible for dispatch)
--   dispatched_at = <ts> → already fired; cron must never fire again (idempotent)
--
-- SAFE BACKFILL:
--   All existing rows have scheduled_at IS NULL (they were sent immediately) or
--   were already delivered manually. Setting dispatched_at = now() for all
--   pre-existing rows with scheduled_at IS NOT NULL prevents the first cron run
--   after migration from re-firing old messages.
--
-- After running this migration, regenerate TypeScript types:
--   npx supabase gen types typescript --project-id <id> > src/types/database.types.ts

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dispatched_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.notifications.dispatched_at IS
  'Set by the cron Rule 5 after the F9 inbox message has been delivered for a '
  'scheduled notification. NULL = not yet dispatched. Used as an idempotency '
  'sentinel to prevent double-firing.';

-- Safe backfill: mark all already-past scheduled rows as dispatched so the
-- first cron run after migration does not replay them.
UPDATE public.notifications
SET    dispatched_at = now()
WHERE  scheduled_at IS NOT NULL
  AND  scheduled_at <= now()
  AND  dispatched_at IS NULL;


  -- migrations/20260407_add_increment_wallet_balance.sql
--
-- PURPOSE:
--   Provides a safe, single-path way to credit a user's wallet balance
--   from a cron/service-role context without relying on supabase-js v2's
--   inability to perform arithmetic in .update() calls.
--
--   Used exclusively by:
--     src/app/api/admin/automation/cron/route.ts — Rule 1 (escrow refund to buyer)
--
-- DESIGN NOTES:
--   • SECURITY DEFINER — runs as the function owner (postgres), bypassing RLS.
--     This is equivalent to what a service-role client does, but expressed as
--     a DB primitive so the arithmetic is atomic and cannot race with other
--     concurrent balance updates.
--   • Only increments `balance`. Does NOT touch `total_earned` — this is a
--     refund, not income, and must not inflate the seller-side earnings metric.
--   • Raises an exception if no wallet row exists for the given user. A missing
--     wallet is a data integrity problem that must surface loudly, not be
--     silently inserted with a possibly wrong initial state.
--   • Uses named dollar-quote tag $func$ (required by Supabase SQL editor for
--     multi-byte safe parsing).

CREATE OR REPLACE FUNCTION public.increment_wallet_balance(
  p_user_id UUID,
  p_amount  NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION
      'increment_wallet_balance: p_amount must be positive, got %', p_amount;
  END IF;

  UPDATE wallets
  SET
    balance    = balance + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'increment_wallet_balance: No wallet found for user %. Cannot credit ₦%.', 
      p_user_id, p_amount;
  END IF;
END;
$func$;

-- Restrict execution to service role only (cron context).
-- Revoke from public so anon/authenticated callers cannot self-credit.
REVOKE EXECUTE ON FUNCTION public.increment_wallet_balance(UUID, NUMERIC) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.increment_wallet_balance(UUID, NUMERIC) TO service_role;



INSERT INTO platform_config (key, value, enabled, description)
VALUES
  ('shared_ip_check_enabled', 1,  true, 'On/Off toggle for the shared-IP fraud detection rule at registration.'),
  ('shared_ip_min_accounts',  1,  true, 'Minimum number of conflicting accounts required to trigger the shared-IP flag.')
ON CONFLICT (key) DO NOTHING;


-- =============================================================================
-- Migration: 001_monnify_migration.sql
-- Phase 1: Flutterwave → Monnify column renames + marketplace earnings fields
-- Safe to re-run: every statement is wrapped in an existence guard.
-- No data is dropped. Old columns are renamed, not deleted.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- transactions: flutterwave_tx_ref → monnify_payment_ref
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'transactions'
      AND column_name  = 'flutterwave_tx_ref'
  ) THEN
    ALTER TABLE public.transactions
      RENAME COLUMN flutterwave_tx_ref TO monnify_payment_ref;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- transactions: flutterwave_response → monnify_response
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'transactions'
      AND column_name  = 'flutterwave_response'
  ) THEN
    ALTER TABLE public.transactions
      RENAME COLUMN flutterwave_response TO monnify_response;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- withdrawals: flutterwave_transfer_id → monnify_transfer_ref
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'withdrawals'
      AND column_name  = 'flutterwave_transfer_id'
  ) THEN
    ALTER TABLE public.withdrawals
      RENAME COLUMN flutterwave_transfer_id TO monnify_transfer_ref;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- marketplace_orders: ADD platform_fee
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'marketplace_orders'
      AND column_name  = 'platform_fee'
  ) THEN
    ALTER TABLE public.marketplace_orders
      ADD COLUMN platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- marketplace_orders: ADD seller_earnings
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'marketplace_orders'
      AND column_name  = 'seller_earnings'
  ) THEN
    ALTER TABLE public.marketplace_orders
      ADD COLUMN seller_earnings NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;
END;
$$;


INSERT INTO platform_config (key, value, description) VALUES
  ('freelance_fee_percent', 10, 'Platform commission on freelance orders'),
  ('marketplace_fee_percent', 8, 'Platform commission on marketplace orders')
ON CONFLICT (key) DO NOTHING;


