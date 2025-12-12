// src/components/onboarding/WelcomeMessage.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { F9Logo } from '@/components/brand/F9Logo';
import { 
  Zap, Heart, Users, Shield, Rocket, ArrowRight, 
  CheckCircle, Sparkles, X 
} from 'lucide-react';

interface WelcomeMessageProps {
  userName?: string;
  onContinue: () => void;
  showSkip?: boolean;
}

export function WelcomeMessage({ 
  userName, 
  onContinue,
  showSkip = true 
}: WelcomeMessageProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: 'Welcome to F9',
      subtitle: userName ? `Hey ${userName}! 🎉` : 'Hey there! 🎉',
      content: (
        <div className="space-y-6">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-red-600 via-blue-600 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
              <Zap className="w-12 h-12 text-white" />
            </div>
          </div>

          <p className="text-lg text-gray-700 leading-relaxed">
            You just joined a platform that was <span className="font-bold text-blue-600">built specifically for Nigerian students</span>—
            not adapted, not localized, but <span className="font-bold">built from scratch</span> with your reality in mind.
          </p>

          <div className="bg-gradient-to-r from-red-50 to-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg">
            <p className="text-gray-800 font-medium mb-2">
              Why F9? The irony is intentional.
            </p>
            <p className="text-gray-700 text-sm">
              F9 isn't a platform for failures—it's built for talented people who were made to 
              feel like failures by systems not designed for them.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xl font-bold bg-gradient-to-r from-red-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Here, you Hustle Forward
            <Sparkles className="w-6 h-6 text-yellow-500" />
          </div>
        </div>
      ),
    },
    {
      title: 'Built By Students, For Students',
      subtitle: 'You\'re not alone in this',
      content: (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <X className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">The Old Way</h4>
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li>• BVN/NIN required just to sign up</li>
                    <li>• Payment methods that don't work here</li>
                    <li>• Algorithms that hide your work</li>
                    <li>• Fees that eat your earnings</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">The F9 Way</h4>
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li>• No NIN/BVN needed to start</li>
                    <li>• Nigerian payment options</li>
                    <li>• Everyone gets equal visibility</li>
                    <li>• Transparent, low fees</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Heart className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <p className="text-gray-800 font-medium mb-2">Built with empathy</p>
                <p className="text-gray-700 text-sm">
                  I got tired of watching Nigerian students fight the same battles over and over. 
                  This platform exists because talent without opportunity is just potential—
                  and potential doesn't pay bills.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'What You Can Do Here',
      subtitle: 'Your hustle starts now',
      content: (
        <div className="space-y-6">
          <div className="grid gap-4">
            <Card className="p-6 hover:shadow-lg transition-shadow bg-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Offer Your Skills</h4>
                  <p className="text-gray-600 text-sm">
                    Design, writing, coding, tutoring, meal prep—whatever you do, 
                    there's someone who needs it.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow bg-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Sell Your Products</h4>
                  <p className="text-gray-600 text-sm">
                    Books, fashion, electronics, food—reach buyers without depending on 
                    WhatsApp status views.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow bg-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Secure Payments</h4>
                  <p className="text-gray-600 text-sm">
                    Escrow protection, multiple payment options, direct to your Nigerian bank account.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
            <p className="text-center text-gray-800 font-medium mb-2">
              Whether you're hustling, learning, surviving, or building—
            </p>
            <p className="text-center text-xl font-bold bg-gradient-to-r from-red-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              F9 exists to lift some weight off your shoulders
            </p>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onContinue();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full p-8 md:p-12 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <F9Logo variant="full" size="xl" showTagline animated />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-red-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
            {slides[currentSlide].title}
          </h2>
          <p className="text-lg text-gray-600">
            {slides[currentSlide].subtitle}
          </p>
        </div>

        {/* Content */}
        <div className="mb-8 min-h-[400px]">
          {slides[currentSlide].content}
        </div>

        {/* Progress Indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'w-8 bg-gradient-to-r from-red-600 to-blue-600' 
                  : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div>
            {showSkip && currentSlide < slides.length - 1 && (
              <Button
                variant="ghost"
                onClick={onContinue}
                className="text-gray-600"
              >
                Skip Tour
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            {currentSlide > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
              >
                Previous
              </Button>
            )}
            
            <Button
              onClick={handleNext}
              className="bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-700 hover:to-blue-700"
            >
              {currentSlide === slides.length - 1 ? (
                <>
                  Let's Go
                  <Rocket className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* About Link */}
        <div className="text-center mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600">
            Want to learn more about our story?{' '}
            <Link href="/about" className="text-blue-600 hover:underline font-medium">
              Read our full About Us page
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}