'use client';

import { useForm, UseFormProps, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodType, ZodTypeDef } from 'zod';

export function useZodForm<T extends Record<string, any>, SZod extends ZodType<any, ZodTypeDef, any>>({
  schema,
  defaultValues,
  ...props
}: Omit<UseFormProps<T>, 'resolver'> & {
  schema: SZod;
}) {
  return useForm<T, any>({
    ...props,
    defaultValues,
    resolver: zodResolver(schema),
  });
}

export interface FormFieldProps {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ name, label, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ error, className, ...props }: InputProps) {
  return (
    <input
      className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-slate-200'
      } ${className}`}
      {...props}
    />
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ error, options, className, ...props }: SelectProps) {
  return (
    <select
      className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-slate-200'
      } ${className}`}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function TextArea({ error, className, ...props }: TextAreaProps) {
  return (
    <textarea
      className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-slate-200'
      } ${className}`}
      {...props}
    />
  );
}

export function getFieldError<T>(errors: FieldErrors<T>, path: string): string | undefined {
  const keys = path.split('.');
  let current: any = errors;
  
  for (const key of keys) {
    if (current && typeof current === 'object') {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return current?.message as string | undefined;
}