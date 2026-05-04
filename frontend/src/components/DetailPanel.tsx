'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Edit2, Trash2, Printer, Link2, FileText, 
  Clock, CheckCircle2, AlertCircle, ChevronRight, MoreVertical,
  Save, RefreshCw, Download, Send, Copy, Eye
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
  type?: 'text' | 'number' | 'currency' | 'date' | 'status' | 'currency' | 'quantity' | 'select';
  options?: { label: string; value: string }[];
}

export interface DetailAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
}

export interface DetailTab {
  id: string;
  label: string;
  icon?: React.ElementType;
  content: React.ReactNode;
}

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fields: DetailField[];
  actions?: DetailAction[];
  tabs?: DetailTab[];
  status?: {
    value: string;
    type: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive' | 'draft';
  };
  metadata?: {
    createdAt?: string;
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
  };
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

function formatValue(value: any, type?: string): React.ReactNode {
  if (value === null || value === undefined || value === '') return '-';
  if (React.isValidElement(value)) return value;
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BDT' }).format(Number(value));
    case 'quantity':
      return new Intl.NumberFormat('en-US').format(Number(value));
    case 'date':
      return new Date(value).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric' 
      });
    case 'status':
      if (typeof value === 'object') return value;
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
  status,
  metadata,
  children,
  size = 'lg',
}: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'details');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={cn(
        'relative flex flex-col w-full h-full bg-white shadow-2xl animate-in slide-in-from-right duration-300',
        sizeClasses[size]
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 truncate">{title}</h2>
              {status && formatValue(status.value, 'status')}
            </div>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="flex gap-1 px-6 border-b border-slate-100 bg-white">
            {tabs.map((tab) => {
              const Icon = tab.icon || FileText;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tabs.length > 0 ? (
            tabs.find(t => t.id === activeTab)?.content || (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  {fields.map((field, idx) => (
                    <div key={idx} className={cn(
                      'space-y-1',
                      field.label.toLowerCase().includes('description') || field.label.toLowerCase().includes('address') ? 'col-span-2' : ''
                    )}>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {field.label}
                      </label>
                      <div className="text-slate-900 font-medium">
                        {formatValue(field.value, field.type)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {fields.map((field, idx) => (
                  <div key={idx} className={cn(
                    'space-y-1',
                    field.label.toLowerCase().includes('description') || field.label.toLowerCase().includes('address') || field.label.toLowerCase().includes('notes') ? 'col-span-2' : ''
                  )}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {field.label}
                    </label>
                    <div className="text-slate-900 font-medium">
                      {formatValue(field.value, field.type)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {children}
        </div>

        {/* Metadata Footer */}
        {metadata && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
            <div className="flex gap-4 text-xs text-slate-400">
              {metadata.createdAt && (
                <span>Created: {new Date(metadata.createdAt).toLocaleString()}</span>
              )}
              {metadata.createdBy && (
                <span>by {metadata.createdBy}</span>
              )}
              {metadata.updatedAt && (
                <span>Updated: {new Date(metadata.updatedAt).toLocaleString()}</span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2 flex-wrap">
            {actions.map((action, idx) => {
              const Icon = action.icon || Save;
              return (
                <button
                  key={idx}
                  onClick={action.onClick}
                  disabled={action.disabled || action.loading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                    action.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                    action.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                    action.variant === 'success' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                    'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
                    (action.disabled || action.loading) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {action.loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
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