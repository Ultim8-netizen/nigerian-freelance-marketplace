// src/app/page.tsx
// Landing page - Main entry point

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Search, Shield, Zap, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-6">
              Nigeria's Premier Student Freelance Marketplace
            </h1>
            <p className="text-xl mb-8 opacity-90">
              Connect with skilled Nigerian students and professionals. 
              Post jobs, offer services, and grow your business with local talent.
            </p>
            <div className="flex gap-4">
              <Link href="/register">
                <Button size="lg" variant="secondary">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/services">
                <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
                  Browse Services
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Our Platform?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Shield className="w-12 h-12" />}
              title="Secure Payments"
              description="Escrow-protected transactions with Flutterwave integration. Your money stays safe until work is delivered."
            />
            <FeatureCard
              icon={<Users className="w-12 h-12" />}
              title="Local Talent"
              description="Access skilled Nigerian students and professionals. Support local talent while getting quality work done."
            />
            <FeatureCard
              icon={<Zap className="w-12 h-12" />}
              title="Fast & Easy"
              description="Simple posting, quick responses, and streamlined workflow. Get your projects done efficiently."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of Nigerians already using our platform
          </p>
          <Link href="/register">
            <Button size="lg">Create Free Account</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="text-center p-6">
      <div className="text-blue-600 mb-4 flex justify-center">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}