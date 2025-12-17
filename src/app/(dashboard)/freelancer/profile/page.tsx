// src/app/(dashboard)/freelancer/profile/page.tsx
// Freelancer profile management

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Edit2, Star, Award, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FreelancerProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/onboarding');
  }

  const { data: services } = await supabase
    .from('services')
    .select('id')
    .eq('freelancer_id', user.id)
    .eq('is_active', true);

  const { count: completedJobs } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('freelancer_id', user.id)
    .eq('status', 'completed');

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Profile</h1>
        <Link href="/dashboard/settings/profile">
          <Button>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </Link>
      </div>

      {/* Profile Header */}
      <Card className="p-8 mb-8">
        <div className="flex gap-6 mb-6">
          {profile.profile_image_url ? (
            <Image
              src={profile.profile_image_url}
              alt={profile.full_name}
              width={120}
              height={120}
              className="rounded-full"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-blue-500 text-white flex items-center justify-center text-4xl font-bold">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold">{profile.full_name}</h2>
              {profile.identity_verified && (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Verified
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-6 mb-4">
              <div>
                <p className="text-sm text-gray-600">Rating</p>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(profile.freelancer_rating || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-2 font-medium">{(profile.freelancer_rating || 0).toFixed(1)}</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">Jobs Completed</p>
                <p className="text-2xl font-bold">{completedJobs || 0}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Active Services</p>
                <p className="text-2xl font-bold">{services?.length || 0}</p>
              </div>
            </div>

            {profile.bio && (
              <p className="text-gray-700">{profile.bio}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Award className="w-6 h-6 text-blue-600" />
            <h3 className="font-semibold">Skills & Expertise</h3>
          </div>
          {profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill: string, i: number) => (
                <Badge key={i} variant="outline">{skill}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No skills added yet</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Star className="w-6 h-6 text-purple-600" />
            <h3 className="font-semibold">Verification Status</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {profile.identity_verified ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span>Identity Verified</span>
            </div>
            <div className="flex items-center gap-2">
              {profile.student_verified ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span>Student Status</span>
            </div>
          </div>
        </Card>
      </Grid>

      {/* About Section */}
      <Card className="p-6 mb-8">
        <h3 className="text-lg font-semibold mb-3">About You</h3>
        <div className="space-y-3 text-sm text-gray-700">
          {profile.location && (
            <p><strong>Location:</strong> {profile.location}</p>
          )}
          {profile.university && (
            <p><strong>University:</strong> {profile.university}</p>
          )}
          {profile.email && (
            <p><strong>Email:</strong> {profile.email}</p>
          )}
          <p><strong>Member Since:</strong> {new Date(profile.created_at).toLocaleDateString('en-NG')}</p>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="space-y-3">
        <Link href="/freelancer/services/new" className="block">
          <Button className="w-full">Create New Service</Button>
        </Link>
        <Link href="/freelancer/earnings" className="block">
          <Button variant="outline" className="w-full">View Earnings</Button>
        </Link>
      </div>
    </div>
  );
}