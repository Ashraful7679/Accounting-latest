'use client';

import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PaginatedResponse } from '../hooks/useInfiniteList';
import React from 'react';

interface InfinitePaginationProps<T> {
  query: ReturnType<typeof useInfiniteQuery<PaginatedResponse<T>>>;
  showStats?: boolean;
}

export function InfinitePagination<T>({ query, showStats = true }: InfinitePaginationProps<T>) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  
  const pagination = data?.pages?.[0]?.pagination;
  const page = pagination?.page || 1;
  const limit = pagination?.limit || 20;
  const total = pagination?.total || 0;

  return (
    <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between">
      {showStats && pagination ? (
        <div className="text-xs text-slate-500">
          Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} of {total.toLocaleString()}
        </div>
      ) : (
        <div />
      )}
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          disabled={page === 1}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Scroll to top"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isFetchingNextPage ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : hasNextPage ? (
            <>
              Load More
              <ChevronDown className="w-4 h-4" />
            </>
          ) : (
            'No more'
          )}
        </button>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-12 bg-slate-100 rounded" />
      ))}
    </div>
  );
}

export function EmptyState({ 
  title = 'No data found',
  action,
  icon: Icon
}: { 
  title?: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      {Icon && <Icon className="w-12 h-12 mb-2" />}
      <p className="text-sm font-medium">{title}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}