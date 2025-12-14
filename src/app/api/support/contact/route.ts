// src/app/api/support/contact/route.ts
// API route to handle support form submissions and send emails

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Validation schema
const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Please select a subject'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
});

// Your email address
const SUPPORT_EMAIL = 'eldergod263@gmail.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validated = contactSchema.parse(body);

    // Get user's IP and user agent for logging
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Format email content
    const emailContent = `
NEW SUPPORT REQUEST - F9 Marketplace
=====================================

From: ${validated.name}
Email: ${validated.email}
Subject: ${validated.subject}
Submitted: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}

IP Address: ${ip}
User Agent: ${userAgent}

MESSAGE:
--------
${validated.message}

=====================================
Reply to: ${validated.email}
    `.trim();

    // OPTION 1: Using Resend (Recommended - requires setup)
    // Uncomment and configure when Resend is set up
    /*
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'F9 Support <noreply@yourdomain.com>',
      to: SUPPORT_EMAIL,
      subject: `[F9 Support] ${validated.subject} - ${validated.name}`,
      text: emailContent,
      reply_to: validated.email,
    });
    */

    // OPTION 2: Using Nodemailer with Gmail (Simple setup)
    // Requires: npm install nodemailer @types/nodemailer
    const nodemailer = await import('nodemailer');
    
    // Create transporter with Gmail
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || SUPPORT_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD, // App-specific password
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"F9 Support Form" <${process.env.GMAIL_USER || SUPPORT_EMAIL}>`,
      to: SUPPORT_EMAIL,
      subject: `[F9 Support] ${validated.subject} - ${validated.name}`,
      text: emailContent,
      replyTo: validated.email,
    });

    // Log successful submission
    console.log('Support email sent:', {
      from: validated.email,
      subject: validated.subject,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully. We will respond within 24-48 hours.',
    }, { status: 200 });

  } catch (error) {
    // Validation error
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: error.issues[0]?.message || 'Invalid form data',
        details: error.issues,
      }, { status: 400 });
    }

    // Email sending error
    console.error('Support email error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to send message. Please try again or email us directly at eldergod263@gmail.com',
    }, { status: 500 });
  }
}