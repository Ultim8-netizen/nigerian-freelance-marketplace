// src/lib/auth/auth-utils.ts
// Authentication helper functions with type safety

import { supabase } from '@/lib/supabase/client';
import { RegisterFormData, LoginFormData, Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

// ============================================================================
// CUSTOM TYPES
// ============================================================================

/**
 * User object with guaranteed non-null ID
 * Use this type after type guards confirm the user ID is valid
 */
export type UserWithId = User & {
  id: NonNullable<User['id']>;
};

/**
 * Result of user authentication check
 */
export type AuthCheckResult =
  | { authenticated: true; user: UserWithId }
  | { authenticated: false; user: null };

// ============================================================================
// TYPE GUARDS - Use these to safely narrow user.id from string | null to string
// ============================================================================

/**
 * Check if user exists and has a valid ID
 * This is a type guard that narrows type from User | null to UserWithId
 * 
 * @example
 * const { data: { user } } = await supabase.auth.getUser();
 * if (hasUserId(user)) {
 *   // user.id is definitely a string here
 *   const profile = await db.from('profiles').eq('id', user.id).single();
 * }
 */
export function hasUserId(
  user: User | null | undefined
): user is UserWithId {
  return Boolean(user?.id);
}

/**
 * Check if user exists (regardless of ID validity)
 * 
 * @param user - User object from Supabase auth
 * @returns true if user is not null/undefined
 */
export function isAuthenticated(
  user: User | null | undefined
): user is User {
  return user !== null && user !== undefined;
}

/**
 * Check if user has a specific property with non-null value
 * 
 * @param user - User object from Supabase auth
 * @param property - Property name to check
 * @returns true if user exists and property is not null/undefined
 */
export function hasUserProperty<K extends keyof User>(
  user: User | null | undefined,
  property: K
): user is User & { [key in K]-?: NonNullable<User[K]> } {
  return (
    user !== null &&
    user !== undefined &&
    user[property] !== null &&
    user[property] !== undefined
  );
}

// ============================================================================
// ASSERTION HELPERS - Use when user ID is REQUIRED
// ============================================================================

/**
 * Assert that user exists and has a valid ID
 * Throws if either is missing. Use when user ID is required.
 * 
 * After calling this, TypeScript knows user is UserWithId
 * 
 * @param user - User object from Supabase auth
 * @throws Error if user or user.id is missing
 * 
 * @example
 * const { data: { user } } = await supabase.auth.getUser();
 * try {
 *   requireUserId(user);
 *   // user.id is definitely a string now
 *   const profile = await getProfile(user.id);
 * } catch (error) {
 *   redirect('/login');
 * }
 */
export function requireUserId(
  user: User | null | undefined,
  message?: string
): asserts user is UserWithId {
  if (!user) {
    throw new Error(message || 'User must be authenticated');
  }
  if (!user.id) {
    throw new Error(message || 'User ID is required but missing');
  }
}

/**
 * Assert that user is authenticated
 * Throws if user is null/undefined
 * 
 * @param user - User object from Supabase auth
 * @throws Error if user is missing
 */
export function requireAuth(
  user: User | null | undefined,
  message?: string
): asserts user is User {
  if (!user) {
    throw new Error(message || 'Authentication is required');
  }
}

// ============================================================================
// SAFE EXTRACTION HELPERS
// ============================================================================

/**
 * Safely extract user ID or return null
 * Never throws - returns null if user or ID is missing
 * 
 * @param user - User object from Supabase auth
 * @returns User ID as string, or null if not available
 * 
 * @example
 * const userId = getUserId(user);
 * if (userId) {
 *   const profile = await getProfile(userId);
 * }
 */
export function getUserId(user: User | null | undefined): string | null {
  return user?.id ?? null;
}

/**
 * Safely extract email or return null
 * 
 * @param user - User object from Supabase auth
 * @returns User email as string, or null if not available
 */
export function getUserEmail(user: User | null | undefined): string | null {
  return user?.email ?? null;
}

/**
 * Get user metadata or empty object
 * FIXED: Changed Record<string, any> to Record<string, unknown>
 * 
 * @param user - User object from Supabase auth
 * @returns User metadata object, or empty object
 */
export function getUserMetadata(
  user: User | null | undefined
): Record<string, unknown> {
  return user?.user_metadata ?? {};
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate user ID format (UUID v4)
 * 
 * @param userId - User ID to validate
 * @returns true if ID looks like a valid UUID v4
 */
export function isValidUserId(
  userId: string | null | undefined
): userId is string {
  if (!userId) return false;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(userId);
}

/**
 * Validate email format
 * 
 * @param email - Email to validate
 * @returns true if email looks valid
 */
export function isValidEmail(
  email: string | null | undefined
): email is string {
  if (!email) return false;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

// ============================================================================
// COMPLETE AUTH CHECK
// ============================================================================

/**
 * Complete authentication check with detailed result
 * 
 * @param user - User object from Supabase auth
 * @returns Object with authentication status and user data
 * 
 * @example
 * const { data: { user } } = await supabase.auth.getUser();
 * const authCheck = checkAuth(user);
 * 
 * if (authCheck.authenticated) {
 *   const profile = await getProfile(authCheck.user.id);
 * }
 */
export function checkAuth(user: User | null | undefined): AuthCheckResult {
  if (hasUserId(user)) {
    return {
      authenticated: true,
      user,
    };
  }

  return {
    authenticated: false,
    user: null,
  };
}

// ============================================================================
// MAIN AUTH SERVICE CLASS (Existing Methods)
// ============================================================================

/**
 * Main authentication service
 * Handles user registration, login, logout, and profile management
 * 
 * @example
 * // Register
 * const { user } = await AuthService.register({
 *   email: 'user@example.com',
 *   password: 'password123',
 *   full_name: 'John Doe',
 *   user_type: 'client'
 * });
 * 
 * // Login
 * const { user } = await AuthService.login({
 *   email: 'user@example.com',
 *   password: 'password123'
 * });
 * 
 * // Get profile
 * const profile = await AuthService.getProfile();
 */
export class AuthService {
  /**
   * Register a new user with profile creation
   * 
   * @param data - Registration form data
   * @returns Object with user and session
   */
  static async register(data: RegisterFormData) {
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      // 2. Create profile with all required fields
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: data.email,
          full_name: data.full_name,
          phone_number: data.phone_number || null,
          user_type: data.user_type,
          university: data.university || null,
          location: data.location || null,
        });

      if (profileError) throw profileError;

      // 3. Create wallet for freelancers
      if (data.user_type === 'freelancer' || data.user_type === 'both') {
        const { error: walletError } = await supabase
          .from('wallets')
          .insert({
            user_id: authData.user.id,
          });

        if (walletError) console.error('Wallet creation failed:', walletError);
      }

      return { user: authData.user, session: authData.session };
    } catch (error) {
      throw new Error((error as Error).message || 'Registration failed');
    }
  }

  /**
   * Login existing user
   * 
   * @param data - Login form data
   * @returns Object with user and session
   */
  static async login(data: LoginFormData) {
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      return { user: authData.user, session: authData.session };
    } catch (error) {
      throw new Error((error as Error).message || 'Login failed');
    }
  }

  /**
   * Logout current user
   */
  static async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Get current user session
   * 
   * @returns Current session or null if not authenticated
   */
  static async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  }

  /**
   * Get current user profile
   * 
   * @returns User profile or null if not authenticated
   * @throws Error if database query fails
   */
  static async getProfile(): Promise<Profile | null> {
    const session = await this.getSession();
    if (!session?.user) return null;

    // FIXED: Explicit type check for user.id
    if (!session.user.id) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update user profile
   * 
   * @param updates - Partial profile object with fields to update
   * @returns Updated profile data
   * @throws Error if not authenticated or update fails
   */
  static async updateProfile(updates: Partial<Profile>) {
    const session = await this.getSession();
    
    // FIXED: Explicit type check for user.id before using in query
    if (!session?.user || !session.user.id) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Verify phone number
   * 
   * Implementation would integrate with SMS verification service.
   * For now, updates the phone_verified flag.
   * 
   * @throws Error if not authenticated or update fails
   */
  static async verifyPhone() {
    const session = await this.getSession();
    
    // FIXED: Explicit type check for user.id before using in query
    if (!session?.user || !session.user.id) {
      throw new Error('Not authenticated');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ phone_verified: true })
      .eq('id', session.user.id);

    if (error) throw error;
  }

  /**
   * Request password reset email
   * 
   * @param email - User email address
   * @throws Error if password reset email fails to send
   */
  static async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });

    if (error) throw error;
  }

  /**
   * Update user password
   * 
   * @param newPassword - New password to set
   * @throws Error if not authenticated or password update fails
   */
  static async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  }

  /**
   * Helper method: Get current user with guaranteed ID
   * 
   * Combines getSession() with type guard to ensure user.id is defined.
   * Use this when you need the user ID without manual null checks.
   * 
   * @returns User object with guaranteed non-null ID
   * @throws Error if not authenticated
   * 
   * @example
   * const user = await AuthService.getCurrentUser();
   * // user.id is definitely a string here
   * const profile = await getProfile(user.id);
   */
  static async getCurrentUser(): Promise<UserWithId> {
    const session = await this.getSession();
    
    if (!session?.user || !session.user.id) {
      throw new Error('Not authenticated');
    }

    return session.user as UserWithId;
  }

  /**
   * Helper method: Check if user is authenticated
   * 
   * @returns true if user is currently authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return isAuthenticated(session?.user);
  }

  /**
   * Helper method: Get current user ID safely
   * 
   * @returns User ID as string, or null if not authenticated
   * 
   * @example
   * const userId = await AuthService.getUserId();
   * if (userId) {
   *   const profile = await getProfile(userId);
   * }
   */
  static async getUserId(): Promise<string | null> {
    const session = await this.getSession();
    return getUserId(session?.user);
  }
}

// ============================================================================
// TYPE RE-EXPORTS FROM SUPABASE (No duplicate exports)
// ============================================================================

export type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';