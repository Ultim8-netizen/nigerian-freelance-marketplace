// src/components/layout/Footer.tsx
'use client';

import Link from 'next/link';
import { F9Logo } from '@/components/brand/F9Logo';
import { BRAND } from '@/lib/branding';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <F9Logo variant="text" size="lg" showTagline className="mb-4 text-white" />
            <p className="text-sm text-gray-400">
              {BRAND.DESCRIPTION}
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/services" className="hover:text-white">Browse Services</Link></li>
              <li><Link href="/jobs" className="hover:text-white">Find Jobs</Link></li>
              <li><Link href="/how-it-works" className="hover:text-white">How It Works</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
              <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li>Email: <a href={`mailto:${BRAND.SUPPORT_EMAIL}`} className="hover:text-white">{BRAND.SUPPORT_EMAIL}</a></li>
              <li>Twitter: <a href={`https://twitter.com/${BRAND.TWITTER.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">{BRAND.TWITTER}</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
          <p>© {new Date().getFullYear()} {BRAND.LEGAL_NAME}. All rights reserved.</p>
          <p className="mt-4 md:mt-0">🇳🇬 Made in Nigeria, for Nigeria</p>
        </div>
      </div>
    </footer>
  );
}