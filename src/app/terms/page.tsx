// src/app/terms/page.tsx
// PART 1 OF 3 - Copy this entire content
// After copying all 3 parts, concatenate them to form the complete file

import { BRAND } from '@/lib/branding';
import Link from 'next/link';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
              <p className="text-gray-600">Please read these terms carefully</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using the {BRAND.NAME} marketplace platform (&quot;Platform,&quot; &quot;Service,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), 
              you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) agree to be bound by these Terms of Service (&quot;Terms&quot;). 
              If you do not agree to these Terms, you must not access or use the Platform.
            </p>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
              <p className="text-gray-800 font-medium">IMPORTANT:</p>
              <p className="text-gray-700 text-sm mt-1">
                These Terms contain a binding arbitration clause and class action waiver that affect your legal rights. 
                Please read Section 18 carefully.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Eligibility and Account Registration</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">2.1 Age Requirements</h3>
            <p className="text-gray-700 leading-relaxed">
              You must be at least 18 years old to use this Platform. By registering, you represent and warrant 
              that you are of legal age to form a binding contract under Nigerian law.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.2 Account Accuracy</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.3 Account Responsibility</h3>
            <p className="text-gray-700 leading-relaxed">
              <strong>YOU ARE SOLELY RESPONSIBLE FOR ALL ACTIVITIES THAT OCCUR UNDER YOUR ACCOUNT, 
              WHETHER OR NOT AUTHORIZED BY YOU.</strong> We are not liable for any loss or damage arising from your 
              failure to maintain account security.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.4 One Account Per User</h3>
            <p className="text-gray-700 leading-relaxed">
              Each user may maintain only one active account. Multiple accounts may result in immediate 
              suspension or termination without notice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Platform Role and Limitations</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">3.1 Marketplace Provider Only</h3>
            <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
              <p className="text-gray-800 font-medium">CRITICAL LIMITATION OF LIABILITY:</p>
              <p className="text-gray-700 text-sm mt-1">
                {BRAND.NAME} is <strong>SOLELY A MARKETPLACE PLATFORM</strong> that connects freelancers with clients. We are:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-700 text-sm">
                <li>NOT a party to any transaction between users</li>
                <li>NOT an employer, agent, or representative of any user</li>
                <li>NOT responsible for the quality, legality, safety, or delivery of services</li>
                <li>NOT liable for any disputes, losses, damages, or injuries arising from user interactions</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">3.2 No Verification of User Claims</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              While we may offer identity verification features, <strong>WE DO NOT:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Verify the accuracy of user profiles, qualifications, or credentials</li>
              <li>Conduct background checks on users</li>
              <li>Guarantee the competence, skill, or reliability of any freelancer</li>
              <li>Verify the legitimacy or payment capacity of any client</li>
              <li>Endorse or recommend any specific user or service</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">3.3 Independent Contractor Relationship</h3>
            <p className="text-gray-700 leading-relaxed">
              All freelancers are independent contractors. No employment, partnership, joint venture, or 
              agency relationship exists between {BRAND.NAME} and any user, or between users who transact on the Platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. User Obligations and Prohibited Conduct</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">4.1 Compliance with Laws</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You agree to comply with all applicable Nigerian federal and state laws, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Tax laws and reporting requirements</li>
              <li>Business registration requirements</li>
              <li>Professional licensing requirements</li>
              <li>Consumer protection laws</li>
              <li>Anti-money laundering regulations</li>
              <li>Data protection regulations (NDPR)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">4.2 Strictly Prohibited Activities</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Users are <strong>ABSOLUTELY PROHIBITED</strong> from:
            </p>
            
            <div className="space-y-4">
              <div>
                <p className="text-gray-800 font-semibold">Fraudulent Activities:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Providing false, misleading, or deceptive information</li>
                  <li>Impersonating any person or entity</li>
                  <li>Creating fake reviews, ratings, or testimonials</li>
                  <li>Engaging in any form of payment fraud or chargeback abuse</li>
                  <li>Money laundering or terrorist financing</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Illegal Activities:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Offering or requesting illegal services</li>
                  <li>Violating intellectual property rights</li>
                  <li>Sharing pirated or stolen content</li>
                  <li>Engaging in activities that violate Nigerian criminal law</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Platform Abuse:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Circumventing platform fees by conducting transactions off-platform</li>
                  <li>Using automated systems (bots, scrapers) without written permission</li>
                  <li>Attempting to manipulate search rankings or reviews</li>
                  <li>Harassing, threatening, or abusing other users</li>
                  <li>Spamming or sending unsolicited commercial messages</li>
                </ul>
              </div>

              <div>
                <p className="text-gray-800 font-semibold">Content Violations:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                  <li>Posting pornographic, obscene, or sexually explicit content</li>
                  <li>Sharing content that promotes violence, terrorism, or hate speech</li>
                  <li>Distributing malware, viruses, or harmful code</li>
                  <li>Violating any third party&apos;s rights</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">4.3 Tax Obligations</h3>
            <p className="text-gray-700 leading-relaxed">
              <strong>YOU ARE SOLELY RESPONSIBLE</strong> for determining, collecting, reporting, and remitting 
              all applicable taxes to appropriate authorities, including compliance with Nigerian Tax Authority (FIRS) 
              regulations and maintaining proper tax records. <strong>WE DO NOT:</strong> provide tax advice, withhold 
              or remit taxes on your behalf, or report your earnings to tax authorities.
            </p>
          </section>
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Transactions and Payments</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.1 Escrow System</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              All payments are held in escrow until work is delivered and approved. By using our payment system, you acknowledge:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Payments are processed through Flutterwave (third-party payment processor)</li>
              <li>We hold funds in escrow as a neutral stakeholder only</li>
              <li>Escrow does not guarantee work quality or client satisfaction</li>
              <li>Release conditions are defined in these Terms</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.2 Platform Fees</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We charge a <strong>10% platform fee</strong> on all transactions. This fee:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Is deducted from the freelancer&apos;s earnings</li>
              <li>Is non-refundable, even if the transaction is disputed or refunded</li>
              <li>Covers platform maintenance, payment processing, and escrow services</li>
              <li>May be adjusted with 30 days&apos; notice</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.3 Payment Release Conditions</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Funds are released to the freelancer when:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Client approves the delivered work, OR</li>
              <li>Client does not respond within 7 days of delivery notification, OR</li>
              <li>A dispute is resolved in the freelancer&apos;s favor</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.4 Refund Policy</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-gray-800 font-medium mb-2">Important:</p>
              <p className="text-gray-700 text-sm mb-3">
                <strong>REFUNDS ARE NOT GUARANTEED.</strong> Refunds may be issued only when:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                <li>Freelancer fails to deliver work within agreed timeframe without justification</li>
                <li>Work delivered is substantially different from agreed scope</li>
                <li>Mutual agreement is reached between parties</li>
                <li>Platform determines freelancer violated Terms</li>
              </ul>
              <p className="text-gray-700 text-sm mt-3">
                <strong>Refunds are NOT issued for:</strong> subjective dissatisfaction with work quality, 
                change of mind or buyer&apos;s remorse, miscommunication between parties, or issues caused by 
                client&apos;s failure to provide required information.
              </p>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.5 Withdrawal Requirements</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Freelancers may withdraw funds when:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Funds have cleared escrow</li>
              <li>Minimum withdrawal threshold (₦5,000) is met</li>
              <li>Valid Nigerian bank account details are provided</li>
              <li>14-day clearance period has elapsed (for fraud prevention)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.6 Payment Disputes</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>IN THE EVENT OF A PAYMENT DISPUTE:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Platform acts as a neutral mediator only</li>
              <li>Decision is based on evidence provided by both parties</li>
              <li>Platform&apos;s decision is <strong>FINAL AND BINDING</strong></li>
              <li>Fees are non-refundable regardless of dispute outcome</li>
              <li>Neither party may pursue legal action against the Platform</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.7 Chargeback Abuse</h3>
            <p className="text-gray-700 leading-relaxed">
              If you initiate an unauthorized chargeback or payment reversal: your account will be immediately suspended, 
              you will be liable for the disputed amount plus administrative fees, we may report fraudulent chargebacks 
              to law enforcement, and you waive any right to dispute our collection efforts.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Service Quality and Disputes</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">6.1 No Quality Guarantees</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>WE MAKE NO REPRESENTATIONS OR WARRANTIES</strong> regarding:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Quality of services provided by freelancers</li>
              <li>Accuracy of service descriptions</li>
              <li>Timeliness of service delivery</li>
              <li>Professional qualifications of users</li>
              <li>Fitness for any particular purpose</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">6.2 User-to-User Disputes</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>YOU ACKNOWLEDGE AND AGREE THAT:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Disputes between users are solely between those users</li>
              <li>We are not obligated to mediate or resolve disputes</li>
              <li>If we choose to mediate, our decision is advisory only (not binding) unless both parties agree to binding arbitration through our platform</li>
              <li>We may suspend or terminate accounts involved in disputes</li>
              <li>You release us from all claims arising from user disputes</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">6.3 Dispute Resolution Process</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              If users cannot resolve disputes independently:
            </p>
            <ol className="list-decimal pl-6 space-y-1 text-gray-700">
              <li>Either party may request platform mediation (optional)</li>
              <li>Platform may request evidence from both parties</li>
              <li>Platform may issue a non-binding recommendation</li>
              <li>Platform may issue a binding decision if both parties agree in advance</li>
              <li>Unresolved disputes must be handled per Section 18 (Arbitration)</li>
            </ol>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">6.4 Evidence Requirements</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              In disputes, the following evidence is considered:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Written communications through the Platform</li>
              <li>Delivered work files and documentation</li>
              <li>Transaction records</li>
              <li>Service descriptions and agreed scope</li>
              <li>Screenshots with timestamps</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-2">
              <strong>Evidence submitted outside the Platform may not be considered.</strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Intellectual Property</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">7.1 Ownership of Work Product</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Unless otherwise agreed in writing between client and freelancer:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Freelancer retains IP rights until full payment is received</li>
              <li>Upon payment, client receives the agreed-upon usage rights</li>
              <li>Freelancer may display work in portfolio unless explicitly prohibited</li>
              <li>Platform claims no ownership of user-generated content</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">7.2 Platform Content</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              All Platform content (logos, design, code, text) is owned by {BRAND.NAME} and protected by Nigerian 
              and international intellectual property laws. You may not:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Copy, modify, or distribute Platform content</li>
              <li>Reverse engineer or decompile Platform code</li>
              <li>Use our trademarks without written permission</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">7.3 User Content License</h3>
            <p className="text-gray-700 leading-relaxed">
              By posting content on the Platform, you grant us a worldwide, non-exclusive, royalty-free license 
              to use, display, reproduce, and distribute your content for Platform operation, marketing, and 
              promotional purposes. This license survives account termination.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">7.4 Infringement Claims</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              If you believe content infringes your intellectual property, email {BRAND.LEGAL_EMAIL} with:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Your contact information</li>
              <li>Description of copyrighted work</li>
              <li>Location of infringing content</li>
              <li>A statement of good faith belief</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-2">
              We will investigate and may remove content at our discretion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Prohibited Services</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              The following services are <strong>STRICTLY PROHIBITED</strong> on our Platform:
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">8.1 Illegal Services</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Any service that violates Nigerian federal or state law</li>
              <li>Services requiring professional licenses (legal, medical) unless properly licensed</li>
              <li>Sale of regulated goods (weapons, drugs, alcohol, tobacco)</li>
              <li>Gambling or betting services</li>
              <li>Pyramid schemes or multi-level marketing</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.2 Harmful or Dangerous Services</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Services that pose health or safety risks</li>
              <li>Services involving hazardous materials</li>
              <li>Services that could cause physical harm</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.3 Adult or Sexual Services</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Pornographic content creation</li>
              <li>Escort or dating services</li>
              <li>Sexual or adult entertainment services</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.4 Academic Dishonesty</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Completing assignments or exams on another&apos;s behalf</li>
              <li>Writing academic papers for submission by another student</li>
              <li>Services that constitute academic fraud</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-2 text-sm italic">
              Note: Tutoring, study assistance, and proofreading are permitted when they educate rather than 
              replace the student&apos;s work.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">8.5 Identity Theft Services</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Creation of fake documents</li>
              <li>Impersonation services</li>
              <li>Services facilitating fraud or identity theft</li>
            </ul>

            <div className="bg-red-50 border-l-4 border-red-400 p-4 mt-4">
              <p className="text-gray-800 font-medium">Warning:</p>
              <p className="text-gray-700 text-sm mt-1">
                <strong>VIOLATION OF THIS SECTION RESULTS IN IMMEDIATE ACCOUNT TERMINATION AND MAY BE 
                REPORTED TO LAW ENFORCEMENT.</strong>
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Account Suspension and Termination</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">9.1 Platform&apos;s Right to Terminate</h3>
            <p className="text-gray-700 leading-relaxed">
              <strong>WE RESERVE THE ABSOLUTE RIGHT TO:</strong> suspend or terminate any account at any time, 
              for any reason or no reason, with or without notice, and without liability to you.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">9.2 Grounds for Termination</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Accounts may be terminated for:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Violation of these Terms</li>
              <li>Fraudulent activity or suspected fraud</li>
              <li>Multiple user complaints</li>
              <li>Chargebacks or payment disputes</li>
              <li>Inactive accounts (12+ months)</li>
              <li>Use of Platform for illegal purposes</li>
              <li>Abuse of other users or Platform staff</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">9.3 Effect of Termination</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Upon termination:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Your access is immediately revoked</li>
              <li>Pending transactions may be cancelled or frozen</li>
              <li>Funds in escrow may be held for 90 days pending investigation</li>
              <li>You remain liable for all outstanding fees and obligations</li>
              <li>You may not create a new account without written permission</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">9.4 Survival of Terms</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              The following sections survive termination: payment obligations, indemnification, 
              limitation of liability, arbitration agreement, and any other provision that by its nature should survive.
            </p>
          </section>
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Representations and Warranties</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">10.1 Your Representations</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              By using the Platform, you represent and warrant that:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>All information provided is accurate and complete</li>
              <li>You have the legal right to provide offered services</li>
              <li>Your services do not infringe third-party rights</li>
              <li>You will comply with all applicable laws</li>
              <li>You have obtained all necessary licenses and permits</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">10.2 Disclaimer of Warranties</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-800 font-medium mb-2">THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;</p>
              <p className="text-gray-700 text-sm mb-3">
                We make no warranties of any kind, express or implied, including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                <li>Warranties of merchantability</li>
                <li>Fitness for a particular purpose</li>
                <li>Non-infringement or title</li>
                <li>Accuracy, completeness, or reliability</li>
              </ul>
              <p className="text-gray-700 text-sm mt-3">
                <strong>WE DO NOT WARRANT THAT:</strong> the Platform will be uninterrupted or error-free, 
                defects will be corrected, the Platform is free of viruses or harmful components, or results 
                obtained will be accurate or reliable.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Limitation of Liability</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">11.1 Maximum Liability Cap</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-gray-800 font-medium mb-2">MAXIMUM LIABILITY CAP</p>
              <p className="text-gray-700 text-sm">
                To the maximum extent permitted by Nigerian law, our total liability to you for any claim 
                arising from or related to the Platform shall not exceed the greater of: (a) ₦50,000, or 
                (b) the fees you paid to us in the 12 months preceding the claim.
              </p>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">11.2 Excluded Damages</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>WE SHALL NOT BE LIABLE FOR:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, data, or business opportunities</li>
              <li>Cost of substitute services</li>
              <li>Damages arising from user-to-user transactions</li>
              <li>Damages from unauthorized access to your account</li>
              <li>Damages from service interruptions or errors</li>
              <li>Damages from third-party conduct</li>
              <li>Any claim exceeding one year from the date of occurrence</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">11.3 User-to-User Transactions</h3>
            <p className="text-gray-700 leading-relaxed">
              <strong>YOU ACKNOWLEDGE AND AGREE THAT:</strong> All transactions are solely between users. 
              We are not responsible for freelancer performance or client payment. We do not guarantee work 
              quality, safety, or legality. You assume all risks in user transactions. We have no liability 
              for loss, damage, or injury arising from transactions.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">11.4 Third-Party Services</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We integrate with third-party services (Flutterwave, Cloudinary, etc.). <strong>WE ARE NOT LIABLE FOR:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Third-party service failures or errors</li>
              <li>Data breaches at third-party providers</li>
              <li>Third-party pricing or policy changes</li>
              <li>Loss of funds due to payment processor issues</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">11.5 Force Majeure</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We are not liable for failure to perform due to circumstances beyond our reasonable control, including: 
              natural disasters, war, terrorism, civil unrest, government actions, legal restrictions, internet or 
              telecommunications failures, power outages, equipment failures, or acts of God.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Indemnification</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">12.1 Your Indemnification Obligation</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>YOU AGREE TO INDEMNIFY, DEFEND, AND HOLD HARMLESS</strong> {BRAND.NAME}, its officers, 
              directors, employees, agents, and affiliates from and against any and all claims, demands, lawsuits, 
              damages, losses, costs, and expenses (including reasonable legal fees) arising from or related to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Your use of the Platform</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any law or third-party rights</li>
              <li>Your services or content</li>
              <li>Transactions with other users</li>
              <li>Your negligence or willful misconduct</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">12.2 Defense of Claims</h3>
            <p className="text-gray-700 leading-relaxed">
              We reserve the right to assume exclusive defense and control of any claim, require your cooperation 
              in our defense, and approve any settlement that affects our rights or interests.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">12.3 Continuing Obligation</h3>
            <p className="text-gray-700 leading-relaxed">
              This indemnification obligation survives termination of your account, applies even if we are 
              partially at fault, and is in addition to any other indemnification obligations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Privacy and Data Protection</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">13.1 Privacy Policy</h3>
            <p className="text-gray-700 leading-relaxed">
              Our collection and use of personal data is governed by our Privacy Policy, which is incorporated 
              into these Terms by reference. By using the Platform, you consent to our Privacy Policy.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">13.2 Data Security</h3>
            <p className="text-gray-700 leading-relaxed">
              While we implement reasonable security measures, <strong>WE CANNOT GUARANTEE ABSOLUTE SECURITY.</strong> 
              You assume all risks of data breaches. We are not liable for unauthorized access to your data. 
              You are responsible for maintaining password security.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">13.3 Communications</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              By registering, you consent to receive:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Transactional emails (order updates, payment notifications)</li>
              <li>Marketing communications (you may opt out)</li>
              <li>Platform announcements and updates</li>
              <li>Legal notices via email</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Modifications to Terms</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">14.1 Right to Modify</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We reserve the right to modify these Terms at any time. Changes are effective:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Immediately upon posting for minor, non-substantive changes</li>
              <li>30 days after posting for material changes</li>
              <li>Upon acceptance if you continue using the Platform after notification</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">14.2 Notification of Changes</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We will notify you of material changes via: email to your registered address, prominent notice on 
              the Platform, or in-app notification.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">14.3 Acceptance of Changes</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Your continued use of the Platform after notification constitutes acceptance of the modified Terms, 
              agreement to be bound by the new Terms, and waiver of any objection to the changes. If you do not 
              agree to modified Terms, you must stop using the Platform immediately, cancel your account, and 
              resolve all pending transactions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Intellectual Property Infringement (DMCA)</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">15.1 DMCA Compliance</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We respect intellectual property rights. If you believe content on our Platform infringes your copyright, 
              submit a written notice to: {BRAND.LEGAL_EMAIL}
            </p>
            <p className="text-gray-700 leading-relaxed mb-3">
              Include: your physical or electronic signature, identification of copyrighted work, location of 
              infringing material, your contact information, a statement of good faith belief, and a statement 
              that information is accurate under penalty of perjury.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">15.2 Counter-Notification</h3>
            <p className="text-gray-700 leading-relaxed">
              If your content is removed for alleged infringement, you may submit a counter-notification including: 
              your physical or electronic signature, identification of removed content, a statement under penalty 
              of perjury that removal was erroneous, and your consent to Nigerian court jurisdiction.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">15.3 Repeat Infringer Policy</h3>
            <p className="text-gray-700 leading-relaxed">
              Accounts with multiple substantiated infringement claims will be terminated.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">16. Miscellaneous Provisions</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">16.1 Entire Agreement</h3>
            <p className="text-gray-700 leading-relaxed">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and 
              {BRAND.NAME}, superseding all prior agreements or understandings.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">16.2 Severability</h3>
            <p className="text-gray-700 leading-relaxed">
              If any provision is found unenforceable, the remaining provisions remain in full effect. The 
              unenforceable provision will be modified to reflect the parties&apos; intent.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">16.3 Waiver</h3>
            <p className="text-gray-700 leading-relaxed">
              Our failure to enforce any right or provision does not constitute a waiver. Any waiver must be 
              in writing and signed by us.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">16.4 Assignment</h3>
            <p className="text-gray-700 leading-relaxed">
              You may not assign or transfer these Terms. We may assign our rights and obligations without notice or consent.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">16.5 No Third-Party Beneficiaries</h3>
            <p className="text-gray-700 leading-relaxed">
              These Terms do not create any third-party beneficiary rights except for our affiliates, officers, directors, and employees.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">16.6 Headings</h3>
            <p className="text-gray-700 leading-relaxed">
              Section headings are for convenience only and do not affect interpretation.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">16.7 Language</h3>
            <p className="text-gray-700 leading-relaxed">
              If these Terms are translated, the English version controls in case of conflict.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">17. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by the laws of the Federal Republic of Nigeria without regard to conflict 
              of law principles. You agree to submit to the jurisdiction of Nigerian courts for any disputes not 
              subject to arbitration.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">18. Dispute Resolution and Arbitration</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">18.1 Mandatory Arbitration</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
              <p className="text-gray-800 font-medium">PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS.</p>
              <p className="text-gray-700 text-sm mt-2">
                <strong>YOU AGREE THAT ANY DISPUTE, CLAIM, OR CONTROVERSY</strong> arising from or relating to 
                these Terms or the Platform (excluding intellectual property claims and requests for injunctive relief) 
                <strong>SHALL BE RESOLVED EXCLUSIVELY THROUGH BINDING ARBITRATION</strong> rather than in court.
              </p>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">18.2 Arbitration Rules</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Arbitration shall be conducted under the Arbitration and Conciliation Act of Nigeria:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Administered by the Lagos Court of Arbitration (LCA)</li>
              <li>Conducted in English</li>
              <li>One arbitrator mutually agreed or appointed by LCA</li>
              <li>Held in Lagos, Nigeria or remotely by agreement</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">18.3 Arbitration Costs</h3>
            <p className="text-gray-700 leading-relaxed">
              Each party bears their own legal fees. Arbitrator fees and administrative costs are split equally. 
              If you prevail, we may reimburse your reasonable costs.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">18.4 Class Action Waiver</h3>
            <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
              <p className="text-gray-800 font-medium mb-2">CLASS ACTION WAIVER</p>
              <p className="text-gray-700 text-sm">
                <strong>YOU AGREE THAT:</strong> Arbitration will be conducted on an individual basis only. 
                <strong>NO CLASS ACTIONS, CLASS ARBITRATIONS, OR REPRESENTATIVE ACTIONS ARE PERMITTED.</strong> 
                You waive the right to participate in class actions. Claims cannot be joined or consolidated without consent.
              </p>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">18.5 Opt-Out Right</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You may opt out of this arbitration agreement within 30 days of account creation by emailing 
              {BRAND.LEGAL_EMAIL} with:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>&quot;ARBITRATION OPT-OUT&quot; in subject line</li>
              <li>Your full name and email address</li>
              <li>Statement that you decline arbitration agreement</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">18.6 Small Claims Exception</h3>
            <p className="text-gray-700 leading-relaxed">
              Either party may bring claims in small claims court if the claim qualifies and remains in that court.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">18.7 Injunctive Relief</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Either party may seek injunctive relief in court for: intellectual property infringement, 
              unauthorized access to systems, or violations requiring immediate action.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">19. Compliance with Nigerian Law</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">19.1 Nigerian Law Compliance</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You agree to comply with all applicable Nigerian laws, including:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Federal Competition and Consumer Protection Act (FCCPA)</li>
              <li>Nigeria Data Protection Regulation (NDPR)</li>
              <li>Cybercrimes Act</li>
              <li>Money Laundering (Prohibition) Act</li>
              <li>Tax laws and regulations</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">19.2 Reporting Obligations</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You acknowledge that we may:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Report suspicious activities to law enforcement</li>
              <li>Comply with legal process and government requests</li>
              <li>Disclose information to prevent harm or fraud</li>
              <li>Cooperate with regulatory investigations</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">19.3 Export Controls</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You may not use the Platform if you are:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Located in a country subject to Nigerian embargoes</li>
              <li>Listed on any Nigerian government prohibited parties list</li>
              <li>Engaged in activities restricted by export laws</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">20. Contact Information</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              For questions, concerns, or legal notices regarding these Terms:
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-gray-800 font-medium">{BRAND.LEGAL_NAME}</p>
              <p className="text-gray-700 mt-2">
                <strong>Legal:</strong> <a href={`mailto:${BRAND.LEGAL_EMAIL}`} className="text-blue-600 hover:underline">{BRAND.LEGAL_EMAIL}</a>
              </p>
              <p className="text-gray-700">
                <strong>Support:</strong> <a href={`mailto:${BRAND.SUPPORT_EMAIL}`} className="text-blue-600 hover:underline">{BRAND.SUPPORT_EMAIL}</a>
              </p>
              <p className="text-gray-700 text-sm mt-3 italic">
                For legal notices, use certified mail or email with read receipt confirmation.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">21. Acknowledgment</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-gray-800 font-medium mb-2">BY CLICKING &quot;I AGREE,&quot; CREATING AN ACCOUNT, OR USING THE PLATFORM, YOU ACKNOWLEDGE THAT:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
                <li>You have read and understood these Terms</li>
                <li>You agree to be bound by these Terms</li>
                <li>You understand the limitation of liability and arbitration clauses</li>
                <li>You waive any rights inconsistent with these Terms</li>
                <li>You are of legal age to enter into a binding contract</li>
                <li>You have the authority to agree to these Terms</li>
              </ul>
            </div>
          </section>

          <div className="border-t border-gray-200 pt-6 mt-8">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} {BRAND.NAME}. All rights reserved.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              These Terms are effective as of {new Date().toLocaleDateString('en-NG', { 
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