import React, { useState, useEffect, useRef } from 'react';
import { api, BASE } from '../utils/api';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  History,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Globe,
  Server,
  HardDrive,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  ScanLine,
  ClipboardList,
  Users,
} from 'lucide-react';

interface DatabaseStats {
  databaseName: string;
  dbHost: string;
  usersCount: number;
  plansCount: number;
  scansCount: number;
  gatePassesCount: number;
  activityLogsCount: number;
  lastBackupDate: string | null;
  lastRestoreDate: string | null;
  serverTime: string;
}

interface ActivityLogItem {
  id: number;
  user_id: number | null;
  username: string | null;
  user_name: string | null;
  role: string | null;
  action: string;
  action_type: 'auth' | 'plan' | 'scan' | 'user' | 'gatepass' | 'system';
  description: string;
  details: string | null;
  ip_address: string;
  user_agent: string | null;
  created_at: string;
}

interface ActivitySummary {
  total_actions?: number;
  today_actions?: number;
  auth_actions?: number;
  scan_actions?: number;
  plan_actions?: number;
  user_actions?: number;
  system_actions?: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'backup' | 'logs'>('backup');

  // Backup & Restore State
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);

  // Restore State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreSqlText, setRestoreSqlText] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Activity Logs State
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSummary, setLogSummary] = useState<ActivitySummary>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch Database Health Stats
  const fetchDbStats = async () => {
    setStatsLoading(true);
    try {
      const data = await api.get('/api/backup/stats');
      if (data) setDbStats(data);
    } catch (err: unknown) {
      console.error('Failed to fetch DB stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Activity Logs
  const fetchActivityLogs = async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (typeFilter && typeFilter !== 'all') params.append('action_type', typeFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/api/backup/activity-logs?${params.toString()}`);
      if (res && res.logs) {
        setLogs(res.logs);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalCount(res.pagination?.total || 0);
        if (res.summary) setLogSummary(res.summary);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch activity logs:', err);
      toast.error('Failed to load activity logs');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchDbStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchActivityLogs();
    }
  }, [activeTab, page, limit, typeFilter, startDate, endDate]);

  // Handle Preset Date Change for Logs
  const handleDatePresetChange = (preset: 'all' | 'today' | '7days' | '30days' | 'custom') => {
    setDatePreset(preset);
    setPage(1);
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Download SQL Backup
  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BASE}/api/backup/download`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Failed to download database backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `rsb_dispatch_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.sql`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Database backup downloaded successfully!');
      fetchDbStats();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error generating backup');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  // Handle File Selection for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.sql')) {
        toast.error('Please select a valid .sql backup file');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setRestoreSqlText((event.target?.result as string) || '');
      };
      reader.readAsText(file);
    }
  };

  // Execute Database Restore
  const handleExecuteRestore = async () => {
    if (!selectedFile && !restoreSqlText) {
      toast.error('Please select a .sql file to restore');
      return;
    }

    setIsRestoring(true);
    try {
      const payload = {
        sql: restoreSqlText,
        fileName: selectedFile?.name || 'uploaded_backup.sql',
      };

      const res = await api.post('/api/backup/restore', payload);
      toast.success(res.message || 'Database restored successfully!');
      setShowConfirmModal(false);
      setSelectedFile(null);
      setRestoreSqlText('');
      setConfirmInput('');
      fetchDbStats();
      if (activeTab === 'logs') fetchActivityLogs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Database restore failed');
    } finally {
      setIsRestoring(false);
    }
  };

  // Export Activity Logs to Excel
  const handleExportLogsExcel = () => {
    try {
      if (logs.length === 0) {
        toast.error('No activity logs to export');
        return;
      }

      const headers = [
        'ID',
        'Timestamp',
        'User Name',
        'Username',
        'Role',
        'Action Type',
        'Action Name',
        'Description',
        'IP Address',
        'User Agent',
      ];

      const rows: any[][] = [headers];

      logs.forEach((l) => {
        rows.push([
          l.id,
          new Date(l.created_at).toLocaleString('en-GB'),
          l.user_name || 'System',
          l.username ? `@${l.username}` : '—',
          (l.role || 'system').toUpperCase(),
          (l.action_type || 'system').toUpperCase(),
          l.action,
          l.description,
          l.ip_address,
          l.user_agent || '—',
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);

      ws['!cols'] = [
        { wch: 8 },  // ID
        { wch: 20 }, // Timestamp
        { wch: 22 }, // User Name
        { wch: 16 }, // Username
        { wch: 12 }, // Role
        { wch: 14 }, // Action Type
        { wch: 24 }, // Action Name
        { wch: 45 }, // Description
        { wch: 16 }, // IP Address
        { wch: 35 }, // User Agent
      ];

      // Header style
      for (let c = 0; c < headers.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) {
          ws[addr].s = {
            fill: { fgColor: { rgb: '0F766E' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Activity_Logs');
      const dateLabel = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `RSB_Activity_Audit_Logs_${dateLabel}.xlsx`);
      toast.success('Activity logs exported to Excel successfully!');
    } catch (err: unknown) {
      toast.error('Failed to export activity logs');
    }
  };

  // Helper to parse simple device from User-Agent
  const getDeviceName = (ua: string | null) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Android')) return 'Android Device';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS Device';
    if (ua.includes('Macintosh')) return 'Mac';
    if (ua.includes('Linux')) return 'Linux';
    return 'Desktop Browser';
  };

  // Helper for Action Badge Colors
  const getActionBadgeStyle = (actionType: string) => {
    switch (actionType) {
      case 'auth':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'scan':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'plan':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'user':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'system':
      default:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Admin Control Center
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Database className="w-6 h-6 text-teal-400" />
            System Settings, Backups & Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Download full database backups, restore SQL snapshots, and monitor live user action logs
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto shrink-0">
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Backup & Restore
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            Activity Audit Logs
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: BACKUP & RESTORE */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Header & Refresh Controls */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-teal-400" />
              Live Database Health & Statistics
            </h3>
            <button
              onClick={fetchDbStats}
              disabled={statsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin text-teal-400' : ''}`} />
              Refresh Stats
            </button>
          </div>

          {/* Quick Health Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Database</span>
                <Server className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-white font-mono truncate">
                {dbStats?.databaseName || 'rsb_despatch'}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate font-mono">
                Host: {dbStats?.dbHost || 'localhost'}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Plans</span>
                <ClipboardList className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-sky-400 font-mono">
                {dbStats?.plansCount ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Active & completed plans</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Scans</span>
                <ScanLine className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
                {dbStats?.scansCount ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Verified barcodes logged</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Users & Logs</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-purple-400 font-mono">
                {dbStats?.usersCount ?? 0} <span className="text-xs text-slate-400 font-sans font-normal">users</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {dbStats?.activityLogsCount ?? 0} activity records
              </p>
            </div>
          </div>

          {/* Backup & Restore Core Operations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CARD 1: DOWNLOAD BACKUP */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">One-Click Database Backup</h2>
                    <p className="text-xs text-slate-400">Download a full SQL dump directly to your browser</p>
                  </div>
                </div>

                <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-teal-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Data & Structure Included:</span>
                  </div>
                  <ul className="space-y-1.5 pl-6 list-disc text-slate-400 text-[11px]">
                    <li>Full Table Schemas (<code className="text-teal-300">CREATE TABLE</code> with foreign keys)</li>
                    <li>Users, Roles, Passwords & Vendor Assignment details</li>
                    <li>All Dispatch Plans, Target Quantities & Fulfillment States</li>
                    <li>Complete Barcode Scan Logs & Unique Part Serial numbers</li>
                    <li>Gate Passes, Dispatch History & Activity Audit Trail</li>
                    <li>Compatible with phpMyAdmin, MySQL Workbench & CLI restore</li>
                  </ul>
                </div>

                {dbStats?.lastBackupDate && (
                  <div className="text-[11px] text-slate-400 mb-4 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Last backup generated: </span>
                    <strong className="text-white">
                      {new Date(dbStats.lastBackupDate).toLocaleString('en-GB')}
                    </strong>
                  </div>
                )}
              </div>

              <button
                onClick={handleDownloadBackup}
                disabled={isDownloadingBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm shadow-lg shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDownloadingBackup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating SQL Dump...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Database Backup (.sql)
                  </>
                )}
              </button>
            </div>

            {/* CARD 2: RESTORE DATABASE */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Upload & Restore Database</h2>
                    <p className="text-xs text-slate-400">Restore your tables and data from a previously saved .sql file</p>
                  </div>
                </div>

                {/* File Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors mb-4 ${
                    selectedFile
                      ? 'border-teal-500 bg-teal-500/5'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-950/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sql"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 mx-auto flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="font-bold text-white text-xs font-mono">{selectedFile.name}</div>
                      <p className="text-[10px] text-slate-400">
                        Size: {(selectedFile.size / 1024).toFixed(1)} KB | Ready to restore
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-7 h-7 text-slate-500 mx-auto mb-1" />
                      <div className="text-xs font-semibold text-slate-300">Click to choose .sql backup file</div>
                      <p className="text-[10px] text-slate-500">Only standard MySQL SQL files are accepted</p>
                    </div>
                  )}
                </div>

                {/* Caution Alert */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 mb-4 text-xs text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Important Safety Warning:</strong>
                    <span>
                      Restoring will recreate tables and replace records with the contents of the chosen .sql file.
                      Ensure you download a fresh backup before performing a restore.
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!selectedFile) {
                    toast.error('Please select a .sql file first');
                    return;
                  }
                  setShowConfirmModal(true);
                }}
                disabled={!selectedFile || isRestoring}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                Restore Database from File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: ACTIVITY AUDIT LOGS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-0">
          {/* Header & Export Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase tracking-wider">
                  Audit Trail
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-teal-400" />
                Live User Activity & Security Logs
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Track who logged in, client IP addresses, plan imports, barcode scanning, and user updates
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleExportLogsExcel}
                disabled={logs.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export to Excel
              </button>
              <button
                onClick={fetchActivityLogs}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin text-teal-400' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-4 bg-slate-950/40 border-b border-slate-800/80 text-xs">
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Events</span>
              <strong className="text-sm font-bold text-white">{logSummary.total_actions || totalCount}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Today's Activity</span>
              <strong className="text-sm font-bold text-teal-400">{logSummary.today_actions || 0}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Logins (Auth)</span>
              <strong className="text-sm font-bold text-amber-400">{logSummary.auth_actions || 0}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Scans</span>
              <strong className="text-sm font-bold text-emerald-400">{logSummary.scan_actions || 0}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Plan Actions</span>
              <strong className="text-sm font-bold text-sky-400">{logSummary.plan_actions || 0}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">User Updates</span>
              <strong className="text-sm font-bold text-purple-400">{logSummary.user_actions || 0}</strong>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search user, action, description, or IP..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-teal-500 placeholder-slate-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <div className="w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Action Types</option>
                <option value="auth">Authentication (Logins/Out)</option>
                <option value="scan">Barcode Scanning</option>
                <option value="plan">Dispatch Plans</option>
                <option value="user">User Management</option>
                <option value="system">System & Backups</option>
              </select>
            </div>

            {/* Date Presets */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                onClick={() => handleDatePresetChange('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  datePreset === 'all'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleDatePresetChange('today')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  datePreset === 'today'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => handleDatePresetChange('7days')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  datePreset === '7days'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => handleDatePresetChange('30days')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  datePreset === '30days'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => handleDatePresetChange('custom')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  datePreset === 'custom'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Dates */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Activity Logs Table */}
          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-300">
                  <th className="px-3.5 py-3 font-semibold text-center w-12">#</th>
                  <th className="px-4 py-3 font-semibold">User Details</th>
                  <th className="px-4 py-3 font-semibold">Action & Type</th>
                  <th className="px-4 py-3 font-semibold min-w-[280px]">Activity Description</th>
                  <th className="px-4 py-3 font-semibold font-mono">Client IP</th>
                  <th className="px-4 py-3 font-semibold">Device / Agent</th>
                  <th className="px-4 py-3 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                      <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-2" />
                      Loading activity logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500 font-sans">
                      No activity logs match the selected filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((l, idx) => {
                    const rowNumber = (page - 1) * limit + idx + 1;
                    const device = getDeviceName(l.user_agent);

                    return (
                      <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* Index */}
                        <td className="px-3.5 py-3 text-center text-slate-500 font-mono">
                          {rowNumber}
                        </td>

                        {/* User Details */}
                        <td className="px-4 py-3 font-sans">
                          {l.user_name || l.username ? (
                            <div>
                              <div className="font-semibold text-white text-xs">
                                {l.user_name || l.username}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {l.username && (
                                  <span className="text-slate-500 text-[10px] font-mono">
                                    @{l.username}
                                  </span>
                                )}
                                {l.role && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase tracking-wider ${
                                      l.role === 'admin'
                                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                        : l.role === 'sales'
                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                    }`}
                                  >
                                    {l.role}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs italic">System / Anonymous</span>
                          )}
                        </td>

                        {/* Action & Type Badges */}
                        <td className="px-4 py-3 font-sans">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getActionBadgeStyle(
                                l.action_type
                              )}`}
                            >
                              {l.action}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                              {l.action_type}
                            </span>
                          </div>
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3 font-sans text-slate-300 text-xs">
                          {l.description}
                        </td>

                        {/* IP Address */}
                        <td className="px-4 py-3 font-mono text-xs">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                            <Globe className="w-3 h-3 text-slate-400" />
                            {l.ip_address}
                          </span>
                        </td>

                        {/* Device / Agent */}
                        <td className="px-4 py-3 font-sans text-slate-400 text-xs">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                            {device}
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                          <div>{new Date(l.created_at).toLocaleDateString('en-GB')}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(l.created_at).toLocaleTimeString('en-GB')}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>
                Showing {logs.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                {Math.min(page * limit, totalCount)} of{' '}
                <strong className="text-white">{totalCount}</strong> total actions
              </span>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page >= totalPages}
                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* RESTORE CONFIRMATION MODAL */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">Confirm Database Restore</h3>
              <p className="text-xs text-slate-400">
                You are about to execute the SQL statements in:
              </p>
              <div className="font-mono text-xs font-bold text-teal-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 mt-2">
                {selectedFile?.name || 'backup.sql'}
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300 space-y-1">
              <strong className="block font-semibold">Destructive Action Warning:</strong>
              <p className="text-[11px] text-red-200">
                This will drop and recreate existing database tables and restore records to the exact state in this backup file.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400">
                To confirm, please type <strong className="text-white">RESTORE</strong> below:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Type RESTORE to continue"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmInput('');
                }}
                disabled={isRestoring}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={confirmInput.trim() !== 'RESTORE' || isRestoring}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Execute Restore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
