import { useState, useEffect, useCallback, useMemo } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AdminSelect } from './AdminSelect';
import {
  RefreshCw, Search, Plus, X, Mail, Ban, RotateCcw, KeyRound,
  Infinity as InfinityIcon, Clock, Monitor, Copy, Check,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface License {
  id: string;
  license_key: string;
  email: string;
  customer_name?: string | null;
  product_id: string;
  product_name: string;
  plan_tier: string;
  type: 'lifetime' | 'subscription';
  status: 'active' | 'revoked' | 'expired' | 'past_due';
  machine_limit: number;
  machines_used: number;
  expires_at: string | null;
  provider: string;
  created_at: string;
}

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return {
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token || '',
    'Content-Type': 'application/json',
  };
}

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  revoked:  'bg-red-500/15 text-red-300 border-red-500/25',
  expired:  'bg-white/8 text-white/40 border-white/15',
  past_due: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function LicensesTab() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const flash = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`${API_BASE}/admin/licenses?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load licenses');
      setLicenses(data.licenses ?? []);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  // Client-side search by email or key (server already filtered status/type).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return licenses;
    return licenses.filter(l =>
      l.email?.toLowerCase().includes(q) ||
      l.license_key.toLowerCase().includes(q) ||
      l.customer_name?.toLowerCase().includes(q)
    );
  }, [licenses, search]);

  const stats = useMemo(() => ({
    total: licenses.length,
    active: licenses.filter(l => l.status === 'active').length,
    subscription: licenses.filter(l => l.type === 'subscription').length,
    lifetime: licenses.filter(l => l.type === 'lifetime').length,
  }), [licenses]);

  const action = async (path: string, body: Record<string, unknown>, okMsg: string) => {
    setBusyKey(String(body.license_key ?? ''));
    try {
      const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Action failed');
      flash('ok', okMsg);
      await load();
    } catch (e: any) {
      flash('err', e.message || 'Action failed');
    } finally {
      setBusyKey(null);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl border ${
          toast.kind === 'ok' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' : 'bg-red-500/15 border-red-500/30 text-red-200'
        }`}>{toast.msg}</div>
      )}

      {/* Header + stats */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-white">Licenses</h2>
            <p className="text-white/40 text-sm mt-0.5">Manage FSTH licenses across all products</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreate(true)} className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white">
              <Plus className="w-4 h-4 mr-1.5" /> Create License
            </Button>
            <Button onClick={load} variant="outline" className="cursor-pointer bg-white/5 border-white/15 text-white/70 hover:bg-white/10">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total', value: stats.total, cls: 'text-white' },
            { label: 'Active', value: stats.active, cls: 'text-emerald-300' },
            { label: 'Subscription', value: stats.subscription, cls: 'text-sky-300' },
            { label: 'Lifetime', value: stats.lifetime, cls: 'text-amber-300' },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-white/35">{s.label}</p>
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Search email, name, or key…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-black/40 border-white/15 text-white"
            />
          </div>
          <div className="w-full sm:w-40">
            <AdminSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'past_due', label: 'Past due' },
                { value: 'expired', label: 'Expired' },
                { value: 'revoked', label: 'Revoked' },
              ]}
            />
          </div>
          <div className="w-full sm:w-40">
            <AdminSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'All types' },
                { value: 'lifetime', label: 'Lifetime' },
                { value: 'subscription', label: 'Subscription' },
              ]}
            />
          </div>
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-300 text-sm">{error}</div>
        )}
        {loading ? (
          <div className="py-16 text-center text-white/30 text-sm">Loading licenses…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-white/30 text-sm">No licenses match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/35">
                  <th className="px-4 py-3 font-medium">License</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Product · Tier</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Machines</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => copyKey(l.license_key)}
                        title="Copy key"
                        className="flex items-center gap-1.5 font-mono text-xs text-purple-300 hover:text-purple-200 transition-colors"
                      >
                        {l.license_key}
                        {copiedKey === l.license_key ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-40" />}
                      </button>
                      <p className="text-[10px] text-white/25 mt-0.5 capitalize">{l.provider}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white/80">{l.email}</p>
                      {l.customer_name && <p className="text-[11px] text-white/35">{l.customer_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {l.product_name}
                      <span className="text-white/35 capitalize"> · {l.plan_tier}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-white/60">
                        {l.type === 'lifetime'
                          ? <><InfinityIcon className="w-3.5 h-3.5 text-amber-400" /> Lifetime</>
                          : <><Clock className="w-3.5 h-3.5 text-sky-400" /> Sub</>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-white/60">
                        <Monitor className="w-3.5 h-3.5 text-white/30" />
                        {l.machines_used}/{l.machine_limit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${STATUS_STYLES[l.status] ?? STATUS_STYLES.expired}`}>
                        {l.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">{l.type === 'lifetime' ? '—' : fmtDate(l.expires_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button" title="Resend license email"
                          disabled={busyKey === l.license_key}
                          onClick={() => action('/admin/licenses/reissue', { license_key: l.license_key }, 'License email resent')}
                          className="p-1.5 rounded-lg text-white/40 hover:text-sky-300 hover:bg-sky-500/10 transition-colors disabled:opacity-40"
                        ><Mail className="w-3.5 h-3.5" /></button>
                        {l.status === 'revoked' ? (
                          <button
                            type="button" title="Un-revoke"
                            disabled={busyKey === l.license_key}
                            onClick={() => action('/admin/licenses/unrevoke', { license_key: l.license_key }, 'License re-activated')}
                            className="p-1.5 rounded-lg text-white/40 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                          ><RotateCcw className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button
                            type="button" title="Revoke"
                            disabled={busyKey === l.license_key}
                            onClick={() => {
                              const reason = prompt('Revoke reason? (optional)') ?? undefined;
                              action('/admin/licenses/revoke', { license_key: l.license_key, reason }, 'License revoked');
                            }}
                            className="p-1.5 rounded-lg text-white/40 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          ><Ban className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {showCreate && <CreateLicenseModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); flash('ok', 'License created'); }} flash={flash} />}
    </div>
  );
}

// ── Create-license modal ────────────────────────────────────────────────────────
function CreateLicenseModal({ onClose, onCreated, flash }: {
  onClose: () => void;
  onCreated: () => void;
  flash: (k: 'ok' | 'err', m: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState('pro');
  const [type, setType] = useState<'lifetime' | 'subscription'>('lifetime');
  const [machineLimit, setMachineLimit] = useState('1');
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) { flash('err', 'Email is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/licenses/create`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          email: email.trim(), plan_tier: tier, type,
          machine_limit: Number(machineLimit) || 1, send_email: sendEmail,
          product_id: 'fastoosh_data_automator',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Create failed');
      setResult(data.license_key);
    } catch (e: any) {
      flash('err', e.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0d0d0f] border border-white/12 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><KeyRound className="w-4 h-4 text-purple-400" /> Create License</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70"><X className="w-4 h-4" /></button>
        </div>

        {result ? (
          <div className="p-6 text-center space-y-4">
            <p className="text-white/60 text-sm">License created for <strong className="text-white">{email}</strong></p>
            <div className="bg-black/50 border border-white/15 rounded-lg p-3">
              <span className="font-mono text-purple-300 text-sm">{result}</span>
            </div>
            <p className="text-white/35 text-xs">{sendEmail ? 'The license email was sent to the customer.' : 'No email was sent — share the key manually.'}</p>
            <Button onClick={onCreated} className="w-full bg-violet-600 hover:bg-violet-500 text-white cursor-pointer">Done</Button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Customer email</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="customer@example.com" className="bg-black/40 border-white/15 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Tier</label>
                <Input value={tier} onChange={e => setTier(e.target.value)} placeholder="pro" className="bg-black/40 border-white/15 text-white" />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Machines</label>
                <Input type="number" min={1} value={machineLimit} onChange={e => setMachineLimit(e.target.value)} className="bg-black/40 border-white/15 text-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Type</label>
              <AdminSelect
                value={type}
                onChange={(v) => setType(v as 'lifetime' | 'subscription')}
                options={[
                  { value: 'lifetime', label: 'Lifetime' },
                  { value: 'subscription', label: 'Subscription (33-day expiry)' },
                ]}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="w-4 h-4 rounded bg-black/40 border-white/20 checked:bg-purple-500" />
              <span className="text-sm text-white/60">Email the license key to the customer</span>
            </label>
            <Button onClick={submit} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-500 text-white cursor-pointer">
              {saving ? 'Creating…' : 'Create License'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
