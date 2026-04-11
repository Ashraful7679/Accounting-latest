'use client';

import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color: string;
  bg: string;
  onClick: () => void;
}

export function KpiCard({ label, value, icon, color, bg, onClick }: KpiCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/50 shadow-xl shadow-slate-200/50 relative overflow-hidden group cursor-pointer"
      onClick={onClick}
    >
      {/* Background Gradient Detail */}
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-5 blur-2xl group-hover:scale-150 transition-transform duration-500 ${bg}`} />
      
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform shadow-lg ${bg} ${color}`}>
        {icon}
      </div>
      
      <div className="space-y-1">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.15em]">{label}</p>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
      </div>

      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
        <div className="p-2 bg-slate-50 rounded-lg">
          <ExternalLink className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </motion.div>
  );
}
