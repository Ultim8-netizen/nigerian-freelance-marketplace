// src/components/auth/RegisterForm.tsx
// User registration form component

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@/lib/validations';
import { RegisterFormData } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { Select } from '@/components/ui/select'; // <-- REMOVED UNUSED IMPORT
import { Card } from '@/components/ui/card';

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Redirect based on user type
      if (data.user_type === 'freelancer') {
        router.push('/freelancer/dashboard');
      } else {
        router.push('/client/dashboard');
      }
    } catch (error) { // <-- RENAMED 'err' to '_error' or 'error' and it's used now by default to avoid a linter warning
      console.error(error); // Optionally log the error for debugging
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-6">
      <h2 className="text-2xl font-bold mb-6">Create Your Account</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <Input
            {...register('full_name')}
            placeholder="John Doe"
            disabled={isLoading}
          />
          {errors.full_name && (
            <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input
            {...register('email')}
            type="email"
            placeholder="john@example.com"
            disabled={isLoading}
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone Number</label>
          <Input
            {...register('phone_number')}
            placeholder="08012345678"
            disabled={isLoading}
          />
          {errors.phone_number && (
            <p className="text-red-500 text-sm mt-1">{errors.phone_number.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <Input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">I want to</label>
          <select
            {...register('user_type')}
            className="w-full px-3 py-2 border rounded-md"
            disabled={isLoading}
          >
            <option value="freelancer">Offer services as a Freelancer</option>
            <option value="client">Hire freelancers as a Client</option>
            <option value="both">Both offer and hire services</option>
          </select>
          {errors.user_type && (
            <p className="text-red-500 text-sm mt-1">{errors.user_type.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">University (Optional)</label>
          <Input
            {...register('university')}
            placeholder="University of Lagos"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Location (Optional)</label>
          <Input
            {...register('location')}
            placeholder="Lagos, Nigeria"
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Button>
      </form>
    </Card>
  );
}