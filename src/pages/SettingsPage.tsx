import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Mail,
  Send,
  Calendar,
  Clock,
  Info,
  AlertCircle,
  Zap,
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

interface UserMailSubscription {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: 'admin' | 'sales' | 'operator';
  vendor_code: string | null;
  customer_name: string | null;
  mail_each_scan: number | boolean;
  mail_plan_add: number | boolean;
  mail_gate_pass: number | boolean;
  mail_daily_report: number | boolean;
  mail_monthly_report: number | boolean;
}

interface MailQueueStatus {
  queueLength: number;
  isProcessing: boolean;
  lastSentAt: string | null;
  totalSent: number;
  totalFailed: number;
}

const CUSTOMER_PRESETS = [
  { name: 'ASL PNR MBP', code: '7201012' },
  { name: 'ASL ALW MBP', code: '7205761' },
  { name: 'ASL ALH MBP', code: '7200868' },
  { name: 'Switch Mobility', code: '7207001' },
  { name: 'Tata Motors (TML)', code: 'R64535' },
  { name: 'IPLT', code: '10830-6' },
  { name: 'VE Commercial Vehicles (VECV)', code: 'V113072' },
];

interface MailToggleProps {
  enabled: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange: () => void;
  title?: string;
}

function MailToggle({ enabled, disabled, loading, onChange, title }: MailToggleProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || loading}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 ${
        enabled ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-slate-700/80 border border-slate-600'
      }`}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
        </span>
      ) : (
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      )}
    </button>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'backup' | 'logs' | 'mail'>('backup');

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

  // Email Subscriptions State
  const [mailUsers, setMailUsers] = useState<UserMailSubscription[]>([]);
  const [mailQueue, setMailQueue] = useState<MailQueueStatus | null>(null);
  const [mailLoading, setMailLoading] = useState(false);
  const [mailSearch, setMailSearch] = useState('');
  const [mailCustomerFilter, setMailCustomerFilter] = useState('all');
  const [mailRoleFilter, setMailRoleFilter] = useState('all');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [batchUpdatingCol, setBatchUpdatingCol] = useState<string | null>(null);

  // Mail Action Modals
  const [showTestMailModal, setShowTestMailModal] = useState(false);
  const [testMailRecipient, setTestMailRecipient] = useState('');
  const [isSendingTestMail, setIsSendingTestMail] = useState(false);

  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyTargetDate, setDailyTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dailyTestRecipient, setDailyTestRecipient] = useState('');
  const [isTriggeringDaily, setIsTriggeringDaily] = useState(false);

  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [monthlyTestRecipient, setMonthlyTestRecipient] = useState('');
  const [isTriggeringMonthly, setIsTriggeringMonthly] = useState(false);

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

  // Fetch Email Subscriptions & Queue
  const fetchMailSubscriptions = async () => {
    setMailLoading(true);
    try {
      const res = await api.get('/api/mail/subscriptions');
      if (res && res.users) {
        setMailUsers(res.users);
      }
      if (res && res.queue) {
        setMailQueue(res.queue);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch mail subscriptions:', err);
      toast.error('Failed to load email subscriptions');
    } finally {
      setMailLoading(false);
    }
  };

  useEffect(() => {
    fetchDbStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchActivityLogs();
    } else if (activeTab === 'mail') {
      fetchMailSubscriptions();
    }
  }, [activeTab, page, limit, typeFilter, startDate, endDate]);

  // Toggle individual user mail preference
  const handleToggleUserMail = async (
    user: UserMailSubscription,
    field: 'mail_each_scan' | 'mail_plan_add' | 'mail_gate_pass' | 'mail_daily_report' | 'mail_monthly_report'
  ) => {
    if (!user.email) {
      toast.warning(`Cannot enable: ${user.name} does not have an email address configured. Add email in Users page.`);
      return;
    }

    const currentVal = Boolean(user[field]);
    const newVal = !currentVal;
    const key = `${user.id}_${field}`;
    setUpdatingKey(key);

    // Optimistic UI update
    setMailUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, [field]: newVal ? 1 : 0 } : u))
    );

    try {
      await api.put(`/api/mail/subscriptions/${user.id}`, { [field]: newVal ? 1 : 0 });
      const label = field.replace('mail_', '').replace('_', ' ');
      toast.success(`${user.name}: ${label} ${newVal ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      // Revert on error
      setMailUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, [field]: currentVal ? 1 : 0 } : u))
      );
      toast.error(err.message || 'Failed to update email subscription');
    } finally {
      setUpdatingKey(null);
    }
  };

  // Batch toggle an entire column
  const handleBatchToggle = async (columnName: string, enable: boolean) => {
    setBatchUpdatingCol(columnName);
    try {
      const res = await api.put(`/api/mail/subscriptions/batch/${columnName}`, { value: enable ? 1 : 0 });
      toast.success(res.message || `Updated all users for ${columnName.replace('mail_', '').replace('_', ' ')}`);
      fetchMailSubscriptions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to batch update subscriptions');
    } finally {
      setBatchUpdatingCol(null);
    }
  };

  // Send Test Email via SMTP
  const handleSendTestMail = async () => {
    if (!testMailRecipient.trim()) {
      toast.warning('Please enter a recipient email address');
      return;
    }
    setIsSendingTestMail(true);
    try {
      const res = await api.post('/api/mail/send-test', { to: testMailRecipient.trim() });
      toast.success(res.message || 'Test email sent successfully via SMTP!');
      setShowTestMailModal(false);
      fetchMailSubscriptions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test email');
    } finally {
      setIsSendingTestMail(false);
    }
  };

  // Trigger Daily Shift Report Now
  const handleTriggerDailyNow = async () => {
    setIsTriggeringDaily(true);
    try {
      const res = await api.post('/api/mail/send-daily-now', {
        targetDate: dailyTargetDate,
        testRecipient: dailyTestRecipient.trim() || undefined,
      });
      toast.success(res.message || 'Daily report emails queued successfully!');
      setShowDailyModal(false);
      fetchMailSubscriptions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger daily report');
    } finally {
      setIsTriggeringDaily(false);
    }
  };

  // Trigger Monthly Report Now
  const handleTriggerMonthlyNow = async () => {
    setIsTriggeringMonthly(true);
    try {
      const res = await api.post('/api/mail/send-monthly-now', {
        testRecipient: monthlyTestRecipient.trim() || undefined,
      });
      toast.success(res.message || 'Monthly report emails queued successfully!');
      setShowMonthlyModal(false);
      fetchMailSubscriptions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger monthly report');
    } finally {
      setIsTriggeringMonthly(false);
    }
  };

  // Filtered users for Email table
  const filteredMailUsers = useMemo(() => {
    return mailUsers.filter((u) => {
      if (mailSearch.trim()) {
        const q = mailSearch.toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(q);
        const matchesUsername = u.username?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesUsername && !matchesEmail) return false;
      }
      if (mailRoleFilter !== 'all' && u.role !== mailRoleFilter) {
        return false;
      }
      if (mailCustomerFilter !== 'all') {
        const matchesCustomer =
          u.customer_name === mailCustomerFilter ||
          u.vendor_code === mailCustomerFilter ||
          (mailCustomerFilter === 'ASL PNR MBP' && (u.customer_name === 'MBP' || u.vendor_code === '7201012'));
        if (!matchesCustomer && u.role !== 'admin') return false;
      }
      return true;
    });
  }, [mailUsers, mailSearch, mailRoleFilter, mailCustomerFilter]);

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
            System Settings, Backups & Mail Controls
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Download database backups, restore SQL snapshots, view audit logs, and configure user mail subscriptions
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto shrink-0 gap-1">
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
          <button
            onClick={() => setActiveTab('mail')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'mail'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            Email Subscriptions
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
      {/* TAB 3: EMAIL NOTIFICATIONS & SUBSCRIPTIONS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'mail' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-400" />
                Email Notifications & User Subscriptions
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage per-user email delivery preferences. Scans are enqueued smoothly without blocking scan operations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchMailSubscriptions}
                disabled={mailLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors border border-slate-700 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${mailLoading ? 'animate-spin text-teal-400' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Top Operational Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* SMTP & Queue Status */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Mail Delivery Queue</h4>
                      <span className="text-[11px] text-teal-400 font-medium">Throttled & Non-blocking</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">In Queue</span>
                    <span className="text-base font-bold text-white font-mono">{mailQueue?.queueLength ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Delivered</span>
                    <span className="text-base font-bold text-teal-400 font-mono">{mailQueue?.totalSent ?? 0}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Scans are queued instantly so operators experience zero lag on barcodes.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTestMailModal(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Test SMTP Connection
                </button>
              </div>
            </div>

            {/* Daily Shift Cron */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Daily Shift Report</h4>
                      <span className="text-[11px] text-sky-400 font-medium">Daily Cron @ 06:00 AM IST</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    Shift 6 AM
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sends day's dispatched parts + Month cumulative (sorted with latest scan first). Includes 2-sheet Excel attachment.
                </p>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-3 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Sheet 1:</span>
                    <span className="text-slate-200 font-mono">Day's Parts & Quantities</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Sheet 2:</span>
                    <span className="text-slate-200 font-mono">Month Cumulative (Recent First)</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDailyModal(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 text-xs font-semibold transition-colors border border-sky-500/30 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Trigger Daily Report Now
                </button>
              </div>
            </div>

            {/* Monthly Report Cron */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Monthly Audit Report</h4>
                      <span className="text-[11px] text-purple-400 font-medium">1st of Month @ 06:00 AM IST</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Monthly 1st
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sends complete monthly summary of dispatches, vehicle gate passes issued, and an attached Excel audit report.
                </p>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-3 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Coverage:</span>
                    <span className="text-slate-200 font-mono">Full Previous Month</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Includes:</span>
                    <span className="text-slate-200 font-mono">Dispatches + Gate Passes Log</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMonthlyModal(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold transition-colors border border-purple-500/30 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Trigger Monthly Report Now
                </button>
              </div>
            </div>
          </div>

          {/* Info Banner: Subject Line & Customer Scoping Rules */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0 mt-0.5 md:mt-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-slate-300">
                <p>
                  <strong className="text-white">Customer-First Email Subjects:</strong> All outgoing email subjects lead with the official customer name (e.g. <span className="font-mono text-teal-300">[Ashok Leyland Pantnagar] - Part Scanned: ...</span>).
                </p>
                <p className="text-slate-400 text-[11px]">
                  Users assigned to specific customers (sales & operators) only receive emails for their customer. Administrators receive emails across all customers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0 text-[11px] font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" />
              <span>ASL PNR MBP (7201012)</span>
            </div>
          </div>

          {/* Search, Filter & Quick Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user by name, username, or email..."
                  value={mailSearch}
                  onChange={(e) => setMailSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
                {mailSearch && (
                  <button
                    onClick={() => setMailSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Customer Filter */}
              <div className="w-full md:w-56">
                <select
                  value={mailCustomerFilter}
                  onChange={(e) => setMailCustomerFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer"
                >
                  <option value="all">All Customers</option>
                  {CUSTOMER_PRESETS.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div className="w-full md:w-36">
                <select
                  value={mailRoleFilter}
                  onChange={(e) => setMailRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="sales">Sales</option>
                  <option value="operator">Operator</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              <span>
                Showing <strong className="text-white">{filteredMailUsers.length}</strong> of{' '}
                <strong className="text-white">{mailUsers.length}</strong> users
              </span>
              <span className="text-[11px] text-slate-500">
                Tip: Toggle buttons are enabled only for users with a registered email address.
              </span>
            </div>
          </div>

          {/* User Email Subscriptions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 min-w-[200px]">User & Role</th>
                    <th className="py-3.5 px-3 min-w-[150px]">Customer</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Email Address</th>

                    {/* Column 1: Each Scan */}
                    <th className="py-3.5 px-3 text-center min-w-[125px]">
                      <div>
                        <span className="text-amber-300 flex items-center justify-center gap-1">
                          <Zap className="w-3.5 h-3.5" />
                          Each Scan
                        </span>
                        <span className="text-[9px] text-slate-500 normal-case block">Instant (Async Queue)</span>
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_each_scan', true)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All On
                          </button>
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_each_scan', false)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                    </th>

                    {/* Column 2: Plan Add */}
                    <th className="py-3.5 px-3 text-center min-w-[125px]">
                      <div>
                        <span className="text-sky-300 flex items-center justify-center gap-1">
                          <ClipboardList className="w-3.5 h-3.5" />
                          Plan Add
                        </span>
                        <span className="text-[9px] text-slate-500 normal-case block">Excel + Details</span>
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_plan_add', true)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All On
                          </button>
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_plan_add', false)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                    </th>

                    {/* Column 3: Gate Pass */}
                    <th className="py-3.5 px-3 text-center min-w-[125px]">
                      <div>
                        <span className="text-emerald-300 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Gate Pass
                        </span>
                        <span className="text-[9px] text-slate-500 normal-case block">Vehicle & Note</span>
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_gate_pass', true)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All On
                          </button>
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_gate_pass', false)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                    </th>

                    {/* Column 4: Daily 6 AM */}
                    <th className="py-3.5 px-3 text-center min-w-[130px]">
                      <div>
                        <span className="text-cyan-300 flex items-center justify-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Daily 6 AM
                        </span>
                        <span className="text-[9px] text-slate-500 normal-case block">2-Sheet Excel</span>
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_daily_report', true)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All On
                          </button>
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_daily_report', false)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                    </th>

                    {/* Column 5: Monthly 1st */}
                    <th className="py-3.5 px-3 text-center min-w-[130px]">
                      <div>
                        <span className="text-purple-300 flex items-center justify-center gap-1">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          Monthly 1st
                        </span>
                        <span className="text-[9px] text-slate-500 normal-case block">Month Audit</span>
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_monthly_report', true)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All On
                          </button>
                          <button
                            type="button"
                            disabled={!!batchUpdatingCol}
                            onClick={() => handleBatchToggle('mail_monthly_report', false)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
                  {mailLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
                        Loading user mail subscriptions...
                      </td>
                    </tr>
                  ) : filteredMailUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No users found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMailUsers.map((user) => {
                      const hasEmail = Boolean(user.email && user.email.includes('@'));
                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          {/* User & Role */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{user.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-500 font-mono">@{user.username}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                                  user.role === 'admin'
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    : user.role === 'sales'
                                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                    : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                }`}
                              >
                                {user.role.toUpperCase()}
                              </span>
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="py-3 px-3">
                            {user.customer_name ? (
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                {user.customer_name}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">Global / All</span>
                            )}
                          </td>

                          {/* Email */}
                          <td className="py-3 px-4">
                            {hasEmail ? (
                              <span className="font-mono text-teal-300 text-xs flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                {user.email}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <AlertCircle className="w-3 h-3" />
                                No Email (Set in Users)
                              </span>
                            )}
                          </td>

                          {/* 1. Each Scan */}
                          <td className="py-3 px-3 text-center">
                            <MailToggle
                              enabled={Boolean(user.mail_each_scan)}
                              disabled={!hasEmail}
                              loading={updatingKey === `${user.id}_mail_each_scan`}
                              onChange={() => handleToggleUserMail(user, 'mail_each_scan')}
                              title={
                                !hasEmail
                                  ? 'Configure email for this user first'
                                  : user.mail_each_scan
                                  ? 'Click to turn OFF each scan email'
                                  : 'Click to turn ON each scan email'
                              }
                            />
                          </td>

                          {/* 2. Plan Add */}
                          <td className="py-3 px-3 text-center">
                            <MailToggle
                              enabled={Boolean(user.mail_plan_add)}
                              disabled={!hasEmail}
                              loading={updatingKey === `${user.id}_mail_plan_add`}
                              onChange={() => handleToggleUserMail(user, 'mail_plan_add')}
                              title={
                                !hasEmail
                                  ? 'Configure email for this user first'
                                  : user.mail_plan_add
                                  ? 'Click to turn OFF plan add email'
                                  : 'Click to turn ON plan add email'
                              }
                            />
                          </td>

                          {/* 3. Gate Pass */}
                          <td className="py-3 px-3 text-center">
                            <MailToggle
                              enabled={Boolean(user.mail_gate_pass)}
                              disabled={!hasEmail}
                              loading={updatingKey === `${user.id}_mail_gate_pass`}
                              onChange={() => handleToggleUserMail(user, 'mail_gate_pass')}
                              title={
                                !hasEmail
                                  ? 'Configure email for this user first'
                                  : user.mail_gate_pass
                                  ? 'Click to turn OFF gate pass email'
                                  : 'Click to turn ON gate pass email'
                              }
                            />
                          </td>

                          {/* 4. Daily 6 AM */}
                          <td className="py-3 px-3 text-center">
                            <MailToggle
                              enabled={Boolean(user.mail_daily_report)}
                              disabled={!hasEmail}
                              loading={updatingKey === `${user.id}_mail_daily_report`}
                              onChange={() => handleToggleUserMail(user, 'mail_daily_report')}
                              title={
                                !hasEmail
                                  ? 'Configure email for this user first'
                                  : user.mail_daily_report
                                  ? 'Click to turn OFF daily shift email'
                                  : 'Click to turn ON daily shift email'
                              }
                            />
                          </td>

                          {/* 5. Monthly 1st */}
                          <td className="py-3 px-3 text-center">
                            <MailToggle
                              enabled={Boolean(user.mail_monthly_report)}
                              disabled={!hasEmail}
                              loading={updatingKey === `${user.id}_mail_monthly_report`}
                              onChange={() => handleToggleUserMail(user, 'mail_monthly_report')}
                              title={
                                !hasEmail
                                  ? 'Configure email for this user first'
                                  : user.mail_monthly_report
                                  ? 'Click to turn OFF monthly email'
                                  : 'Click to turn ON monthly email'
                              }
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TEST MAIL MODAL */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showTestMailModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-teal-400" />
                Test SMTP Mail Dispatch
              </h3>
              <button
                onClick={() => setShowTestMailModal(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Send an instant verification test email using the configured SMTP server credentials.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Recipient Email Address:</label>
              <input
                type="email"
                placeholder="name@company.com"
                value={testMailRecipient}
                onChange={(e) => setTestMailRecipient(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTestMailModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingTestMail || !testMailRecipient.trim()}
                onClick={handleSendTestMail}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                {isSendingTestMail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Test Mail
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TRIGGER DAILY REPORT MODAL */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showDailyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-400" />
                Trigger Daily Shift Report Now
              </h3>
              <button
                onClick={() => setShowDailyModal(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              This triggers the 6:00 AM Daily Shift Report generation on-demand. It compiles yesterday's dispatched parts + Month cumulative (latest first) and attaches the 2-sheet Excel report.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Date:</label>
                <input
                  type="date"
                  value={dailyTargetDate}
                  onChange={(e) => setDailyTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Optional Test Recipient:
                  <span className="text-[11px] text-slate-500 block font-normal">
                    Leave blank to send to all subscribed users for their assigned customers.
                  </span>
                </label>
                <input
                  type="email"
                  placeholder="Leave empty for all subscribed, or test@domain.com"
                  value={dailyTestRecipient}
                  onChange={(e) => setDailyTestRecipient(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDailyModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTriggeringDaily}
                onClick={handleTriggerDailyNow}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                {isTriggeringDaily ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TRIGGER MONTHLY REPORT MODAL */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showMonthlyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                Trigger Monthly Report Now
              </h3>
              <button
                onClick={() => setShowMonthlyModal(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              This triggers the 1st-of-the-month audit report on-demand for the previous calendar month. Includes dispatches, gate passes, and Excel attachment.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Optional Test Recipient:
                <span className="text-[11px] text-slate-500 block font-normal">
                  Leave blank to broadcast to all subscribed users for their customers.
                </span>
              </label>
              <input
                type="email"
                placeholder="Leave empty for all subscribed, or test@domain.com"
                value={monthlyTestRecipient}
                onChange={(e) => setMonthlyTestRecipient(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMonthlyModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTriggeringMonthly}
                onClick={handleTriggerMonthlyNow}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                {isTriggeringMonthly ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Report
                  </>
                )}
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
