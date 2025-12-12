// src/app/about/page.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { F9Logo } from '@/components/brand/F9Logo';
import { 
  Zap, Shield, Users, Heart, Target, Rocket, 
  TrendingUp, CheckCircle, ArrowRight, Sparkles 
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <F9Logo variant="full" size="md" animated />
            </Link>
            <Link href="/register">
              <Button>
                <Rocket className="w-4 h-4 mr-2" />
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-linear-to-br from-red-600 via-blue-600 to-purple-600 text-white relative overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20 mb-8">
              <Heart className="w-5 h-5 text-red-300 animate-pulse" />
              <span className="text-white font-semibold">Our Story</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Built By Students,
              <br />
              <span className="bg-linear-to-r from-red-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                For Students
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
              The platform that turns "F9" from failure into "Hustle Forward" — 
              where talent meets real opportunity.
            </p>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Why F9 Exists</h2>
              <p className="text-xl text-gray-600">
                A problem I experienced myself
              </p>
            </div>

            <Card className="p-8 md:p-12 bg-linear-to-br from-red-50 to-orange-50 border-red-200">
              <div className="prose prose-lg max-w-none">
                <p className="text-lg text-gray-800 leading-relaxed mb-6">
                  I got tired of watching Nigerian students fight the same battles over and over—
                  <span className="font-semibold text-red-600"> no access, no visibility, and no real opportunity </span>
                  to turn skills into money.
                </p>

                <p className="text-lg text-gray-800 leading-relaxed mb-6">
                  The truth is simple: <span className="font-semibold">most global freelancing platforms were never designed with us in mind.</span> 
                  The signup process alone feels like an exam nobody taught us for, and the payment options usually end in frustration.
                </p>

                <p className="text-lg text-gray-800 leading-relaxed">
                  You shouldn't need NIN, BVN, or a foreign account just to get paid for work you already did. 
                  You shouldn't depend on WhatsApp status views to sell the products you believe in. 
                  And you shouldn't have to hope someone recognizes your worth by chance.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* The Name Story */}
      <section className="py-20 bg-linear-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 md:p-12 border-2 border-blue-200 bg-white shadow-xl">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 bg-linear-to-br from-red-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-2">Why "F9"?</h2>
                  <p className="text-gray-600">The irony is intentional</p>
                </div>
              </div>

              <div className="prose prose-lg max-w-none">
                <p className="text-lg text-gray-800 leading-relaxed mb-6">
                  I know what the name traditionally means—an F9 is supposed to be <span className="italic">failure</span>. 
                  But here, <span className="font-bold text-blue-600">the joke flips.</span>
                </p>

                <p className="text-lg text-gray-800 leading-relaxed mb-6">
                  <span className="font-semibold bg-linear-to-r from-red-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                    F9 isn't a platform for failures; it's a platform built precisely because too many talented people 
                    were being made to feel like failures by systems that weren't built for them.
                  </span>
                </p>

                <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg">
                  <p className="text-xl font-bold text-blue-900 mb-2">
                    F9 is where you "Hustle Forward," not backwards.
                  </p>
                  <p className="text-blue-800">
                    This is not just software. It's a correction. A redirection. A link that should have existed long ago.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Our Vision */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Our Vision</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                To give students and everyday Nigerians a real channel to earn, trade, 
                and grow without fighting unnecessary barriers
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <VisionCard
                icon={<Target className="w-12 h-12 text-red-600" />}
                title="Direct Connection"
                description="Where talent meets opportunity—not luck, not connections, not bureaucracy."
              />
              <VisionCard
                icon={<Shield className="w-12 h-12 text-blue-600" />}
                title="Absolute Neutrality"
                description="The platform connects people; it does not gatekeep access. Badges inform decisions—users remain free."
              />
              <VisionCard
                icon={<Users className="w-12 h-12 text-purple-600" />}
                title="For Everyone"
                description="If you have a skill, there's a place for you here. If you have goods to sell, there's a place for you here."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                This Platform Is For You If...
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 hover:shadow-xl transition-shadow bg-white">
                <div className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">You're Hustling</h3>
                    <p className="text-gray-600">
                      Trying to pay bills without begging for "urgent 2k"
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 hover:shadow-xl transition-shadow bg-white">
                <div className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">You're Learning</h3>
                    <p className="text-gray-600">
                      Building skills and want to earn while you grow
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 hover:shadow-xl transition-shadow bg-white">
                <div className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">You're Surviving</h3>
                    <p className="text-gray-600">
                      Making it work day by day and need a reliable channel
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 hover:shadow-xl transition-shadow bg-white">
                <div className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">You're Building</h3>
                    <p className="text-gray-600">
                      Creating something and need visibility without barriers
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="mt-12 text-center">
              <Card className="p-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none">
                <p className="text-2xl font-bold mb-2">
                  F9 exists to lift some weight off your shoulders.
                </p>
                <p className="text-lg text-blue-100">
                  Whether you're offering a skill, selling a product, or just trying to survive—
                  there's room for you here.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 md:p-12 bg-gradient-to-br from-gray-900 to-blue-900 text-white border-none shadow-2xl">
              <div className="flex flex-col md:flex-row items-start gap-8">
                <div className="w-32 h-32 bg-gradient-to-br from-red-500 to-purple-600 rounded-full flex items-center justify-center text-6xl font-bold flex-shrink-0">
                  AP
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-bold mb-2">AbyssProtocol</h3>
                  <p className="text-blue-200 mb-6">Founder & Creator of F9</p>
                  
                  <blockquote className="text-lg leading-relaxed border-l-4 border-blue-400 pl-6 mb-6">
                    "I built F9 because I got tired of watching Nigerian students fight the same battles 
                    over and over. This platform exists because talent without opportunity is just 
                    potential—and potential doesn't pay bills."
                  </blockquote>

                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm">Built in Nigeria</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                      <Heart className="w-4 h-4 text-red-400" />
                      <span className="text-sm">For Students</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-sm">Always Free</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
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
              Welcome to F9
            </h2>
            <p className="text-2xl md:text-3xl text-blue-100 mb-10 font-light">
              Hustle Forward. 🚀
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/register">
                <Button 
                  size="lg" 
                  className="text-lg px-12 py-7 bg-white hover:bg-gray-100 text-red-600 font-bold shadow-2xl hover:shadow-white/50 transition-all duration-300 hover:scale-110"
                >
                  <Rocket className="w-6 h-6 mr-2" />
                  Start Your Journey
                  <ArrowRight className="w-6 h-6 ml-2" />
                </Button>
              </Link>
            </div>

            <p className="text-sm text-blue-200">
              Free forever. No hidden fees. Built for Nigeria. 🇳🇬
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
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/services" className="hover:text-white transition-colors">
                Services
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

function VisionCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <Card className="p-8 hover:shadow-2xl transition-all duration-300 group bg-white">
      <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </Card>
  );
}