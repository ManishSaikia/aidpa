'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUpload } from '@/hooks/useUpload';
import { useDatasetStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function UploadZone() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const { upload, progress, phase, result, error, reset } = useUpload();
  const setDataset = useDatasetStore((s) => s.setDataset);

  const requireAuth = useCallback(() => {
    if (!user) {
      router.push('/login?returnUrl=%2F');
      return false;
    }
    return true;
  }, [user, router]);

  useEffect(() => {
    if (phase === 'done' && result) {
      setDataset(result.dataset_id, result.filename, result);
      const t = setTimeout(() => {
        router.push(`/dashboard/${result.dataset_id}`);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [phase, result, setDataset, router]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => c + 1);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => {
      const next = c - 1;
      if (next <= 0) setIsDragging(false);
      return next;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const file = e.dataTransfer.files?.[0];
    if (file && requireAuth()) upload(file);
  }, [upload, requireAuth]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && requireAuth()) upload(file);
    e.target.value = '';
  }, [upload, requireAuth]);

  const handleClick = () => {
    if (phase === 'idle' || phase === 'error') {
      if (!requireAuth()) return;
      fileInputRef.current?.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') handleClick();
  };

  const isActive = phase === 'uploading' || phase === 'analysing';
  const isSuccess = phase === 'done';
  const isError = phase === 'error';

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .upload-zone {
          position: relative;
          width: 100%;
          margin: 0 auto;
          padding: 56px 40px;
          border-radius: var(--radius-xxl);
          border: 1.5px dashed var(--color-hairline-strong);
          background-color: var(--color-canvas-soft);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          cursor: pointer;
          outline: none;
          transition: border-color 200ms ease, background-color 200ms ease, transform 150ms ease;
          user-select: none;
        }

        .upload-zone:focus-visible {
          border-color: var(--color-ink);
          box-shadow: 0 0 0 3px rgba(12, 10, 9, 0.08);
        }

        .upload-zone.dragging {
          border-color: var(--color-ink);
          border-style: solid;
          background-color: var(--color-surface-strong);
          transform: scale(1.01);
        }

        .upload-zone.success {
          border-color: var(--color-success);
          border-style: solid;
          background-color: #f0fdf4;
          cursor: default;
        }

        .upload-zone.error-state {
          border-color: var(--color-error);
          border-style: solid;
          background-color: #fff5f5;
          cursor: pointer;
        }

        .upload-zone.active {
          border-style: solid;
          cursor: default;
        }

        .upload-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-full);
          background-color: var(--color-surface-strong);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          color: var(--color-muted);
          transition: background-color 200ms ease, color 200ms ease;
        }

        .upload-zone.dragging .upload-icon-wrap {
          background-color: var(--color-ink);
          color: white;
        }

        .upload-zone.success .upload-icon-wrap {
          background-color: var(--color-success);
          color: white;
        }

        .upload-zone.error-state .upload-icon-wrap {
          background-color: var(--color-error);
          color: white;
        }

        .upload-title {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 500;
          color: var(--color-ink);
          margin: 0 0 6px;
        }

        .upload-subtitle {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-muted);
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .upload-error-msg {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-error);
          margin: 0 0 20px;
          line-height: 1.5;
          max-width: 360px;
        }

        .progress-track {
          width: 100%;
          max-width: 320px;
          height: 3px;
          background-color: var(--color-hairline);
          border-radius: var(--radius-pill);
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-fill {
          height: 100%;
          background-color: var(--color-ink);
          border-radius: var(--radius-pill);
          transition: width 120ms ease-out;
        }

        .progress-label {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-muted);
        }

        .file-constraint {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: center;
          margin-top: 8px;
        }

        .constraint-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background-color: var(--color-surface-strong);
          color: var(--color-muted);
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: var(--radius-pill);
        }
      `}</style>

      <div
        id="upload-zone"
        role="button"
        tabIndex={0}
        aria-label="Upload CSV file — click or drag and drop"
        className={[
          'upload-zone',
          isDragging ? 'dragging' : '',
          isActive ? 'active' : '',
          isSuccess ? 'success' : '',
          isError ? 'error-state' : '',
        ].join(' ')}
        onDragEnter={!isActive && !isSuccess ? handleDragEnter : undefined}
        onDragLeave={!isActive && !isSuccess ? handleDragLeave : undefined}
        onDragOver={!isActive && !isSuccess ? handleDragOver : undefined}
        onDrop={!isActive && !isSuccess ? handleDrop : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          id="csv-file-input"
          aria-hidden="true"
        />

        {/* Icon */}
        <div className="upload-icon-wrap">
          {isSuccess ? <CheckIcon /> : isActive ? <SpinnerIcon /> : <UploadIcon />}
        </div>

        {/* ── Idle state ───────────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <>
            <p className="upload-title">
              {isDragging ? 'Drop to upload' : 'Drop your CSV here'}
            </p>
            <p className="upload-subtitle">or click to browse files</p>
            <button className="btn-primary" type="button" onClick={(e) => { e.stopPropagation(); handleClick(); }}>
              Browse files
            </button>
            <div className="file-constraint" style={{ marginTop: 20 }}>
              <span className="constraint-pill">CSV only</span>
              <span className="constraint-pill">Max 20 MB</span>
            </div>
          </>
        )}

        {/* ── Uploading state (bytes in transit) ───────────────────────────── */}
        {phase === 'uploading' && (
          <>
            <p className="upload-title">Uploading…</p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-label">{progress}%</p>
          </>
        )}

        {/* ── Analysing state (server processing) ──────────────────────────── */}
        {phase === 'analysing' && (
          <>
            <p className="upload-title">Analysing your dataset…</p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '100%' }} />
            </div>
            <p className="progress-label">Running quality checks</p>
          </>
        )}

        {/* ── Success state ─────────────────────────────────────────────────── */}
        {phase === 'done' && result && (
          <>
            <p className="upload-title" style={{ color: 'var(--color-success)' }}>
              Upload complete
            </p>
            <p className="upload-subtitle">
              {result.filename} · {result.rows.toLocaleString()} rows · {result.columns.length} columns
            </p>
            <p className="upload-subtitle" style={{ marginBottom: 0 }}>
              Redirecting to dashboard…
            </p>
          </>
        )}

        {/* ── Error state ───────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <>
            <p className="upload-title" style={{ color: 'var(--color-error)' }}>
              Upload failed
            </p>
            <p className="upload-error-msg">{error}</p>
            <button
              className="btn-outline"
              type="button"
              onClick={(e) => { e.stopPropagation(); reset(); }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </>
  );
}
