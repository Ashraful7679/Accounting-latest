import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface ExportPDFButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  companyId: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showIcon?: boolean;
}

const variantStyles = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  outline: 'border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export function ExportPDFButton({
  invoiceId,
  invoiceNumber,
  companyId,
  className,
  variant = 'primary',
  size = 'md',
  label = 'Export PDF',
  showIcon = true,
}: ExportPDFButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const response = await api.get(
        `/company/${companyId}/invoices/${invoiceId}/pdf`,
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

      toast.success(`Invoice ${invoiceNumber} exported successfully`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to export PDF';
      toast.error(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExportPDF}
      disabled={isExporting}
      className={cn(
        'rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : showIcon ? (
        <FileDown className="w-4 h-4" />
      ) : null}
      {isExporting ? 'Exporting...' : label}
    </button>
  );
}
