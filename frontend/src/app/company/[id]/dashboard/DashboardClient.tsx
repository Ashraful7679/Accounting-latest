'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight,
  BarChart2, FileText, ShoppingCart, Users, Layers,
  BookOpen, Settings, Bell, LogOut, Activity, AlertTriangle,
  CheckCircle, Clock, Loader2
} from 'lucide-react';
import { FinanceCharts } from './components/FinanceCharts';

const QUICK_ACTIONS = [
  { label: 'Journals', icon: BookOpen, path: 'journals' },
  { label: 'Invoices', icon: FileText, path: 'sales/invoices' },
  { label: 'Purchase', icon: ShoppingCart, path: 'purchase' },
  { label: 'Customers', icon: Users, path: 'sales/customers' },
  { label: 'Products', icon: Layers, path: 'products' },
  { label: 'Reports', icon: BarChart2, path: 'reports' },
];

const DRILL_DOWN: Record<string, string> = {
  'Total Revenue': 'reports?id=profit-loss',
  'Cash & Bank': 'reports?id=ledger',
  'Receivables': 'reports?id=customer-aging',
  'Payables': 'reports?id=vendor-aging',
};

import { getCurrencySymbol } from '@/lib/decimalUtils';

function formatCurrency(val: any): string {
  const num = Number(val);
  const symbol = getCurrencySymbol('BDT');
  if (isNaN(num)) return `${symbol}0`;
  if (Math.abs(num) >= 10000000) return `${symbol}${(num / 10000000).toFixed(2)}Cr`;
  if (Math.abs(num) >= 100000) return `${symbol}${(num / 100000).toFixed(2)}L`;
  if (Math.abs(num) >= 1000) return `${symbol}${(num / 1000).toFixed(1)}K`;
  return `${symbol}${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatFullCurrency(val: any): string {
  const num = Number(val);
  const symbol = getCurrencySymbol('BDT');
  if (isNaN(num)) return `${symbol}0`;
  return `${symbol}${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const ACTION_ICONS: Record<string, typeof CheckCircle> = {
  STATUS_REACHED_APPROVED: CheckCircle,
  STATUS_REACHED_VERIFIED: CheckCircle,
  STATUS_REACHED_PENDING_VERIFICATION: Clock,
  STATUS_REACHED_REJECTED: AlertTriangle,
};

export default function DashboardClient() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats', companyId],
    queryFn: async () => {
      const res = await api.get(`/company/${companyId}/dashboard-stats`);
      return res.data.data;
    },
    refetchInterval: 60000, // auto-refresh every 60s
  });

  const kpis = data?.kpis;
  const charts = data?.charts || [];
  const activities = data?.alerts || [];
  const unreadCount = data?.unreadCount || 0;
  const accountingEquation = data?.accountingEquation;

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: kpis?.revenue?.value,
      sub: kpis?.revenue?.growth != null
        ? `${kpis.revenue.growth >= 0 ? '+' : ''}${kpis.revenue.growth.toFixed(1)}% vs last month`
        : 'This month',
      icon: TrendingUp,
      color: 'bg-emerald-500',
      light: 'bg-emerald-50 text-emerald-600',
      breakdown: kpis?.revenue?.breakdown,
    },
    {
      label: 'Cash & Bank',
      value: kpis?.cash?.value,
      sub: 'Live balance',
      icon: DollarSign,
      color: 'bg-blue-500',
      light: 'bg-blue-50 text-blue-600',
      breakdown: kpis?.cash?.breakdown,
    },
    {
      label: 'Receivables',
      value: kpis?.receivables?.value,
      sub: 'Outstanding',
      icon: ArrowUpRight,
      color: 'bg-indigo-500',
      light: 'bg-indigo-50 text-indigo-600',
      breakdown: kpis?.receivables?.breakdown,
    },
    {
      label: 'Payables',
      value: kpis?.payables?.value,
      sub: 'Amount owed',
      icon: ArrowDownRight,
      color: 'bg-rose-500',
      light: 'bg-rose-50 text-rose-600',
      breakdown: kpis?.payables?.breakdown,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {data?.companyName || 'Command Center'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Dashboard overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/company/${companyId}/audit`)}
            className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Bell className="w-5 h-5 text-slate-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push(`/company/${companyId}/settings`)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Settings className="w-5 h-5 text-slate-500" />
          </button>
          <button
            onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="p-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="ml-3 text-slate-500">Loading dashboard...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-red-700">
            <p className="font-semibold">Failed to load dashboard data</p>
            <p className="text-sm mt-1">{(error as any)?.message || 'Please try again'}</p>
          </div>
        )}

        {!isLoading && data && (
          <>
            {/* Accounting Equation Validation */}
            {accountingEquation && !accountingEquation.isBalanced && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Accounting equation imbalance detected</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Assets ({formatFullCurrency(accountingEquation.assets)}) != Liabilities ({formatFullCurrency(accountingEquation.liabilities)}) + Equity ({formatFullCurrency(accountingEquation.equity)}) + Net Income ({formatFullCurrency(accountingEquation.netIncome)})
                  </p>
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {kpiCards.map((kpi) => (
                <div
                  key={kpi.label}
                  onClick={() => DRILL_DOWN[kpi.label] && router.push(`/company/${companyId}/${DRILL_DOWN[kpi.label]}`)}
                  className={`bg-white rounded-2xl border border-slate-200 p-5 ${DRILL_DOWN[kpi.label] ? 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.light}`}>
                      <kpi.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{kpi.label}</p>
                      <p className="text-xl font-bold text-slate-800 mt-0.5">
                        {kpi.value != null ? formatCurrency(kpi.value) : '৳0'}
                      </p>
                      <p className="text-xs text-slate-400">{kpi.sub}</p>
                    </div>
                  </div>
                  {/* Breakdown tooltip on hover */}
                  {kpi.breakdown && kpi.breakdown.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                      {kpi.breakdown.slice(0, 3).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 truncate max-w-[140px]">{item.label}</span>
                          <span className="font-semibold text-slate-600">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      {kpi.breakdown.length > 3 && (
                        <p className="text-[10px] text-slate-400">+{kpi.breakdown.length - 3} more</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {(data?.actions?.length ? data.actions : QUICK_ACTIONS).map((action: any) => (
                  <button
                    key={action.label}
                    onClick={() => router.push(action.href || `/company/${companyId}/${action.path}`)}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-3
                               hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/50 hover:-translate-y-0.5
                               transition-all duration-200 group"
                  >
                    {action.icon && typeof action.icon !== 'string' ? (
                      <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                        <action.icon className="w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                        <BarChart2 className="w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Charts */}
            {charts.length > 0 && (
              <FinanceCharts charts={charts} formatCurrency={formatCurrency} />
            )}

            {/* Recent Activity */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Recent Activity
                </h3>
                <button
                  onClick={() => router.push(`/company/${companyId}/audit`)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View All
                </button>
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No recent activity</p>
              ) : (
                <div className="space-y-2">
                  {activities.slice(0, 10).map((act: any) => {
                    const ActionIcon = ACTION_ICONS[act.action] || Activity;
                    const isApproval = act.action?.includes('APPROVED');
                    const isRejection = act.action?.includes('REJECTED');
                    return (
                      <div
                        key={act.id}
                        onClick={() => act.link && router.push(act.link)}
                        className={`flex items-start gap-3 py-2.5 px-3 rounded-xl ${act.link ? 'cursor-pointer hover:bg-slate-50' : ''} transition-colors`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isApproval ? 'bg-emerald-50 text-emerald-600' :
                          isRejection ? 'bg-red-50 text-red-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          <ActionIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">
                              {act.performedBy ? `${act.performedBy.firstName} ${act.performedBy.lastName}` : 'System'}
                            </span>
                            {' '}
                            <span className="text-slate-500">
                              {act.action?.replace('STATUS_REACHED_', '').toLowerCase().replace(/_/g, ' ')}
                            </span>
                            {' '}
                            <span className="font-medium text-slate-600">
                              {act.entityType} {(act.metadata as any)?.docNumber || ''}
                            </span>
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{timeAgo(act.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Accounting Equation Card */}
            {accountingEquation && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-600 mb-4">Accounting Equation</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Assets</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(accountingEquation.assets)}</p>
                  </div>
                  <div className="flex items-center justify-center text-slate-300 text-xl">=</div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Liabilities</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(accountingEquation.liabilities)}</p>
                  </div>
                  <div className="flex items-center justify-center text-slate-300 text-xl">+</div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Equity + Net Income</p>
                    <p className="text-lg font-bold text-slate-800">
                      {formatCurrency(accountingEquation.equity + accountingEquation.netIncome)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    accountingEquation.isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {accountingEquation.isBalanced ? (
                      <><CheckCircle className="w-3.5 h-3.5" /> Balanced</>
                    ) : (
                      <><AlertTriangle className="w-3.5 h-3.5" /> Imbalanced</>
                    )}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
