import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Zap,
  Clock,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import api from '../services/api';

const STATUS_COLORS = {
  OPEN: '#94a3b8',
  IN_PROGRESS: '#3b82f6',
  IN_REVIEW: '#a855f7',
  RESOLVED: '#10b981',
  CLOSED: '#475569',
};

const PRIORITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#64748b',
};

const TYPE_COLORS = ['#388eff', '#a855f7', '#10b981', '#f59e0b', '#06b6d4'];

export default function AnalyticsPage() {
  const { id: routeProjectId } = useParams();
  const { activeProject } = useProject();
  const projectId = routeProjectId || activeProject?._id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/analytics/project/${projectId}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-devflow-400" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-slate-500">No analytics data available.</div>;
  }

  const { stats, charts, aiInsights } = data;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Analytics
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Engineering velocity, status distribution, and issue breakdown.
        </p>
      </div>

      {/* Project Health Diagnostics */}
      <div className="rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm">
            <Activity className="w-4 h-4 text-devflow-400" />
            <span>Project Health & Diagnostics</span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">Health Score:</span>
            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {aiInsights?.healthScore || 90}/100
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {aiInsights?.insights?.map((insight, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start space-x-3 ${
                insight.type === 'CRITICAL'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : insight.type === 'WARNING'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : insight.type === 'HOTSPOT'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {insight.type === 'CRITICAL' && <ShieldAlert className="w-4 h-4 text-rose-400" />}
                {insight.type === 'WARNING' && <Clock className="w-4 h-4 text-amber-400" />}
                {insight.type === 'HOTSPOT' && <Zap className="w-4 h-4 text-indigo-400" />}
                {insight.type === 'VELOCITY' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
              </div>
              <div>
                <p>{insight.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overview Stat Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border text-center">
          <span className="text-[11px] text-slate-400 block mb-1">Total Issues</span>
          <span className="text-xl font-bold text-white">{stats.total}</span>
        </div>
        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border text-center">
          <span className="text-[11px] text-slate-400 block mb-1">Open</span>
          <span className="text-xl font-bold text-slate-300">{stats.open}</span>
        </div>
        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border text-center">
          <span className="text-[11px] text-slate-400 block mb-1">In Progress</span>
          <span className="text-xl font-bold text-blue-400">{stats.inProgress}</span>
        </div>
        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border text-center">
          <span className="text-[11px] text-slate-400 block mb-1">In Review</span>
          <span className="text-xl font-bold text-purple-400">{stats.inReview}</span>
        </div>
        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border text-center">
          <span className="text-[11px] text-slate-400 block mb-1">Resolved</span>
          <span className="text-xl font-bold text-emerald-400">{stats.resolved}</span>
        </div>
        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border text-center">
          <span className="text-[11px] text-slate-400 block mb-1">Closed</span>
          <span className="text-xl font-bold text-slate-400">{stats.closed}</span>
        </div>
      </div>

      {/* Visual Charts Grid (Recharts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 1: Status Distribution */}
        <div className="p-5 rounded-2xl bg-dark-surface border border-dark-border shadow-sm">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Status Distribution
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byStatus}>
                <XAxis dataKey="status" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111726', borderColor: '#1f2b45', borderRadius: '8px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {charts.byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#388eff'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Priority Breakdown */}
        <div className="p-5 rounded-2xl bg-dark-surface border border-dark-border shadow-sm">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Priority Breakdown
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byPriority}>
                <XAxis dataKey="priority" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111726', borderColor: '#1f2b45', borderRadius: '8px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {charts.byPriority.map((entry, index) => (
                    <Cell key={`cell-p-${index}`} fill={PRIORITY_COLORS[entry.priority] || '#388eff'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Type Breakdown */}
        <div className="p-5 rounded-2xl bg-dark-surface border border-dark-border shadow-sm">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Issue Types
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.byType}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {charts.byType.map((entry, index) => (
                    <Cell key={`cell-t-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111726', borderColor: '#1f2b45', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Developer Workload */}
        <div className="p-5 rounded-2xl bg-dark-surface border border-dark-border shadow-sm">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Workload by Assignee
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byDeveloper}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111726', borderColor: '#1f2b45', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                <Bar dataKey="active" name="Active (Open/Review)" fill="#388eff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
