'use client';

import { useEffect, useState, } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle,
  Loader2,
  CheckCircle,
  Clock,
  Trash2,
} from 'lucide-react';

interface Report {
  id: string;
  type: 'user' | 'content' | 'transaction' | 'other';
  title: string;
  description: string;
  reporter: string;
  status: 'open' | 'pending' | 'resolved';
  created_at: string;
  updated_at: string;
}

export function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const response = await fetch(`/api/admin/reports${query}`);
      const data = await response.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId: string) => {
    setActionLoading(reportId);
    try {
      await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
      });
      fetchReports();
    } catch (error) {
      console.error('Failed to resolve report:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Delete this report?')) return;

    setActionLoading(reportId);
    try {
      await fetch(`/api/admin/reports/${reportId}`, {
        method: 'DELETE',
      });
      fetchReports();
    } catch (error) {
      console.error('Failed to delete report:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-blue-100 text-blue-800';
      case 'content':
        return 'bg-yellow-100 text-yellow-800';
      case 'transaction':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'success';
      case 'pending':
        return 'warning';
      default:
        return 'destructive';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">Manage user reports and violations</p>
      </div>

      {/* Filter */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by status:</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </Card>
        ) : reports.length === 0 ? (
          <Card className="p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No reports found</p>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <h3 className="font-semibold text-lg text-gray-900">
                      {report.title}
                    </h3>
                    <Badge className={getTypeColor(report.type)}>
                      {report.type.charAt(0).toUpperCase() + report.type.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-gray-600 mb-3">{report.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Reporter: {report.reporter}</span>
                    <span>
                      Created: {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <Badge
                    variant={getStatusColor(report.status)}
                    className="flex items-center gap-1"
                  >
                    {getStatusIcon(report.status)}
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </Badge>

                  <div className="flex items-center gap-2">
                    {report.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(report.id)}
                        disabled={actionLoading === report.id}
                      >
                        {actionLoading === report.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-1" />
                        )}
                        Resolve
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(report.id)}
                      disabled={actionLoading === report.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {actionLoading === report.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}