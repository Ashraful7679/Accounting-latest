'use client';

import React, { useState } from 'react';
import { Info, Sparkles, AlertTriangle, Zap, BookOpen } from 'lucide-react';

interface FieldInfo {
  function: string;
  procedure?: string;
  impact?: string;
  suggestions?: string[];
}

interface InfoTooltipProps {
  fieldInfo: FieldInfo;
  children?: React.ReactNode;
}

export function InfoTooltip({ fieldInfo }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block ml-2">
      <div
        className="cursor-help text-gray-400 hover:text-blue-500 transition-colors"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Info className="w-4 h-4" />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 left-6 top-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 text-left animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="space-y-3">
            {/* Function */}
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Function</p>
                <p className="text-sm text-gray-900">{fieldInfo.function}</p>
              </div>
            </div>

            {/* Procedure */}
            {fieldInfo.procedure && (
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Procedure</p>
                  <p className="text-sm text-gray-700">{fieldInfo.procedure}</p>
                </div>
              </div>
            )}

            {/* Impact */}
            {fieldInfo.impact && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Impact</p>
                  <p className="text-sm text-gray-700">{fieldInfo.impact}</p>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {fieldInfo.suggestions && fieldInfo.suggestions.length > 0 && (
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Suggestions</p>
                  <ul className="text-sm text-gray-700 space-y-1 mt-1">
                    {fieldInfo.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-purple-500">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface FormFieldWithInfoProps {
  label: string;
  fieldInfo: FieldInfo;
  required?: boolean;
  children: React.ReactNode;
}

export function FormFieldWithInfo({ label, fieldInfo, required, children }: FormFieldWithInfoProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        <InfoTooltip fieldInfo={fieldInfo} />
      </label>
      {children}
    </div>
  );
}

interface InputWithInfoProps extends React.InputHTMLAttributes<HTMLInputElement> {
  fieldInfo: FieldInfo;
  label: string;
}

export function InputWithInfo({ fieldInfo, label, ...props }: InputWithInfoProps) {
  return (
    <FormFieldWithInfo label={label} fieldInfo={fieldInfo} required={props.required}>
      <input {...props} className={`input ${props.className || ''}`} />
    </FormFieldWithInfo>
  );
}

interface SelectWithInfoProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  fieldInfo: FieldInfo;
  label: string;
  options: { value: string; label: string }[];
}

export function SelectWithInfo({ fieldInfo, label, options, ...props }: SelectWithInfoProps) {
  return (
    <FormFieldWithInfo label={label} fieldInfo={fieldInfo} required={props.required}>
      <select {...props} className={`input ${props.className || ''}`}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormFieldWithInfo>
  );
}

interface TextareaWithInfoProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  fieldInfo: FieldInfo;
  label: string;
}

export function TextareaWithInfo({ fieldInfo, label, ...props }: TextareaWithInfoProps) {
  return (
    <FormFieldWithInfo label={label} fieldInfo={fieldInfo} required={props.required}>
      <textarea {...props} className={`input ${props.className || ''}`} />
    </FormFieldWithInfo>
  );
}