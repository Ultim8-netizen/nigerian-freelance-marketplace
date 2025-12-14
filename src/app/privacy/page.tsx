// src/app/privacy/page.tsx
// PART 1 OF 3 - Copy this entire content
// After copying all 3 parts, concatenate them to form the complete file

import { BRAND } from '@/lib/branding';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <Link 
            href="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
              <p className="text-gray-600">How we protect your information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm p-8 prose prose-gray max-w-none">
          <p className="text-sm text-gray-500 mb-8">
            Last updated: {new Date().toLocaleDateString('en-NG', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              {BRAND.NAME} (&quot;we,&quot; &quot;us,&quot; &quot;our,&quot; or &quot;Platform&quot;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information 
              when you use our freelance marketplace platform.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
              <p className="text-gray-800 font-medium">Important:</p>
              <p className="text-gray-700 text-sm mt-1">
                By using our Platform, you consent to the data practices described in this Privacy Policy. 
                If you do not agree with this Privacy Policy, please do not access or use our Platform.
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed mt-4">
              This Privacy Policy is designed to comply with:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-700">
              <li>Nigeria Data Protection Regulation (NDPR) 2019</li>
              <li>Federal Competition and Consumer Protection Act (FCCPA)</li>
              <li>Other applicable Nigerian data protection laws</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Definitions</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              For purposes of this Privacy Policy:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>&quot;Personal Data&quot;</strong> means any information relating to an identified or identifiable natural person</li>
              <li><strong>&quot;Processing&quot;</strong> means any operation performed on personal data, including collection, storage, use, and disclosure</li>
              <li><strong>&quot;Data Subject&quot;</strong> means you, the individual whose personal data we process</li>
              <li><strong>&quot;Data Controller&quot;</strong> means {BRAND.NAME}, determining the purposes and means of processing</li>
              <li><strong>&quot;Third Party&quot;</strong> means any person or entity other than you or {BRAND.NAME}</li>
              <li><strong>&quot;Services&quot;</strong> means all features, content, and functionality available through the Platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">3.1 Information You Provide Directly</h3>
            
            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Account Registration Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Full name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Password (encrypted)</li>
                <li>User type (freelancer, client, or both)</li>
                <li>University/institution name (optional)</li>
                <li>Location (state and city)</li>
                <li>Date of birth (for age verification)</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Profile Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Profile photograph</li>
                <li>Biography</li>
                <li>Skills and expertise</li>
                <li>Portfolio items and work samples</li>
                <li>Education and work history</li>
                <li>Professional certifications</li>
                <li>Languages spoken</li>
                <li>Hourly rates or service prices</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Identity Verification Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>National Identification Number (NIN)</li>
                <li>Student ID card images</li>
                <li>Utility bills for address verification</li>
                <li>Bank Verification Number (BVN) - through Flutterwave</li>
                <li>Government-issued ID documents</li>
                <li>Biometric verification (liveness detection)</li>
                <li>Authenticator app credentials</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Financial Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Bank account details (name, account number, bank name)</li>
                <li>Transaction history</li>
                <li>Payment method information (processed by Flutterwave)</li>
                <li>Tax identification information (if provided)</li>
                <li>Withdrawal requests and history</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Transaction Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Service descriptions and requirements</li>
                <li>Job postings and proposals</li>
                <li>Order details and specifications</li>
                <li>Delivery files and attachments</li>
                <li>Payment amounts and dates</li>
                <li>Refund and dispute information</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Communications:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Messages between users through Platform messaging</li>
                <li>Customer support inquiries and responses</li>
                <li>Emails, notifications, and alerts</li>
                <li>Survey responses and feedback</li>
                <li>Reviews and ratings</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>User-Generated Content:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Service listings and descriptions</li>
                <li>Job postings</li>
                <li>Proposal cover letters</li>
                <li>Reviews and testimonials</li>
                <li>Forum posts and comments</li>
                <li>Uploaded files and documents</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.2 Information Collected Automatically</h3>
            
            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Device Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Device identifiers</li>
                <li>Screen resolution</li>
                <li>Language preferences</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Usage Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Pages visited and features used</li>
                <li>Time and date of visits</li>
                <li>Referral sources</li>
                <li>Search queries</li>
                <li>Click patterns and navigation paths</li>
                <li>Time spent on pages</li>
                <li>Services viewed or purchased</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Location Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Approximate location based on IP address</li>
                <li>Precise location (if you grant permission)</li>
                <li>Location from browser geolocation API</li>
                <li>Location from IP geolocation services</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Cookies and Tracking Technologies:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Session cookies (essential for Platform functionality)</li>
                <li>Persistent cookies (for preferences and authentication)</li>
                <li>Analytics cookies (for usage analysis)</li>
                <li>Third-party cookies (from integrated services)</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.3 Information from Third-Party Sources</h3>
            
            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Payment Processors (Flutterwave):</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Payment verification data</li>
                <li>Transaction status and confirmations</li>
                <li>Bank account validation results</li>
                <li>Fraud detection signals</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Social Media (if you choose to connect):</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Profile information from linked accounts</li>
                <li>Friends or connections list</li>
                <li>Profile picture</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Identity Verification Services:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>NIN verification results</li>
                <li>BVN validation data</li>
                <li>Address verification outcomes</li>
                <li>Credit checks (for specific services)</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Public Sources:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Information you make publicly available</li>
                <li>Professional networking profiles</li>
                <li>Business registrations</li>
                <li>Academic credentials (with your permission)</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.4 Information We Do NOT Collect</h3>
            <div className="bg-green-50 border-l-4 border-green-400 p-4">
              <p className="text-gray-800 font-medium mb-2">We do NOT collect:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                <li>Credit or debit card numbers (processed by Flutterwave)</li>
                <li>Card CVV codes</li>
                <li>Full card details (we receive only tokenized data)</li>
                <li>Sensitive health information</li>
                <li>Religious or political affiliations</li>
                <li>Trade union membership</li>
                <li>Genetic or biometric data for identification (except liveness detection)</li>
              </ul>
            </div>
          </section>
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. How We Use Your Information</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">4.1 Platform Operation and Service Delivery</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We use your information to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Create and manage your account</li>
              <li>Authenticate your identity</li>
              <li>Process transactions and payments</li>
              <li>Facilitate communication between users</li>
              <li>Deliver services you request</li>
              <li>Provide customer support</li>
              <li>Resolve disputes and enforce agreements</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">4.2 Platform Improvement and Personalization</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We use your information to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Personalize your Platform experience</li>
              <li>Recommend relevant services or jobs</li>
              <li>Analyze user behavior and preferences</li>
              <li>Improve Platform features and functionality</li>
              <li>Develop new products and services</li>
              <li>Conduct research and analytics</li>
              <li>Test new features and updates</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">4.3 Security and Fraud Prevention</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We use your information to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Detect and prevent fraud, abuse, and illegal activity</li>
              <li>Verify user identities</li>
              <li>Monitor for suspicious transactions</li>
              <li>Enforce our Terms of Service</li>
              <li>Protect user safety and Platform integrity</li>
              <li>Comply with legal obligations</li>
              <li>Respond to legal processes</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">4.4 Communication and Marketing</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We use your information to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Send transactional emails (order updates, payment confirmations)</li>
              <li>Provide important Platform announcements</li>
              <li>Send promotional materials (you may opt out)</li>
              <li>Conduct surveys and request feedback</li>
              <li>Notify you of policy changes</li>
              <li>Respond to your inquiries</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">4.5 Legal and Compliance</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We use your information to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Comply with applicable laws and regulations</li>
              <li>Respond to lawful requests from authorities</li>
              <li>Protect our legal rights and interests</li>
              <li>Enforce our Terms of Service</li>
              <li>Resolve disputes and legal claims</li>
              <li>Prevent harm to users or the public</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">4.6 Business Operations</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We use your information to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Manage business operations</li>
              <li>Conduct financial reporting</li>
              <li>Process payroll and contractor payments</li>
              <li>Maintain business records</li>
              <li>Conduct audits and assessments</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Legal Basis for Processing (NDPR Compliance)</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Under Nigerian Data Protection Regulation, we process your personal data based on:
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.1 Consent</h3>
            <p className="text-gray-700 leading-relaxed">
              You explicitly consent to data processing when creating an account. You may withdraw consent 
              at any time (may limit service availability).
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.2 Contractual Necessity</h3>
            <p className="text-gray-700 leading-relaxed">
              Processing necessary to fulfill our contract with you (Terms of Service), facilitating 
              transactions between users, and providing Platform services you requested.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.3 Legal Obligations</h3>
            <p className="text-gray-700 leading-relaxed">
              Compliance with Nigerian laws and regulations, tax reporting and financial compliance, 
              anti-money laundering requirements, and response to legal processes.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.4 Legitimate Interests</h3>
            <p className="text-gray-700 leading-relaxed">
              Fraud prevention and Platform security, improvement of services and user experience, 
              business analytics and operations, balanced against your rights and interests.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. How We Share Your Information</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">6.1 With Other Users</h3>
            
            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Publicly Visible Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Profile name and photograph</li>
                <li>Biography and skills</li>
                <li>Portfolio items</li>
                <li>Service listings</li>
                <li>Reviews and ratings</li>
                <li>University/institution (if provided)</li>
                <li>Approximate location (state/city only)</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>Shared During Transactions:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Contact information (with consent)</li>
                <li>Delivery files and work product</li>
                <li>Transaction-specific details</li>
                <li>Communication history for that transaction</li>
              </ul>
            </div>

            <div className="bg-green-50 border-l-4 border-green-400 p-4 mt-4">
              <p className="text-gray-800 font-medium mb-2">We Never Share Without Permission:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                <li>Full name (unless you choose to display it)</li>
                <li>Phone number</li>
                <li>Email address</li>
                <li>Bank account details</li>
                <li>Government ID numbers</li>
                <li>Precise location</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.2 With Service Providers and Business Partners</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We share information with trusted third parties who assist us:
            </p>

            <div className="space-y-4">
              <div>
                <p className="text-gray-800 font-semibold">Payment Processing:</p>
                <p className="text-gray-700 text-sm"><strong>Flutterwave</strong> (payment gateway)</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Transaction amounts and details</li>
                  <li>Bank account information for payouts</li>
                  <li>Identity verification data</li>
                  <li>Fraud detection information</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Cloud Services:</p>
                <p className="text-gray-700 text-sm"><strong>Cloudinary</strong> (image and file hosting)</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Uploaded images and files</li>
                  <li>Metadata associated with uploads</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Analytics and Monitoring:</p>
                <p className="text-gray-700 text-sm"><strong>Google Analytics</strong> (usage analytics)</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Anonymized usage patterns</li>
                  <li>Device and browser information</li>
                  <li>Geographic data (country/city level)</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Communication Services:</p>
                <p className="text-gray-700 text-sm"><strong>Email service providers</strong> (transactional emails)</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Email addresses</li>
                  <li>Message content</li>
                  <li>Delivery status</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Infrastructure Providers:</p>
                <p className="text-gray-700 text-sm"><strong>Supabase</strong> (database and authentication)</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>All account and transaction data</li>
                  <li>Authentication tokens</li>
                  <li>Database records</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Identity Verification:</p>
                <p className="text-gray-700 text-sm">Third-party verification services</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Government ID documents</li>
                  <li>Verification results</li>
                  <li>Fraud risk scores</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Legal and Professional Services:</p>
                <p className="text-gray-700 text-sm">Legal counsel and accountants</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Information necessary for legal advice</li>
                  <li>Financial records for accounting</li>
                  <li>Dispute-related information</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.3 For Legal and Safety Reasons</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We may disclose information:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>To comply with legal obligations</li>
              <li>In response to lawful requests from authorities</li>
              <li>To enforce our Terms of Service</li>
              <li>To protect against fraud or illegal activity</li>
              <li>To protect rights, property, or safety</li>
              <li>In connection with legal proceedings</li>
              <li>To prevent harm to individuals or the public</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.4 Business Transfers</h3>
            <p className="text-gray-700 leading-relaxed">
              If we are involved in a merger, acquisition, or sale of assets: your information may be transferred, 
              you will be notified via email and Platform notice, and the new entity will be bound by this Privacy Policy.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.5 With Your Consent</h3>
            <p className="text-gray-700 leading-relaxed">
              We may share information for other purposes with your explicit consent.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.6 Aggregated and De-identified Data</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We may share:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Aggregated statistics (number of users, transaction volumes)</li>
              <li>De-identified data that cannot be linked to you</li>
              <li>Industry research and reports</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-2 text-sm italic">
              This data is not considered personal information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Data Retention</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">7.1 Active Account Data</h3>
            <p className="text-gray-700 leading-relaxed">
              We retain your information while your account is active and for the periods necessary to fulfill 
              the purposes described in this Privacy Policy, comply with legal obligations, resolve disputes, 
              and enforce agreements.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">7.2 Specific Retention Periods</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-800 font-semibold">Account Information:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Active accounts: Indefinitely while account is active</li>
                  <li>Closed accounts: 7 years after closure (for legal compliance)</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Transaction Records:</p>
                <p className="text-gray-700 text-sm">7 years after transaction completion (Nigerian tax law requirement)</p>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Communication Records:</p>
                <p className="text-gray-700 text-sm">3 years after last communication</p>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Identity Verification Documents:</p>
                <p className="text-gray-700 text-sm">Duration of account plus 7 years</p>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Financial Records:</p>
                <p className="text-gray-700 text-sm">7 years (accounting and tax requirements)</p>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Marketing Communications:</p>
                <p className="text-gray-700 text-sm">Until you opt out plus 30 days</p>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Dispute Records:</p>
                <p className="text-gray-700 text-sm">7 years after resolution</p>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Cookies and Tracking Data:</p>
                <p className="text-gray-700 text-sm">See Section 9 (Cookies Policy)</p>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">7.3 Deletion Requests</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You may request deletion of your account and data. However, we may retain:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Information required by law</li>
              <li>Information necessary for ongoing legal matters</li>
              <li>De-identified or aggregated data</li>
              <li>Backup copies (deleted within 90 days)</li>
            </ul>
          </section>
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Your Data Protection Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Under Nigerian Data Protection Regulation (NDPR), you have the following rights:
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">8.1 Right to Access</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-2">
              <li>Request a copy of your personal data</li>
              <li>Receive information about how we process your data</li>
              <li>Obtain data in a structured, commonly used format</li>
            </ul>
            <p className="text-gray-700 text-sm italic">
              How to Exercise: Email {BRAND.SUPPORT_EMAIL} with &quot;Data Access Request&quot;
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.2 Right to Rectification</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-2">
              <li>Correct inaccurate personal data</li>
              <li>Complete incomplete personal data</li>
              <li>Update outdated information</li>
            </ul>
            <p className="text-gray-700 text-sm italic">
              How to Exercise: Update through account settings or email us
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.3 Right to Erasure (&quot;Right to be Forgotten&quot;)</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-2">
              <li>Request deletion of your personal data</li>
              <li>Subject to legal retention requirements</li>
              <li>May limit or prevent future use of Platform</li>
            </ul>
            <p className="text-gray-700 text-sm italic">
              How to Exercise: Email {BRAND.SUPPORT_EMAIL} with &quot;Deletion Request&quot;
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.4 Right to Restrict Processing</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-2">
              <li>Request limitation of data processing</li>
              <li>Challenge accuracy of data</li>
              <li>Object to processing based on legitimate interests</li>
            </ul>
            <p className="text-gray-700 text-sm italic">
              How to Exercise: Email {BRAND.SUPPORT_EMAIL}
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.5 Right to Data Portability</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-2">
              <li>Receive your data in a portable format</li>
              <li>Transfer data to another service provider</li>
              <li>Applies to data processed by automated means</li>
            </ul>
            <p className="text-gray-700 text-sm italic">
              How to Exercise: Email {BRAND.SUPPORT_EMAIL} with &quot;Data Portability Request&quot;
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.6 Right to Object</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-2">
              <li>Object to processing based on legitimate interests</li>
              <li>Object to direct marketing</li>
              <li>Object to profiling for marketing purposes</li>
            </ul>
            <p className="text-gray-700 text-sm italic">
              How to Exercise: Opt-out links in emails or email {BRAND.SUPPORT_EMAIL}
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.7 Right to Withdraw Consent</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-2">
              <li>Withdraw consent at any time</li>
              <li>Does not affect lawfulness of prior processing</li>
              <li>May limit service availability</li>
            </ul>
            <p className="text-gray-700 text-sm italic">
              How to Exercise: Account settings or email {BRAND.SUPPORT_EMAIL}
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.8 Right to Lodge a Complaint</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-2">
              <li>File a complaint with Nigeria Data Protection Bureau (NDPB)</li>
              <li>Contact: info@ndpb.gov.ng</li>
              <li>We prefer you contact us first to resolve concerns</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.9 Response Timeline</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>We respond to requests within 30 days</li>
              <li>Complex requests may take up to 60 days (we&apos;ll notify you)</li>
              <li>Verification of identity required for all requests</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Cookies and Tracking Technologies</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">9.1 What Are Cookies?</h3>
            <p className="text-gray-700 leading-relaxed">
              Cookies are small text files stored on your device that help us provide and improve our Platform.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">9.2 Types of Cookies We Use</h3>
            
            <div className="space-y-3">
              <div>
                <p className="text-gray-800 font-semibold">Essential Cookies (Always Active):</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Authentication and session management</li>
                  <li>Security features</li>
                  <li>Load balancing</li>
                  <li>Platform functionality</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Functional Cookies:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>User preferences</li>
                  <li>Language settings</li>
                  <li>Recent searches</li>
                  <li>Interface customization</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Analytics Cookies:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Usage statistics</li>
                  <li>Performance monitoring</li>
                  <li>Error tracking</li>
                  <li>Feature effectiveness</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Marketing Cookies:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Ad targeting</li>
                  <li>Campaign effectiveness</li>
                  <li>Conversion tracking</li>
                  <li>Remarketing</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">9.3 Third-Party Cookies</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Our Platform may include cookies from: Google Analytics, social media platforms, payment processors, 
              and advertising networks.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">9.4 Cookie Management</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>How to Control Cookies:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Browser settings (block or delete cookies)</li>
              <li>Opt-out tools provided by third parties</li>
              <li>Platform cookie preferences (when available)</li>
            </ul>
            <p className="text-gray-700 text-sm mt-2 italic">
              Note: Disabling essential cookies may impair Platform functionality.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">9.5 Do Not Track Signals</h3>
            <p className="text-gray-700 leading-relaxed">
              We currently do not respond to &quot;Do Not Track&quot; browser signals, as there is no industry 
              standard for compliance.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">9.6 Mobile Identifiers</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We may use mobile advertising identifiers (IDFA, AAID) for: app analytics, personalization, and advertising.
            </p>
            <p className="text-gray-700 text-sm">
              You can reset or limit identifier use through device settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Data Security</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">10.1 Security Measures</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We implement industry-standard security measures:
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-gray-800 font-semibold">Technical Safeguards:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Encryption in transit (TLS/SSL)</li>
                  <li>Encryption at rest for sensitive data</li>
                  <li>Secure authentication (password hashing)</li>
                  <li>Regular security audits</li>
                  <li>Vulnerability scanning</li>
                  <li>Intrusion detection systems</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Organizational Safeguards:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Access controls and authentication</li>
                  <li>Employee data protection training</li>
                  <li>Confidentiality agreements</li>
                  <li>Background checks for staff with data access</li>
                  <li>Incident response procedures</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Physical Safeguards:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Secure data center facilities (through cloud providers)</li>
                  <li>Access controls to server locations</li>
                  <li>Environmental controls</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">10.2 Data Breach Response</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              In the event of a data breach:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>We investigate immediately</li>
              <li>We notify affected users within 72 hours (as required by NDPR)</li>
              <li>We report to Nigeria Data Protection Bureau</li>
              <li>We provide information about the breach and remediation steps</li>
              <li>We implement additional safeguards to prevent recurrence</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">10.3 User Responsibilities</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You are responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Maintaining password confidentiality</li>
              <li>Using strong, unique passwords</li>
              <li>Enabling two-factor authentication (when available)</li>
              <li>Reporting suspected unauthorized access</li>
              <li>Protecting your devices from malware</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">10.4 Limitations</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-gray-800 font-medium mb-2">IMPORTANT:</p>
              <p className="text-gray-700 text-sm">
                While we implement robust security measures: no method of transmission is 100% secure, 
                no electronic storage system is completely secure, we cannot guarantee absolute security, 
                and you use the Platform at your own risk.
              </p>
              <p className="text-gray-700 text-sm mt-2">
                Report security concerns to: {BRAND.SUPPORT_EMAIL}
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. International Data Transfers</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">11.1 Data Storage Locations</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Your data may be stored and processed in: Nigeria, cloud service provider data centers globally, 
              and locations where our service providers operate.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">11.2 Transfer Safeguards</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              When transferring data internationally, we ensure: adequate data protection measures, contractual 
              commitments from recipients, compliance with NDPR requirements, and standard contractual clauses 
              where applicable.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">11.3 Your Consent</h3>
            <p className="text-gray-700 leading-relaxed">
              By using the Platform, you consent to international data transfers as described.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Children&apos;s Privacy</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">12.1 Age Restriction</h3>
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-gray-800 font-medium mb-2">Our Platform is NOT intended for individuals under 18 years of age.</p>
              <p className="text-gray-700 text-sm">
                We do not knowingly collect information from children under 18, target children under 18 with 
                our services, or market to children under 18.
              </p>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">12.2 Parental Notice</h3>
            <p className="text-gray-700 leading-relaxed">
              If you believe a child under 18 has provided us with personal information: email {BRAND.SUPPORT_EMAIL} immediately. 
              We will investigate and delete the information, and the account will be terminated.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">12.3 Verification</h3>
            <p className="text-gray-700 leading-relaxed">
              We may request proof of age if we suspect a user is under 18.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Third-Party Links and Services</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">13.1 External Links</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Our Platform may contain links to third-party websites. We are NOT responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Privacy practices of external sites</li>
              <li>Content of third-party websites</li>
              <li>Security of third-party services</li>
            </ul>
            <p className="text-gray-700 text-sm mt-2 font-medium">
              We encourage you to read third-party privacy policies.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">13.2 Third-Party Services</h3>
            <p className="text-gray-700 leading-relaxed">
              Integrated third-party services (Flutterwave, Google Analytics, etc.) have their own privacy policies. 
              We are not responsible for their data practices.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">13.3 Social Media Features</h3>
            <p className="text-gray-700 leading-relaxed">
              Social media features on our Platform may allow third parties to collect information, use cookies 
              or other tracking technologies, and be governed by the privacy policies of those platforms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Marketing Communications</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">14.1 Types of Marketing</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We may send you:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Promotional emails about new features</li>
              <li>Special offers and discounts</li>
              <li>Newsletter and updates</li>
              <li>Survey invitations</li>
              <li>Event announcements</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">14.2 Opt-Out Options</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You can opt out of marketing communications:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Click &quot;Unsubscribe&quot; link in emails</li>
              <li>Update preferences in account settings</li>
              <li>Email {BRAND.SUPPORT_EMAIL} with &quot;Unsubscribe&quot;</li>
            </ul>
            <p className="text-gray-700 text-sm mt-2 italic">
              Note: You cannot opt out of transactional emails (order confirmations, security alerts).
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">14.3 Opt-Out Effect</h3>
            <p className="text-gray-700 leading-relaxed">
              Opting out stops promotional emails within 10 business days, does not affect transactional emails, 
              and does not delete your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Updates to This Privacy Policy</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">15.1 Right to Modify</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We may update this Privacy Policy to reflect: changes in our data practices, new features or services, 
              legal or regulatory requirements, and industry best practices.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">15.2 Notification of Changes</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We will notify you of material changes via: email to your registered address, prominent notice on 
              the Platform, and in-app notification.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">15.3 Effective Date</h3>
            <p className="text-gray-700 leading-relaxed">
              Changes are effective 30 days after notification for material changes, and immediately for minor, 
              clarifying changes.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">15.4 Continued Use</h3>
            <p className="text-gray-700 leading-relaxed">
              Your continued use after notification constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">16. Contact Information</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              For privacy-related inquiries, requests, or concerns:
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-gray-800 font-medium">{BRAND.LEGAL_NAME}</p>
              <p className="text-gray-700 mt-2">
                <strong>Privacy Email:</strong> <a href={`mailto:${BRAND.SUPPORT_EMAIL}`} className="text-blue-600 hover:underline">{BRAND.SUPPORT_EMAIL}</a>
              </p>
              <p className="text-gray-700">
                <strong>Support:</strong> <a href={`mailto:${BRAND.SUPPORT_EMAIL}`} className="text-blue-600 hover:underline">{BRAND.SUPPORT_EMAIL}</a>
              </p>
              <p className="text-gray-700">
                <strong>Security Issues:</strong> <a href={`mailto:${BRAND.SUPPORT_EMAIL}`} className="text-blue-600 hover:underline">{BRAND.SUPPORT_EMAIL}</a>
              </p>
              <p className="text-gray-700 text-sm mt-3">
                <strong>Response Time:</strong> Privacy requests within 30 days, security issues immediate acknowledgment
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">17. Nigeria Data Protection Bureau</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              For complaints or concerns about our data practices, you may contact:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-800 font-medium">Nigeria Data Protection Bureau (NDPB)</p>
              <p className="text-gray-700 mt-2">
                Email: info@ndpb.gov.ng
              </p>
              <p className="text-gray-700">
                Website: ndpb.gov.ng
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed mt-4 font-medium">
              We encourage you to contact us first to resolve any concerns.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">18. Consent and Acknowledgment</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-gray-800 font-medium mb-2">By using our Platform, you:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                <li>Consent to the collection, use, and disclosure of your information as described</li>
                <li>Acknowledge you have read and understood this Privacy Policy</li>
                <li>Agree to our data practices</li>
                <li>Confirm you are at least 18 years old</li>
              </ul>
              <p className="text-gray-800 font-medium mt-3">
                If you do not agree with this Privacy Policy, you must not use our Platform.
              </p>
            </div>
          </section>

          <div className="border-t border-gray-200 pt-6 mt-8">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} {BRAND.NAME}. All rights reserved.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This Privacy Policy is effective as of {new Date().toLocaleDateString('en-NG', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}