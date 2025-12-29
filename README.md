F9 - Hustle Forward 🇳🇬
Nigeria's Premier Student Freelance & Marketplace Platform

F9 is a specialized platform designed to bridge the gap between talented Nigerian students and the gig economy. Unlike traditional freelance platforms, F9 removes structural barriers (like complex ID requirements for entry) by utilizing a Trust Score system and Liveness Verification, allowing students to trade skills, services, and products securely within their university communities and beyond.

🚀 Key Features
💼 Freelance Hub
Service Listings: Freelancers can post detailed service offerings with packages and pricing.

Job Board: Clients can post custom jobs; freelancers can submit proposals.

Escrow Payments: All service transactions are secured via an escrow system to protect both parties.

Smart Matching: Filter by university, state, and skill level.

🛍️ Student Marketplace
Buy & Sell: A dedicated space for physical goods (textbooks, gadgets, fashion).

Campus-Centric: optimized for local pickups and campus deliveries.

Seller Ratings: Verified reviews and trust badges for vendors.

🛡️ Trust & Safety
Liveness Verification: AI-powered biometric face detection (using MediaPipe) to verify humanity without needing immediate government ID.

Trust Score: A dynamic scoring system (0-100) based on behavior, completion rates, and verification status.

Dispute Resolution: Built-in tools for handling order conflicts.

💳 Payments
Flutterwave Integration: Native support for Nigerian payment methods (Card, USSD, Bank Transfer).

Wallet System: Internal wallet for managing earnings and withdrawals.

🛠️ Tech Stack
Frontend & Framework

Next.js 16 (App Router)

React 19

TypeScript

Tailwind CSS (v4)

Framer Motion (Animations)

Shadcn/UI & Radix UI (Component Library)

Backend & Database

Supabase (PostgreSQL, Auth, Realtime)

TanStack Query (Data Fetching & State Management)

Zod (Data Validation)

Infrastructure & Services

Flutterwave (Payment Processing)

Cloudinary (Image Optimization & Storage)

Upstash (Redis) (Rate Limiting)

Google MediaPipe (Face Detection/Liveness)

⚙️ Prerequisites
Before you begin, ensure you have the following installed:

Node.js (v18.0.0 or higher)

npm or yarn

Git

🚀 Getting Started
1. Clone the Repository
Bash

git clone https://github.com/your-username/f9-marketplace.git
cd f9-marketplace
2. Install Dependencies
Bash

npm install
# or
yarn install
3. Environment Configuration
Create a .env.local file in the root directory. You can copy the template from .env.example:

Bash

cp .env.example .env.local
Fill in the following required variables:

Code snippet

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Flutterwave (Payments)
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=your_flw_public_key
FLUTTERWAVE_SECRET_KEY=your_flw_secret_key
FLUTTERWAVE_ENCRYPTION_KEY=your_flw_enc_key
FLUTTERWAVE_WEBHOOK_SECRET=your_webhook_secret

# Cloudinary (Images)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=marketplace_unsigned
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENCRYPTION_KEY=32_byte_hex_string
4. Database Setup
Go to your Supabase Dashboard.

Navigate to the SQL Editor.

Copy the content from database/schema.sql.

Run the script to create tables, RLS policies, functions, and triggers.

5. Run the Development Server
Bash

npm run dev
Open http://localhost:3000 with your browser.

📂 Project Structure
Plaintext

src/
├── app/                  # Next.js App Router pages and API routes
│   ├── (auth)/           # Authentication routes (login, register)
│   ├── (dashboard)/      # Protected dashboard routes (client/freelancer)
│   ├── api/              # Backend API endpoints
│   ├── marketplace/      # Marketplace product pages
│   ├── services/         # Freelance service browsing
│   └── verification/     # Liveness verification pages
├── components/           # Reusable React components
│   ├── ui/               # Base UI elements (buttons, inputs)
│   ├── cloudinary/       # Image uploaders
│   └── ...
├── contexts/             # React Contexts (User state)
├── hooks/                # Custom hooks (useAuth, useOrders)
├── lib/                  # Utilities and library configurations
│   ├── api/              # Middleware & Error handling
│   ├── flutterwave/      # Payment logic
│   ├── mediapipe/        # Face detection logic
│   └── supabase/         # Database clients
└── types/                # TypeScript definitions
🧪 Scripts
npm run dev: Starts the development server.

npm run build: Builds the application for production.

npm run start: Starts the production server.

npm run lint: Runs ESLint checks.

npm run type-check: Runs TypeScript compiler check.

npm run format: Formats code using Prettier.

🔒 Security Features
RLS (Row Level Security): All database access is scoped to the authenticated user via Supabase policies.

Rate Limiting: API routes are protected by Upstash Redis to prevent abuse.

Input Sanitization: All user inputs are sanitized using DOMPurify and Zod validation.

CSRF Protection: Custom CSRF handling for API routes.

Secure Uploads: Signed Cloudinary uploads preventing unauthorized file hosting.

🤝 Contributing
Contributions are welcome! Please follow these steps:

Fork the repository.

Create a feature branch (git checkout -b feature/AmazingFeature).

Commit your changes (git commit -m 'Add some AmazingFeature').

Push to the branch (git push origin feature/AmazingFeature).

Open a Pull Request.

Please ensure you run npm run type-check and npm run lint before pushing.

📄 License
This project is proprietary and confidential. Copyright © 2025 F9 Marketplace. All rights reserved.

📞 Support
For support, email support@f9.ng or visit our Support Page.