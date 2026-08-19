'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface QueryHistoryItem {
  id: string;
  question: string;
  sql: string;
  explanation?: string;
  total_count: number;
  total_pages: number;
  page_size: number;
  current_page: number;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  timestamp: Date;
  isError?: boolean;
  errorMessage?: string;
  rowsPending?: boolean;
}

export type AskPhase = 'idle' | 'loading';

export function useQueryHistory(datasetId: string) {
  const [items, setItems] = useState<QueryHistoryItem[]>([]);
  const [phase, setPhase] = useState<AskPhase>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Load history from Postgres on mount ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    api.listQueryHistory(datasetId).then((records) => {
      if (cancelled) return;

      const loaded: QueryHistoryItem[] = records.map((r) => ({
        id: r.id,
        question: r.question,
        sql: r.sql_query ?? '',
        explanation: r.explanation ?? undefined,
        total_count: r.total_count ?? 0,
        total_pages: r.total_pages ?? 0,
        page_size: r.page_size ?? 10,
        current_page: 1,
        columns: [],
        rows: [],
        row_count: 0,
        timestamp: new Date(r.created_at),
        isError: r.is_error,
        errorMessage: r.error_message ?? undefined,
        rowsPending: !r.is_error && !!r.sql_query,
      }));

      setItems(loaded);

      const first = loaded.find((i) => !i.isError && i.rowsPending);
      if (first) setSelectedId(first.id);
    }).catch(() => {

    });

    return () => { cancelled = true; };
  }, [datasetId]);

  useEffect(() => {
    if (!selectedId) return;
    const item = items.find((i) => i.id === selectedId);
    if (item?.rowsPending) {
      fetchPage(selectedId, 1);
    }
  }, [selectedId]);

  // ── Submit new question (LLM + execute) ───────────────────────────────────

  const submit = useCallback(
    async (question: string) => {
      if (!question.trim() || phase === 'loading') return;

      setPhase('loading');
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await api.query(
          { dataset_id: datasetId, question: question.trim(), page: 1 },
          controller.signal,
        );

        const newItem: QueryHistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          question: question.trim(),
          sql: result.sql,
          explanation: result.explanation,
          total_count: result.total_count,
          total_pages: result.total_pages,
          page_size: result.page_size,
          current_page: result.page,
          columns: result.columns,
          rows: result.rows,
          row_count: result.row_count,
          timestamp: new Date(),
          rowsPending: false,
        };

        setItems((prev) => [...prev, newItem]);
        setSelectedId(newItem.id);
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort) {
          const errorItem: QueryHistoryItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            question: question.trim(),
            sql: '',
            total_count: 0,
            total_pages: 0,
            page_size: 10,
            current_page: 1,
            columns: [],
            rows: [],
            row_count: 0,
            timestamp: new Date(),
            isError: true,
            errorMessage: (err as Error).message,
            rowsPending: false,
          };
          setItems((prev) => [...prev, errorItem]);
          setSelectedId(errorItem.id);
        }
      } finally {
        abortRef.current = null;
        setPhase('idle');
      }
    },
    [datasetId, phase],
  );

  // ── Page navigation ────

  const fetchPage = useCallback(
    async (itemId: string, page: number) => {
      const item = items.find((i) => i.id === itemId);
      if (!item || item.isError || !item.sql) return;
      if (!item.rowsPending && (page < 1 || page > item.total_pages)) return;

      setPhase('loading');
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await api.paginateQuery(
          {
            dataset_id: datasetId,
            sql: item.sql,
            page,
            page_size: item.page_size,
          },
          controller.signal,
        );

        setItems((prev) =>
          prev.map((i) =>
            i.id !== itemId
              ? i
              : {
                ...i,
                current_page: result.page,
                columns: result.columns,
                rows: result.rows,
                row_count: result.row_count,
                total_count: result.total_count,
                total_pages: result.total_pages,
                rowsPending: false,
              },
          ),
        );
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort) {
          console.error('Page fetch failed:', (err as Error).message);
        }
      } finally {
        abortRef.current = null;
        setPhase('idle');
      }
    },
    [datasetId, items],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearHistory = useCallback(() => {
    setItems([]);
    setSelectedId(null);
    setPhase('idle');
  }, []);

  return { items, phase, submit, fetchPage, abort, clearHistory, selectedId, setSelectedId };
}
