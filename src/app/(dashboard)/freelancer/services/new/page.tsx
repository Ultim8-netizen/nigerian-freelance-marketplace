'use client';

import { CreateServiceForm } from '@/components/services/CreateServiceForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewServicePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/freelancer/services">
          <Button variant="ghost" size="sm" className="gap-2 pl-0 hover:pl-2 transition-all">
            <ArrowLeft className="w-4 h-4" />
            Back to Services
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mt-2">Create New Service</h1>
        <p className="text-gray-600">Details about what you offer to clients.</p>
      </div>
      
      <CreateServiceForm />
    </div>
  );
}