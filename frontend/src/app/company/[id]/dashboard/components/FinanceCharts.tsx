'use client';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899'];

interface FinanceChartsProps {
  charts: any[];
  formatCurrency: (val: any) => string;
}

export function FinanceCharts({ charts, formatCurrency }: FinanceChartsProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-2xl shadow-2xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <span className="text-[10px] font-bold text-slate-400">{entry.name}</span>
              <span className="text-xs font-black" style={{ color: entry.color || entry.fill }}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Revenue vs Expenses */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Operating Performance</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Revenue vs Expenses Distribution</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-tight">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-600"/>Revenue</div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-200"/>Expenses</div>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.find((c: any) => c.name === 'Revenue vs Expenses')?.data || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F8FAFC" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94A3B8' }} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="revenue" fill="#2563EB" radius={[8, 8, 0, 0]} barSize={28} />
                <Bar dataKey="expense" fill="#E2E8F0" radius={[8, 8, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Net Cash Flow */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Cash Flow Dynamics</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Net Liquidity Movement</p>
            </div>
            <div className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black tracking-widest border border-emerald-100 uppercase">
              Stable Trend
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.find((c: any) => c.name === 'Monthly Net Cash Flow')?.data || []}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F8FAFC" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94A3B8' }} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={4} fillOpacity={1} fill="url(#chartGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Buyer Distribution */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"
        >
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-10">Revenue Concentration</h3>
          <div className="h-[320px] flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.find((c: any) => c.name === 'Revenue by Buyer')?.data || []}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {charts.find((c: any) => c.name === 'Revenue by Buyer')?.data?.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-4 pl-8 border-l border-slate-50">
              {charts.find((c: any) => c.name === 'Revenue by Buyer')?.data?.slice(0, 5).map((entry: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                       <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-900">{formatCurrency(entry.value)}</span>
                  </div>
                  <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                     <div className="h-full bg-slate-200" style={{ width: `${(entry.value / Math.max(...charts.find((c: any) => c.name === 'Revenue by Buyer')?.data.map((d: any) => d.value))) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Liquidity Position */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-10">
             <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Liquidity Breakdown</h3>
             <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Portfolio</span>
             </div>
          </div>
          <div className="h-[320px]">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.find((c: any) => c.name === 'Cash Position')?.data || []} layout="vertical" margin={{ left: 50 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 900, fill: '#64748B', width: 100 }} 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
                  <Bar 
                    dataKey="value" 
                    radius={[0, 10, 10, 0]} 
                    barSize={20}
                  >
                    {(charts.find((c: any) => c.name === 'Cash Position')?.data || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
