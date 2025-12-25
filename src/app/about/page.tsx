// src/app/about/page.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { F9Logo } from '@/components/brand/F9Logo';
import { 
  Rocket,  
  Terminal, 
  ShieldCheck, 
  BadgeCheck, 
  MousePointer2 
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 selection:bg-blue-500/30 selection:text-white overflow-x-hidden">
      
      {/* Ominous Animated Background Layer */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-linear-to-b from-blue-900/10 via-black to-black" />
        {/* Subtle "Abyss" glow effect */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[50%] bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      <header className="relative z-50 border-b border-white/5 bg-black/50 backdrop-blur-md">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/">
            <F9Logo variant="full" size="md" animated />
          </Link>
          <Link href="/register">
            <Button className="bg-white text-black hover:bg-slate-200 font-bold px-6">
              Join the Movement
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto">
          
          {/* Section 1: The Origin */}
          <section className="mb-32">
            <div className="flex items-center gap-3 text-blue-400 font-mono text-sm mb-8">
              <Terminal className="w-4 h-4" />
              <span className="tracking-widest uppercase">Identity // AbyssProtocol</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black mb-12 text-white leading-tight">
              About Us
            </h1>

            <div className="space-y-8 text-xl md:text-2xl leading-relaxed text-slate-400 font-light">
              <p>
                My name is <span className="text-white font-semibold">AbyssProtocol</span>, and I built F9 because I got tired of watching Nigerian students fight the same battles over and over—no access, no visibility, and no real opportunity to turn skills into money.
              </p>
              
              <div className="p-8 border-l-2 border-red-500 bg-red-500/5 rounded-r-2xl my-12">
                <p className="text-white font-medium italic">
                  &quot;The truth is simple: most global freelancing platforms were never designed with us in mind. The signup process alone feels like an exam nobody taught us for, and the payment options usually end in frustration. I wanted something different. Something ours.&quot;
                </p>
              </div>

              <p>That&apos;s where F9 comes in.</p>
            </div>
          </section>

          {/* Section 2: The Flipping Point */}
          <section className="mb-32 relative">
            <div className="absolute -left-20 top-0 text-[15rem] font-black text-white/2 select-none pointer-events-none">
              F9
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold mb-8 text-white">
              The joke flips.
            </h2>
            
            <div className="space-y-8 text-xl leading-relaxed text-slate-300">
              <p>
                I know what the name traditionally means—an F9 is supposed to be failure. But here, the joke flips. F9 isn&apos;t a platform for failures; it&apos;s a platform built precisely because too many talented people were being made to feel like failures by systems that weren&apos;t built for them.
              </p>
              <p className="text-blue-400 font-bold text-3xl md:text-4xl py-6">
                The irony is intentional. F9 is where you &ldquo;Hustle forward,&rdquo; not backwards.
              </p>
            </div>
          </section>

          {/* Section 3: The Vision (The "Welcome" shift) */}
          <section className="mb-32 p-12 rounded-3xl bg-linear-to-br from-blue-600/10 to-purple-600/10 border border-white/10 backdrop-blur-sm">
            <h2 className="text-2xl font-mono text-purple-400 mb-8 uppercase tracking-widest flex items-center gap-2">
              <BadgeCheck className="w-6 h-6" /> The Vision
            </h2>
            
            <div className="space-y-8 text-xl leading-relaxed">
              <p>
                My vision is simple: to give students and everyday Nigerians a real channel to earn, trade, and grow without fighting unnecessary barriers.
              </p>
              <p>
                Whether you&apos;re offering a skill, selling a product, or just trying to pay your bills without begging someone for &ldquo;urgent 2k,&rdquo; F9 exists to make room for you. I want students to have an environment where talent meets opportunity—not luck, not connections, not bureaucracy.
              </p>
            </div>
          </section>

          {/* Section 4: The Logic */}
          <section className="mb-32">
             <h2 className="text-3xl font-bold mb-10 text-white">Logic over Bureaucracy</h2>
             <div className="grid md:grid-cols-2 gap-12 text-lg text-slate-400 leading-relaxed">
                <div>
                  <p className="mb-6">
                    I built this platform to solve a problem that I experienced myself: making money shouldn&apos;t require jumping through flaming hoops. 
                  </p>
                  <p className="text-red-400/80">
                    You shouldn&apos;t need NIN, BVN, or a foreign account just to get paid for work you already did. You shouldn&apos;t depend on WhatsApp status views to sell the products you believe in. And you shouldn&apos;t have to hope someone recognizes your worth by chance.
                  </p>
                </div>
                <div className="p-8 bg-white/5 rounded-2xl border border-white/10">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                    The Logical Answer
                  </h3>
                  <p>
                    F9 is a logical answer to a real gap: a lightweight, Nigeria-first, student-friendly space where skills and needs meet directly, securely, and freely.
                  </p>
                </div>
             </div>
          </section>

          {/* Section 5: The Invitation */}
          <section className="mb-32 text-center py-20 border-y border-white/5">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-12 italic tracking-tighter">
              There is room for you here.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {[
                "If you have a skill",
                "If you have goods to sell",
                "If you're hustling",
                "If you're building"
              ].map((text) => (
                <div key={text} className="p-4 border border-white/10 rounded-xl bg-white/2 flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xl font-medium">{text}</span>
                </div>
              ))}
            </div>
            <p className="mt-12 text-2xl text-slate-400 italic">
              F9 exists to lift some weight off your shoulders.
            </p>
          </section>

          {/* Section 6: The Correction */}
          <section className="mb-32 text-center max-w-2xl mx-auto">
            <div className="space-y-4 text-3xl font-bold text-white mb-16">
              <p className="opacity-40 uppercase text-sm tracking-[0.3em]">Status</p>
              <p>This is not just software.</p>
              <p className="text-blue-500">It&apos;s a correction.</p>
              <p className="text-purple-500">A redirection.</p>
              <p>A link that should have existed long ago.</p>
              <p className="text-5xl pt-4">And now, it does.</p>
            </div>

            <div className="space-y-8">
              <div className="inline-block p-1 rounded-full bg-linear-to-r from-blue-600 via-purple-600 to-red-600">
                <div className="bg-black rounded-full px-8 py-4">
                  <h2 className="text-2xl font-black text-white tracking-widest">
                    WELCOME TO F9.
                  </h2>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-6">
                <p className="text-4xl font-black bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent italic tracking-tighter">
                  HUSTLE FORWARD.
                </p>
                <Link href="/register">
                  <Button size="lg" className="h-16 px-12 text-xl bg-white text-black hover:scale-105 transition-transform font-black rounded-full">
                    <Rocket className="w-6 h-6 mr-3" />
                    GET STARTED
                  </Button>
                </Link>
              </div>
            </div>
          </section>

        </div>
      </main>

      <footer className="relative z-10 py-12 border-t border-white/5 bg-black/80">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <F9Logo variant="text" size="sm" className="opacity-50" />
            <p className="text-xs font-mono text-slate-600">MISSION_CONTROL // NIGERIA</p>
          </div>
          <div className="flex gap-8 text-sm font-mono text-slate-500">
            <Link href="/terms" className="hover:text-white">TERMS</Link>
            <Link href="/privacy" className="hover:text-white">PRIVACY</Link>
            <Link href="/support" className="hover:text-white">SUPPORT</Link>
          </div>
          <p className="text-xs text-slate-700 font-mono">© 2025 F9_PROJECT</p>
        </div>
      </footer>

      {/* Floating Decorative Element */}
      <div className="fixed bottom-10 left-10 z-50 hidden lg:flex items-center gap-3 text-slate-500 font-mono text-[10px] rotate-90 origin-left opacity-20">
        <MousePointer2 className="w-3 h-3" />
        <span>SCROLL_TO_DESCEND</span>
      </div>
    </div>
  );
}