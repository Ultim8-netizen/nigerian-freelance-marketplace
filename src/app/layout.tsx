// src/app/layout.tsx
import { Suspense } from 'react';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { BRAND } from "@/lib/branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

// Generate metadata using BRAND constants
export const metadata: Metadata = {
  title: {
    default: BRAND.META_TITLE,
    template: `%s | ${BRAND.NAME}`,
  },
  description: BRAND.META_DESCRIPTION,
  keywords: BRAND.META_KEYWORDS,
  authors: [{ name: BRAND.LEGAL_NAME }],
  creator: BRAND.NAME,
  metadataBase: new URL(BRAND.APP_URL),
  
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: BRAND.APP_URL,
    siteName: BRAND.FULL_NAME,
    title: BRAND.META_TITLE,
    description: BRAND.META_DESCRIPTION,
    images: [
      {
        url: BRAND.OG_IMAGE,
        width: 1200,
        height: 630,
        alt: BRAND.META_TITLE,
      },
    ],
  },
  
  twitter: {
    card: 'summary_large_image',
    site: BRAND.TWITTER,
    creator: BRAND.TWITTER,
    title: BRAND.META_TITLE,
    description: BRAND.META_DESCRIPTION,
    images: [BRAND.OG_IMAGE],
  },
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  verification: {
    // Add when available
    // google: 'your-google-verification-code',
  },
  
  other: {
    'contact:email': BRAND.SUPPORT_EMAIL,
    'contact:legal': BRAND.LEGAL_EMAIL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to important domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        {/* Theme color for mobile browsers - F9 brand colors */}
        <meta name="theme-color" content={BRAND.COLORS.PRIMARY} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={BRAND.COLORS.SECONDARY} media="(prefers-color-scheme: dark)" />
        
        {/* Additional SEO */}
        <link rel="canonical" href={BRAND.APP_URL} />
        <meta name="format-detection" content="telephone=no" />
      </head>
      
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* 
            QueryProvider is now the ONLY auth state manager
            All auth state is handled via useAuth() hook from @/hooks/useAuth.query.ts
            No more UserContext - TanStack Query handles everything
          */}
          <QueryProvider>
            {/* Wrap ProgressBar in Suspense for better hydration handling */}
            <Suspense fallback={null}>
              <ProgressBar />
            </Suspense>
            
            {/* Main content with smooth transitions */}
            <div className="relative flex min-h-screen flex-col">
              {children}
            </div>
            
            {/* Toast notifications */}
            <ToastProvider />
          </QueryProvider>
        </ThemeProvider>
        
        {/* Scroll to top button functionality with F9 branding */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Smooth scroll behavior
              document.documentElement.style.scrollBehavior = 'smooth';
              
              // Add scroll progress indicator with F9 brand gradient
              window.addEventListener('scroll', () => {
                const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
                const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const scrolled = (winScroll / height) * 100;
                
                let progressBar = document.getElementById('scroll-progress');
                if (!progressBar) {
                  progressBar = document.createElement('div');
                  progressBar.id = 'scroll-progress';
                  progressBar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:linear-gradient(to right,${BRAND.COLORS.GRADIENT_START},${BRAND.COLORS.GRADIENT_MID},${BRAND.COLORS.GRADIENT_END});z-index:9999;transition:width 0.1s ease';
                  document.body.appendChild(progressBar);
                }
                progressBar.style.width = scrolled + '%';
              });
            `,
          }}
        />
      </body>
    </html>
  );
}