// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@/lib/validations';
import { AuthService } from '@/lib/auth/auth-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

// ============================================================================
// Development Mode Configuration
// ============================================================================
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * FIX: Removed 'as const' and added explicit typing.
 * This tells TypeScript these are standard strings that match your form's expected shape.
 */
const DEV_CREDENTIALS = {
  email: 'user@example.com',
  password: 'password123',
};

// ============================================================================
// Component
// ============================================================================

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with dev credentials if in development mode
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: isDevelopment ? DEV_CREDENTIALS : { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await AuthService.login(data);
      
      const profile = await AuthService.getProfile();
      
      if (profile?.user_type === 'freelancer') {
        router.push('/freelancer/dashboard');
      } else {
        router.push('/client/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-md p-6 relative">
        {/* Development Mode Indicator */}
        {isDevelopment && (
          <div className="absolute top-4 right-4 px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-full">
            <span className="text-xs font-semibold text-yellow-800">DEV MODE</span>
          </div>
        )}

        <h2 className="text-2xl font-bold mb-6">Welcome Back</h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {isDevelopment && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4 text-sm">
            <p className="font-semibold mb-1">🛠️ Development Mode</p>
            <p>Credentials are pre-filled for quick testing.</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input
              {...register('email')}
              type="email"
              placeholder="your@email.com"
              disabled={isLoading}
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message as string}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <Input
              {...register('password')}
              type="password"
              placeholder="••••••••"
              disabled={isLoading}
              autoComplete="current-password"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message as string}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <p className="text-center mt-6 text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}