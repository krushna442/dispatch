import { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
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
  Download,
  Search,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  UserCheck,
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

interface UserScannerItem {
  scanner_id: number;
  scanner_name: string;
  scanner_username?: string;
  scanner_role?: string;
  scan_count: number;
}

interface UserScannedForItem {
  uploader_id: number;
  uploader_name: string;
  uploader_username?: string;
  uploader_role?: string;
  scan_count: number;
  plans_count: number;
}

interface UserStat {
  id: number;
  name: string;
  username: string;
  role?: 'admin' | 'sales' | 'operator';
  customer_name?: string | null;
  vendor_code?: string | null;
  customers?: string[];
  total_plans: number;
  completed_plans: number;
  uploaded_plans?: number;
  completed_uploaded_plans?: number;
  scans: number;
  user_scanned_plans?: number;
  completed_scanned_plans?: number;
  last_active: string | null;
  scanned_by?: UserScannerItem[];
  scanned_for?: UserScannedForItem[];
}

interface PlanAuditScanner {
  scanner_id: number;
  scanner_name: string;
  scanner_username?: string;
  scanner_role?: string;
  scan_count: number;
  last_scanned_at?: string;
}

interface PlanAuditItem {
  id: number;
  part_number: string;
  quantity: number;
  scanned_quantity: number;
  balance_quantity: number;
  fulfillment_pct: number;
  status: 'pending' | 'completed';
  plan_date: string;
  schedule_date: string | null;
  customer_name: string | null;
  vendor_code: string | null;
  gate_pass_number: string | null;
  created_at: string;
  uploader: {
    id: number;
    name: string;
    username: string;
    role?: string;
  };
  scanners: PlanAuditScanner[];
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [partsData, setPartsData] = useState<PartPoint[]>([]);
  const [usersData, setUsersData] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Detailed Plans Audit Table State
  const todayStr = new Date().toISOString().split('T')[0];
  const [plansAudit, setPlansAudit] = useState<PlanAuditItem[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planSearch, setPlanSearch] = useState('');
  const [planCustomerFilter, setPlanCustomerFilter] = useState('all');
  const [planStatusFilter, setPlanStatusFilter] = useState('all');
  const [planDatePreset, setPlanDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [planStartDate, setPlanStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [planPage, setPlanPage] = useState(1);
  const [planPageSize, setPlanPageSize] = useState(15);

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

      if (user?.role === 'admin' || user?.role === 'sales') {
        const uRes = await api.get('/api/analytics/users').catch(() => []);
        if (Array.isArray(uRes)) setUsersData(uRes);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlansAudit = async () => {
    setPlansLoading(true);
    try {
      let queryParams: string[] = [];
      if (planStartDate) queryParams.push(`startDate=${encodeURIComponent(planStartDate)}`);
      if (planEndDate) queryParams.push(`endDate=${encodeURIComponent(planEndDate)}`);
      if (planCustomerFilter && planCustomerFilter !== 'all') {
        queryParams.push(`customer_name=${encodeURIComponent(planCustomerFilter)}`);
      }
      if (planStatusFilter && planStatusFilter !== 'all') {
        queryParams.push(`status=${encodeURIComponent(planStatusFilter)}`);
      }

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const data = await api.get(`/api/analytics/plans${queryString}`).catch(() => []);
      if (Array.isArray(data)) {
        setPlansAudit(data);
      } else {
        setPlansAudit([]);
      }
    } catch (err) {
      console.error('Error loading plans audit:', err);
      toast.error('Failed to load plan execution data');
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  useEffect(() => {
    loadPlansAudit();
    setPlanPage(1);
  }, [planStartDate, planEndDate, planCustomerFilter, planStatusFilter]);

  // Handle Preset Date Selection
  const handleDatePresetChange = (preset: 'all' | 'today' | '7days' | '30days' | 'custom') => {
    setPlanDatePreset(preset);
    if (preset === 'today') {
      setPlanStartDate(todayStr);
      setPlanEndDate(todayStr);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setPlanStartDate(d.toISOString().split('T')[0]);
      setPlanEndDate(todayStr);
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setPlanStartDate(d.toISOString().split('T')[0]);
      setPlanEndDate(todayStr);
    } else if (preset === 'all') {
      setPlanStartDate('');
      setPlanEndDate('');
    }
  };

  // Derive unique customer list for dropdown
  const uniqueCustomers = useMemo(() => {
    const list = new Set<string>();
    plansAudit.forEach((p) => {
      if (p.customer_name && p.customer_name.trim()) {
        list.add(p.customer_name.trim());
      }
    });
    // Add common presets if not present
    [
      'ASL PNR MBP',
      'ASL ALW MBP',
      'ASL ALH MBP',
      'Switch Mobility',
      'Tata Motors (TML)',
      'IPLT',
      'VE Commercial Vehicles (VECV)'
    ].forEach((c) => list.add(c));
    return Array.from(list).sort();
  }, [plansAudit]);

  // Client-side text search over the plans
  const filteredPlans = useMemo(() => {
    if (!planSearch.trim()) return plansAudit;
    const q = planSearch.toLowerCase().trim();
    return plansAudit.filter((p) => {
      const part = (p.part_number || '').toLowerCase();
      const cust = (p.customer_name || '').toLowerCase();
      const vend = (p.vendor_code || '').toLowerCase();
      const uploaderName = (p.uploader?.name || '').toLowerCase();
      const uploaderUser = (p.uploader?.username || '').toLowerCase();
      const scannerMatches = p.scanners?.some(
        (s) =>
          (s.scanner_name || '').toLowerCase().includes(q) ||
          (s.scanner_username || '').toLowerCase().includes(q)
      );

      return (
        part.includes(q) ||
        cust.includes(q) ||
        vend.includes(q) ||
        uploaderName.includes(q) ||
        uploaderUser.includes(q) ||
        scannerMatches
      );
    });
  }, [plansAudit, planSearch]);

  // Pagination slice
  const paginatedPlans = useMemo(() => {
    const start = (planPage - 1) * planPageSize;
    return filteredPlans.slice(start, start + planPageSize);
  }, [filteredPlans, planPage, planPageSize]);

  const totalPages = Math.ceil(filteredPlans.length / planPageSize) || 1;

  // Export Detailed Plans & Scanner Audit to Excel
  const exportPlansAuditToExcel = () => {
    try {
      if (filteredPlans.length === 0) {
        toast.error('No plans available to export');
        return;
      }

      const headers = [
        'SR No',
        'Part Number',
        'Customer Name',
        'Vendor Code',
        'Plan Date',
        'Schedule Date',
        'Target Qty',
        'Actual Scanned Qty',
        'Balance Qty',
        'Fulfillment %',
        'Uploaded By',
        'Scanned By (Operators & Breakdown)',
        'Status',
      ];

      const rows: any[][] = [headers];

      filteredPlans.forEach((p, idx) => {
        const uploaderStr = p.uploader?.name
          ? `${p.uploader.name} (@${p.uploader.username || ''}) [${(p.uploader.role || '').toUpperCase()}]`
          : 'System / Unassigned';

        const scannedByStr =
          p.scanners && p.scanners.length > 0
            ? p.scanners.map((s) => `${s.scanner_name || s.scanner_username} (${s.scan_count})`).join(', ')
            : 'No scans yet';

        const planDateStr = p.plan_date ? new Date(p.plan_date).toLocaleDateString('en-GB') : '—';
        const scheduleDateStr = p.schedule_date ? new Date(p.schedule_date).toLocaleDateString('en-GB') : '—';

        rows.push([
          idx + 1,
          p.part_number,
          p.customer_name || '—',
          p.vendor_code || '—',
          planDateStr,
          scheduleDateStr,
          p.quantity,
          p.scanned_quantity,
          p.balance_quantity,
          `${p.fulfillment_pct}%`,
          uploaderStr,
          scannedByStr,
          (p.status || 'pending').toUpperCase(),
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },  // SR No
        { wch: 20 }, // Part Number
        { wch: 28 }, // Customer Name
        { wch: 14 }, // Vendor Code
        { wch: 14 }, // Plan Date
        { wch: 14 }, // Schedule Date
        { wch: 12 }, // Target Qty
        { wch: 16 }, // Actual Scanned Qty
        { wch: 12 }, // Balance Qty
        { wch: 14 }, // Fulfillment %
        { wch: 32 }, // Uploaded By
        { wch: 45 }, // Scanned By
        { wch: 14 }, // Status
      ];

      // Header style
      for (let c = 0; c < headers.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) {
          ws[addr].s = {
            fill: { fgColor: { rgb: '0F766E' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: '0D9488' } },
              bottom: { style: 'thin', color: { rgb: '0D9488' } },
              left: { style: 'thin', color: { rgb: '0D9488' } },
              right: { style: 'thin', color: { rgb: '0D9488' } },
            },
          };
        }
      }

      // Cell styles
      for (let r = 1; r < rows.length; r++) {
        for (let c = 0; c < headers.length; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) {
            ws[addr] = { t: 's', v: '' };
          }
          ws[addr].s = {
            font: { color: { rgb: '1E293B' }, sz: 10 },
            alignment: {
              vertical: 'center',
              horizontal: [0, 4, 5, 6, 7, 8, 9, 12].includes(c) ? 'center' : 'left',
            },
            border: {
              top: { style: 'thin', color: { rgb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
              left: { style: 'thin', color: { rgb: 'E2E8F0' } },
              right: { style: 'thin', color: { rgb: 'E2E8F0' } },
            },
          };
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Plans_Scanner_Audit');
      const dateLabel = planStartDate === planEndDate && planStartDate ? planStartDate : (planStartDate ? `${planStartDate}_to_${planEndDate}` : todayStr);
      XLSX.writeFile(wb, `RSB_Plans_Scanner_Audit_${dateLabel}.xlsx`);
      toast.success('Plans and scanner audit report exported to Excel successfully!');
    } catch (err: unknown) {
      console.error('Export error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to export Excel');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Operational Insights & Audits
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            Dispatch Analytics & Reporting
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {user?.role === 'admin'
              ? 'Plant-wide fulfilment rates, plan uploader audits, operator productivity, and part throughput'
              : 'Your personal scanning velocity, plan fulfillment rates, and part volumes'}
          </p>
        </div>

        <button
          onClick={() => {
            loadAnalytics();
            loadPlansAudit();
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs sm:text-sm font-medium transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading || plansLoading ? 'animate-spin text-teal-400' : ''}`} />
          Refresh All Metrics
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
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#cbd5e1',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    itemStyle={{ color: '#14b8a6', fontWeight: 'bold' }}
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
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
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
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#cbd5e1',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    itemStyle={{ color: '#0284c7', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="scan_count" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Operator & Team Productivity Performance Table */}
      {(user?.role === 'admin' || user?.role === 'sales') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                Operator Productivity & Performance
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Breakdown of customer group targets, completed scans, and operator scanner activity
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-left text-xs border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-300">
                  <th className="px-4 py-3 font-semibold">User & Role</th>
                  <th className="px-4 py-3 font-semibold">Customer / Group</th>
                  <th className="px-4 py-3 font-semibold text-right">Target Plans</th>
                  <th className="px-4 py-3 font-semibold text-right">Completed Plans</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Scans</th>
                  <th className="px-4 py-3 font-semibold text-center min-w-[220px]">Fulfillment & Scanner Activity</th>
                  <th className="px-4 py-3 font-semibold text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {usersData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                      No operator performance records found.
                    </td>
                  </tr>
                ) : (
                  usersData.map((u) => {
                    const pct =
                      u.total_plans > 0
                        ? Math.min(100, Math.round((u.completed_plans / u.total_plans) * 100))
                        : (u.scans > 0 ? 100 : 0);

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-sans">
                          <div className="flex items-center gap-2">
                            <div>
                              <span className="font-bold text-white text-sm block">{u.name}</span>
                              <span className="text-slate-500 text-xs block">@{u.username}</span>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${
                                u.role === 'admin'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : u.role === 'sales'
                                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                  : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                              }`}
                            >
                              {u.role || 'operator'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-sans">
                          {u.customers && u.customers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.customers.map((cust) => (
                                <span
                                  key={cust}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700"
                                >
                                  {cust}
                                </span>
                              ))}
                            </div>
                          ) : u.customer_name ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                              {u.customer_name}
                            </span>
                          ) : u.vendor_code ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                              Vendor: {u.vendor_code}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs italic">Global / All Customers</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-200 text-sm">
                              {u.total_plans}
                            </span>
                            <span className="text-[10px] font-sans text-slate-400">
                              {u.role === 'operator' ? 'scanned' : 'uploaded'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-emerald-400 text-sm">
                              {u.completed_plans}
                            </span>
                            <span className="text-[10px] font-sans text-emerald-400/80">
                              {u.role === 'operator' ? 'fulfilled' : 'completed'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-teal-400 text-sm">
                          {u.scans}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <div className="flex flex-col gap-1.5 max-w-[280px] mx-auto">
                            {/* Fulfillment Progress Bar */}
                            <div className="flex items-center gap-2 w-full">
                              <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-teal-400 w-10 text-right">
                                {pct}%
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                              <span>{u.completed_plans} / {u.total_plans} {u.role === 'operator' ? 'scanned plans' : 'uploaded plans'}</span>
                              <span className="font-semibold text-teal-400">{u.scans} parts scanned</span>
                            </div>

                            {/* Scanned By: Who scanned the plans uploaded by this user */}
                            {u.scanned_by && u.scanned_by.length > 0 && (
                              <div className="w-full text-left pt-1 border-t border-slate-800/80">
                                <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                                  Scanned by:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {u.scanned_by.slice(0, 3).map((s) => (
                                    <span
                                      key={s.scanner_id}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20"
                                      title={`${s.scanner_name} (@${s.scanner_username}): ${s.scan_count} scans`}
                                    >
                                      <UserCheck className="w-2.5 h-2.5 text-teal-400" />
                                      <span>{s.scanner_name}</span>
                                      <strong className="text-emerald-400">({s.scan_count})</strong>
                                    </span>
                                  ))}
                                  {u.scanned_by.length > 3 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                                      +{u.scanned_by.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Scanned For: Whose plans did this operator scan */}
                            {u.scanned_for && u.scanned_for.length > 0 && (!u.scanned_by || u.scanned_by.length === 0) && (
                              <div className="w-full text-left pt-1 border-t border-slate-800/80">
                                <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                                  Scanned for:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {u.scanned_for.slice(0, 3).map((f) => (
                                    <span
                                      key={f.uploader_id}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20"
                                      title={`Uploaded by ${f.uploader_name} (@${f.uploader_username}): ${f.scan_count} parts across ${f.plans_count} plans`}
                                    >
                                      <span>{f.uploader_name}</span>
                                      <strong className="text-sky-300">({f.scan_count})</strong>
                                    </span>
                                  ))}
                                  {u.scanned_for.length > 3 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                                      +{u.scanned_for.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
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

      {/* NEW: Plan Execution & Scanner Audit Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-0">
        {/* Table Header & Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">
                Full Transparency Audit
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-400" />
              Plan Execution & Scanner Audit
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live tracking of dispatch plans: target vs actual scanned quantities, uploaded by whom, and scanned by which operators
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={exportPlansAuditToExcel}
              disabled={filteredPlans.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>
            <button
              onClick={loadPlansAudit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${plansLoading ? 'animate-spin text-teal-400' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={planSearch}
              onChange={(e) => {
                setPlanSearch(e.target.value);
                setPlanPage(1);
              }}
              placeholder="Search part #, customer, uploader, or scanner..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-teal-500 placeholder-slate-500"
            />
            {planSearch && (
              <button
                onClick={() => setPlanSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Customer Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={planCustomerFilter}
              onChange={(e) => setPlanCustomerFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Customers</option>
              {uniqueCustomers.map((cust) => (
                <option key={cust} value={cust}>
                  {cust}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={planStatusFilter}
              onChange={(e) => setPlanStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending Plans</option>
              <option value="completed">Completed Plans</option>
            </select>
          </div>

          {/* Date Presets */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => handleDatePresetChange('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                planDatePreset === 'all'
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handleDatePresetChange('today')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                planDatePreset === 'today'
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleDatePresetChange('7days')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                planDatePreset === '7days'
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => handleDatePresetChange('30days')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                planDatePreset === '30days'
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => handleDatePresetChange('custom')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                planDatePreset === 'custom'
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Custom Date Inputs */}
          {planDatePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={planStartDate}
                  onChange={(e) => setPlanStartDate(e.target.value)}
                  className="bg-transparent border-0 text-slate-200 text-xs focus:outline-none"
                />
              </div>
              <span className="text-slate-500 text-xs">to</span>
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={planEndDate}
                  onChange={(e) => setPlanEndDate(e.target.value)}
                  className="bg-transparent border-0 text-slate-200 text-xs focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Plans Audit Table */}
        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-300">
                <th className="px-3.5 py-3 font-semibold text-center w-12">#</th>
                <th className="px-4 py-3 font-semibold">Part Number</th>
                <th className="px-4 py-3 font-semibold">Customer / Vendor</th>
                <th className="px-4 py-3 font-semibold text-center">Plan Date</th>
                <th className="px-4 py-3 font-semibold text-right">Target</th>
                <th className="px-4 py-3 font-semibold text-right">Actual</th>
                <th className="px-4 py-3 font-semibold text-right">Balance</th>
                <th className="px-4 py-3 font-semibold text-center w-36">Fulfillment</th>
                <th className="px-4 py-3 font-semibold">Uploaded By</th>
                <th className="px-4 py-3 font-semibold min-w-[200px]">Scanned By</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {plansLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 font-sans">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-2" />
                    Loading plan execution audit records...
                  </td>
                </tr>
              ) : paginatedPlans.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-500 font-sans">
                    No dispatch plan audit records match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedPlans.map((p, idx) => {
                  const globalIdx = (planPage - 1) * planPageSize + idx + 1;
                  const isCompleted = p.status === 'completed' || p.balance_quantity === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* SR No */}
                      <td className="px-3.5 py-3 text-center text-slate-400 font-semibold font-sans">
                        {globalIdx}
                      </td>

                      {/* Part Number */}
                      <td className="px-4 py-3 font-bold text-white text-sm">
                        <span className="font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                          {p.part_number}
                        </span>
                      </td>

                      {/* Customer / Vendor */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-200">
                            {p.customer_name || '—'}
                          </span>
                          {p.vendor_code && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Vendor: {p.vendor_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Plan Date */}
                      <td className="px-4 py-3 text-center text-slate-300 font-sans text-xs">
                        {p.plan_date ? new Date(p.plan_date).toLocaleDateString('en-GB') : '—'}
                      </td>

                      {/* Target Qty */}
                      <td className="px-4 py-3 text-right font-bold text-slate-200 text-sm">
                        {p.quantity}
                      </td>

                      {/* Actual Scanned Qty */}
                      <td className="px-4 py-3 text-right font-extrabold text-teal-400 text-sm">
                        {p.scanned_quantity}
                      </td>

                      {/* Balance Qty */}
                      <td className={`px-4 py-3 text-right font-bold text-sm ${p.balance_quantity > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {p.balance_quantity}
                      </td>

                      {/* Fulfillment % */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5 w-full">
                            <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isCompleted
                                    ? 'bg-emerald-400'
                                    : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                                }`}
                                style={{ width: `${p.fulfillment_pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-teal-400 w-9 text-right">
                              {p.fulfillment_pct}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Uploaded By */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <div>
                            <span className="font-semibold text-slate-200 block text-xs">
                              {p.uploader?.name || 'System'}
                            </span>
                            {p.uploader?.username && (
                              <span className="text-slate-500 text-[10px] block">
                                @{p.uploader.username}
                              </span>
                            )}
                          </div>
                          {p.uploader?.role && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border uppercase tracking-wider ${
                                p.uploader.role === 'admin'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              }`}
                            >
                              {p.uploader.role}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Scanned By (Operators breakdown) */}
                      <td className="px-4 py-3 font-sans">
                        {p.scanners && p.scanners.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.scanners.map((s) => (
                              <span
                                key={s.scanner_id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20"
                                title={`Scanned by ${s.scanner_name} (@${s.scanner_username}): ${s.scan_count} items`}
                              >
                                <UserCheck className="w-3 h-3 text-teal-400 shrink-0" />
                                <span>{s.scanner_name}</span>
                                <strong className="text-emerald-400">({s.scan_count})</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic">
                            No scans yet
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center font-sans">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isCompleted
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {isCompleted ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Summary Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing {filteredPlans.length > 0 ? (planPage - 1) * planPageSize + 1 : 0} to{' '}
              {Math.min(planPage * planPageSize, filteredPlans.length)} of{' '}
              <strong className="text-white">{filteredPlans.length}</strong> total plans
            </span>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={planPageSize}
                onChange={(e) => {
                  setPlanPageSize(Number(e.target.value));
                  setPlanPage(1);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPlanPage((prev) => Math.max(prev - 1, 1))}
              disabled={planPage === 1}
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-slate-300">
              Page {planPage} of {totalPages}
            </span>
            <button
              onClick={() => setPlanPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={planPage >= totalPages}
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
