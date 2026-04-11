'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Clock, ChevronRight, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { renderActivityMessage } from '@/utils/activityRenderer';

interface ActivityPulseProps {
  alerts: any[];
  role: string;
}

export function ActivityPulse({ alerts, role }: ActivityPulseProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr && userStr !== 'undefined' && userStr !== 'null') {
        const userObj = JSON.parse(userStr);
        setUserId(userObj?.id || '');
      }
    } catch (e) {
      console.error('Error parsing user from localStorage', e);
    }
  }, []);

  return (
    <div className="bg-[#0F172A] rounded-[2.5rem] p-8 shadow-2xl sticky top-8 border border-slate-800 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-10">
        <h3 className="text-xl font-black text-white flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-[1rem] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bell className="w-6 h-6 text-white" />
          </div>
          Live Pulse
        </h3>
        <div className="relative">
          <span className="px-4 py-1.5 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-black tracking-widest border border-blue-500/20">
            {alerts.length} UPDATES
          </span>
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {alerts.map((activity, idx) => {
            const message = renderActivityMessage(activity, userId, role);
            
            return (
              <motion.div
                key={activity.id || idx}
                layout
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 rounded-[1.5rem] border border-slate-800/50 bg-slate-800/10 hover:bg-slate-800/40 transition-all group/item cursor-pointer relative overflow-hidden"
                onClick={() => activity.link && router.push(activity.link)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                
                <div className="flex items-start gap-4 relateve z-10">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 font-bold text-xs flex items-center justify-center text-slate-300 shrink-0 group-hover/item:border-blue-500/50 group-hover/item:text-blue-400 transition-colors">
                    {(activity.performedBy?.firstName?.[0] || activity.user?.[0] || 'A').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-200 leading-relaxed mb-3">{message}</p>
                    <div className="flex items-center justify-between mt-auto">
                       <p className="text-[10px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-tight">
                         <Clock className="w-3.5 h-3.5" />
                         {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </p>
                       {activity.link && (
                         <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center opacity-0 group-hover/item:opacity-100 translate-x-4 group-hover/item:translate-x-0 transition-all shadow-lg shadow-blue-500/20">
                            <ChevronRight className="w-4 h-4 text-white" />
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-8 pt-8 border-t border-slate-800/50">
        <button className="w-full py-4 bg-slate-800/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-3 border border-slate-800/50">
          Sync History
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </div>
  );
}
