// src/lib/verification/youverify.ts
// Server-side Youverify NIN verification service
import 'server-only';

const YOUVERIFY_API_KEY = process.env.YOUVERIFY_API_KEY!;
const YOUVERIFY_BASE_URL = process.env.YOUVERIFY_BASE_URL || 'https://api.youverify.co/v2';
const NIN_VERIFICATION_COST = 150; // ₦150

interface YouverifyNINRequest {
  id: string; // NIN number
  isSubjectConsent: boolean;
  metadata?: {
    user_id: string;
    request_id: string;
  };
}

interface YouverifyNINResponse {
  id: string;
  status: 'approved' | 'declined' | 'pending';
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: string;
  photo?: string;
  ninNumber: string;
  message?: string;
  reference?: string;
}

interface VerificationResult {
  success: boolean;
  status: 'approved' | 'rejected' | 'pending';
  data?: YouverifyNINResponse;
  error?: string;
  youverify_request_id?: string;
}

export class YouverifyService {
  private static async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: any
  ): Promise<T> {
    try {
      const response = await fetch(`${YOUVERIFY_BASE_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${YOUVERIFY_API_KEY}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 
          `Youverify API error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error: any) {
      console.error('Youverify API error:', error);
      throw new Error(error.message || 'Verification service unavailable');
    }
  }

  /**
   * Verify NIN with Youverify
   * Cost: ₦150 per verification
   */
  static async verifyNIN(
    nin: string,
    userId: string,
    requestId: string
  ): Promise<VerificationResult> {
    try {
      // Validate NIN format (11 digits)
      if (!/^\d{11}$/.test(nin)) {
        return {
          success: false,
          status: 'rejected',
          error: 'Invalid NIN format. Must be 11 digits.',
        };
      }

      const payload: YouverifyNINRequest = {
        id: nin,
        isSubjectConsent: true,
        metadata: {
          user_id: userId,
          request_id: requestId,
        },
      };

      const response = await this.makeRequest<YouverifyNINResponse>(
        '/identities/nin',
        'POST',
        payload
      );

      // Youverify returns approved/declined/pending
      const status = response.status === 'approved' 
        ? 'approved' 
        : response.status === 'declined' 
        ? 'rejected' 
        : 'pending';

      return {
        success: status === 'approved',
        status,
        data: response,
        youverify_request_id: response.reference || response.id,
      };
    } catch (error: any) {
      console.error('NIN verification error:', error);
      return {
        success: false,
        status: 'rejected',
        error: error.message || 'Verification failed',
      };
    }
  }

  /**
   * Check verification status by reference ID
   */
  static async checkVerificationStatus(
    referenceId: string
  ): Promise<VerificationResult> {
    try {
      const response = await this.makeRequest<YouverifyNINResponse>(
        `/identities/nin/${referenceId}`,
        'GET'
      );

      const status = response.status === 'approved' 
        ? 'approved' 
        : response.status === 'declined' 
        ? 'rejected' 
        : 'pending';

      return {
        success: status === 'approved',
        status,
        data: response,
        youverify_request_id: referenceId,
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'rejected',
        error: error.message || 'Status check failed',
      };
    }
  }

  /**
   * Get verification cost
   */
  static getVerificationCost(): number {
    return NIN_VERIFICATION_COST;
  }

  /**
   * Validate NIN format without API call
   */
  static validateNINFormat(nin: string): { valid: boolean; error?: string } {
    if (!nin || nin.trim().length === 0) {
      return { valid: false, error: 'NIN is required' };
    }

    // Remove any spaces or dashes
    const cleaned = nin.replace(/[\s-]/g, '');

    if (!/^\d{11}$/.test(cleaned)) {
      return { 
        valid: false, 
        error: 'NIN must be exactly 11 digits' 
      };
    }

    return { valid: true };
  }

  /**
   * Mask NIN for display (show only last 4 digits)
   */
  static maskNIN(nin: string): string {
    if (!nin || nin.length < 4) return '****';
    return '*'.repeat(nin.length - 4) + nin.slice(-4);
  }
}