'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#111827', '#4B5563', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6'];

interface FinanceChartsProps {
  charts: any[];
  formatCurrency: (val: any) => string;
}

export function FinanceCharts({ charts, formatCurrency }: FinanceChartsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 p-3 rounded-sm shadow-md">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-50 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6 py-0.5">
              <span className="text-[10px] font-medium text-gray-600">{entry.name}</span>
              <span className="text-[11px] font-bold text-gray-900">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const getChartData = (name: string) => {
    const chart = charts.find((c: any) => c.name === name);
    return chart?.data || [];
  };

  if (!mounted) return <div className="h-[400px] bg-white animate-pulse rounded-sm" />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Revenue vs Expenses */}
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm min-h-[400px] flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em]">Operating Performance</h3>
              <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">Revenue vs Expenses</p>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-gray-400">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-gray-900 rounded-full"/>Revenue</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-gray-200 rounded-full"/>Expenses</div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <BarChart data={getChartData('Revenue vs Expenses')} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#9CA3AF' }} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="revenue" fill="#111827" radius={[2, 2, 0, 0]} barSize={24} />
                <Bar dataKey="expense" fill="#E5E7EB" radius={[2, 2, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm min-h-[400px] flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em]">Cash Flow Dynamics</h3>
              <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">Net Liquidity Movement</p>
            </div>
            <div className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-sm text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              Monthly Trend
            </div>
          </div>
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <AreaChart data={getChartData('Monthly Net Cash Flow')} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.05}/>
                    <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#9CA3AF' }} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#111827" strokeWidth={2} fillOpacity={1} fill="url(#chartGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Buyer Distribution */}
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm min-h-[400px] flex flex-col min-w-0">
          <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em] mb-8">Revenue Concentration</h3>
          <div className="flex-1 flex items-center min-h-[300px]">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <PieChart>
                  <Pie
                    data={getChartData('Revenue by Buyer')}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {getChartData('Revenue by Buyer').map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-4 pl-6 border-l border-gray-100">
              {getChartData('Revenue by Buyer').slice(0, 5).map((entry: any, idx: number) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                       <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-900">{formatCurrency(entry.value)}</span>
                  </div>
                  <div className="h-0.5 bg-gray-50 rounded-full overflow-hidden">
                     <div className="h-full bg-gray-200" style={{ width: `${(entry.value / Math.max(...getChartData('Revenue by Buyer').map((d: any) => d.value))) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Liquidity Position */}
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm min-h-[400px] flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em]">Liquidity Breakdown</h3>
             <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Active Accounts</span>
             </div>
          </div>
          <div className="flex-1 w-full min-h-[300px]">
             <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <BarChart data={getChartData('Cash Position')} layout="vertical" margin={{ left: 40, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 700, fill: '#9CA3AF', width: 100 }} 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                  <Bar 
                    dataKey="value" 
                    radius={[0, 2, 2, 0]} 
                    barSize={16}
                  >
                    {getChartData('Cash Position').map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} opacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
