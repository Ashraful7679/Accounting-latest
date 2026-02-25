'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import { Settings, ShieldAlert } from 'lucide-react';

export default function CompanySettingsPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar companyName="Company Settings" />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center max-w-2xl mx-auto mt-20">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-4 Capsule">Company Configuration</h1>
            <p className="text-slate-500 mb-8 leading-relaxed">
              This module is currently under development. It will allow you to manage company metadata, 
              currency preferences, fiscal year settings, and user permissions.
            </p>
            <div className="items-center justify-center gap-3 text-sm font-bold text-blue-600 bg-blue-50 py-3 px-6 rounded-xl inline-flex">
              <ShieldAlert className="w-4 h-4" />
              Coming Soon in Phase 13
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
