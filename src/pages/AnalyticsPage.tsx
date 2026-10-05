import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  ScanLine,
  Users,
  Package,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface SummaryStats {
  total_plans: number;
  completed_plans: number;
  pending_plans: number;
  today_scans: number;
  total_scans: number;
  completion_rate: number;
}

interface DailyPoint {
  date: string;
  count: number;
}

interface PartPoint {
  part_number: string;
  scan_count: number;
}

interface UserStat {
  id: number;
  name: string;
  username: string;
  total_plans: number;
  completed_plans: number;
  scans: number;
  last_active: string | null;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [partsData, setPartsData] = useState<PartPoint[]>([]);
  const [usersData, setUsersData] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [sumRes, dailyRes, partsRes] = await Promise.all([
        api.get('/api/analytics/summary').catch(() => null),
        api.get('/api/analytics/daily').catch(() => []),
        api.get('/api/analytics/parts').catch(() => []),
      ]);

      if (sumRes) setSummary(sumRes);
      if (Array.isArray(dailyRes)) {
        // Format date string for chart ticks
        setDailyData(
          dailyRes.map((d: { date: string; count: number }) => ({
            date: d.date ? new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '',
            count: Number(d.count) || 0,
          }))
        );
      }
      if (Array.isArray(partsRes)) {
        setPartsData(
          partsRes.slice(0, 10).map((p: { part_number: string; scan_count: number }) => ({
            part_number: p.part_number,
            scan_count: Number(p.scan_count) || 0,
          }))
        );
      }

      if (user?.role === 'admin') {
        const uRes = await api.get('/api/analytics/users').catch(() => []);
        if (Array.isArray(uRes)) setUsersData(uRes);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Operational Insights
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            Dispatch Analytics & Reporting
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {user?.role === 'admin'
              ? 'Plant-wide fulfilment rates, user productivity, and part throughput'
              : 'Your personal scanning velocity, fulfillment rates, and part volumes'}
          </p>
        </div>

        <button
          onClick={loadAnalytics}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs sm:text-sm font-medium transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">Total Scans</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0">
              <ScanLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {summary?.total_scans ?? 0}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-none">
            Today: <strong className="text-teal-400">{summary?.today_scans ?? 0}</strong> parts
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">Completion</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">
            {summary?.completion_rate ?? 0}%
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-none">
            {summary?.completed_plans ?? 0} of {summary?.total_plans ?? 0} plans
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">Completed</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-400 tracking-tight">
            {summary?.completed_plans ?? 0}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-none">Ready / dispatched</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">Pending Plans</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-400 tracking-tight">
            {summary?.pending_plans ?? 0}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-none">Requires scanning</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Scan Volume Trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-400" />
                Daily Scan Activity (30 Days)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Scanned barcodes per day</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
              </div>
            ) : dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                No scan data recorded in the last 30 days.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#2dd4bf', fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#scanGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top 10 Scanned Parts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-400" />
                Top Parts by Scan Volume
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Most frequently verified part numbers</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
              </div>
            ) : partsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                No part volume data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partsData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="part_number"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="scan_count" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Admin User Performance Table */}
      {user?.role === 'admin' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                Operator Productivity & Performance
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Breakdown of plans assigned, fulfillment rates, and barcode activity per user
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-left text-xs border-collapse min-w-[620px]">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-300">
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Plans</th>
                  <th className="px-4 py-3 font-semibold text-right">Completed Plans</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Scans</th>
                  <th className="px-4 py-3 font-semibold text-center w-36">Fulfillment %</th>
                  <th className="px-4 py-3 font-semibold text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {usersData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                      No operator performance records found.
                    </td>
                  </tr>
                ) : (
                  usersData.map((u) => {
                    const pct =
                      u.total_plans > 0
                        ? Math.round((u.completed_plans / u.total_plans) * 100)
                        : 0;

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-sans">
                          <span className="font-bold text-white text-sm">{u.name}</span>
                          <span className="text-slate-500 text-xs block">@{u.username}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-200">
                          {u.total_plans}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400">
                          {u.completed_plans}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-teal-400">
                          {u.scans}
                        </td>
                        <td className="px-4 py-3 text-center font-sans">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-teal-400 w-9 text-right">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 text-xs">
                          {u.last_active
                            ? new Date(u.last_active).toLocaleDateString('en-GB')
                            : 'Never'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
