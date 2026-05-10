'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

interface ExportToPDFButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  companyId: string;
  className?: string;
  variant?: 'icon' | 'button';
}

export function ExportToPDFButton({
  invoiceId,
  invoiceNumber,
  companyId,
  className = '',
  variant = 'icon',
}: ExportToPDFButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportMutation = useMutation({
    mutationFn: async () => {
      setIsExporting(true);
      try {
        const response = await api.get(
          `/company/${companyId}/invoices/${invoiceId}/export/pdf`,
          { responseType: 'blob' }
        );
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Invoice-${invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return true;
      } finally {
        setIsExporting(false);
      }
    },
    onSuccess: () => {
      toast.success(`Invoice ${invoiceNumber} exported to PDF`);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to export PDF');
    },
  });

  if (variant === 'button') {
    return (
      <button
        onClick={() => exportMutation.mutate()}
        disabled={isExporting}
        className={`px-4 py-2 bg-gray-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileDown className="w-4 h-4" />
        )}
        {isExporting ? 'Exporting...' : 'Export to PDF'}
      </button>
    );
  }

  return (
    <button
      onClick={() => exportMutation.mutate()}
      disabled={isExporting}
      className={`p-2 text-gray-400 hover:text-gray-900 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Export to PDF"
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4" />
      )}
    </button>
  );
}
