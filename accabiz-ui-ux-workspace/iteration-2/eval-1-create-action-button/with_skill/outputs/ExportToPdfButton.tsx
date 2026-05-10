import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileDown } from 'lucide-react';
import api from '@/lib/api';

interface ExportToPdfButtonProps {
  invoiceId: string;
  invoiceNumber: string;
}

export default function ExportToPdfButton({ invoiceId, invoiceNumber }: ExportToPdfButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/company/${invoiceId}/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });
      return response.data;
    },
    onSuccess: (data: Blob) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice exported to PDF');
    },
    onError: () => {
      toast.error('Failed to export PDF');
    },
    onSettled: () => {
      setIsDownloading(false);
    },
  });

  const handleExport = () => {
    setIsDownloading(true);
    exportMutation.mutate();
  };

  return (
    <button
      onClick={handleExport}
      disabled={exportMutation.isPending || isDownloading}
      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold text-sm hover:bg-black transition-all disabled:opacity-50"
    >
      <FileDown className="w-4 h-4" />
      {exportMutation.isPending ? 'Exporting...' : 'Export to PDF'}
    </button>
  );
}