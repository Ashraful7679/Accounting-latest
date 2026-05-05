'use client';

import { useEffect } from 'react';
import { useForm, UseFormProps, FieldValues, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodType, ZodTypeDef } from 'zod';
import { subscribeToFormErrors, clearFormErrors, getFormErrors } from '../lib/api';

export interface UseZodFormOptions<T extends FieldValues, SZod extends ZodType<any, ZodTypeDef, any>> extends Omit<UseFormProps<T>, 'resolver'> {
  schema: SZod;
  formId: string;
}

export function useZodForm<T extends FieldValues, SZod extends ZodType<any, ZodTypeDef, any>>({
  schema,
  formId,
  defaultValues,
  ...props
}: UseZodFormOptions<T, SZod>): UseFormReturn<T> {
  const form = useForm<T>({
    ...props,
    defaultValues,
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const unsubscribe = subscribeToFormErrors((subscribedFormId, errors) => {
      if (subscribedFormId === formId) {
        Object.entries(errors).forEach(([field, message]) => {
          form.setError(field as any, { type: 'server', message });
        });
        
        if (Object.keys(errors).length > 0) {
          form.setError('root' as any, {
            type: 'server',
            message: Object.values(errors).join(', '),
          });
        }
      }
    });

    return () => {
      unsubscribe();
      clearFormErrors(formId);
    };
  }, [formId, form]);

  return form;
}

export function useFieldError(fieldName: string, formId: string): string | undefined {
  return getFormErrors(formId)[fieldName];
}