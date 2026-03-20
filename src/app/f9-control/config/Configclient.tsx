'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import type { PlatformConfig } from './page';

interface ConfigClientProps {
  configs: PlatformConfig[];
  onToggle: (key: string, enabled: boolean) => Promise<void>;
  onUpdateValue: (
    key: string,
    value: number | null,
    stringValue: string | null
  ) => Promise<void>;
}

// ─── Per-card state ───────────────────────────────────────────────────────────

interface CardState {
  // Optimistic enabled state so the toggle feels instant
  enabled: boolean;
  // Draft value being edited (kept as string for the input element)
  draftValue: string;
  // Whether the value input is in edit mode
  editing: boolean;
  // Feedback banner: null | 'saved' | 'error'
  feedback: 'saved' | 'error' | null;
}

function initialCardState(config: PlatformConfig): CardState {
  return {
    enabled: config.enabled ?? false,
    draftValue:
      config.value !== null
        ? String(config.value)
        : config.string_value ?? '',
    editing: false,
    feedback: null,
  };
}

// ─── Individual config card ───────────────────────────────────────────────────

interface ConfigCardProps {
  config: PlatformConfig;
  state: CardState;
  isPending: boolean;
  onToggle: () => void;
  onEditStart: () => void;
  onDraftChange: (v: string) => void;
  onSaveValue: () => void;
  onCancelEdit: () => void;
}

function ConfigCard({
  config,
  state,
  isPending,
  onToggle,
  onEditStart,
  onDraftChange,
  onSaveValue,
  onCancelEdit,
}: ConfigCardProps) {
  const hasValue = config.value !== null || config.string_value !== null;
  const isNumeric = config.value !== null;

  return (
    <Card className="p-5 flex flex-col gap-4">
      {/* Header row: key + description + toggle */}
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 font-mono text-sm break-all">
            {config.key}
          </h3>
          {config.description && (
            <p className="text-sm text-gray-500 mt-1">{config.description}</p>
          )}
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          onClick={onToggle}
          disabled={isPending}
          aria-checked={state.enabled}
          role="switch"
          className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 ${
            state.enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              state.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          <span className="sr-only">
            {state.enabled ? 'Disable' : 'Enable'} {config.key}
          </span>
        </button>
      </div>

      {/* Status pill */}
      <div className="flex items-center gap-2">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            state.enabled
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {state.enabled ? 'ON' : 'OFF'}
        </span>
        {isPending && (
          <Loader2 size={14} className="animate-spin text-gray-400" />
        )}
        {state.feedback === 'saved' && !isPending && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <Check size={12} /> Saved
          </span>
        )}
        {state.feedback === 'error' && !isPending && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertCircle size={12} /> Failed — try again
          </span>
        )}
      </div>

      {/* Value / threshold row */}
      {hasValue && (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-600 font-medium shrink-0">
              Threshold / Value
            </span>

            {state.editing ? (
              <div className="flex items-center gap-2">
                <input
                  type={isNumeric ? 'number' : 'text'}
                  value={state.draftValue}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveValue();
                    if (e.key === 'Escape') onCancelEdit();
                  }}
                  className="w-28 px-2 py-1 text-sm font-mono border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={onSaveValue}
                  disabled={isPending}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded transition-colors"
                >
                  {isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    'Save'
                  )}
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onEditStart}
                className="group flex items-center gap-1.5 bg-gray-100 hover:bg-blue-50 hover:border-blue-300 border border-transparent px-3 py-1 rounded transition-colors"
                title="Click to edit"
              >
                <span className="text-sm font-mono text-gray-800 group-hover:text-blue-700">
                  {config.value !== null ? config.value : config.string_value}
                </span>
                <span className="text-xs text-gray-400 group-hover:text-blue-500">
                  ✎
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function ConfigClient({
  configs,
  onToggle,
  onUpdateValue,
}: ConfigClientProps) {
  const [isPending, startTransition] = useTransition();

  // Per-key card state map
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(
    () =>
      Object.fromEntries(configs.map((c) => [c.key, initialCardState(c)]))
  );

  const updateCard = (key: string, patch: Partial<CardState>) =>
    setCardStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));

  const showFeedback = (key: string, feedback: 'saved' | 'error') => {
    updateCard(key, { feedback });
    setTimeout(() => updateCard(key, { feedback: null }), 2500);
  };

  const handleToggle = (key: string) => {
    const next = !cardStates[key].enabled;
    // Optimistic update
    updateCard(key, { enabled: next });
    startTransition(async () => {
      try {
        await onToggle(key, next);
        showFeedback(key, 'saved');
      } catch {
        // Rollback on failure
        updateCard(key, { enabled: !next });
        showFeedback(key, 'error');
      }
    });
  };

  const handleSaveValue = (config: PlatformConfig) => {
    const { draftValue } = cardStates[config.key];
    const isNumeric = config.value !== null;

    const numericValue = isNumeric ? Number(draftValue) : null;
    const stringValue  = !isNumeric ? draftValue : null;

    if (isNumeric && isNaN(numericValue!)) return;

    updateCard(config.key, { editing: false });
    startTransition(async () => {
      try {
        await onUpdateValue(config.key, numericValue, stringValue);
        showFeedback(config.key, 'saved');
      } catch {
        showFeedback(config.key, 'error');
      }
    });
  };

  if (configs.length === 0) {
    return (
      <p className="text-sm text-gray-500">No configuration entries found.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {configs.map((config) => {
        const state = cardStates[config.key];
        if (!state) return null;

        return (
          <ConfigCard
            key={config.key}
            config={config}
            state={state}
            isPending={isPending}
            onToggle={() => handleToggle(config.key)}
            onEditStart={() => updateCard(config.key, { editing: true })}
            onDraftChange={(v) => updateCard(config.key, { draftValue: v })}
            onSaveValue={() => handleSaveValue(config)}
            onCancelEdit={() =>
              updateCard(config.key, {
                editing: false,
                draftValue:
                  config.value !== null
                    ? String(config.value)
                    : config.string_value ?? '',
              })
            }
          />
        );
      })}
    </div>
  );
}