'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import type { PersistedMessage, SessionListItem } from '@/types/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isAborted?: boolean;
  isError?: boolean;
}

export type ChatPhase = 'idle' | 'loading';

interface UseAgentChatResult {
  // Session list (sidebar)
  sessions: SessionListItem[];
  sessionsLoading: boolean;
  // Active session
  activeSessionId: string | null;
  messages: ChatMessage[];
  phase: ChatPhase;
  // Actions
  selectSession: (sessionId: string) => void;
  startNewSession: () => void;
  sendMessage: (question: string) => void;
  abort: () => void;
  deleteActiveSession: () => void;
}

const ABORT_MESSAGE = "Sure, let me know when you're ready!";

function uid(): string {
  return Math.random().toString(36).slice(2);
}

function persistedToChat(pm: PersistedMessage): ChatMessage {
  return {
    id: uid(),
    role: pm.role,
    content: pm.content,
    timestamp: new Date(pm.ts),
  };
}

export function useAgentChat(datasetId: string): UseAgentChatResult {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const abortRef = useRef<AbortController | null>(null);

  // ── Load session list on mount ──────────────────────────────────────────────

  const refreshSessions = useCallback(async () => {
    try {
      const list = await api.listSessions(datasetId);
      setSessions(list);
    } catch {
      // Non-fatal — sidebar shows empty state
    } finally {
      setSessionsLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // ── Load a session's messages ───────────────────────────────────────────────

  const selectSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setMessages([]);
    setPhase('loading');
    try {
      const resp = await api.getSessionMessages(sessionId);
      setMessages(resp.messages.map(persistedToChat));
    } catch {
      setMessages([]);
    } finally {
      setPhase('idle');
    }
  }, [activeSessionId]);

  // ── Start a fresh session ───────────────────────────────────────────────────

  const startNewSession = useCallback(() => {
    abortRef.current?.abort();
    setActiveSessionId(null);
    setMessages([]);
    setPhase('idle');
  }, []);

  // ── Send a message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || phase === 'loading') return;

    const isNew = activeSessionId === null;

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPhase('loading');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await api.agentChat(
        {
          dataset_id: datasetId,
          question: question.trim(),
          is_new_session: isNew,
          session_id: activeSessionId ?? undefined,
        },
        controller.signal,
      );

      // On first message: set active session and refresh sidebar
      if (isNew) {
        setActiveSessionId(res.session_id);
        await refreshSessions();
      } else {
        // Update last_used_at in local sessions list
        setSessions((prev) =>
          prev.map((s) =>
            s.session_id === res.session_id
              ? { ...s, last_used_at: new Date().toISOString(), message_count: s.message_count + 1 }
              : s,
          ),
        );
      }

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: res.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: isAbort ? ABORT_MESSAGE : `Something went wrong: ${(err as Error).message}`,
        timestamp: new Date(),
        isAborted: isAbort,
        isError: !isAbort,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      abortRef.current = null;
      setPhase('idle');
    }
  }, [datasetId, phase, activeSessionId, refreshSessions]);

  // ── Abort + delete ──────────────────────────────────────────────────────────

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const deleteActiveSession = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await api.deleteSession(activeSessionId);
    } catch { /* ignore */ }
    setActiveSessionId(null);
    setMessages([]);
    setSessions((prev) => prev.filter((s) => s.session_id !== activeSessionId));
  }, [activeSessionId]);

  return {
    sessions,
    sessionsLoading,
    activeSessionId,
    messages,
    phase,
    selectSession,
    startNewSession,
    sendMessage,
    abort,
    deleteActiveSession,
  };
}
