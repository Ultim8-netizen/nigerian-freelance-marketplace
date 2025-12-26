'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loginSchema } from '@/lib/validations';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox'; // Assuming you have this, otherwise see note below
import { AlertCircle, Loader2, Beaker } from 'lucide-react';

// Infer the type directly from the schema
type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch, // Added to handle checkbox state if needed
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    // FIX: defaultValues must match LoginFormData exactly to satisfy TypeScript
    defaultValues: {
      email: '',
      password: '',
      remember_me: false, 
    }
  });

  // Check for Dev Mode on Mount
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setIsDev(true);
    }
  }, []);

  const handleDevFill = () => {
    // Fill credentials and trigger validation
    setValue('email', 'user@example.com', { shouldValidate: true });
    setValue('password', 'password123', { shouldValidate: true });
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw error;
      }

      // Handle 'remember_me' logic here if you have custom persistence logic
      // Supabase handles session persistence automatically by default, 
      // but you can use data.remember_me to toggle local/session storage if using custom auth flow.

      router.push('/services');
      router.refresh();
    } catch (error: unknown) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to sign in';
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
      <Card className="max-w-md w-full p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-linear-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Dev Mode Toolbar */}
        {isDev && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
              <Beaker className="w-4 h-4" />
              <span>Dev Mode Active</span>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={handleDevFill}
              className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Fill Test User
            </Button>
          </div>
        )}

        {/* Error Display */}
        {authError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{authError}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              {...register('email')}
              className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              className={errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Remember Me Checkbox - Added to match schema */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="remember_me"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              {...register('remember_me')}
              disabled={isLoading}
            />
            <Label 
              htmlFor="remember_me" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Remember me
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-semibold text-primary hover:text-primary/80 transition-colors hover:underline"
          >
            Create account
          </Link>
        </div>
      </Card>
    </div>
  );
}