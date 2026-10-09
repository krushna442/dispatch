import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
import {
  ClipboardList,
  ScanLine,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Truck,
  Download,
  AlertOctagon,
} from 'lucide-react';

interface SummaryData {
  total_plans: number;
  completed_plans: number;
  pending_plans: number;
  total_scans: number;
  today_scans: number;
  completion_rate: number;
  active_gatepasses?: number;
}

interface RecentScan {
  id: number;
  part_number: string;
  vendor_code: string | null;
  serial_number: string;
  format: string | null;
  scanned_at: string;
  user_name?: string | null;
  username?: string | null;
  status?: string | null;
  remark?: string | null;
  raw_scan_text?: string | null;
  scanned_label?: string | null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<SummaryData>({
    total_plans: 0,
    completed_plans: 0,
    pending_plans: 0,
    total_scans: 0,
    today_scans: 0,
    completion_rate: 0,
  });
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [sumRes, logsRes] = await Promise.all([
        api.get('/api/analytics/summary').catch(() => null),
        api.get('/api/scan/logs').catch(() => []),
      ]);
      if (sumRes) {
        setSummary(sumRes);
      }
      if (Array.isArray(logsRes)) {
        setRecentScans(logsRes.slice(0, 15));
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportScanReport = async () => {
    try {
      const logs = await api.get('/api/scan/logs');
      if (!Array.isArray(logs) || logs.length === 0) {
        toast.error('No scan records to export');
        return;
      }
      const exportData = logs.map((s: RecentScan, idx: number) => ({
        'SR No': idx + 1,
        'Scanned Label (Barcode Text)': s.scanned_label || s.raw_scan_text || s.serial_number || '—',
        'Scan Time': s.scanned_at ? new Date(s.scanned_at).toLocaleString('en-GB') : '',
        'Part Number': s.part_number,
        'Serial Number': s.serial_number,
        'Vendor Code': s.vendor_code || '—',
        'Scanned By': s.username ? `@${s.username} (${s.user_name || ''})` : '—',
        'Status': s.status === 'reject' ? 'REJECT' : 'SUCCESS',
        'Remark': s.remark || (s.status === 'reject' ? 'duplicate scan' : 'verified'),
        'Format': s.format || 'F1',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const totalCols = Object.keys(exportData[0] || {}).length;

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },  // SR No
        { wch: 40 }, // Scanned Label
        { wch: 22 }, // Scan Time
        { wch: 18 }, // Part Number
        { wch: 18 }, // Serial Number
        { wch: 14 }, // Vendor Code
        { wch: 24 }, // Scanned By
        { wch: 14 }, // Status
        { wch: 20 }, // Remark
        { wch: 12 }, // Format
      ];

      // Header styling
      for (let c = 0; c < totalCols; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) {
          ws[addr].s = {
            fill: { fgColor: { rgb: '0F766E' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      }

      // Red background for duplicate / rejected scans
      exportData.forEach((row: any, rIdx: number) => {
        const isDuplicate = row.Status === 'REJECT' || row.Remark?.toLowerCase().includes('duplicate');
        if (isDuplicate) {
          for (let c = 0; c < totalCols; c++) {
            const addr = XLSX.utils.encode_cell({ r: rIdx + 1, c });
            if (ws[addr]) {
              ws[addr].s = {
                fill: { fgColor: { rgb: 'FFC7CE' } }, // Soft red fill
                font: { color: { rgb: '9C0006' }, bold: true }, // Dark red text
                border: {
                  top: { style: 'thin', color: { rgb: 'E0B4B4' } },
                  bottom: { style: 'thin', color: { rgb: 'E0B4B4' } },
                  left: { style: 'thin', color: { rgb: 'E0B4B4' } },
                  right: { style: 'thin', color: { rgb: 'E0B4B4' } },
                },
              };
            }
          }
        }
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Scanned_Labels_Report');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `RSB_Scan_Report_${today}.xlsx`);
      toast.success('Scan report exported with scanned labels and duplicate highlights!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export scan report');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time updates via WebSocket
  useSocket('despatch:scan', () => {
    loadData();
  });
  useSocket('despatch:plans-changed', () => {
    loadData();
  });
  useSocket('despatch:gatepass', () => {
    loadData();
  });

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                {user?.role === 'admin'
                  ? 'Admin Portal'
                  : user?.role === 'sales'
                  ? 'Sales Portal'
                  : 'Operator Station'}
              </span>
              {user?.customer_name && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {user.customer_name} ({user.vendor_code})
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome back, {user?.name || user?.username}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Real-time dispatch management & barcode verification dashboard
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap shrink-0">
            <Link
              to="/scan"
              title="Start Scanning"
              className="inline-flex items-center justify-center gap-2 p-2.5 lg:px-4 lg:py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-medium hover:from-teal-500 hover:to-emerald-500 transition-all shadow-lg shadow-teal-600/20 text-xs sm:text-sm shrink-0"
            >
              <ScanLine className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">Start Scanning</span>
            </Link>
            {user?.role !== 'operator' && (
              <Link
                to="/plans"
                title="View Plans"
                className="inline-flex items-center justify-center gap-2 p-2.5 lg:px-4 lg:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-all text-xs sm:text-sm shrink-0"
              >
                <ClipboardList className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline whitespace-nowrap">View Plans</span>
              </Link>
            )}
            <Link
              to="/gatepass"
              title="Gate Pass"
              className="inline-flex items-center justify-center gap-2 p-2.5 lg:px-4 lg:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-all text-xs sm:text-sm shrink-0"
            >
              <Truck className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">Gate Pass</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Planned */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">Total Plans</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{summary.total_plans}</div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-none">Active scheduled part numbers</p>
        </div>

        {/* Completed */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">Completed</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">
            {summary.completed_plans}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-none">Ready for Gate Pass loading</p>
        </div>

        {/* Pending */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">Pending Balance</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-400 tracking-tight">
            {summary.pending_plans}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-none">Requires scanning to complete</p>
        </div>

        {/* Today Scans */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">Today's Scans</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-teal-400 tracking-tight">
            {summary.today_scans}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-none">Verified parts today</p>
        </div>
      </div>

      {/* Completion Progress Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-white">Overall Plan Completion Rate</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Percentage of scheduled parts fully scanned and fulfilled
            </p>
          </div>
          <span className="text-xl font-bold text-teal-400">{summary.completion_rate}%</span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, summary.completion_rate))}%` }}
          />
        </div>
      </div>

      {/* Quick Access & Recent Scans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">


        {/* Recent Scans Activity */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-teal-400" />
                Live Scan Activity
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Real-time scan logs, user attempts & status</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportScanReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-all cursor-pointer"
                title="Export Scan Report to Excel (with Red background for duplicates)"
              >
                <Download className="w-3.5 h-3.5" />
                Export Scans
              </button>
              <Link
                to="/scan"
                className="text-xs text-teal-400 hover:text-teal-300 font-medium inline-flex items-center gap-1"
              >
                Open Scanner <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-sm">Loading activity...</div>
          ) : recentScans.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-slate-600" />
              <span>No scans recorded yet today.</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 whitespace-nowrap">
                    <th className="pb-2 font-medium">Part No</th>
                    <th className="pb-2 font-medium">Serial No</th>
                    <th className="pb-2 font-medium">Scanned By</th>
                    <th className="pb-2 font-medium">Status / Remark</th>
                    <th className="pb-2 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentScans.map((scan) => {
                    const isReject = scan.status === 'reject' || scan.remark?.toLowerCase().includes('duplicate');
                    return (
                      <tr
                        key={scan.id}
                        className={`transition-colors ${
                          isReject
                            ? 'bg-red-950/40 hover:bg-red-950/60 border-l-2 border-red-500 text-red-200'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-2.5 font-semibold text-teal-400 font-mono">
                          {scan.part_number}
                        </td>
                        <td className="py-2.5 font-mono text-slate-300">{scan.serial_number}</td>
                        <td className="py-2.5 text-slate-300">
                          {scan.username ? (
                            <span className="font-semibold text-white">
                              @{scan.username}
                              {scan.user_name ? (
                                <span className="text-[11px] text-slate-400 block font-normal">
                                  {scan.user_name}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {isReject ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                              <AlertOctagon className="w-3 h-3" />
                              REJECT: {scan.remark || 'duplicate scan'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              SUCCESS
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right text-slate-400 font-mono text-[11px]">
                          {new Date(scan.scanned_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
