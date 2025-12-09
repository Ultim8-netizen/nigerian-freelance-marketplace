Nigerian Freelance Marketplace(F9)

A modern, full-stack freelance marketplace designed specifically for Nigeria’s unique digital, economic, and infrastructural landscape. The platform connects freelancers and clients across diverse skill categories while addressing local challenges such as unreliable addresses, payment frictions, onboarding barriers, and service discovery in an informal economy.

Overview

This project provides a scalable foundation for a localized Nigerian freelance ecosystem. It combines a marketplace workflow with supporting tools and utilities that improve trust, visibility, communication, and job completion efficiency. The platform focuses on simplicity at the early stage while remaining extensible for advanced features.

Core Features
1. User Accounts & Profiles

Freelancers and clients have distinct but flexible roles.

Profiles include skills, ratings, portfolios, and verification levels.

Designed to support future KYC integrations.

2. Job Posting & Bidding

Clients can publish job listings with budgets, deadlines, and descriptions.

Freelancers submit proposals directly from their dashboards.

Status transitions: Open → In-Progress → Review → Completed → Closed.

3. Messaging & Communication

Real-time or near-real-time direct messaging for negotiation and project updates.

Initially lightweight, expandable to file sharing and voice notes.

4. Category & Skill Organization

Structured browsing of jobs by categories (design, writing, tech, repairs, etc.).

Flexible enough to incorporate informal and non-tech Nigerian skill sectors.

5. Ratings & Reviews

After job completion, clients can rate freelancers.

Review data contributes to ranking and trust signals.

6. Dashboard & Activity Management

Separate dashboards for clients and freelancers.

Track jobs, proposals, finances, messages, and notifications.

7. Location-Aware Service Discovery (Optional Future Feature)

Lightweight location validation (no heavy real-time tracking).

Users can add descriptive location info (e.g., local landmarks).

Designed for integration with the Descriptive-to-Geospatial Translation Framework (DGTF) for better discovery of informal areas.

8. Payment Architecture (Future)

Designed for later implementation of escrow-based systems.

Support for Nigerian gateways: Paystack, Flutterwave, etc.

Secure ledger and transaction logs prepared for expansion.

Technology Stack
Frontend

Next.js 14 / React 18

TypeScript

TailwindCSS

Modular UI components (Select, Spinner, ProgressBar, etc.)

Backend & API

Next.js server actions

Supabase for authentication and database

Middleware for cookies, sessions, and protected routes

Database

PostgreSQL (Supabase)

Tables for users, jobs, proposals, reviews, messages, and notifications

State & Utilities

Custom hooks

Loading indicators

Validation rules

Reusable UI primitives

Project Structure
/src
  /app
    /api
    /dashboard
    /auth
    ...
  /components
    /ui
      spinner.tsx
      select.tsx
      progressbar.tsx
      ...
  /lib
    supabase.ts
    utils.ts
  /types
  /hooks
  /styles

Installation & Setup
Requirements

Node.js

npm or yarn

Supabase project with API keys

Environment variables (.env.local)

Setup Steps

Clone repository

Install dependencies

Configure environment variables

Run dev server:

npm run dev

Goals & Philosophy

The project aims to:

Provide a fast, lightweight, and locally-relevant freelance platform.

Support both digital and non-digital Nigerian work sectors.

Gradually integrate advanced features without bloating the initial experience.

Tackle challenges like informal addresses, trust gaps, and payment failures.

Build a reliable, modular foundation for long-term expansion.

Future Enhancements

Full DGTF-powered descriptive-location mapping

Advanced search and filtering

Full escrow payment system

Mobile app versions

Real-time activity feeds

AI-assisted proposal generation

Verification and reputation scoring

Offline-friendly modes