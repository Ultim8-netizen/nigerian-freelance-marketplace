// src/components/orders/OrderCard.tsx
// Order management card

'use client';

import { Order } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, User, DollarSign } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  userType: 'client' | 'freelancer';
  onAction?: (action: string, order: Order) => void;
}

export function OrderCard({ order, userType, onAction }: OrderCardProps) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_payment: 'bg-yellow-100 text-yellow-800',
      awaiting_delivery: 'bg-blue-100 text-blue-800',
      delivered: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      disputed: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const otherParty = userType === 'client' ? order.freelancer : order.client;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">{order.order_number}</p>
          <h3 className="font-semibold text-lg">{order.title}</h3>
        </div>
        <Badge className={getStatusColor(order.status)}>
          {order.status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      <p className="text-gray-600 mb-4">{order.description}</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500">
            {userType === 'client' ? 'Freelancer' : 'Client'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <User className="w-4 h-4" />
            <span className="font-medium">{otherParty?.full_name}</span>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500">Amount</p>
          <div className="flex items-center gap-2 mt-1">
            <DollarSign className="w-4 h-4" />
            <span className="font-medium">{formatCurrency(order.amount)}</span>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500">Delivery Date</p>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-4 h-4" />
            <span className="font-medium">{formatDate(order.delivery_date)}</span>
          </div>
        </div>

        {order.delivered_at && (
          <div>
            <p className="text-sm text-gray-500">Delivered</p>
            <span className="font-medium">{formatDate(order.delivered_at)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {order.status === 'awaiting_delivery' && userType === 'freelancer' && (
          <Button
            onClick={() => onAction?.('deliver', order)}
            className="flex-1"
          >
            Deliver Work
          </Button>
        )}

        {order.status === 'delivered' && userType === 'client' && (
          <>
            <Button
              onClick={() => onAction?.('approve', order)}
              variant="default"
              className="flex-1"
            >
              Approve & Complete
            </Button>
            <Button
              onClick={() => onAction?.('request_revision', order)}
              variant="outline"
              className="flex-1"
            >
              Request Revision
            </Button>
          </>
        )}

        <Button
          onClick={() => onAction?.('view', order)}
          variant="outline"
          className="flex-1"
        >
          View Details
        </Button>
      </div>
    </Card>
  );
}