import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api, { BASE_URL } from '@/lib/api';

interface Attachment {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  createdAt: string;
}

interface AttachmentManagerProps {
  entityType: 'VOUCHER' | 'LC' | 'BILL' | 'PAYMENT';
  entityId: string;
  canEdit?: boolean;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({ entityType, entityId, canEdit = true }) => {
  const params = useParams();
  const companyId = params.id as string;
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [selectedDocType, setSelectedDocType] = useState('GENERAL');

  const fetchAttachments = async () => {
    try {
      const response = await api.get(`/company/attachments/related/${entityType}/${entityId}`);
      if (response.data.success) {
        setAttachments(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch attachments:', error);
    }
  };

  useEffect(() => {
    if (entityId) fetchAttachments();
  }, [entityId, entityType]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      const uploadData = new FormData();
      uploadData.append('file', files[0]);

      const response = await api.post(
        `/company/${companyId}/attachments/upload?entityType=${entityType}&entityId=${entityId}&documentType=${selectedDocType}`, 
        uploadData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.data.success) {
        fetchAttachments();
        e.target.value = ''; // Reset input
      } else {
        alert(response.data.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!window.confirm('Are you sure you want to remove this attachment?')) return;

    try {
      const response = await api.delete(`/company/attachments/${attachmentId}`);
      if (response.data.success || response.status === 200) {
        fetchAttachments();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const getSecureUrl = (id: string) => {
    const token = localStorage.getItem('token');
    return `${BASE_URL}/api/company/attachments/secure/${id}?token=${token}`;
  };

  return (
    <div className="attachment-manager">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Transaction Attachments</h3>
        {canEdit && (
          <div className="flex gap-2">
            <select 
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-slate-500"
            >
              <option value="GENERAL">General Document</option>
              <option value="INVOICE">Invoice</option>
              <option value="LC_COPY">LC Copy</option>
              <option value="BILL_OF_LADING">Bill of Lading</option>
              <option value="BANK_ADVICE">Bank Advice</option>
              <option value="EXP_FORM">EXP Form</option>
            </select>
            <input 
              type="file" 
              id="attachment-upload" 
              onChange={handleUpload} 
              disabled={isUploading}
              className="hidden"
            />
            <label 
              htmlFor="attachment-upload" 
              className={`px-4 py-1 rounded text-sm font-medium cursor-pointer transition-colors ${
                isUploading ? 'bg-slate-300 text-slate-500' : 'bg-slate-800 text-white hover:bg-black'
              }`}
            >
              {isUploading ? 'Uploading...' : 'Add Attachment'}
            </label>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {attachments.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
            No attachments found for this transaction.
          </div>
        ) : (
          attachments.map((file) => (
            <div key={file.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-500 font-bold text-xs">
                  {file.fileType.split('/').pop()?.toUpperCase() || 'FILE'}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-700">{file.name}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-tighter">
                    {file.documentType} - {(file.fileSize / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPreviewFile(file)}
                  className="px-3 py-1 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 transition-all text-slate-600"
                >
                  Preview
                </button>
                <a 
                  href={getSecureUrl(file.id)} 
                  download={file.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 transition-all text-slate-600 no-underline"
                >
                  Download
                </a>
                {canEdit && (
                  <button 
                    onClick={() => handleDelete(file.id)}
                    className="px-3 py-1 text-xs font-medium border border-red-100 rounded hover:bg-red-50 transition-all text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {previewFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <div>
                <h4 className="font-semibold text-slate-800">{previewFile.name}</h4>
                <p className="text-xs text-slate-500">{previewFile.documentType} View</p>
              </div>
              <button 
                onClick={() => setPreviewFile(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
              >
                X
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex justify-center overflow-auto max-h-[75vh]">
              {previewFile.fileType.includes('image') ? (
                <img src={getSecureUrl(previewFile.id)} alt={previewFile.name} className="shadow-lg rounded max-w-full" />
              ) : previewFile.fileType.includes('pdf') ? (
                <iframe src={getSecureUrl(previewFile.id)} className="w-full h-[70vh] border-0 rounded shadow-lg bg-white" />
              ) : (
                <div className="bg-white p-12 rounded-lg border border-slate-200 text-center shadow-lg">
                  <div className="text-4xl mb-4">📄</div>
                  <h5 className="text-slate-700 mb-2">Preview Not Available</h5>
                  <p className="text-sm text-slate-500 mb-6">This file type cannot be previewed in the browser.</p>
                  <a 
                    href={getSecureUrl(previewFile.id)} 
                    download 
                    className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-black no-underline"
                  >
                    Download to View
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
