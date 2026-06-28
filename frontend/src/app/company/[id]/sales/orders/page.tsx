'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Search, ChevronDown, ChevronRight, ChevronUp, Trash2, Loader2, ShoppingBag, Truck, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import DetailPanel from '@/components/DetailPanel';
import { usePermissions } from '@/hooks/usePermissions';

interface SalesOrderLine {
  id: string;
  productId?: string;
  product?: { name: string };
  description: string;
  quantity: number;
  unitPrice: number;
}

interface SalesOrder {
  id: string;
  soNumber: string;
  soDate: string;
  totalBDT: number;
  totalAmount: number;
  currency: string;
  status: string;
  customer?: { id: string; name: string; code: string };
  lines: SalesOrderLine[];
  purchaseOrders: any[];
  dns: any[];
  invoices: any[];
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const PAGE_SIZE = 20;

function SalesOrdersPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'local' | 'foreign'>('local');
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const { canView, canCreate, canEdit, canDelete, isLoading: permsLoading } = usePermissions('sales.orders', companyId);

  useEffect(() => { setMounted(true); }, []);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['sales-orders', companyId, activeTab, searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get(`/company/${companyId}/sales-orders`, {
        params: {
          page: pageParam,
          limit: PAGE_SIZE,
          currency: activeTab === 'local' ? 'BDT' : 'USD',
          search: searchTerm || undefined,
        },
      });
      return response.data.data as PaginatedResponse<SalesOrder>;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!companyId && mounted,
  });

  const salesOrders = (Array.isArray(data?.pages) ? data.pages : []).flatMap(page => Array.isArray(page?.data) ? page.data : []) || [];

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase-orders`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const assignPOMutation = useMutation({
    mutationFn: async ({ soId, poId, action }: { soId: string; poId: string; action: 'connect' | 'disconnect' }) => {
      await api.post(`/company/${companyId}/sales-orders/${soId}/assign-po`, { poId, action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/company/${companyId}/sales-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
    },
  });

  const generateDCMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/company/${companyId}/sales-orders/${id}/dn`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      toast.success('Delivery Challan generated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to generate DC');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.post(`/company/${companyId}/sales-orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
    },
  });

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: newStatus });
      toast.success(`Order ${newStatus.toLowerCase()}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '--';
    return new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const filteredOrders = (Array.isArray(salesOrders) ? salesOrders : []).filter((order: any) => 
    order.currency === (activeTab === 'local' ? 'BDT' : 'USD')
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-600',
      CONFIRMED: 'bg-blue-100 text-blue-600',
      FULFILLED: 'bg-purple-100 text-purple-600',
      INVOICED: 'bg-amber-100 text-amber-600',
      COMPLETED: 'bg-green-100 text-green-600',
      CANCELLED: 'bg-red-100 text-red-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  if (!mounted) return null;

  if (!permsLoading && !canView) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            Sales Orders
          </h1>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('local')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'local' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Local
            </button>
            <button
              onClick={() => setActiveTab('foreign')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'foreign' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Export
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {canCreate && (
            <button
              onClick={() => router.push(`/company/${companyId}/sales/orders/create?type=${activeTab}`)}
              className="bg-gray-900 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              New Order
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <ShoppingBag className="w-12 h-12 mb-2" />
            <p className="text-sm font-medium">No orders found</p>
            <button
              onClick={() => router.push(`/company/${companyId}/sales/orders/create?type=${activeTab}`)}
              className="mt-4 text-blue-600 text-sm font-medium hover:underline"
            >
              Create your first order
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order: SalesOrder) => (
                <tr
                  key={order.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/company/${companyId}/sales/orders/${order.id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-slate-900">{order.soNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(order.soDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900 text-sm">{order.customer?.name}</span>
                      <span className="text-xs text-slate-400">{order.customer?.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-semibold text-slate-900">
                      {order.currency} {formatCurrency(order.totalAmount || order.totalBDT)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-bold', getStatusColor(order.status))}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {order.status === 'DRAFT' && (
                        <>
                          {canEdit && (
                            <button
                              onClick={() => handleStatusUpdate(order.id, 'CONFIRMED')}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Confirm"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => deleteMutation.mutate(order.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      {order.status === 'CONFIRMED' && (
                        <button
                          onClick={() => generateDCMutation.mutate(order.id)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                          title="Generate Delivery Challan"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      )}
                      {order.status === 'FULFILLED' && (
                        <button
                          onClick={() => router.push(`/company/${companyId}/sales/invoices/create?soId=${order.id}`)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                          title="Create Sales Invoice"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/company/${companyId}/pis/create?soId=${order.id}`)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        title="Create Proforma Invoice"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data?.pages[0]?.pagination && (
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Showing {((data.pages[0].pagination.page - 1) * PAGE_SIZE) + 1} - {Math.min(data.pages[0].pagination.page * PAGE_SIZE, data.pages[0].pagination.total)} of {data.pages[0].pagination.total.toLocaleString()} orders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              disabled={data.pages[0].pagination.page === 1}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchNextPage()}
              disabled={!hasNextPage || isFetchingNextPage}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : hasNextPage ? (
                <>
                  Load More
                  <ChevronDown className="w-4 h-4" />
                </>
              ) : (
                'No more orders'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesOrdersPage;