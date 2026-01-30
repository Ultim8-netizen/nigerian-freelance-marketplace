// src/components/jobs/JobCard.tsx
// Job posting card component

'use client';

import Link from 'next/link';
import type { JobWithClient } from '@/types/extended.types';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, DollarSign, Users } from 'lucide-react';

interface JobCardProps {
  job: JobWithClient;
}

export function JobCard({ job }: JobCardProps) {
  const getBudgetDisplay = () => {
    if (job.budget_type === 'fixed' && job.budget_min) {
      return formatCurrency(job.budget_min);
    }
    if (job.budget_type === 'hourly' && job.budget_min) {
      return `${formatCurrency(job.budget_min)}/hr`;
    }
    if (job.budget_min && job.budget_max) {
      return `${formatCurrency(job.budget_min)} - ${formatCurrency(job.budget_max)}`;
    }
    return 'Negotiable';
  };

  return (
    <Link href={`/jobs/${job.id}`}>
      <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-xl">{job.title}</h3>
          <Badge variant="secondary">{job.category}</Badge>
        </div>

        <p className="text-gray-600 mb-4 line-clamp-2">{job.description}</p>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            <span className="font-medium">{getBudgetDisplay()}</span>
          </div>

          {job.experience_level && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span className="capitalize">{job.experience_level}</span>
            </div>
          )}

          {job.deadline && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Due: {formatRelativeTime(job.deadline)}</span>
            </div>
          )}

          {job.client?.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{job.client.location}</span>
            </div>
          )}
        </div>

        {job.required_skills && job.required_skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {job.required_skills.slice(0, 5).map((skill, index) => (
              <Badge key={index} variant="outline">
                {skill}
              </Badge>
            ))}
            {job.required_skills.length > 5 && (
              <Badge variant="outline">+{job.required_skills.length - 5} more</Badge>
            )}
          </div>
        )}

        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>
            {job.created_at ? formatRelativeTime(job.created_at) : 'Recently posted'}
          </span>
          <span>{job.proposals_count ?? 0} proposals</span>
        </div>
      </Card>
    </Link>
  );
}