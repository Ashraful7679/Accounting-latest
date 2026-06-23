'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DocNode {
  id: string;
  number: string;
  status: string;
  date?: string;
  amount?: number;
  currency?: string;
  href?: string;
}

export interface DocGroup {
  label: string;
  icon?: React.ElementType;
  documents: DocNode[];
  defaultExpanded?: boolean;
}

interface DocumentTreeViewProps {
  groups: DocGroup[];
  title?: string;
  emptyMessage?: string;
  variant?: 'sidebar' | 'inline';
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-500 border-gray-100',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-100',
  VERIFIED: 'bg-blue-50 text-blue-700 border-blue-100',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  SENT: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  SHIPPED: 'bg-gray-900 text-white border-gray-900',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-100',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700 border-amber-100',
  FULFILLED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  COMPLETED: 'bg-gray-900 text-white border-gray-900',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  OPEN: 'bg-blue-50 text-blue-700 border-blue-100',
  CANCELLED: 'bg-red-50 text-red-700 border-red-100',
  REJECTED: 'bg-red-50 text-red-700 border-red-100',
};

function getStatusStyle(status: string): string {
  return STATUS_STYLE[status] || 'bg-gray-50 text-gray-500 border-gray-100';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatAmount(amount?: number, currency?: string): string {
  if (amount === undefined || amount === null) return '';
  const sym = currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : (currency || '') + ' ';
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DocumentTreeView({
  groups,
  title = 'Linked Documents',
  emptyMessage = 'No linked documents',
  variant = 'inline',
}: DocumentTreeViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    groups.forEach((g, i) => {
      if (g.documents.length > 0 && g.defaultExpanded !== false) initial.add(i);
    });
    return initial;
  });

  const toggleGroup = (idx: number) => {
    const next = new Set(expandedGroups);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedGroups(next);
  };

  const totalDocs = groups.reduce((sum, g) => sum + g.documents.length, 0);

  if (totalDocs === 0) return null;

  const containerClass = variant === 'sidebar'
    ? 'bg-white border border-gray-200 rounded-sm shadow-sm'
    : 'bg-white border border-gray-200 rounded-sm shadow-sm';

  return (
    <div className={containerClass}>
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <FileText className="w-3 h-3" />
          {title}
          <span className="ml-auto text-gray-400 font-mono text-[9px]">{totalDocs}</span>
        </h3>
      </div>
      <div className="divide-y divide-gray-50">
        {groups.map((group, gIdx) => {
          const Icon = group.icon;
          const isExpanded = expandedGroups.has(gIdx);
          const docCount = group.documents.length;

          if (docCount === 0) return null;

          return (
            <div key={gIdx}>
              <button
                type="button"
                onClick={() => toggleGroup(gIdx)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50/50 transition-colors"
              >
                {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex-1">{group.label}</span>
                <span className="text-[9px] font-bold text-gray-400 font-mono">{docCount}</span>
                {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-300" /> : <ChevronRight className="w-3 h-3 text-gray-300" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-1.5">
                  {group.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between py-2 px-3 bg-gray-50/80 border border-gray-100 rounded-sm hover:border-gray-200 hover:bg-gray-50 transition-all group/doc"
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {doc.href ? (
                            <Link
                              href={doc.href}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline truncate flex items-center gap-1"
                            >
                              {doc.number}
                              <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/doc:opacity-100 transition-opacity shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-900 truncate">{doc.number}</span>
                          )}
                          <span className={cn(
                            "px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-sm border shrink-0",
                            getStatusStyle(doc.status)
                          )}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {doc.date && (
                            <span className="text-[9px] text-gray-400 font-mono">{formatDate(doc.date)}</span>
                          )}
                          {doc.date && doc.amount !== undefined && (
                            <span className="text-[9px] text-gray-300">|</span>
                          )}
                          {doc.amount !== undefined && (
                            <span className="text-[9px] font-bold text-gray-600 font-mono">{formatAmount(doc.amount, doc.currency)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {totalDocs === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-[10px] text-gray-400 italic">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
