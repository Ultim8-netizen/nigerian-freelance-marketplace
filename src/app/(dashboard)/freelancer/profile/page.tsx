import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrustBadge } from '@/components/ui/TrustBadge';
import Image from 'next/image';
import { Edit2, Star, Award, CheckCircle, MapPin, Calendar, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import type { Profile, Service, Wallet } from '@/types/index';

export default async function FreelancerProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch profile with proper typing
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (profileError || !profile) {
    redirect('/onboarding');
  }

  // Fetch active services with proper typing
  const { data: services } = await supabase
    .from('services')
    .select('id, title, base_price, views_count, orders_count')
    .eq('freelancer_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .returns<Pick<Service, 'id' | 'title' | 'base_price' | 'views_count' | 'orders_count'>[]>();

  // Fetch completed orders count
  const { count: completedJobs } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('freelancer_id', user.id)
    .eq('status', 'completed');

  // Fetch wallet balance with proper typing
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', user.id)
    .single<Pick<Wallet, 'balance'>>();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header with Edit Button */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your Profile</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your freelancer profile</p>
          </div>
          <Link href="/dashboard/settings">
            <Button className="gap-2">
              <Edit2 className="w-4 h-4" />
              Edit Settings
            </Button>
          </Link>
        </div>

        {/* Profile Header Card */}
        <Card className="p-8 mb-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex gap-8 mb-8">
            {/* Profile Image */}
            <div className="shrink-0">
              {profile.profile_image_url ? (
                <Image
                  src={profile.profile_image_url}
                  alt={profile.full_name}
                  width={120}
                  height={120}
                  className="rounded-full border-4 border-blue-500"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-linear-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-5xl font-bold border-4 border-blue-500">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{profile.full_name}</h2>
                {profile.identity_verified && (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Verified
                  </Badge>
                )}
              </div>

              {/* Trust Level Badge */}
              <div className="mb-4">
                <TrustBadge 
                  level={(profile.trust_level || 'new') as 'new' | 'verified' | 'trusted' | 'elite'}
                  score={profile.trust_score || 0}
                  size="md"
                />
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Rating</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(profile.freelancer_rating || 0)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white ml-1">
                      {(profile.freelancer_rating || 0).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Jobs Completed</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{completedJobs || 0}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Services</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{services?.length || 0}</p>
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Contact & Location Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Location
            </h3>
            <div className="space-y-3">
              {profile.location && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Current Location</p>
                  <p className="text-gray-900 dark:text-white font-medium">{profile.location}</p>
                </div>
              )}
              {profile.university && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">University</p>
                  <p className="text-gray-900 dark:text-white font-medium">{profile.university}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Verification Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {profile.identity_verified ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                )}
                <span className="text-gray-900 dark:text-white">Identity Verified</span>
              </div>
              <div className="flex items-center gap-3">
                {profile.student_verified ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                )}
                <span className="text-gray-900 dark:text-white">Student Status</span>
              </div>
              <div className="flex items-center gap-3">
                {profile.liveness_verified ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                )}
                <span className="text-gray-900 dark:text-white">Liveness Verified</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Contact Information */}
        <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <p className="text-gray-900 dark:text-white font-medium">{profile.email}</p>
              </div>
            </div>
            {profile.phone_number && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                  <p className="text-gray-900 dark:text-white font-medium">{profile.phone_number}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {profile.created_at && new Date(profile.created_at).toLocaleDateString('en-NG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Earnings Overview */}
        {wallet && (
          <Card className="p-6 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-900 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Wallet Balance
            </h3>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              ₦{(wallet.balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </Card>
        )}

        {/* Active Services */}
        {services && services.length > 0 && (
          <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Services ({services.length})</h3>
            <div className="space-y-3">
              {services.slice(0, 5).map((service) => (
                <div key={service.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{service.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">₦{Number(service.base_price).toLocaleString('en-NG')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{service.views_count || 0} views</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{service.orders_count || 0} orders</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/freelancer/services" className="block mt-4">
              <Button variant="outline" fullWidth>
                View All Services
              </Button>
            </Link>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/freelancer/services/new">
            <Button fullWidth className="gap-2">
              <Star className="w-4 h-4" />
              Create New Service
            </Button>
          </Link>
          <Link href="/freelancer/earnings">
            <Button variant="outline" fullWidth className="gap-2">
              <Award className="w-4 h-4" />
              View Earnings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}