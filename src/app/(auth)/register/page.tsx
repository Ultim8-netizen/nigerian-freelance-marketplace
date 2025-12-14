// src/app/(auth)/register/page.tsx
import { RegisterForm } from '@/components/auth/RegisterForm';
import { F9Logo } from '@/components/brand/F9Logo';
import { BRAND } from '@/lib/branding';
import Link from 'next/link';
import { Metadata } from 'next';
import { Sparkles, Users, Shield, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: `Register | ${BRAND.NAME}`,
  description: `Create your account on ${BRAND.NAME} - ${BRAND.TAGLINE}`,
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 via-blue-50/30 to-purple-50/30 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background Elements */}i
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-20 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 border border-gray-100 backdrop-blur-sm transform transition-all duration-300 hover:shadow-3xl">
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-top duration-700">
              <div className="relative">
                <F9Logo variant="stacked" size="lg" animated />
                {/* Sparkle Effect */}
                <div className="absolute -top-2 -right-2 animate-pulse">
                  <Sparkles className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                </div>
              </div>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-bold bg-linear-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-3 animate-in fade-in slide-in-from-top duration-700 delay-100">
              Join {BRAND.NAME}
            </h1>
            
            <p className="text-gray-600 text-base sm:text-lg animate-in fade-in slide-in-from-top duration-700 delay-200">
              {BRAND.TAGLINE}
            </p>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-3 gap-3 mb-8 animate-in fade-in slide-in-from-bottom duration-700 delay-300">
            <TrustBadge 
              icon={Users}
              label="10K+ Users"
              color="blue"
            />
            <TrustBadge 
              icon={Shield}
              label="Secure"
              color="green"
            />
            <TrustBadge 
              icon={Zap}
              label="Fast Setup"
              color="purple"
            />
          </div>

          {/* Registration Form */}
          <div className="animate-in fade-in slide-in-from-bottom duration-700 delay-400">
            <RegisterForm />
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* Sign In Link */}
          <p className="text-center text-gray-600 animate-in fade-in duration-700 delay-500">
            Already have an account?{' '}
            <Link 
              href="/login" 
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors inline-flex items-center gap-1 group"
            >
              Sign in
              <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </p>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center space-y-3 animate-in fade-in duration-700 delay-600">
          <div className="flex justify-center gap-6 text-sm text-gray-600">
            <Link 
              href="/privacy" 
              className="hover:text-gray-900 transition-colors hover:underline"
            >
              Privacy Policy
            </Link>
            <Link 
              href="/terms" 
              className="hover:text-gray-900 transition-colors hover:underline"
            >
              Terms of Service
            </Link>
          </div>
          
          <p className="text-xs text-gray-500">
            By signing up, you agree to our Terms and Privacy Policy
          </p>
        </div>

        {/* Social Proof */}
        <div className="mt-6 text-center animate-in fade-in duration-700 delay-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div 
                  key={i}
                  className="w-6 h-6 rounded-full bg-linear-to-br from-blue-400 to-purple-500 border-2 border-white"
                />
              ))}
            </div>
            <span className="text-xs text-gray-600 font-medium">
              Join 10,000+ freelancers
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

interface TrustBadgeProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: 'blue' | 'green' | 'purple';
}

function TrustBadge({ icon: Icon, label, color }: TrustBadgeProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  return (
    <div className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border ${colorClasses[color]} transition-all hover:scale-105 hover:shadow-sm cursor-default`}>
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium whitespace-nowrap">{label}</span>
    </div>
  );
}