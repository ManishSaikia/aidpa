'use client';

/**
 * useUpload — handles CSV upload via XMLHttpRequest.
 *
 * WHY XHR instead of fetch:
 *   fetch() does not expose upload progress events. XHR's
 *   `xhr.upload.onprogress` gives us byte-level progress so we can show
 *   a real percentage bar, not just a spinner.
 *
 * Returns:
 *   upload(file)  — start an upload
 *   progress      — 0-100, upload bytes sent %
 *   phase         — 'idle' | 'uploading' | 'analysing' | 'done' | 'error'
 *   result        — AnalysisResult on success
 *   error         — specific error message string
 *   reset()       — back to idle
 */

import { useState, useCallback } from 'react';
import type { UploadAnalysisResponse, UploadResponse } from '@/types/api';
import { createSupabaseBrowserClient } from '@/lib/supabase';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export type UploadPhase = 'idle' | 'uploading' | 'analysing' | 'done' | 'error';

interface UseUploadResult {
  upload: (file: File) => void;
  progress: number;
  phase: UploadPhase;
  result: UploadAnalysisResponse | null;
  error: string | null;
  reset: () => void;
}

/** Maps HTTP status codes and error shapes to user-facing messages. */
function parseUploadError(status: number, body: string): string {
  // Try to extract FastAPI's `detail` field
  try {
    const json = JSON.parse(body);
    const detail: string = json?.detail ?? '';

    if (status === 413 || detail.toLowerCase().includes('too large')) {
      return `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
    }
    if (status === 400) {
      // Backend sends e.g. "Failed to parse CSV file: ..."
      return detail || 'The server could not parse this file. Make sure it is a valid CSV.';
    }
    if (status === 422) {
      return 'Invalid request — check the file format and try again.';
    }
    if (detail) return detail;
  } catch {
    // body is not JSON
  }

  if (status === 0) {
    return 'Connection failed. Check that the backend server is running.';
  }
  if (status >= 500) {
    return `Server error (${status}). Try again in a moment.`;
  }
  return `Upload failed (HTTP ${status}).`;
}

export function useUpload(): UseUploadResult {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [result, setResult] = useState<UploadAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setPhase('idle');
    setResult(null);
    setError(null);
  }, []);

  const upload = useCallback((file: File) => {
    // ── Client-side validation before any network call ────────────────────
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setPhase('error');
      setError('Only .csv files are accepted. Please choose a CSV file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setPhase('error');
      setError(
        `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. ` +
        `Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`
      );
      return;
    }
    if (file.size === 0) {
      setPhase('error');
      setError('The selected file is empty. Please choose a CSV with data.');
      return;
    }

    setPhase('uploading');
    setProgress(0);
    setError(null);
    setResult(null);

    // ── Get auth token then send via XHR (XHR needed for upload progress) ─
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token ?? '';

      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);

      // Progress: bytes uploaded to server (0 → 100 %)
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      // Upload bytes fully sent — server is now analysing
      xhr.upload.onload = () => {
        setProgress(100);
        setPhase('analysing');
      };

      // Network-level failure (no status code)
      xhr.upload.onerror = () => {
        setPhase('error');
        setError('Connection lost during upload. Check your network and try again.');
      };

      // Server responded
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body: UploadResponse = JSON.parse(xhr.responseText);
            if (body.success && body.data) {
              setResult(body.data);
              setPhase('done');
            } else {
              setPhase('error');
              setError(body.error ?? 'The server returned an unexpected response.');
            }
          } catch {
            setPhase('error');
            setError('Could not read the server response. Try again.');
          }
        } else {
          setPhase('error');
          setError(parseUploadError(xhr.status, xhr.responseText));
        }
      };

      xhr.onerror = () => {
        setPhase('error');
        setError('Connection failed. Check that the backend server is running at ' + BASE_URL);
      };

      xhr.ontimeout = () => {
        setPhase('error');
        setError('Request timed out. The file may be too large or the server is slow.');
      };

      xhr.timeout = 120_000; // 2 minutes
      xhr.open('POST', `${BASE_URL}/upload`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(form);
    });
  }, []);

  return { upload, progress, phase, result, error, reset };
}
