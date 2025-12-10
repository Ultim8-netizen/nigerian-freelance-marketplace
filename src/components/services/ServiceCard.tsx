// src/components/services/ServiceCard.tsx (enhanced version)
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Service } from '@/types/database.types';
import { formatCurrency, getInitials } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { VerifiedIcon } from '@/components/verification/VerifiedBadge';
import { Star, Clock } from 'lucide-react';

interface ServiceCardProps {
  service: Service & {
    freelancer?: {
      id: string;
      full_name: string;
      profile_image_url?: string;
      freelancer_rating: number;
      total_jobs_completed: number;
      nin_verified?: boolean;
    };
  };
}

export function EnhancedServiceCard({ service }: ServiceCardProps) {
  const freelancer = service.freelancer;
  const imageUrl = service.images?.[0] || '/placeholder-service.png';

  return (
    <Link href={`/services/${service.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
        <div className="relative h-48 bg-gray-200">
          <Image
            src={imageUrl}
            alt={service.title}
            fill
            className="object-cover"
          />
        </div>

        <div className="p-4">
          {/* Freelancer Info with Verification */}
          <div className="flex items-center gap-2 mb-2">
            {freelancer?.profile_image_url ? (
              <Image
                src={freelancer.profile_image_url}
                alt={freelancer.full_name}
                width={24}
                height={24}
                className="rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                {getInitials(freelancer?.full_name || 'U')}
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600">
                {freelancer?.full_name}
              </span>
              {freelancer?.nin_verified && <VerifiedIcon size={14} />}
            </div>
          </div>

          <h3 className="font-semibold text-lg mb-2 line-clamp-2">
            {service.title}
          </h3>

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
            {freelancer && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" />
                <span>{freelancer.freelancer_rating.toFixed(1)}</span>
                <span className="text-gray-400">
                  ({freelancer.total_jobs_completed})
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{service.delivery_days} days</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Starting at</span>
            <span className="text-lg font-bold">
              {formatCurrency(service.base_price)}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}