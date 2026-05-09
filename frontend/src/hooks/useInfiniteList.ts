'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UseInfiniteListOptions<T> {
  companyId: string;
  endpoint: string;
  queryKey: (string | number)[];
  search?: string;
  filter?: Record<string, string | undefined>;
  enabled?: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

export function useInfiniteList<T>({
  companyId,
  endpoint,
  queryKey,
  search,
  filter,
  enabled = true,
}: UseInfiniteListOptions<T>) {
  const queryClient = useQueryClient();

  const result = useInfiniteQuery<PaginatedResponse<T>>({
    queryKey: [...queryKey, search],
    queryFn: async ({ pageParam = 1 }) => {
      const params: Record<string, unknown> = {
        page: pageParam,
        limit: DEFAULT_PAGE_SIZE,
        ...(search && { search }),
        ...(filter || {}),
      };
      
      const response = await api.get(`/company/${companyId}/${endpoint}`, { params });
      return response.data.data as PaginatedResponse<T>;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!companyId && enabled,
  });

  const flatData = result.data?.pages.flatMap(page => Array.isArray(page?.data) ? page.data : []) ?? [];

  return {
    ...result,
    data: flatData,
  };
}

export interface StandardMutationOptions<T> {
  companyId: string;
  endpoint: string;
  queryKey: string[];
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useStandardMutation<T>({
  companyId,
  endpoint,
  queryKey,
  onSuccess,
  onError,
}: StandardMutationOptions<T>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: T) => {
      const response = await api.post(`/company/${companyId}/${endpoint}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryKey.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key, companyId] });
      });
      onSuccess?.();
    },
    onError,
  });
}

export function useStandardDelete({
  companyId,
  endpoint,
  queryKey,
}: Omit<StandardMutationOptions<unknown>, 'onSuccess' | 'onError'>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/company/${companyId}/${endpoint}/${id}`);
    },
    onSuccess: () => {
      queryKey.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key, companyId] });
      });
    },
  });
}