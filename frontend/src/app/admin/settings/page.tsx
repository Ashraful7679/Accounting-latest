'use client';

import Link from 'next/link';
import { Shield, Database, ArrowRight } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="rounded-[32px] bg-white border border-slate-200 p-10 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-4xl font-black text-slate-900">Admin Settings</h1>
              <p className="mt-2 text-slate-500 font-medium">Manage global admin preferences, security, and platform-level settings from one place.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Link href="/admin/settings/account" className="group block rounded-[28px] border border-slate-200 bg-slate-50 p-8 transition hover:border-slate-300 hover:bg-white">
                <div className="flex items-center gap-4">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-900 text-white">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Account Settings</h2>
                    <p className="mt-2 text-sm text-slate-500">Update your profile, email and password securely.</p>
                  </div>
                </div>
                <div className="mt-8 flex items-center gap-2 text-sm font-black text-slate-900">
                  Manage profile <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
              <Link href="/admin/settings/backup" className="group block rounded-[28px] border border-slate-200 bg-slate-50 p-8 transition hover:border-slate-300 hover:bg-white">
                <div className="flex items-center gap-4">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-600 text-white">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Backup Settings</h2>
                    <p className="mt-2 text-sm text-slate-500">Create and restore enterprise backups for the platform.</p>
                  </div>
                </div>
                <div className="mt-8 flex items-center gap-2 text-sm font-black text-slate-900">
                  View backups <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
              <Link href="/admin/audit-logs" className="group block rounded-[28px] border border-slate-200 bg-slate-50 p-8 transition hover:border-slate-300 hover:bg-white">
                <div className="flex items-center gap-4">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-900 text-white">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Audit Logs</h2>
                    <p className="mt-2 text-sm text-slate-500">Review support and admin actions for compliance</p>
                  </div>
                </div>
                <div className="mt-8 flex items-center gap-2 text-sm font-black text-slate-900">
                  View logs <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
