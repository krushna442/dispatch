import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertOctagon,
  Volume2,
  VolumeX,
  Truck,
  Search,
  Send,
  Loader2,
} from 'lucide-react';

interface DespatchPlan {
  id: number;
  part_number: string;
  quantity: number;
  balance_quantity: number;
  scanned_quantity: number;
  status: 'pending' | 'completed';
  plan_date: string;
  gate_pass_number?: string | null;
}

interface LastScanResult {
  success: boolean;
  message: string;
  partNo?: string;
  vendorCode?: string;
  partSlNo?: string;
  dispatchDate?: string | null;
  format?: string;
  time: string;
}

// Synthesize audio using Web Audio API so it works without external audio files
function playBeep(success: boolean) {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (success) {
      // Pleasant high double beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.15);

      // Second pip
      setTimeout(() => {
        try {
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1174.66, audioCtx.currentTime); // D6
          gain2.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
          osc2.start(audioCtx.currentTime);
          osc2.stop(audioCtx.currentTime + 0.15);
        } catch {
          // ignore
        }
      }, 100);
    } else {
      // Low buzzy error sound
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.35);
    }
  } catch {
    // AudioContext not allowed or failed
  }
}

export default function ScanPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<DespatchPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Scan input & processing
  const [scanInput, setScanInput] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [lastScan, setLastScan] = useState<LastScanResult | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Camera Scanner
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCameraBusyRef = useRef(false);

  // Gate Pass
  const [gatePassNumber, setGatePassNumber] = useState('');
  const [isSubmittingGatePass, setIsSubmittingGatePass] = useState(false);

  // Table pagination & search
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const scanInputRef = useRef<HTMLInputElement>(null);

  const fetchPlans = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await api.get(`/api/plans?date=${today}`);
      if (Array.isArray(data)) {
        setPlans(data);
      }
    } catch (err: unknown) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    // Auto-focus the scan input so barcode scanners work immediately
    scanInputRef.current?.focus();
  }, []);

  // Real-time updates
  useSocket('despatch:scan', () => {
    fetchPlans();
  });
  useSocket('despatch:plans-changed', () => {
    fetchPlans();
  });
  useSocket('despatch:gatepass', () => {
    fetchPlans();
  });

  // Handle Scan Submission
  const processScan = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    setIsProcessingScan(true);
    try {
      const res = await api.post('/api/scan', { raw_scan_text: text });

      if (soundEnabled) playBeep(true);

      const parsed = res.parsed;
      const successResult: LastScanResult = {
        success: true,
        message: `Part verified & balance decremented!`,
        partNo: parsed?.partNo,
        vendorCode: parsed?.vendorCode,
        partSlNo: parsed?.partSlNo,
        dispatchDate: parsed?.dispatchDate,
        format: parsed?.format,
        time: new Date().toLocaleTimeString(),
      };
      setLastScan(successResult);
      toast.success(`Scanned ${parsed?.partNo || 'Part'} successfully!`);
      setScanInput('');
      fetchPlans();
    } catch (err: unknown) {
      if (soundEnabled) playBeep(false);

      const errMsg = err instanceof Error ? err.message : 'Scan verification failed';
      const failResult: LastScanResult = {
        success: false,
        message: errMsg,
        time: new Date().toLocaleTimeString(),
      };
      setLastScan(failResult);
      toast.error(errMsg);
    } finally {
      setIsProcessingScan(false);
      // Keep scan input focused
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 50);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processScan(scanInput);
    }
  };

  // Toggle Camera Scanner
  const stopCamera = async () => {
    isCameraBusyRef.current = true;
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Camera stop error:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraOpen(false);
    scanInputRef.current?.focus();
  };

  const startCamera = async () => {
    if (isCameraOpen) {
      await stopCamera();
      return;
    }

    setIsCameraOpen(true);
    isCameraBusyRef.current = false;
    try {
      // Delay slightly for container element to render
      setTimeout(async () => {
        try {
          const qrCode = new Html5Qrcode('reader');
          html5QrCodeRef.current = qrCode;

          await qrCode.start(
            { facingMode: 'environment' },
            {
              fps: 15,
              qrbox: { width: 280, height: 180 },
            },
            async (decodedText) => {
              // Only scan 1 time. Guard against rapid subsequent frames
              if (isCameraBusyRef.current) return;
              isCameraBusyRef.current = true;

              // Immediately auto-close camera after single scan
              await stopCamera();

              // Process scan (whether success or fail)
              processScan(decodedText);
            },
            () => {
              // scan failure callback (silent)
            }
          );
        } catch (innerErr) {
          console.error('Camera init error:', innerErr);
          toast.error('Unable to start camera. Please check browser permissions.');
          setIsCameraOpen(false);
        }
      }, 250);
    } catch (err) {
      console.error('Camera start error:', err);
      toast.error('Unable to start camera. Check browser permissions.');
      setIsCameraOpen(false);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Handle Gate Pass Submission
  const handleSubmitGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatePassNumber.trim()) {
      toast.error('Please enter a Gate Pass Number');
      return;
    }

    const completedCount = plans.filter((p) => p.balance_quantity === 0 && !p.gate_pass_number).length;
    if (completedCount === 0) {
      toast.error('No completed parts (balance = 0) available to dispatch');
      return;
    }

    setIsSubmittingGatePass(true);
    try {
      const res = await api.post('/api/gatepass', {
        gate_pass_number: gatePassNumber.trim(),
      });
      toast.success(
        `Gate Pass ${gatePassNumber.trim()} generated for ${res.gatePass?.total_parts || completedCount} part(s)!`
      );
      setGatePassNumber('');
      fetchPlans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit Gate Pass');
    } finally {
      setIsSubmittingGatePass(false);
    }
  };

  // Filtered rows
  const filteredPlans = useMemo(() => {
    return plans.filter((p) =>
      p.part_number.toLowerCase().includes(searchQuery.toLowerCase())
    );
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
    plans.forEach((p) => {
      totalQty += Number(p.quantity) || 0;
      totalBal += Number(p.balance_quantity) || 0;
    });
    return { totalQty, totalBal };
  }, [plans]);

  // Completed parts count ready for gate pass
  const readyToDispatchCount = useMemo(() => {
    return plans.filter((p) => p.balance_quantity === 0 && !p.gate_pass_number).length;
  }, [plans]);

  return (
    <div className="space-y-6">
      {/* Top Scan Bar Container — Styled matching Reference Image 2 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Main Scan Input with Camera Icon */}
          <div className="relative flex-1">
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isProcessingScan}
              placeholder="Scan QR / Barcode here (or type & press Enter)..."
              className="w-full pl-4 pr-12 py-2.5 sm:py-3 rounded-xl bg-slate-800 border-2 border-teal-500/40 text-white placeholder-slate-400 text-xs sm:text-sm font-mono tracking-wider focus:outline-none focus:border-teal-400 shadow-inner"
            />
            <button
              type="button"
              onClick={isCameraOpen ? stopCamera : startCamera}
              title={isCameraOpen ? 'Close Camera' : 'Open Camera Scanner'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-teal-400 hover:text-white hover:bg-teal-600/30 transition-colors cursor-pointer"
            >
              {isCameraOpen ? <CameraOff className="w-5 h-5 text-red-400" /> : <Camera className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Add Button */}
            <button
              onClick={() => processScan(scanInput)}
              disabled={isProcessingScan || !scanInput.trim()}
              className="flex-1 sm:flex-none px-6 py-2.5 sm:py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-teal-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessingScan ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Add
            </button>

            {/* Sound Mute/Unmute Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Scan Sound' : 'Enable Scan Sound'}
              className="p-2.5 sm:p-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-teal-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
            </button>
          </div>
        </div>

        {/* Assigned Customer Info Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-slate-400 pt-1 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>
              Assigned Vendor Code:{' '}
              <strong className="text-teal-400 font-mono">
                {user?.vendor_code || 'All (Admin)'}
              </strong>
            </span>
            {user?.customer_name && (
              <span>
                Customer: <strong className="text-white">{user.customer_name}</strong>
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">
            Auto-submits on barcode Enter. Camera or USB scanner supported.
          </span>
        </div>

        {/* Camera Scanner Container */}
        {isCameraOpen && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-400 flex items-center gap-2">
                <Camera className="w-4 h-4" /> Live Camera Scanner Active
              </span>
              <button
                onClick={stopCamera}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                Close Camera
              </button>
            </div>
            <div id="reader" className="w-full max-w-md mx-auto overflow-hidden rounded-lg" />
          </div>
        )}

        {/* Last Scan Status Banner */}
        {lastScan && (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
              lastScan.success
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/40 border-red-500/40 text-red-200'
            }`}
          >
            {lastScan.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {lastScan.success ? 'Scan Verified & Accepted' : 'Scan Rejected'}
                </span>
                <span className="text-[11px] opacity-75 font-mono">{lastScan.time}</span>
              </div>
              <p className="text-slate-300">{lastScan.message}</p>
              {lastScan.success && (
                <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1 font-mono">
                  <span>Part: <strong className="text-teal-300">{lastScan.partNo}</strong></span>
                  <span>Vendor: <strong className="text-slate-200">{lastScan.vendorCode}</strong></span>
                  <span>Serial: <strong className="text-slate-200">{lastScan.partSlNo}</strong></span>
                  {lastScan.format && <span>Format: <strong className="text-slate-200">{lastScan.format}</strong></span>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Table Card — Styled matching Reference Image 2 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Table Filter Controls */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Part Number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <table className="w-full text-left text-xs border-collapse min-w-[440px]">
            <thead>
              <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-300">
                <th className="px-4 sm:px-6 py-2.5 sm:py-3 font-semibold w-1/3">Part Number</th>
                <th className="px-4 sm:px-6 py-2.5 sm:py-3 font-semibold text-right w-1/3">Quantity</th>
                <th className="px-4 sm:px-6 py-2.5 sm:py-3 font-semibold text-right w-1/3">Balance Quantity</th>
              </tr>
            </thead>
            <tbody>
              {/* Data Rows */}
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
                    Loading scan list...
                  </td>
                </tr>
              ) : paginatedPlans.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    No part numbers found for today's plan.
                  </td>
                </tr>
              ) : (
                paginatedPlans.map((plan) => {
                  const isZero = plan.balance_quantity === 0;

                  return (
                    <tr
                      key={plan.id}
                      className="border-b border-slate-800/80 hover:bg-slate-800/20 transition-colors"
                    >
                      {/* Part Number */}
                      <td className="px-6 py-3 font-bold font-mono text-sm text-white tracking-wide">
                        {plan.part_number}
                      </td>

                      {/* Quantity */}
                      <td className="px-6 py-3 text-right font-bold text-sm text-slate-200">
                        {plan.quantity}
                      </td>

                      {/* Balance Quantity (Reference Image 2: Green if 0, Orange if > 0) */}
                      <td
                        className={`px-6 py-3 text-right font-extrabold text-sm transition-colors ${
                          isZero
                            ? 'bg-emerald-600/90 text-white'
                            : 'bg-amber-500/90 text-slate-950'
                        }`}
                      >
                        {plan.balance_quantity}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Total Summary Row (Reference Image 2: Cyan background) */}
              <tr className="bg-cyan-500 text-slate-950 font-bold border-t-2 border-cyan-400">
                <td className="px-6 py-3 text-left font-bold text-sm uppercase tracking-wider">
                  Total -
                </td>
                <td className="px-6 py-3 text-right font-extrabold text-base">
                  {totals.totalQty}
                </td>
                <td className="px-6 py-3 text-right font-extrabold text-base">
                  {totals.totalBal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
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

      {/* Bottom Gate Pass Section — Styled matching Reference Image 2 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-teal-400 shrink-0" />
            Complete Vehicle Dispatch
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Parts with balance quantity <strong>0</strong> will be loaded into the vehicle under this Gate Pass.
            {readyToDispatchCount > 0 && (
              <span className="mt-1 sm:mt-0 sm:ml-2 inline-block px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                {readyToDispatchCount} part(s) ready to dispatch
              </span>
            )}
          </p>
        </div>

        <form
          onSubmit={handleSubmitGatePass}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto"
        >
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={gatePassNumber}
              onChange={(e) => setGatePassNumber(e.target.value)}
              placeholder="Enter Gate Pass Number"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingGatePass || readyToDispatchCount === 0 || !gatePassNumber.trim()}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-teal-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            {isSubmittingGatePass ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
