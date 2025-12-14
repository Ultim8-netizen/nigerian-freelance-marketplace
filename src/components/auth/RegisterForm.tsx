'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { z } from 'zod';

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const { 
    register, 
    handleSubmit, 
    formState: { errors },
    // Removed 'watch' as it was unused, resolving the ESLint error.
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      user_type: 'freelancer',
    }
  });

  const onSubmit = async (data: RegisterFormData, isRetry = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // Provide detailed error message
        const errorMessage = result.error || 
          result.details?.[0]?.message || 
          `Registration failed: ${response.status} ${response.statusText}`;
        
        throw new Error(errorMessage);
      }

      // Success
      router.push('/login?registered=true');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      
      // Retry logic for network errors
      if (!isRetry && retryCount < maxRetries && errorMessage.includes('fetch')) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          onSubmit(data, true);
        }, 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      setError(errorMessage);
      setRetryCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Global styles for form inputs - FIXES WHITE TEXT & AUTOFILL */}
      <style jsx global>{`
        /* Fix white text in inputs */
        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="password"],
        select {
          color: #1f2937 !important; /* gray-800 */
          background-color: #ffffff !important;
        }

        /* Fix autofill background */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px white inset !important;
          -webkit-text-fill-color: #1f2937 !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        /* Fix dropdown/select visibility */
        select {
          color: #1f2937 !important;
          background-color: #ffffff !important;
        }

        select option {
          color: #1f2937 !important;
          background-color: #ffffff !important;
          padding: 8px;
        }

        /* Placeholder text */
        input::placeholder,
        select::placeholder {
          color: #9ca3af !important; /* gray-400 */
        }

        /* Focus states */
        input:focus,
        select:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
      `}</style>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 mb-1">Registration Error</p>
            <p className="text-sm text-red-700">{error}</p>
            {retryCount > 0 && (
              <p className="text-xs text-red-600 mt-2">
                Retry attempt {retryCount} of {maxRetries}...
              </p>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit((data) => onSubmit(data, false))} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <Input
            {...register('full_name')}
            type="text"
            placeholder="John Doe"
            disabled={isLoading}
            className="bg-white text-gray-800 border-gray-300 placeholder:text-gray-400"
          />
          {errors.full_name && (
            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.full_name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address *
          </label>
          <Input
            {...register('email')}
            type="email"
            placeholder="your@email.com"
            disabled={isLoading}
            className="bg-white text-gray-800 border-gray-300 placeholder:text-gray-400"
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number *
          </label>
          <Input
            {...register('phone_number')}
            type="tel"
            placeholder="08012345678"
            disabled={isLoading}
            className="bg-white text-gray-800 border-gray-300 placeholder:text-gray-400"
          />
          {errors.phone_number && (
            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.phone_number.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password *
          </label>
          <Input
            {...register('password')}
            type="password"
            placeholder="Minimum 8 characters"
            disabled={isLoading}
            className="bg-white text-gray-800 border-gray-300 placeholder:text-gray-400"
          />
          {errors.password && (
            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* User Type - FIXED DROPDOWN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            I am a... *
          </label>
          <select
            {...register('user_type')}
            disabled={isLoading}
            className="w-full px-3 py-2 bg-white text-gray-800 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="freelancer" className="text-gray-800 bg-white">
              Freelancer - I want to offer services
            </option>
            <option value="client" className="text-gray-800 bg-white">
              Client - I need services
            </option>
            <option value="both" className="text-gray-800 bg-white">
              Both - Offer and need services
            </option>
          </select>
          {errors.user_type && (
            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.user_type.message}
            </p>
          )}
        </div>

        {/* University (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            University/Institution (Optional)
          </label>
          <Input
            {...register('university')}
            type="text"
            placeholder="e.g., University of Lagos"
            disabled={isLoading}
            className="bg-white text-gray-800 border-gray-300 placeholder:text-gray-400"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location (State) *
          </label>
          <Input
            {...register('location')}
            type="text"
            placeholder="e.g., Lagos"
            disabled={isLoading}
            className="bg-white text-gray-800 border-gray-300 placeholder:text-gray-400"
          />
          {errors.location && (
            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.location.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button 
          type="submit" 
          className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account{retryCount > 0 ? ` (retry ${retryCount})` : ''}...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Create Account
            </>
          )}
        </Button>
      </form>
    </>
  );
}