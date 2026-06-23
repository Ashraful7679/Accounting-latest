'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Edit2, Trash2, Printer, Link2, FileText,
  Clock, CheckCircle2, AlertCircle, ChevronRight, MoreVertical,
  Save, RefreshCw, Download, Send, Copy, Eye, ChevronLeft
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface DetailField {
  label: string;
  value: string | number | boolean | React.ReactNode;
  type?: 'text' | 'number' | 'currency' | 'date' | 'status' | 'quantity' | 'select' | 'link';
  options?: { label: string; value: string }[];
  href?: string;
  onClick?: () => void;
}

export interface DetailAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  permission?: 'create' | 'view' | 'edit' | 'delete' | 'verify' | 'approve' | 'export' | 'print';
}

export interface DetailTab {
  id: string;
  label: string;
  icon?: React.ElementType;
  content: React.ReactNode;
}

export interface LinkedEntity {
  type: 'purchase_order' | 'sales_order' | 'journal_entry' | 'grn' | 'challan' | 'invoice' | 'debit_note' | 'credit_note';
  id: string;
  title: string;
  fields: DetailField[];
  tabs?: DetailTab[];
  actions?: DetailAction[];
}

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fields: DetailField[];
  actions?: DetailAction[];
  tabs?: DetailTab[];
  permissions?: Record<string, boolean>;
  status?: { value: string; type: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive' | 'draft' };
  metadata?: { createdAt?: string; createdBy?: string; updatedAt?: string; updatedBy?: string };
  linkedEntity?: LinkedEntity | null;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const statusStyles = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: Clock },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertCircle },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  inactive: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: AlertCircle },
  draft: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: FileText },
};

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw]',
};

function formatValue(value: unknown, type?: string): React.ReactNode {
  if (value === null || value === undefined || value === '') return '-';
  if (React.isValidElement(value)) return value;

  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BDT' }).format(Number(value));
    case 'link':
      return (
        <button
          onClick={(value as unknown as { _onClick?: () => void })._onClick}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          {String(value)}
        </button>
      );
    case 'quantity':
      return new Intl.NumberFormat('en-US').format(Number(value));
    case 'date':
      return new Date(String(value)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    case 'status':
      if (typeof value === 'object') return value as React.ReactNode;
      const s = statusStyles[value as keyof typeof statusStyles] || statusStyles.draft;
      const Icon = s.icon;
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border', s.bg, s.text, s.border)}>
          <Icon className="w-3.5 h-3.5" />
          {String(value).charAt(0).toUpperCase() + String(value).slice(1)}
        </span>
      );
    case 'boolean':
      return value ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> Yes
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
          <AlertCircle className="w-3.5 h-3.5" /> No
        </span>
      );
    default:
      return String(value);
  }
}

export default function DetailPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  fields,
  actions = [],
  tabs = [],
  permissions = {},
  status,
  metadata,
  linkedEntity = null,
  children,
  size = 'lg',
}: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'details');
  const [mounted, setMounted] = useState(false);
  const [currentLinked, setCurrentLinked] = useState<LinkedEntity | null>(null);

  const filteredActions = actions.filter(action => {
    if (!action.permission) return true;
    return permissions[action.permission] === true;
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentLinked(linkedEntity);
    }
  }, [isOpen, linkedEntity]);

  const handleLinkedBack = () => {
    setCurrentLinked(null);
    setActiveTab(tabs[0]?.id || 'details');
  };

  if (!mounted || !isOpen) return null;

  const displayTitle = currentLinked?.title || title;
  const displayFields = currentLinked?.fields || fields;
  const displayTabs = currentLinked?.tabs || tabs;
  const displayActions = currentLinked?.actions || filteredActions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      {/* Centered Modal */}
      <div className={cn(
        'relative flex flex-col w-full bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200',
        'max-h-[90vh]',
        sizeClasses[size]
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
            {currentLinked && (
              <button onClick={handleLinkedBack} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500" title="Back">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 truncate">{displayTitle}</h2>
                {status && formatValue(status.value, 'status')}
              </div>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        {displayTabs.length > 0 && (
          <div className="flex border-b border-slate-200 px-6 shrink-0">
            {(Array.isArray(displayTabs) ? displayTabs : []).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('px-4 py-3 text-sm font-bold border-b-2 transition-colors', activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {(() => {
            const currentTab = displayTabs.find(t => t.id === activeTab);
            const hasContent = currentTab?.content !== null && currentTab?.content !== undefined;
            const hasFields = displayFields.length > 0;

            if (hasContent) {
              return currentTab?.content;
            } else if (hasFields) {
              return (
                <div className="space-y-4">
                  {displayFields.map((field, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">{field.label}</span>
                      <span className="text-sm font-medium text-slate-900 text-right">{formatValue(field.value, field.type)}</span>
                    </div>
                  ))}
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* Footer Actions */}
        {displayActions.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex gap-2 flex-wrap shrink-0">
            {(Array.isArray(displayActions) ? displayActions : []).map((action, idx) => {
              const Icon = action.icon || Save;
              return (
                <button key={idx} onClick={action.onClick} disabled={action.disabled || action.loading} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all', action.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : action.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : action.variant === 'success' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50', (action.disabled || action.loading) && 'opacity-50 cursor-not-allowed')}>
                  {action.loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}