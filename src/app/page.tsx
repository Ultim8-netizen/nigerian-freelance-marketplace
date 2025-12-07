// src/app/page.tsx
// F9 Landing Page - Dramatic, Nigerian-focused, conversion-optimized

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { F9Logo } from '@/components/brand/F9Logo';
import { BRAND } from '@/lib/branding';
import { 
  Zap, Shield, Users, TrendingUp, Star, CheckCircle,
  ArrowRight, Sparkles, Trophy, Target, Rocket
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - DRAMATIC */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-600 via-blue-600 to-purple-600">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Logo/Brand */}
            <div className="mb-8 flex justify-center">
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
                <Zap className="w-5 h-5 text-yellow-300 animate-pulse" />
                <span className="text-white font-semibold">
                  Nigeria's #1 Student Marketplace
                </span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              <span className="inline-block bg-gradient-to-r from-red-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                F9
              </span>
              <br />
              <span className="text-4xl md:text-5xl font-light">
                Hustle Forward
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Turn your skills into income. Find talent across Nigeria. 
              <span className="text-red-300 font-semibold"> Secure payments. </span>
              Built for Nigerian students.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/register">
                <Button 
                  size="lg" 
                  className="text-lg px-8 py-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-105"
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  Start Hustling - Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/services">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-6 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/20 hover:border-white/50"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Explore Services
                </Button>
              </Link>
            </div>

            {/* Social Proof */}
            <div className="flex flex-wrap items-center justify-center gap-8 text-white/90">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-red-300" />
                <span className="text-sm">10,000+ Students</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-red-300" />
                <span className="text-sm">50,000+ Projects</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-red-300 fill-red-300" />
                <span className="text-sm">4.8/5 Rating</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Value Propositions */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Why <span className="bg-gradient-to-r from-red-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">F9</span>?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We understand the Nigerian hustle. Built by students, for students.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <ValueCard
              icon={<Shield className="w-12 h-12 text-red-600" />}
              title="100% Secure Payments"
              description="Your money stays safe in escrow until work is delivered. Pay with cards, bank transfer, or USSD. Powered by Flutterwave."
              highlight="₦0 hidden fees"
            />
            <ValueCard
              icon={<Users className="w-12 h-12 text-blue-600" />}
              title="Verified Students"
              description="Connect with talented students from UNILAG, UI, OAU, ABU, UNN and 100+ universities across Nigeria."
              highlight="NIN & Student ID verified"
            />
            <ValueCard
              icon={<TrendingUp className="w-12 h-12 text-purple-600" />}
              title="Fast Payouts"
              description="Freelancers get paid directly to their Nigerian bank accounts. No stress. No delays. Your hustle, your money."
              highlight="Same-day withdrawals"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Start in <span className="bg-gradient-to-r from-red-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">3 Steps</span>
            </h2>
            <p className="text-xl text-gray-600">
              Your journey to financial freedom begins here
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <StepCard
                number={1}
                title="Create Account"
                description="Sign up free. Add your skills or post what you need. Takes 2 minutes."
                icon={<Target className="w-8 h-8" />}
              />
              <StepCard
                number={2}
                title="Connect & Agree"
                description="Browse services or receive proposals. Chat, negotiate, agree on price and timeline."
                icon={<Users className="w-8 h-8" />}
              />
              <StepCard
                number={3}
                title="Work & Get Paid"
                description="Complete the work, deliver, get reviewed. Money released instantly to your bank."
                icon={<Zap className="w-8 h-8" />}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Popular Services */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Popular on <span className="bg-gradient-to-r from-red-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">F9</span>
            </h2>
            <p className="text-xl text-gray-600">
              From assignments to apps, we've got you covered
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
            {[
              '📝 Assignment Help',
              '💻 Web Development',
              '🎨 Graphic Design',
              '📱 Social Media',
              '✍️ Content Writing',
              '📊 Data Analysis',
              '🎬 Video Editing',
              '📸 Photography',
              '🎤 Voiceover',
              '🍳 Meal Prep',
              '👗 Fashion Design',
              '💼 CV Writing',
            ].map((service) => (
              <div
                key={service}
                className="p-4 rounded-lg border-2 border-gray-200 hover:border-red-500 hover:shadow-lg transition-all duration-300 text-center cursor-pointer"
              >
                <span className="text-sm font-medium">{service}</span>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/services">
              <Button size="lg" variant="outline">
                View All Services
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gradient-to-br from-red-50 via-blue-50 to-purple-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Students Trust <span className="bg-gradient-to-r from-red-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">F9</span>
            </h2>
            <p className="text-xl text-gray-600">
              Real stories from real hustlers
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <TestimonialCard
              quote="I made ₦150k in my first month doing graphic design. F9 changed my student life!"
              author="Chioma O."
              role="Graphics Designer, UNILAG"
              rating={5}
            />
            <TestimonialCard
              quote="Found a coder who built my app idea for way less than I expected. Smooth process!"
              author="Ibrahim K."
              role="Startup Founder, Abuja"
              rating={5}
            />
            <TestimonialCard
              quote="As a final year student, F9 helps me earn while studying. The escrow gives me peace of mind."
              author="Blessing A."
              role="Content Writer, UI"
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-red-600 via-blue-600 to-purple-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Your Hustle Starts Now ⚡
            </h2>
            <p className="text-xl md:text-2xl text-blue-100 mb-10">
              Join thousands of Nigerian students earning and learning on F9.
              <br />
              <span className="text-red-300 font-semibold">No registration fee. No hidden charges.</span>
            </p>
            <Link href="/register">
              <Button 
                size="lg" 
                className="text-lg px-12 py-7 bg-white hover:bg-gray-100 text-red-600 font-bold shadow-2xl hover:shadow-white/50 transition-all duration-300 hover:scale-110"
              >
                <Rocket className="w-6 h-6 mr-2" />
                Get Started Free
                <ArrowRight className="w-6 h-6 ml-2" />
              </Button>
            </Link>
            <p className="text-sm text-blue-200 mt-6">
              Free forever. Secure. Built for Nigeria. 🇳🇬
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <F9Logo variant="text" size="lg" showTagline className="text-white" />
              <p className="text-sm mt-2">🇳🇬 Made in Nigeria, for Nigeria</p>
            </div>
            <div className="flex gap-8">
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/support" className="hover:text-white transition-colors">
                Support
              </Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>© 2025 F9 Marketplace. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Supporting Components

function ValueCard({ 
  icon, 
  title, 
  description, 
  highlight 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  highlight: string;
}) {
  return (
    <div className="relative p-8 rounded-2xl border-2 border-gray-200 hover:border-red-500 hover:shadow-2xl transition-all duration-300 group bg-white">
      <div className="absolute top-4 right-4 text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
        {highlight}
      </div>
      <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ 
  number, 
  title, 
  description, 
  icon 
}: { 
  number: number; 
  title: string; 
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 via-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-xl">
            {number}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-lg">
            {icon}
          </div>
        </div>
        <h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
      {number < 3 && (
        <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-red-600 via-blue-600 to-purple-600 opacity-30" />
      )}
    </div>
  );
}

function TestimonialCard({ 
  quote, 
  author, 
  role, 
  rating 
}: { 
  quote: string; 
  author: string; 
  role: string;
  rating: number;
}) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-shadow duration-300">
      <div className="flex mb-4">
        {[...Array(rating)].map((_, i) => (
          <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
        ))}
      </div>
      <p className="text-gray-700 italic mb-6 leading-relaxed">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
          {author.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{author}</p>
          <p className="text-sm text-gray-600">{role}</p>
        </div>
      </div>
    </div>
  );
}