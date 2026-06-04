'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface Schedule {
  _id: string;
  name: string;
  reportKey: string;
  format: string;
  cron: string;
  windowSpec: string;
  isActive: boolean;
  lastRunAt?: string;
  lastRunStatus?: string;
}

interface Artefact {
  _id: string;
  reportKey: string;
  format: string;
  rowCount: number;
  createdAt: string;
}

export default function ReportsPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const [reportKey, setReportKey] = useState<'sales_summary' | 'inventory_snapshot' | 'customer_segments' | 'orders_full'>('sales_summary');
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');
  const [windowSpec, setWindowSpec] = useState<'last_24h' | 'last_7d' | 'last_30d' | 'last_90d'>('last_7d');
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const [schedName, setSchedName] = useState('Weekly sales digest');
  const [cron, setCron] = useState('0 9 * * 1');
  const [recipients, setRecipients] = useState('finance@example.com');

  const schedules = useQuery({
    queryKey: ['reports', 'schedules'],
    queryFn: () => apiFetch<{ data: Schedule[] }>('/reports/schedules', { accessToken }),
    enabled: Boolean(accessToken),
  });
  const artefacts = useQuery({
    queryKey: ['reports', 'artefacts'],
    queryFn: () => apiFetch<{ data: Artefact[] }>('/reports/artefacts', { accessToken }),
    enabled: Boolean(accessToken),
  });

  const run = useMutation({
    mutationFn: async () =>
      apiFetch<{ artefactId: string; rowCount: number }>('/reports/run', {
        method: 'POST',
        accessToken,
        body: { reportKey, format, windowSpec },
      }),
    onSuccess: (data) => {
      setRunMsg(`Generated artefact ${data.artefactId.slice(-6)} (${data.rowCount} rows).`);
      void qc.invalidateQueries({ queryKey: ['reports', 'artefacts'] });
    },
  });

  const schedule = useMutation({
    mutationFn: async () =>
      apiFetch('/reports/schedules', {
        method: 'POST',
        accessToken,
        body: {
          name: schedName,
          reportKey,
          format,
          cron,
          windowSpec,
          recipients: { addresses: recipients.split(',').map((s) => s.trim()).filter(Boolean) },
        },
      }),
    onSuccess: () => {
      setRunMsg('Schedule saved.');
      void qc.invalidateQueries({ queryKey: ['reports', 'schedules'] });
    },
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => apiFetch(`/reports/schedules/${id}`, { method: 'DELETE', accessToken }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'schedules'] }),
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
      <NeuCard>
        <h2 className="text-lg font-semibold">Build a report</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-text-secondary">Report</span>
            <select
              value={reportKey}
              onChange={(e) => setReportKey(e.target.value as typeof reportKey)}
              className="mt-1 w-full rounded-md bg-surface-sunken px-3 py-2 shadow-neu-sunken"
            >
              <option value="sales_summary">Sales summary</option>
              <option value="inventory_snapshot">Inventory snapshot</option>
              <option value="customer_segments">Customer segments</option>
              <option value="orders_full">Orders (full)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Format</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="mt-1 w-full rounded-md bg-surface-sunken px-3 py-2 shadow-neu-sunken"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Window</span>
            <select
              value={windowSpec}
              onChange={(e) => setWindowSpec(e.target.value as typeof windowSpec)}
              className="mt-1 w-full rounded-md bg-surface-sunken px-3 py-2 shadow-neu-sunken"
            >
              <option value="last_24h">Last 24h</option>
              <option value="last_7d">Last 7 days</option>
              <option value="last_30d">Last 30 days</option>
              <option value="last_90d">Last 90 days</option>
            </select>
          </label>
          <NeuButton onClick={() => run.mutate()} loading={run.isPending}>
            Run now
          </NeuButton>
          {runMsg ? <p className="text-sm text-success">{runMsg}</p> : null}
        </div>

        <hr className="my-6 border-surface-sunken/40" />

        <h2 className="text-lg font-semibold">Schedule</h2>
        <div className="mt-3 space-y-3">
          <NeuInput label="Name" value={schedName} onChange={(e) => setSchedName(e.target.value)} />
          <NeuInput
            label="Cron (UTC)"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            hint="e.g. 0 9 * * 1 — every Monday at 09:00 UTC"
          />
          <NeuInput
            label="Recipients (comma-separated)"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
          />
          <NeuButton onClick={() => schedule.mutate()} loading={schedule.isPending} variant="secondary">
            Save schedule
          </NeuButton>
        </div>
      </NeuCard>

      <div className="space-y-6">
        <NeuCard>
          <h2 className="text-lg font-semibold">Schedules</h2>
          {schedules.isLoading ? (
            <div className="skeleton mt-3 h-24" aria-busy role="status" />
          ) : (schedules.data?.data?.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">No schedules yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {schedules.data?.data?.map((s) => (
                <li key={s._id} className="rounded-md p-3 shadow-neu-soft">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs uppercase tracking-wide text-text-muted">{s.format}</p>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {s.reportKey} · {s.windowSpec} · cron <span className="font-mono">{s.cron}</span>
                  </p>
                  {s.lastRunAt ? (
                    <p className="mt-1 text-xs">
                      Last run {new Date(s.lastRunAt).toLocaleString()} — {s.lastRunStatus}
                    </p>
                  ) : null}
                  {s.isActive ? (
                    <button
                      onClick={() => deactivate.mutate(s._id)}
                      className="mt-2 text-xs text-error underline"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <span className="mt-2 inline-block text-xs text-text-muted">inactive</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </NeuCard>

        <NeuCard>
          <h2 className="text-lg font-semibold">Recent artefacts</h2>
          {artefacts.isLoading ? (
            <div className="skeleton mt-3 h-24" aria-busy role="status" />
          ) : (artefacts.data?.data?.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">No reports run yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {artefacts.data?.data?.map((a) => (
                <li key={a._id} className="flex items-center justify-between rounded-md p-3 shadow-neu-soft">
                  <div>
                    <p className="font-medium">{a.reportKey}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(a.createdAt).toLocaleString()} · {a.rowCount} rows
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs uppercase shadow-neu-soft">
                    {a.format}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </NeuCard>
      </div>
    </div>
  );
}
