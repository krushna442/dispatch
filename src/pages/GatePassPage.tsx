import { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
import {
  Truck,
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  Package,
  Calendar,
  Clock,
  Printer,
  Loader2,
} from 'lucide-react';

interface DespatchItem {
  id: number;
  gate_pass_id: number;
  plan_id: number;
  part_number: string;
  quantity: number;
}

interface GatePass {
  id: number;
  user_id: number;
  gate_pass_number: string;
  plan_date: string;
  total_parts: number;
  total_quantity: number;
  created_at: string;
  history?: DespatchItem[];
}

export default function GatePassPage() {
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPassId, setExpandedPassId] = useState<number | null>(null);
  const [gatePassScans, setGatePassScans] = useState<Record<number, any[]>>({});
  const [activeTabMap, setActiveTabMap] = useState<Record<number, 'summary' | 'scans'>>({});

  const fetchGatePasses = async () => {
    try {
      const data = await api.get('/api/gatepass');
      if (Array.isArray(data)) {
        setGatePasses(data);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch gate passes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGatePasses();
  }, []);

  useSocket('despatch:gatepass', () => {
    fetchGatePasses();
  });

  const toggleExpand = async (id: number) => {
    const nextState = expandedPassId === id ? null : id;
    setExpandedPassId(nextState);
    if (nextState !== null && !gatePassScans[id]) {
      try {
        const scans = await api.get(`/api/gatepass/${id}/scans`);
        setGatePassScans((prev) => ({
          ...prev,
          [id]: Array.isArray(scans) ? scans : [],
        }));
      } catch {
        // silent fallback
      }
    }
  };

  const filteredPasses = useMemo(() => {
    return gatePasses.filter((gp) => {
      const q = searchQuery.toLowerCase();
      const matchNumber = gp.gate_pass_number.toLowerCase().includes(q);
      const matchPart = gp.history?.some((item) =>
        item.part_number.toLowerCase().includes(q)
      );
      return matchNumber || matchPart;
    });
  }, [gatePasses, searchQuery]);

  // Export Gate Pass to Excel with Scanned Labels
  const exportGatePass = async (gp: GatePass) => {
    try {
      toast.info(`Generating Excel export for Gate Pass #${gp.gate_pass_number}...`);
      const scans = await api.get(`/api/gatepass/${gp.id}/scans`).catch(() => []);

      const scanRows =
        Array.isArray(scans) && scans.length > 0
          ? scans.map((s: any, idx: number) => ({
              'SR No': idx + 1,
              'Scanned Label (Barcode Text)':
                s.scanned_label || s.raw_scan_text || s.serial_number || '—',
              'Part Number': s.part_number,
              'Serial Number': s.serial_number,
              'Vendor Code': s.vendor_code || '—',
              'Scanned By': s.username
                ? `@${s.username} (${s.user_name || ''})`
                : s.user_id
                ? `User #${s.user_id}`
                : '—',
              'Status': (s.status || 'success').toUpperCase(),
              'Remark':
                s.remark ||
                (s.status === 'reject' ? 'duplicate scan' : 'verified'),
              'Scan Date & Time': s.scanned_at
                ? new Date(s.scanned_at).toLocaleString('en-GB')
                : '',
            }))
          : [
              {
                'SR No': 1,
                'Scanned Label (Barcode Text)': 'No scans recorded',
                'Part Number': '—',
                'Serial Number': '—',
                'Vendor Code': '—',
                'Scanned By': '—',
                'Status': '—',
                'Remark': '—',
                'Scan Date & Time': '—',
              },
            ];

      const wsScans = XLSX.utils.json_to_sheet(scanRows);
      const scanCols = Object.keys(scanRows[0] || {}).length;

      wsScans['!cols'] = [
        { wch: 8 },  // SR No
        { wch: 40 }, // Scanned Label
        { wch: 18 }, // Part Number
        { wch: 18 }, // Serial Number
        { wch: 14 }, // Vendor Code
        { wch: 24 }, // Scanned By
        { wch: 14 }, // Status
        { wch: 20 }, // Remark
        { wch: 22 }, // Scan Date & Time
      ];

      for (let c = 0; c < scanCols; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (wsScans[addr]) {
          wsScans[addr].s = {
            fill: { fgColor: { rgb: '0F766E' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      }

      scanRows.forEach((row: any, rIdx: number) => {
        const isDup =
          row.Status === 'REJECT' ||
          row.Remark?.toLowerCase().includes('duplicate');
        if (isDup) {
          for (let c = 0; c < scanCols; c++) {
            const addr = XLSX.utils.encode_cell({ r: rIdx + 1, c });
            if (wsScans[addr]) {
              wsScans[addr].s = {
                fill: { fgColor: { rgb: 'FFC7CE' } },
                font: { color: { rgb: '9C0006' }, bold: true },
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

      const summaryRows: Array<Record<string, any>> = (gp.history || []).map((h, i) => ({
        'SR No': i + 1,
        'Gate Pass Number': gp.gate_pass_number,
        'Part Number': h.part_number,
        'Quantity': h.quantity,
        'Dispatched Date': gp.plan_date,
        'Timestamp': new Date(gp.created_at).toLocaleString(),
      }));

      summaryRows.push({
        'SR No': '',
        'Gate Pass Number': '',
        'Part Number': 'GRAND TOTAL',
        'Quantity': gp.total_quantity,
        'Dispatched Date': '',
        'Timestamp': '',
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      const sumCols = Object.keys(summaryRows[0] || {}).length;
      wsSummary['!cols'] = [
        { wch: 8 },
        { wch: 20 },
        { wch: 18 },
        { wch: 14 },
        { wch: 18 },
        { wch: 22 },
      ];

      for (let c = 0; c < sumCols; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (wsSummary[addr]) {
          wsSummary[addr].s = {
            fill: { fgColor: { rgb: '0F766E' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsScans, 'Scanned_Labels');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Gate_Pass_Summary');
      XLSX.writeFile(wb, `GatePass_${gp.gate_pass_number}_Scanned_Labels.xlsx`);
      toast.success('Gate pass exported with scanned labels!');
    } catch (err: unknown) {
      console.error('Export error:', err);
      toast.error('Failed to export gate pass');
    }
  };

  // Print Gate Pass Slip
  const printGatePass = (gp: GatePass) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    const itemsHtml = (gp.history || [])
      .map(
        (h, i) => `
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${i + 1}</td>
          <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">${h.part_number}</td>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: right; font-weight: bold;">${h.quantity}</td>
        </tr>
      `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gate Pass: ${gp.gate_pass_number}</title>
          <style>
            body { font-family: sans-serif; padding: 24px; color: #111; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
            th { background: #f0f0f0; border: 1px solid #ccc; padding: 8px; text-align: left; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 14px; }
            .signature { border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>RSB TRANSMISSIONS (I) LTD.</h2>
            <h3>VEHICLE DISPATCH GATE PASS</h3>
          </div>
          <div class="meta">
            <div>
              <strong>Gate Pass No:</strong> ${gp.gate_pass_number}<br>
              <strong>Plan Date:</strong> ${gp.plan_date}
            </div>
            <div style="text-align: right;">
              <strong>Date & Time:</strong> ${new Date(gp.created_at).toLocaleString()}<br>
              <strong>Total Parts:</strong> ${gp.total_parts} | <strong>Total Qty:</strong> ${gp.total_quantity}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 60px;">SR No</th>
                <th>Part Number</th>
                <th style="text-align: right; width: 120px;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="background: #f9f9f9; font-weight: bold;">
                <td colspan="2" style="border: 1px solid #ccc; padding: 8px; text-align: right;">GRAND TOTAL:</td>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">${gp.total_quantity}</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            <div class="signature">Dispatched By</div>
            <div class="signature">Verified by Security</div>
            <div class="signature">Driver Signature</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Vehicle Loading & Dispatch
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-teal-400" />
            Gate Pass Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Audit trail of all vehicle dispatches and fulfilled part numbers
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search gate pass or part..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Gate Pass List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
            Loading gate passes...
          </div>
        ) : filteredPasses.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center text-slate-500 text-xs sm:text-sm">
            No gate passes found. Complete scanning all items in the Scan page and enter a Gate Pass Number to create one.
          </div>
        ) : (
          filteredPasses.map((gp) => {
            const isExpanded = expandedPassId === gp.id;

            return (
              <div
                key={gp.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg hover:border-slate-700 transition-all"
              >
                {/* Gate Pass Header Bar */}
                <div
                  onClick={() => toggleExpand(gp.id)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 shrink-0 mt-0.5 sm:mt-0"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-bold font-mono text-teal-400">
                          {gp.gate_pass_number}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Dispatched
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-400 mt-1 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Plan: {gp.plan_date}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {new Date(gp.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side stats & actions */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 sm:gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-left md:text-right">
                        <div className="text-[10px] sm:text-xs text-slate-400">Total Parts</div>
                        <div className="text-xs sm:text-sm font-bold text-white">{gp.total_parts} types</div>
                      </div>
                      <div className="text-left md:text-right">
                        <div className="text-[10px] sm:text-xs text-slate-400">Total Quantity</div>
                        <div className="text-sm sm:text-base font-extrabold text-teal-400">
                          {gp.total_quantity} pcs
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => exportGatePass(gp)}
                        title="Export Excel"
                        className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => printGatePass(gp)}
                        title="Print Gate Pass"
                        className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/60 p-4 sm:p-5 space-y-4">
                    {/* View Switcher Tabs */}
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                      <button
                        onClick={() =>
                          setActiveTabMap((prev) => ({
                            ...prev,
                            [gp.id]: 'summary',
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          (activeTabMap[gp.id] || 'summary') === 'summary'
                            ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5" />
                        Parts Summary ({gp.history?.length || 0})
                      </button>
                      <button
                        onClick={() =>
                          setActiveTabMap((prev) => ({
                            ...prev,
                            [gp.id]: 'scans',
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          activeTabMap[gp.id] === 'scans'
                            ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <Search className="w-3.5 h-3.5" />
                        Scanned Labels ({gatePassScans[gp.id]?.length || 0})
                      </button>
                    </div>

                    {(activeTabMap[gp.id] || 'summary') === 'summary' ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-800">
                              <th className="px-4 py-2.5 w-12 text-center">#</th>
                              <th className="px-4 py-2.5 font-medium">Part Number</th>
                              <th className="px-4 py-2.5 font-medium text-right">Quantity Loaded</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {gp.history && gp.history.length > 0 ? (
                              gp.history.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-800/20">
                                  <td className="px-4 py-2 text-center text-slate-500">{idx + 1}</td>
                                  <td className="px-4 py-2 font-bold text-white tracking-wider">
                                    {item.part_number}
                                  </td>
                                  <td className="px-4 py-2 text-right font-extrabold text-teal-400">
                                    {item.quantity}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-4 py-3 text-center text-slate-500">
                                  No items recorded for this gate pass.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-800">
                              <th className="px-3 py-2.5 w-10 text-center">#</th>
                              <th className="px-3 py-2.5 font-medium">Scanned Label (Barcode Text)</th>
                              <th className="px-3 py-2.5 font-medium">Part Number</th>
                              <th className="px-3 py-2.5 font-medium">Serial No</th>
                              <th className="px-3 py-2.5 font-medium">Vendor</th>
                              <th className="px-3 py-2.5 font-medium">Scanned By</th>
                              <th className="px-3 py-2.5 font-medium text-center">Status</th>
                              <th className="px-3 py-2.5 font-medium">Remark</th>
                              <th className="px-3 py-2.5 font-medium text-right">Scan Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {gatePassScans[gp.id] && gatePassScans[gp.id].length > 0 ? (
                              gatePassScans[gp.id].map((s: any, idx: number) => {
                                const isReject = s.status === 'reject' || s.remark?.toLowerCase().includes('duplicate');
                                return (
                                  <tr
                                    key={s.id || idx}
                                    className={`transition-colors ${
                                      isReject
                                        ? 'bg-red-950/30 text-red-200 hover:bg-red-950/50'
                                        : 'hover:bg-slate-800/20'
                                    }`}
                                  >
                                    <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                                    <td className="px-3 py-2 font-mono text-[11px] text-teal-300 break-all max-w-xs">
                                      {s.scanned_label || s.raw_scan_text || s.serial_number || '—'}
                                    </td>
                                    <td className="px-3 py-2 font-bold text-white tracking-wider">
                                      {s.part_number}
                                    </td>
                                    <td className="px-3 py-2 text-slate-300">{s.serial_number}</td>
                                    <td className="px-3 py-2 text-slate-400">{s.vendor_code || '—'}</td>
                                    <td className="px-3 py-2 text-slate-300">
                                      {s.username ? `@${s.username}` : (s.user_id ? `User #${s.user_id}` : '—')}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                          isReject
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        }`}
                                      >
                                        {s.status === 'reject' ? 'REJECT' : 'SUCCESS'}
                                      </span>
                                    </td>
                                    <td className={`px-3 py-2 text-[11px] ${isReject ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                                      {s.remark || (s.status === 'reject' ? 'duplicate scan' : 'verified')}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-400 text-[11px]">
                                      {s.scanned_at ? new Date(s.scanned_at).toLocaleString('en-GB') : '—'}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={9} className="px-4 py-3 text-center text-slate-500">
                                  No scanned barcode labels found for this gate pass.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
