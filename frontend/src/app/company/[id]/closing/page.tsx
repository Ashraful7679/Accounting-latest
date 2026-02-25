'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import { Calendar, ShieldAlert } from 'lucide-react';

export default function PeriodClosingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar companyName="Period Closing" />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center max-w-2xl mx-auto mt-20">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-4 Capsule">Period Closing Module</h1>
            <p className="text-slate-500 mb-8 leading-relaxed">
              This module is currently under development. It will handle month-end and year-end closing processes, 
              ensuring all transactions are locked and financial statements are finalized.
            </p>
            <div className="items-center justify-center gap-3 text-sm font-bold text-blue-600 bg-blue-50 py-3 px-6 rounded-xl inline-flex">
              <ShieldAlert className="w-4 h-4" />
              Coming Soon in Phase 12
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
