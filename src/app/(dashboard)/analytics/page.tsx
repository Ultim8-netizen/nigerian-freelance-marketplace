'use client';
import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, DollarSign, LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Analytics & Insights</h1>
      
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Earnings" value="₦0.00" icon={DollarSign} color="text-green-600" />
        <StatCard title="Total Orders" value="0" icon={BarChart3} color="text-blue-600" />
        <StatCard title="Profile Views" value="0" icon={Users} color="text-purple-600" />
        <StatCard title="Success Rate" value="100%" icon={TrendingUp} color="text-orange-600" />
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <Card className="p-6 h-64 flex items-center justify-center bg-gray-50 border-dashed">
          <p className="text-gray-500">Earnings Chart (Coming Soon)</p>
        </Card>
        <Card className="p-6 h-64 flex items-center justify-center bg-gray-50 border-dashed">
            <p className="text-gray-500">Profile Traffic (Coming Soon)</p>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        </div>
        <div className={`p-3 bg-gray-100 rounded-full ${color}`}>
          <Icon size={24} />
        </div>
      </div>
    </Card>
  );
}