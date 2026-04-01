import React from 'react';
import toast from 'react-hot-toast';

interface AppError {
  message: string;
  remedy?: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

export const handleError = (error: any, defaultMessage: string = 'Operation failed') => {
  console.error('API Error:', error);

  const errorData = error.response?.data?.error as AppError | undefined;
  const serverMessage = error.response?.data?.message;
  const statusCode = error.response?.status;
  
  const message = errorData?.message || serverMessage || error.message || defaultMessage;
  const remedy = errorData?.remedy;
  const code = errorData?.code;

  const hasDetails = errorData?.details || error.response?.data?.details || error.stack;

  const errorContent = (
    <div className="flex flex-col gap-1 max-w-sm">
      <span className="font-bold">{message}</span>
      {remedy && (
        <span className="text-xs opacity-90 leading-tight">
          <strong className="text-blue-200">Fix:</strong> {remedy}
        </span>
      )}
      {code && (
        <span className="text-xs text-yellow-300">
          <strong>Code:</strong> {code}
        </span>
      )}
      {statusCode && (
        <span className="text-xs text-red-300">
          <strong>Status:</strong> {statusCode}
        </span>
      )}
      {hasDetails && (
        <details className="text-xs text-slate-400 mt-1">
          <summary className="cursor-pointer hover:text-slate-300">View details</summary>
          <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all max-h-20 overflow-auto">
            {JSON.stringify(errorData?.details || error.response?.data, null, 2) || error.stack}
          </pre>
        </details>
      )}
    </div>
  );

  toast.error(errorContent, {
    duration: 8000,
  });

  return { message, remedy, code, statusCode };
};

export const showError = (error: any, defaultMessage?: string) => {
  return handleError(error, defaultMessage);
};
