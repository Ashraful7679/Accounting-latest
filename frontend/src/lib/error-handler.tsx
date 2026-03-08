import React from 'react';
import toast from 'react-hot-toast';

interface AppError {
  message: string;
  remedy?: string;
  code?: string;
  statusCode?: number;
}

export const handleError = (error: any, defaultMessage: string = 'Operation failed') => {
  console.error('API Error:', error);

  // Prisma or custom structure: { success: false, error: { message, remedy, ... } }
  const errorData = error.response?.data?.error as AppError | undefined;
  
  // Fallback structures
  const message = errorData?.message || error.response?.data?.message || error.message || defaultMessage;
  const remedy = errorData?.remedy;

  if (remedy) {
    toast.error((t) => (
      <div className="flex flex-col gap-1">
        <span className="font-bold">{message}</span>
        <span className="text-xs opacity-90 leading-tight">
          <strong className="text-blue-200">Fix:</strong> {remedy}
        </span>
      </div>
    ), {
      duration: 6000,
    });
  } else {
    toast.error(message);
  }

  return { message, remedy, code: errorData?.code };
};
