# 🇳🇬 Nigerian Freelance Marketplace

A comprehensive freelance marketplace connecting Nigerian students and professionals with clients. Built with Next.js 14+, Supabase, and Flutterwave.

## ✨ Features

- 🎓 **Student-Focused**: Tailored for Nigerian university students
- 💰 **Secure Payments**: Escrow system with Flutterwave integration
- 📍 **Location-Based**: Find services and opportunities near you
- 🔒 **Identity Verification**: NIN and student ID verification
- ⭐ **Rating System**: Build your reputation
- 💬 **Real-time Messaging**: Communicate with clients/freelancers
- 🎨 **Service Packages**: Offer tiered services (basic, standard, premium)
- 🏆 **Job Bidding**: Freelancers can bid on posted jobs
- 🛡️ **Dispute Resolution**: Protected transactions with admin mediation

## 🚀 Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Payments**: Flutterwave
- **Storage**: Cloudinary
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **TypeScript**: Full type safety

## 📋 Prerequisites

- Node.js 18+ and npm 9+
- Supabase account
- Cloudinary account
- Flutterwave account (test mode for development)

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/nigerian-freelance-marketplace.git
cd nigerian-freelance-marketplace
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual credentials (see `.env.example` for details).

### 4. Set up Supabase

1. Create a new Supabase project at https://supabase.com
2. Run the database schema:
   - Go to SQL Editor in Supabase Dashboard
   - Copy and paste the entire content from the schema file provided in the documents
   - Execute the SQL

3. Set up Row Level Security (RLS):
   - The schema already includes RLS policies
   - Verify they're enabled in Authentication → Policies

4. Create storage bucket for images:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true);

CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');
```

### 5. Set up Cloudinary

1. Go to https://cloudinary.com/console
2. Get your Cloud Name, API Key, and API Secret
3. Create an unsigned upload preset:
   - Settings → Upload → Add upload preset
   - Name: `marketplace_unsigned`
   - Signing Mode: **Unsigned**
   - Folder: `marketplace`
   - Apply these transformations:
     - Auto format (`f_auto`)
     - Auto quality (`q_auto:good`)
     - Max dimensions: 1920x1920

### 6. Set up Flutterwave

1. Sign up at https://flutterwave.com
2. Get test API keys from Dashboard → Settings → API
3. Use test keys (start with `FLWPUBK_TEST-`)
4. For production, use live keys (start with `FLWPUBK-`)

### 7. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Dashboard pages
│   ├── api/                 # API routes
│   └── ...
├── components/
│   ├── auth/               # Auth components
│   ├── services/           # Service components
│   ├── orders/             # Order components
│   ├── ui/                 # UI components
│   └── ...
├── hooks/                  # React Query hooks
├── lib/
│   ├── supabase/          # Supabase client
│   ├── flutterwave/       # Payment integration
│   ├── cloudinary/        # Image upload
│   └── ...
├── types/                 # TypeScript types
└── store/                # (Deprecated - using React Query now)
```

## 🔑 Key Files

- `src/lib/query-client.ts` - React Query configuration
- `src/hooks/useAuth.query.ts` - Authentication hooks
- `src/app/api/orders/` - Order management APIs
- `src/app/api/payments/` - Payment processing APIs
- Database schema in provided documents

## 🧪 Testing

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Run tests
npm test

# Build test
npm run build
```

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables from `.env.local`
4. Deploy!

### Environment Variables for Production

Set these in Vercel:
- All variables from `.env.local`
- Change `NEXT_PUBLIC_APP_URL` to your production domain
- Use Flutterwave **live** keys (not test keys)
- Set `NODE_ENV=production`

### Post-Deployment

1. Test payment flow with real cards
2. Set up monitoring (Sentry recommended)
3. Configure custom domain
4. Enable Supabase Auth email templates
5. Set up cron job for:
   - Processing pending clearances (daily)
   - Sending reminder emails

## 📊 Database Maintenance

### Run Pending Clearances (Cron Job)

```sql
-- Run this daily to release funds from escrow after 7 days
SELECT process_pending_clearances();
```

Set up in Vercel Cron or use Supabase Database Webhooks.

### Backup Database

```bash
# Using Supabase CLI
supabase db dump -f backup.sql
```

## 🔒 Security Checklist

- [x] Environment variables secured
- [x] RLS policies enabled
- [x] Rate limiting implemented
- [x] Input sanitization (DOMPurify)
- [x] CSRF protection
- [x] Password requirements enforced
- [x] Secure payment flow
- [ ] SSL certificate (automatic with Vercel)
- [ ] Security headers configured
- [ ] Regular security audits

## 🐛 Common Issues

### "localStorage is not defined"
Only access in `useEffect` or with `typeof window !== 'undefined'` check.

### Payment initialization fails
- Check Flutterwave keys are correct
- Verify you're using test keys for development
- Check secret key is NOT in client-side code

### Images not uploading
- Verify Cloudinary unsigned preset is enabled
- Check cloud name and upload preset match
- Ensure file size is under 5MB

### Database connection errors
- Check Supabase URL and keys
- Verify RLS policies allow the operation
- Check user is authenticated

## 📚 Documentation

- [Implementation Guide](./IMPLEMENTATION_GUIDE.md) - Detailed setup instructions
- [API Documentation](./API.md) - API endpoints reference
- [Database Schema](./SCHEMA.md) - Database structure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Write meaningful commit messages
- Add comments for complex logic

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Supabase for backend infrastructure
- Flutterwave for payment processing
- Cloudinary for image management
- All contributors

## 📧 Support

- Email: support@nigerianfreelance.com
- GitHub Issues: [Create an issue](https://github.com/yourusername/nigerian-freelance-marketplace/issues)
- Documentation: [View docs](https://docs.nigerianfreelance.com)

## 🗺️ Roadmap

### Phase 1 (Current)
- [x] Basic user authentication
- [x] Service listings
- [x] Job postings
- [x] Order management
- [x] Payment integration
- [x] Escrow system

### Phase 2 (Next)
- [ ] Real-time messaging
- [ ] Advanced search
- [ ] Email notifications
- [ ] SMS verification
- [ ] Mobile app (React Native)

### Phase 3 (Future)
- [ ] Video calls
- [ ] Team accounts
- [ ] Subscription plans
- [ ] Affiliate program
- [ ] API for third-party integrations

## 📈 Performance

- Lighthouse Score: 95+ (target)
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Cumulative Layout Shift: <0.1

## 🌍 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

**Made with ❤️ for Nigerian students and freelancers**