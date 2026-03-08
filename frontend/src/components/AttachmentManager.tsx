import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api, { BASE_URL } from '@/lib/api';
import { 
  FileText, Upload, Trash2, Eye, Download, 
  X, File, Image as ImageIcon, FileArchive, 
  Plus, AlertCircle, HardDrive
} from 'lucide-react';
import { toast } from 'react-hot-toast';

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
  entityType: 'VOUCHER' | 'LC' | 'BILL' | 'PAYMENT' | 'INVOICE' | 'EXPENSE' | 'PI';
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
    const uploadData = new FormData();
    uploadData.append('file', files[0]);

    try {
      const response = await api.post(
        `/company/${companyId}/attachments/upload?entityType=${entityType}&entityId=${entityId}&documentType=${selectedDocType}`, 
        uploadData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.data.success) {
        toast.success('Document uploaded successfully');
        fetchAttachments();
        e.target.value = ''; // Reset input
      } else {
        toast.error(response.data.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!window.confirm('Are you sure you want to remove this attachment?')) return;

    try {
      const response = await api.delete(`/company/attachments/${attachmentId}`);
      if (response.data.success || response.status === 200) {
        toast.success('Attachment removed');
        fetchAttachments();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete attachment');
    }
  };

  const getSecureUrl = (id: string) => {
    const token = localStorage.getItem('token');
    return `${BASE_URL}/api/company/attachments/secure/${id}?token=${token}`;
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-rose-500" />;
    if (type.includes('zip') || type.includes('rar')) return <FileArchive className="w-5 h-5 text-amber-500" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-slate-800">
           <HardDrive className="w-5 h-5 text-blue-600" />
           <h3 className="text-sm font-black uppercase tracking-widest">Digital Attachments</h3>
           <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full">{attachments.length}</span>
        </div>
        
        {canEdit && (
          <div className="flex items-center gap-2">
            <select 
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
            >
              <option value="GENERAL">General Doc</option>
              <option value="INVOICE">Invoice</option>
              <option value="LC_COPY">LC Copy</option>
              <option value="CHALLAN">Challan</option>
              <option value="PACKING_LIST">Packing List</option>
              <option value="BILL_OF_LADING">B/L</option>
              <option value="BANK_ADVICE">Bank Advice</option>
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
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-sm transition-all ${
                isUploading 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-slate-900 text-white hover:bg-black active:scale-95'
              }`}
            >
              {isUploading ? <Plus className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {isUploading ? 'Uploading...' : 'Upload File'}
            </label>
          </div>
        )}
      </div>

      <div className="p-4 bg-white min-h-[100px]">
        {attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300">
            <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">No Documents Attached</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {attachments.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:border-blue-100 hover:shadow-md transition-all group">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm shrink-0 group-hover:scale-110 transition-transform">
                    {getFileIcon(file.fileType)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-800 truncate">{file.name}</div>
                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                      <span className="bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-md">{file.documentType}</span>
                      <span>•</span>
                      <span>{(file.fileSize / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 ml-4">
                  <button 
                    onClick={() => setPreviewFile(file)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="Quick Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a 
                    href={getSecureUrl(file.id)} 
                    download={file.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  {canEdit && (
                    <button 
                      onClick={() => handleDelete(file.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[5000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-6xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            <div className="flex justify-between items-center px-8 py-5 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  {getFileIcon(previewFile.fileType)}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 leading-tight">{previewFile.name}</h4>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">{previewFile.documentType} PREVIEW</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewFile(null)}
                className="w-10 h-10 rounded-2xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 bg-slate-100 p-6 flex justify-center items-center overflow-hidden">
              <div className="w-full h-full rounded-2xl overflow-auto flex justify-center items-center bg-white shadow-inner">
                {previewFile.fileType.includes('image') ? (
                  <img src={getSecureUrl(previewFile.id)} alt={previewFile.name} className="max-w-none max-h-none" />
                ) : previewFile.fileType.includes('pdf') ? (
                  <iframe src={getSecureUrl(previewFile.id)} className="w-full h-full border-0" />
                ) : (
                  <div className="text-center p-12">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                       <AlertCircle className="w-10 h-10 text-slate-300" />
                    </div>
                    <h5 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Preview Unsupported</h5>
                    <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto font-medium">This file type ({previewFile.fileType}) requires a local application to view.</p>
                    <a 
                      href={getSecureUrl(previewFile.id)} 
                      download 
                      className="inline-flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Download to Device
                    </a>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Uploaded: {new Date(previewFile.createdAt).toLocaleString()}
               </div>
               <div className="flex gap-2">
                  <a 
                    href={getSecureUrl(previewFile.id)} 
                    download
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    <Download className="w-3 h-3" />
                    Download File
                  </a>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
