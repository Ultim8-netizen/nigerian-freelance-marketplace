// src/app/about/page.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { F9Logo } from '@/components/brand/F9Logo';
import { 
  Rocket, 
  ArrowRight, 
  XCircle,
  CheckCircle2,
  Terminal,
  Quote,
  Wallet,
  Globe2,
  Lock
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-red-100 selection:text-red-900">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/">
               <F9Logo variant="full" size="sm" />
            </Link>
          <div className="flex gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-blue-600 flex items-center">
              Log In
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
                Join the Hustle
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero: The Statement */}
      <section className="pt-24 pb-12 md:pt-32 md:pb-20 container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold tracking-wider uppercase mb-6">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"/>
            The Anti-Failure Platform
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] text-slate-900 mb-8">
            WE FLIPPED <br />
            THE <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 via-purple-600 to-blue-600">SCRIPT.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 max-w-2xl leading-relaxed">
            Talent without opportunity is just potential. And potential doesn&apos;t pay bills. 
            We built the bridge that should have existed long ago.
          </p>
        </div>
      </section>

      {/* The Bento Grid Manifesto */}
      <section className="pb-24 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-[minmax(180px,auto)]">
          
          {/* 1. The Name Origin (Large Card) */}
          <Card className="md:col-span-6 lg:col-span-8 row-span-2 bg-slate-900 text-white p-8 md:p-12 flex flex-col justify-between overflow-hidden relative group border-none shadow-2xl">
            <div className="absolute top-0 right-0 p-32 bg-red-600 rounded-full blur-[100px] opacity-20 group-hover:opacity-30 transition-opacity" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center font-mono font-bold text-2xl border border-red-500/30">F9</div>
                <ArrowRight className="text-slate-500" />
                <div className="w-12 h-12 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center font-mono font-bold text-2xl border border-green-500/30">A1</div>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold mb-4">The Irony is Intentional.</h2>
              <p className="text-slate-300 text-lg leading-relaxed max-w-2xl">
                Traditionally, an F9 is failure. But here, the joke flips. F9 isn&apos;t a platform for failures; it&apos;s built for talented people made to feel like failures by systems not built for them.
              </p>
            </div>

            <div className="mt-8 relative z-10">
              <span className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-linear-to-r from-white to-slate-600">
                HUSTLE FORWARD.
              </span>
            </div>
          </Card>

          {/* 2. The Problem (Medium Card) */}
          <Card className="md:col-span-3 lg:col-span-4 row-span-1 p-6 bg-red-50 border-red-100 hover:border-red-200 transition-colors">
            <div className="h-full flex flex-col justify-between">
              <XCircle className="w-8 h-8 text-red-500 mb-4" />
              <div>
                <h3 className="font-bold text-red-900 text-lg mb-2">The Old Way</h3>
                <p className="text-red-700/80 text-sm">
                  Gatekeeping. Bureaucracy. Needing a foreign account just to get paid.
                </p>
              </div>
            </div>
          </Card>

          {/* 3. The Solution (Medium Card) */}
          <Card className="md:col-span-3 lg:col-span-4 row-span-1 p-6 bg-blue-50 border-blue-100 hover:border-blue-200 transition-colors">
            <div className="h-full flex flex-col justify-between">
              <CheckCircle2 className="w-8 h-8 text-blue-600 mb-4" />
              <div>
                <h3 className="font-bold text-blue-900 text-lg mb-2">The F9 Way</h3>
                <p className="text-blue-700/80 text-sm">
                  No NIN. No BVN. Just sign up, list your skill, and get paid.
                </p>
              </div>
            </div>
          </Card>

           {/* 4. Founder's Note (Tall Card) */}
           <Card className="md:col-span-3 lg:col-span-4 row-span-2 p-1 bg-linear-to-b from-slate-200 to-slate-100 border-slate-300">
            <div className="bg-white h-full w-full rounded-lg p-6 flex flex-col relative overflow-hidden">
              <div className="flex items-center gap-2 mb-6 opacity-50">
                <Terminal className="w-4 h-4" />
                <span className="text-xs font-mono">AbyssProtocol.tsx</span>
              </div>
              
              <Quote className="absolute -right-4 -top-4 w-24 h-24 text-slate-50 rotate-12" />
              
              <div className="prose prose-sm flex-1 relative z-10">
                <p className="text-slate-600 italic">
                  &quot;I built F9 because I got tired of watching Nigerian students fight the same battles. You shouldn&apos;t depend on WhatsApp status views to sell products you believe in.&quot;
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="font-bold text-slate-900">AbyssProtocol</div>
                <div className="text-xs text-slate-500">Founder & Creator</div>
              </div>
            </div>
          </Card>

          {/* 5. The "Urgent 2k" Stat (Wide Card) */}
          <Card className="md:col-span-3 lg:col-span-8 row-span-1 p-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-white border-slate-200 shadow-sm">
            <div>
              <h3 className="text-2xl font-bold mb-2">End the &quot;Urgent 2k&quot; Cycle</h3>
              <p className="text-slate-500">
                Whether you&apos;re hustling, learning, or surviving—we created a real channel to earn without begging.
              </p>
            </div>
            <div className="shrink-0 flex gap-2">
               <BadgeIcon icon={<Wallet className="w-5 h-5"/>} label="Secure Pay" />
               <BadgeIcon icon={<Globe2 className="w-5 h-5"/>} label="No Borders" />
               <BadgeIcon icon={<Lock className="w-5 h-5"/>} label="Private" />
            </div>
          </Card>

          {/* 6. Vision CTA (Image/Visual Card) */}
          <div className="md:col-span-6 lg:col-span-12 row-span-1 relative rounded-xl overflow-hidden group cursor-pointer">
             <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-purple-600 transition-transform duration-500 group-hover:scale-105" />
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
             
             <div className="relative h-full flex flex-col md:flex-row items-center justify-between p-8 md:px-16 text-white">
                <div className="mb-6 md:mb-0">
                  <h2 className="text-3xl font-bold mb-2">Ready to Hustle Forward?</h2>
                  <p className="text-blue-100">Join the correction. The platform connects—decisions remain yours.</p>
                </div>
                <Link href="/register">
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 border-0 font-bold h-14 px-8 rounded-full shadow-lg shadow-blue-900/20">
                    <Rocket className="w-5 h-5 mr-2 animate-bounce" />
                    Start Selling Now
                  </Button>
                </Link>
             </div>
          </div>

        </div>
      </section>

      {/* Footer Minimal */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="container mx-auto px-4 text-center">
            <p className="text-slate-400 text-sm mb-4">
                Designed for the students, by the students.
            </p>
            <div className="flex justify-center items-center gap-2 text-slate-300 font-mono text-xs">
                <span>LAGOS</span> • <span>ABUJA</span> • <span>ONLINE</span>
            </div>
        </div>
      </footer>
    </div>
  );
}

// Small Utility Component for badges
function BadgeIcon({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100 w-24">
      <div className="text-slate-900">{icon}</div>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
    </div>
  );
}