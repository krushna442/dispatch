import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Save,
  Pencil,
  Trash2,
  Search,
  Calendar,
  X,
  Loader2,
  RefreshCw,
  Plus,
  ChevronUp,
  LayoutGrid,
  List,
} from 'lucide-react';

interface DespatchPlan {
  id: number;
  user_id: number;
  part_number: string;
  quantity: number;
  balance_quantity: number;
  scanned_quantity: number;
  status: 'pending' | 'completed';
  plan_date: string;
  schedule_date: string | null;
  gate_pass_number: string | null;
  created_at: string;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<DespatchPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showAddSection, setShowAddSection] = useState(false);
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');

  // Manual Add Form State
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newScheduleDate, setNewScheduleDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isSaving, setIsSaving] = useState(false);

  // Edit Modal State
  const [editingPlan, setEditingPlan] = useState<DespatchPlan | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/plans?date=${dateFilter}`);
      if (Array.isArray(data)) {
        setPlans(data);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch dispatch plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [dateFilter]);

  // Real-time updates
  useSocket('despatch:plans-changed', () => {
    fetchPlans();
  });
  useSocket('despatch:scan', () => {
    fetchPlans();
  });
  useSocket('despatch:gatepass', () => {
    fetchPlans();
  });

  // Handle Manual Add Record
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartNumber.trim()) {
      toast.error('Part number is required');
      return;
    }
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid positive quantity');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/plans', {
        part_number: newPartNumber.trim().toUpperCase(),
        quantity: qty,
        schedule_date: newScheduleDate || null,
        plan_date: dateFilter,
      });
      toast.success(`Part ${newPartNumber.trim().toUpperCase()} added successfully`);
      setNewPartNumber('');
      setNewQuantity('');
      fetchPlans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add record');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Excel Import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        if (!rawData || rawData.length === 0) {
          toast.error('Excel file is empty');
          return;
        }

        // Normalize column keys (e.g., "Part Number", "Part No", "part_number", "Quantity", "Qty")
        const formattedPlans: Array<{ part_number: string; quantity: number }> = [];

        for (const row of rawData) {
          const partKey = Object.keys(row).find((k) =>
            /part(\s|_)?(no|number)?/i.test(k)
          );
          const qtyKey = Object.keys(row).find((k) =>
            /qty|quantity|count/i.test(k)
          );

          if (partKey && qtyKey) {
            const partVal = String(row[partKey] || '').trim().toUpperCase();
            const qtyVal = parseInt(String(row[qtyKey] || '0'), 10);
            if (partVal && !isNaN(qtyVal) && qtyVal > 0) {
              formattedPlans.push({ part_number: partVal, quantity: qtyVal });
            }
          }
        }

        if (formattedPlans.length === 0) {
          toast.error(
            'Could not find valid "Part Number" and "Quantity" columns in Excel.'
          );
          return;
        }

        await api.post('/api/plans/import', formattedPlans);
        toast.success(`Imported ${formattedPlans.length} records successfully!`);
        fetchPlans();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Error reading Excel file');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Download Dummy Excel Template
  const handleDownloadDummyExcel = () => {
    const dummyData = [
      { 'Part Number': 'FC373500', Quantity: 40, 'Schedule Date': dateFilter },
      { 'Part Number': 'FEA56800', Quantity: 40, 'Schedule Date': dateFilter },
      { 'Part Number': 'FC319400', Quantity: 2, 'Schedule Date': dateFilter },
      { 'Part Number': 'FC320300', Quantity: 7, 'Schedule Date': dateFilter },
      { 'Part Number': 'FEA23500', Quantity: 4, 'Schedule Date': dateFilter },
    ];
    const ws = XLSX.utils.json_to_sheet(dummyData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'RSB_Dispatch_Plan_Template.xlsx');
    toast.info('Template downloaded');
  };

  // Export Scanned / Plan Data (with multi-sheet Excel and Red Background for duplicate scans)
  const handleExportScannedData = async () => {
    if (plans.length === 0) {
      toast.error('No records to export');
      return;
    }

    try {
      toast.info('Generating dispatch report with scanned labels...');

      // 1. Fetch scan logs (all logs, then match with current date or displayed plans)
      const scanLogsAll = await api.get('/api/scan/logs').catch(() => []);
      const currentPlanPartNumbers = new Set(plans.map((p) => p.part_number));
      const currentPlanIds = new Set(plans.map((p) => p.id));

      const scanLogs = (Array.isArray(scanLogsAll) ? scanLogsAll : []).filter((s: any) => {
        const scanDate = s.scan_date ? String(s.scan_date).slice(0, 10) : '';
        const scannedAt = s.scanned_at ? String(s.scanned_at).slice(0, 10) : '';
        const dateMatch = scanDate === dateFilter || scannedAt === dateFilter;
        const planMatch =
          (s.plan_id && currentPlanIds.has(s.plan_id)) ||
          currentPlanPartNumbers.has(s.part_number);
        return dateMatch || planMatch;
      });

      // 2. Build Detailed Scanned Labels Sheet with grouped & merged Part Numbers
      const scansByPart = new Map<string, any[]>();
      for (const s of scanLogs) {
        const pNo = (s.part_number || '').trim().toUpperCase();
        if (!scansByPart.has(pNo)) scansByPart.set(pNo, []);
        scansByPart.get(pNo)!.push(s);
      }

      const headers = [
        'SR No',
        'Part Number',
        'Scanned Label (Barcode Text)',
        'Serial Number',
        'Vendor Code',
        'Scanned By',
        'Status',
        'Remark',
        'Scan Date & Time',
      ];

      const rows: any[][] = [headers];
      const merges: any[] = [];
      const redRows = new Set<number>();

      let currentSrNo = 1;
      let currentRowIdx = 1;

      const processedParts = new Set<string>();

      for (const plan of plans) {
        const pNo = (plan.part_number || '').trim().toUpperCase();
        if (processedParts.has(pNo)) continue;
        processedParts.add(pNo);

        const partScans = scansByPart.get(pNo) || [];
        const count = partScans.length;

        if (count === 0) {
          rows.push([
            currentSrNo,
            pNo,
            'No scans recorded',
            '—',
            '—',
            '—',
            '—',
            '—',
            '—',
          ]);
          currentRowIdx++;
          currentSrNo++;
        } else {
          const startRow = currentRowIdx;
          const endRow = startRow + count - 1;

          if (count > 1) {
            merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
            merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
          }

          partScans.forEach((s: any, idx: number) => {
            const isDup =
              s.status === 'reject' ||
              (s.remark && s.remark.toLowerCase().includes('duplicate'));
            const rIdx = startRow + idx;
            if (isDup) redRows.add(rIdx);

            const label =
              s.scanned_label || s.raw_scan_text || s.serial_number || '—';
            const serial = s.serial_number || '—';
            const vendor = s.vendor_code || '—';
            const scannedBy = s.username
              ? `@${s.username} (${s.user_name || ''})`
              : s.user_id
              ? `User #${s.user_id}`
              : '—';
            const status = (s.status || 'success').toUpperCase();
            const remark =
              s.remark ||
              (s.status === 'reject' ? 'duplicate scan' : 'verified');
            const time = s.scanned_at
              ? new Date(s.scanned_at).toLocaleString('en-GB')
              : '—';

            rows.push([
              idx === 0 ? currentSrNo : '',
              idx === 0 ? pNo : '',
              label,
              serial,
              vendor,
              scannedBy,
              status,
              remark,
              time,
            ]);
            currentRowIdx++;
          });

          currentSrNo++;
        }
      }

      // Check any scans not belonging to plans on screen
      for (const [pNo, partScans] of scansByPart.entries()) {
        if (processedParts.has(pNo)) continue;
        processedParts.add(pNo);

        const count = partScans.length;
        const startRow = currentRowIdx;
        const endRow = startRow + count - 1;

        if (count > 1) {
          merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
          merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
        }

        partScans.forEach((s: any, idx: number) => {
          const isDup =
            s.status === 'reject' ||
            (s.remark && s.remark.toLowerCase().includes('duplicate'));
          const rIdx = startRow + idx;
          if (isDup) redRows.add(rIdx);

          const label =
            s.scanned_label || s.raw_scan_text || s.serial_number || '—';
          const serial = s.serial_number || '—';
          const vendor = s.vendor_code || '—';
          const scannedBy = s.username
            ? `@${s.username} (${s.user_name || ''})`
            : s.user_id
            ? `User #${s.user_id}`
            : '—';
          const status = (s.status || 'success').toUpperCase();
          const remark =
            s.remark ||
            (s.status === 'reject' ? 'duplicate scan' : 'verified');
          const time = s.scanned_at
            ? new Date(s.scanned_at).toLocaleString('en-GB')
            : '—';

          rows.push([
            idx === 0 ? currentSrNo : '',
            idx === 0 ? pNo : '',
            label,
            serial,
            vendor,
            scannedBy,
            status,
            remark,
            time,
          ]);
          currentRowIdx++;
        });

        currentSrNo++;
      }

      const wsScans = XLSX.utils.aoa_to_sheet(rows);
      wsScans['!merges'] = merges;
      wsScans['!cols'] = [
        { wch: 8 },  // SR No
        { wch: 20 }, // Part Number
        { wch: 42 }, // Scanned Label
        { wch: 18 }, // Serial Number
        { wch: 14 }, // Vendor Code
        { wch: 24 }, // Scanned By
        { wch: 14 }, // Status
        { wch: 20 }, // Remark
        { wch: 22 }, // Scan Date & Time
      ];

      // Header style
      for (let c = 0; c < headers.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (wsScans[addr]) {
          wsScans[addr].s = {
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

      // Row styling: SR No and Part Number centered bold; duplicate scans soft red
      for (let r = 1; r < rows.length; r++) {
        const isDup = redRows.has(r);
        for (let c = 0; c < headers.length; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!wsScans[addr]) {
            wsScans[addr] = { t: 's', v: '' };
          }

          if (c === 0 || c === 1) {
            wsScans[addr].s = {
              font: { bold: true, color: { rgb: '0F172A' }, sz: 11 },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: 'CBD5E1' } },
                bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
                left: { style: 'thin', color: { rgb: 'CBD5E1' } },
                right: { style: 'thin', color: { rgb: 'CBD5E1' } },
              },
            };
          } else if (isDup) {
            wsScans[addr].s = {
              fill: { fgColor: { rgb: 'FFC7CE' } }, // Soft red fill
              font: { color: { rgb: '9C0006' }, bold: true, sz: 10 }, // Dark red bold text
              alignment: {
                vertical: 'center',
                horizontal: c === 2 ? 'left' : 'center',
              },
              border: {
                top: { style: 'thin', color: { rgb: 'E0B4B4' } },
                bottom: { style: 'thin', color: { rgb: 'E0B4B4' } },
                left: { style: 'thin', color: { rgb: 'E0B4B4' } },
                right: { style: 'thin', color: { rgb: 'E0B4B4' } },
              },
            };
          } else {
            wsScans[addr].s = {
              font: { color: { rgb: '334155' }, sz: 10 },
              alignment: {
                vertical: 'center',
                horizontal: c === 2 ? 'left' : 'center',
              },
              border: {
                top: { style: 'thin', color: { rgb: 'F1F5F9' } },
                bottom: { style: 'thin', color: { rgb: 'F1F5F9' } },
                left: { style: 'thin', color: { rgb: 'F1F5F9' } },
                right: { style: 'thin', color: { rgb: 'F1F5F9' } },
              },
            };
          }
        }
      }

      // 3. Build Plan Summary Sheet (SHEET 2)
      const exportPlanData = plans.map((p, idx) => {
        const pct =
          p.quantity > 0
            ? Math.round((p.scanned_quantity / p.quantity) * 100)
            : 0;
        const duplicateCount = Array.isArray(scanLogs)
          ? scanLogs.filter(
              (s: any) =>
                s.part_number === p.part_number &&
                (s.status === 'reject' ||
                  s.remark?.toLowerCase().includes('duplicate'))
            ).length
          : 0;

        return {
          'SR No': idx + 1,
          'Part Number': p.part_number,
          'Quantity': p.quantity,
          'Balance Quantity': p.balance_quantity,
          'Scanned Quantity': p.scanned_quantity,
          'Duplicate Attempts': duplicateCount,
          'Status': p.status === 'completed' ? 'Completed' : 'Pending',
          'Completed %': `${pct}%`,
          'Plan Date': p.plan_date ? p.plan_date.slice(0, 10) : '',
          'Schedule Date': p.schedule_date ? p.schedule_date.slice(0, 10) : '',
          'Gate Pass': p.gate_pass_number || 'None',
        };
      });

      const wsPlans = XLSX.utils.json_to_sheet(exportPlanData);
      const planCols = Object.keys(exportPlanData[0] || {}).length;

      // Plan summary header styling
      for (let c = 0; c < planCols; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (wsPlans[addr]) {
          wsPlans[addr].s = {
            fill: { fgColor: { rgb: '0F766E' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      }

      // If any part has duplicate attempts, highlight Duplicate Attempts cell with soft red
      exportPlanData.forEach((row, rIdx) => {
        if (row['Duplicate Attempts'] > 0) {
          const dupCellAddr = XLSX.utils.encode_cell({ r: rIdx + 1, c: 5 });
          if (wsPlans[dupCellAddr]) {
            wsPlans[dupCellAddr].s = {
              fill: { fgColor: { rgb: 'FFC7CE' } },
              font: { color: { rgb: '9C0006' }, bold: true },
            };
          }
        }
      });

      const wb = XLSX.utils.book_new();
      // Put Scanned_Labels FIRST so it opens immediately when user opens Excel
      XLSX.utils.book_append_sheet(wb, wsScans, 'Scanned_Labels');
      XLSX.utils.book_append_sheet(wb, wsPlans, 'Dispatch_Plan_Summary');

      XLSX.writeFile(wb, `RSB_Dispatch_Data_${dateFilter}.xlsx`);
      toast.success('Data exported successfully with scanned labels and duplicate highlights!');
    } catch (err: unknown) {
      console.error('Export error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to export data');
    }
  };

  // Delete Plan Entry
  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this part record?')) return;
    try {
      await api.delete(`/api/plans/${id}`);
      toast.success('Record deleted');
      fetchPlans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete record');
    }
  };

  // Open Edit Dialog
  const openEdit = (plan: DespatchPlan) => {
    setEditingPlan(plan);
    setEditQty(String(plan.quantity));
    setEditDate(plan.schedule_date ? plan.schedule_date.slice(0, 10) : dateFilter);
  };

  // Save Edit
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Valid positive quantity required');
      return;
    }
    if (qty < editingPlan.scanned_quantity) {
      toast.error(
        `Quantity cannot be less than already scanned count (${editingPlan.scanned_quantity})`
      );
      return;
    }

    setIsUpdating(true);
    try {
      await api.put(`/api/plans/${editingPlan.id}`, {
        quantity: qty,
        schedule_date: editDate || null,
      });
      toast.success('Record updated');
      setEditingPlan(null);
      fetchPlans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update record');
    } finally {
      setIsUpdating(false);
    }
  };

  // Filtered & Paginated Rows
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const q = searchQuery.toLowerCase();
      return (
        p.part_number.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q) ||
        (p.gate_pass_number && p.gate_pass_number.toLowerCase().includes(q))
      );
    });
  }, [plans, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / pageSize));
  const paginatedPlans = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPlans.slice(start, start + pageSize);
  }, [filteredPlans, currentPage, pageSize]);

  // Totals calculations
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalBal = 0;
    let totalScan = 0;
    plans.forEach((p) => {
      totalQty += Number(p.quantity) || 0;
      totalBal += Number(p.balance_quantity) || 0;
      totalScan += Number(p.scanned_quantity) || 0;
    });
    return { totalQty, totalBal, totalScan };
  }, [plans]);

  return (
    <div className="space-y-6">
      {/* Top Header Card — Styled matching Reference Image 1 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Banner Title */}
        <div className="bg-teal-700 px-6 py-3 text-center">
          <h1 className="text-xl font-bold text-white tracking-wide">Part Details</h1>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Top Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => setShowAddSection(!showAddSection)}
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-teal-600/20 transition-all cursor-pointer"
              >
                {showAddSection ? <ChevronUp className="w-4 h-4 shrink-0" /> : <Plus className="w-4 h-4 shrink-0" />}
                <span className="truncate">{showAddSection ? 'Hide Options' : 'Add / Import Records'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportScannedData}
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="truncate sm:inline hidden">Export Scanned Data</span>
                <span className="truncate sm:hidden inline">Export Data</span>
              </button>
            </div>

            {/* Search By Date Input */}
            <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs sm:text-sm w-full sm:w-auto">
              <div className="flex items-center gap-2 shrink-0">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-[11px] sm:text-xs text-slate-400 font-medium whitespace-nowrap">Date:</span>
              </div>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent border-none text-white text-xs sm:text-sm font-medium focus:outline-none cursor-pointer flex-1 sm:flex-none text-center sm:text-left min-w-0"
              />
              <button
                type="button"
                onClick={fetchPlans}
                title="Refresh"
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Collapsible Adding / Importing Section */}
          {showAddSection && (
            <div className="bg-slate-950/80 p-3.5 sm:p-5 rounded-2xl border border-teal-500/30 shadow-inner space-y-3.5 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    Add or Import Dispatch Plan Records
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-2">
                  {/* Hidden Excel Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import Records
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadDummyExcel}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Dummy Excel
                  </button>
                </div>
              </div>

              {/* Manual Entry Form */}
              <form
                onSubmit={handleAddRecord}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Part Number:
                  </label>
                  <input
                    type="text"
                    value={newPartNumber}
                    onChange={(e) => setNewPartNumber(e.target.value)}
                    placeholder="e.g. FC373500"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Quantity:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="e.g. 40"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Date:
                  </label>
                  <input
                    type="date"
                    value={newScheduleDate}
                    onChange={(e) => setNewScheduleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filter & Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                >
                  <option value={10} className="bg-slate-800">10</option>
                  <option value={25} className="bg-slate-800">25</option>
                  <option value={50} className="bg-slate-800">50</option>
                  <option value={100} className="bg-slate-800">100</option>
                </select>
                <span>entries</span>
              </div>

              {/* Mobile View Switcher (Cards vs Table) */}
              <div className="sm:hidden flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setMobileView('cards')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    mobileView === 'cards'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView('table')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    mobileView === 'table'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <List className="w-3 h-3" />
                  Table
                </button>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search part or status..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Mobile Card List (Active when mobileView === 'cards' on small screens) */}
        <div className={`sm:hidden ${mobileView === 'cards' ? 'block' : 'hidden'} p-3 space-y-3`}>
          {/* Highlighted Cyan Total Summary Card */}
          <div className="bg-cyan-500 text-slate-950 p-3.5 rounded-xl font-bold shadow-md">
            <div className="flex items-center justify-between text-xs pb-1.5 border-b border-cyan-400 mb-2">
              <span className="uppercase tracking-wider font-extrabold text-[11px]">Total Summary</span>
              <span className="text-[11px] font-semibold">{plans.length} Planned Parts</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-cyan-600/25 rounded-lg p-1.5">
                <div className="text-[10px] uppercase font-semibold text-slate-900/80">Planned</div>
                <div className="text-base font-extrabold">{totals.totalQty}</div>
              </div>
              <div className="bg-cyan-600/25 rounded-lg p-1.5">
                <div className="text-[10px] uppercase font-semibold text-slate-900/80">Balance</div>
                <div className="text-base font-extrabold">{totals.totalBal}</div>
              </div>
              <div className="bg-cyan-600/25 rounded-lg p-1.5">
                <div className="text-[10px] uppercase font-semibold text-slate-900/80">Scanned</div>
                <div className="text-base font-extrabold">{totals.totalScan}</div>
              </div>
            </div>
            <div className="text-center text-xs mt-2 font-extrabold bg-cyan-600/20 rounded-lg py-1">
              {totals.totalQty > 0
                ? `${Math.round((totals.totalScan / totals.totalQty) * 100)}% Fulfilled`
                : '0%'}
            </div>
          </div>

          {/* Card Items */}
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
              Loading records...
            </div>
          ) : paginatedPlans.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No records found for the selected date. Import Excel or add records above.
            </div>
          ) : (
            paginatedPlans.map((plan, index) => {
              const srNo = (currentPage - 1) * pageSize + index + 1;
              const isCompleted = plan.status === 'completed' || plan.balance_quantity === 0;
              const percent =
                plan.quantity > 0
                  ? Math.min(100, Math.round((plan.scanned_quantity / plan.quantity) * 100))
                  : 0;

              return (
                <div
                  key={plan.id}
                  className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 space-y-3 hover:border-slate-600 transition-all shadow-md"
                >
                  {/* Card Top: SR No, Part Number, Status & Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {srNo}
                      </span>
                      <span className="font-mono font-bold text-white text-sm tracking-wide truncate">
                        {plan.part_number}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCompleted
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                        }`}
                      >
                        {isCompleted ? 'Completed' : 'Pending'}
                      </span>

                      <button
                        onClick={() => openEdit(plan)}
                        title="Edit Plan"
                        className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        title="Delete Plan"
                        className="p-1 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quantities Row */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 uppercase font-medium">Planned</div>
                      <div className="font-bold text-white text-sm mt-0.5">{plan.quantity}</div>
                    </div>

                    <div
                      className={`rounded-lg p-2 border ${
                        isCompleted
                          ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-medium opacity-80">Balance</div>
                      <div className="font-bold text-sm mt-0.5">{plan.balance_quantity}</div>
                    </div>

                    <div
                      className={`rounded-lg p-2 border ${
                        isCompleted
                          ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-medium opacity-80">Scanned</div>
                      <div className="font-bold text-sm mt-0.5">{plan.scanned_quantity}</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Progress</span>
                      <span className="font-bold text-slate-200">{percent}%</span>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Schedule Date */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                    <span>Schedule Date:</span>
                    <span className="font-mono text-slate-300">
                      {plan.schedule_date
                        ? new Date(plan.schedule_date).toLocaleDateString('en-GB')
                        : plan.plan_date
                        ? new Date(plan.plan_date).toLocaleDateString('en-GB')
                        : '—'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Table Container (Visible on sm+ screens, or on mobile when mobileView === 'table') */}
        <div className={`overflow-x-auto -mx-1 sm:mx-0 ${mobileView === 'cards' ? 'hidden sm:block' : 'block'}`}>
          {/* Mobile swipe helper cue */}
          <div className="sm:hidden px-3 py-1.5 bg-slate-800/80 border-b border-slate-700 text-[11px] text-teal-400 font-medium flex items-center justify-between">
            <span>Horizontal Table</span>
            <span className="font-mono">Swipe horizontally &rarr;</span>
          </div>
          <table className="w-full text-left text-xs border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-slate-800/80 border-y border-slate-700 text-slate-300 whitespace-nowrap">
                <th className="px-4 py-3 font-semibold text-center w-24 whitespace-nowrap">Action</th>
                <th className="px-4 py-3 font-semibold text-center w-16 whitespace-nowrap">SR No</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Part No</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Quantity</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Balance Quantity</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Scan Part Quantity</th>
                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-semibold text-center w-40 whitespace-nowrap">Completed %</th>
                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Schedule Date</th>
              </tr>
            </thead>
            <tbody>
              {/* Highlighted Cyan Total Summary Row (Reference Image 1) */}
              <tr className="bg-cyan-500 text-slate-950 font-bold border-b border-cyan-400">
                <td colSpan={2} className="px-4 py-2.5 text-center uppercase tracking-wider">
                  Total -
                </td>
                <td className="px-4 py-2.5 font-bold">Total Planned Parts ({plans.length})</td>
                <td className="px-4 py-2.5 text-right font-extrabold text-sm">
                  {totals.totalQty}
                </td>
                <td className="px-4 py-2.5 text-right font-extrabold text-sm">
                  {totals.totalBal}
                </td>
                <td className="px-4 py-2.5 text-right font-extrabold text-sm">
                  {totals.totalScan}
                </td>
                <td colSpan={3} className="px-4 py-2.5 text-center text-xs">
                  {totals.totalQty > 0
                    ? `${Math.round((totals.totalScan / totals.totalQty) * 100)}% Fulfilled`
                    : '0%'}
                </td>
              </tr>

              {/* Data Rows */}
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
                    Loading records...
                  </td>
                </tr>
              ) : paginatedPlans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No records found for the selected date. Import Excel or add records above.
                  </td>
                </tr>
              ) : (
                paginatedPlans.map((plan, index) => {
                  const srNo = (currentPage - 1) * pageSize + index + 1;
                  const isCompleted = plan.status === 'completed' || plan.balance_quantity === 0;
                  const percent =
                    plan.quantity > 0
                      ? Math.min(100, Math.round((plan.scanned_quantity / plan.quantity) * 100))
                      : 0;

                  return (
                    <tr
                      key={plan.id}
                      className="border-b border-slate-800/80 hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Action buttons (Green edit, Red delete like reference) */}
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEdit(plan)}
                            title="Edit Plan"
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(plan.id)}
                            title="Delete Plan"
                            className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* SR No */}
                      <td className="px-4 py-2.5 text-center font-bold text-slate-300">
                        {srNo}
                      </td>

                      {/* Part No */}
                      <td className="px-4 py-2.5 font-bold font-mono text-white tracking-wide">
                        {plan.part_number}
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-2.5 text-right font-bold text-slate-200">
                        {plan.quantity}
                      </td>

                      {/* Balance Quantity (Orange if pending, Green if 0) */}
                      <td
                        className={`px-4 py-2.5 text-right font-bold ${
                          isCompleted
                            ? 'bg-emerald-600/90 text-white'
                            : 'bg-amber-500/90 text-slate-950'
                        }`}
                      >
                        {plan.balance_quantity}
                      </td>

                      {/* Scan Part Quantity (Orange if pending, Green if completed) */}
                      <td
                        className={`px-4 py-2.5 text-right font-bold ${
                          isCompleted
                            ? 'bg-emerald-600/90 text-white'
                            : 'bg-amber-500/90 text-slate-950'
                        }`}
                      >
                        {plan.scanned_quantity}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5 text-center font-semibold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isCompleted
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                          }`}
                        >
                          {isCompleted ? 'Completed' : 'Pending'}
                        </span>
                      </td>

                      {/* Completed % Progress Bar (Reference Image 1) */}
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-700 h-5 rounded overflow-hidden relative border border-slate-600">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isCompleted ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                            <span
                              className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${
                                percent > 50 ? 'text-slate-950' : 'text-white'
                              }`}
                            >
                              {percent}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Schedule Date */}
                      <td className="px-4 py-2.5 text-center text-slate-400 font-mono">
                        {plan.schedule_date
                          ? new Date(plan.schedule_date).toLocaleDateString('en-GB')
                          : plan.plan_date
                          ? new Date(plan.plan_date).toLocaleDateString('en-GB')
                          : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div>
            Showing {filteredPlans.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredPlans.length)} of {filteredPlans.length}{' '}
            entries
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold">
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Edit Record Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-teal-400" />
                Edit Plan: {editingPlan.part_number}
              </h3>
              <button
                onClick={() => setEditingPlan(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Total Planned Quantity:
                </label>
                <input
                  type="number"
                  min={editingPlan.scanned_quantity}
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Already scanned: {editingPlan.scanned_quantity} (quantity cannot be lower than this)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Schedule Date:
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-md shadow-teal-600/20 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
