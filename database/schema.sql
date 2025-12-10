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

