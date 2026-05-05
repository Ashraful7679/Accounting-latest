'use client';

import { useFieldArray, UseFieldArrayProps, FieldArrayWithId, Control, FieldErrors } from 'react-hook-form';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import clsx from 'clsx';

export interface DynamicFieldArrayProps<T extends Record<string, any>>
  extends Omit<UseFieldArrayProps<T>, 'control'> {
  control: Control<T>;
  name: string;
  label?: string;
  addLabel?: string;
  minFields?: number;
  maxFields?: number;
  render: (field: FieldArrayWithId<T>, index: number, onRemove: () => void) => React.ReactNode;
  errors?: FieldErrors<T>;
}

export function DynamicFieldArray<T extends Record<string, any>>({
  control,
  name,
  label,
  addLabel = 'Add Item',
  minFields = 0,
  maxFields,
  render,
  errors,
}: DynamicFieldArrayProps<T>) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: name as any,
  });

  const errorArray = errors && (errors as any)[name.split('.')[0]];

  const handleAdd = () => {
    if (!maxFields || fields.length < maxFields) {
      append({} as any);
    }
  };

  const canRemove = fields.length > minFields;

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">{label}</label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!!maxFields && fields.length >= maxFields}
            className={clsx(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded',
              maxFields && fields.length >= maxFields
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'text-blue-600 hover:bg-blue-50'
            )}
          >
            <Plus className="w-3 h-3" />
            {addLabel}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {fields.map((field, index) => {
          const fieldError = errorArray && (errorArray as any)[index];
          
          return (
            <div
              key={field.id}
              className={clsx(
                'relative flex items-start gap-2 p-3 rounded-lg border transition-colors',
                fieldError
                  ? 'border-red-200 bg-red-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              )}
            >
              <button
                type="button"
                className="mt-1 text-slate-400 hover:text-slate-600 cursor-grab"
                title="Drag to reorder"
              >
                <GripVertical className="w-4 h-4" />
              </button>
              
              <div className="flex-1">{render(field as FieldArrayWithId<T>, index, () => remove(index))}</div>
              
              {canRemove && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="mt-1 text-red-400 hover:text-red-600"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!label && (
        <button
          type="button"
          onClick={handleAdd}
          disabled={!!maxFields && fields.length >= maxFields}
          className={clsx(
            'w-full py-2 border-2 border-dashed rounded-lg text-sm font-medium transition-colors',
            maxFields && fields.length >= maxFields
              ? 'border-slate-200 text-slate-400 cursor-not-allowed'
              : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600'
          )}
        >
          <Plus className="w-4 h-4 inline mr-1" />
          {addLabel}
        </button>
      )}
    </div>
  );
}