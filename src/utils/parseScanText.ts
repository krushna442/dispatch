export interface ParsedScan {
  format: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';
  partNo: string;
  revNo: string;
  vendorCode: string;
  partSlNo: string;
  dispatchDate: string | null;
}

function normaliseRev(raw = ''): string {
  let s = raw.replace(/rev\s*no\s*/i, '').trim();
  if (!s.startsWith('#')) s = '#' + s;
  return s.toUpperCase().replace(/\s+/g, '');
}

function isF2(text: string): boolean {
  return text.includes('$');
}

function isF4(text: string): boolean {
  return (
    text.startsWith('P') &&
    text.includes('#') &&
    !text.includes('$') &&
    /^P.+#T\d+#V\w+#/.test(text)
  );
}

function isF1orF6(text: string): boolean {
  return /rev\s*no\s*/i.test(text) && !text.includes('$');
}

function isF5(text: string): boolean {
  return (
    text.length === 28 &&
    /^[A-Z0-9]+$/i.test(text) &&
    /^[A-Z]/i.test(text[0]) &&
    text[9] === 'V' &&
    !text.startsWith('00')
  );
}

function isF3(text: string): boolean {
  const t = text.trim();
  return (
    t.startsWith('00') &&
    /^[A-Z0-9]+$/i.test(t) &&
    t.length >= 30
  );
}

function parseF1core(text: string): Omit<ParsedScan, 'format'> | null {
  const match = text.match(/^(.+?)\s*rev\s*no\s*#?([^\s]*)\s*(.+)$/i);
  if (!match) return null;

  const partNo = match[1].trim();
  const revSuffix = match[2].trim();
  const rest = match[3].trim();
  const restClean = rest.replace(/\s+/g, '');

  if (restClean.length < 12) return null;

  const sl = restClean.slice(-6);
  const year = '20' + restClean.slice(-8, -6);
  const month = restClean.slice(-10, -8);
  const vendor = restClean.slice(0, restClean.length - 10);

  const rev = revSuffix ? normaliseRev('#' + revSuffix) : '#';
  const dispatchDate = buildDate(year, month, null);

  return { partNo, revNo: rev, vendorCode: vendor, partSlNo: sl, dispatchDate };
}

function parseF1(text: string): ParsedScan | null {
  const result = parseF1core(text);
  if (!result) return null;
  return { format: 'F1', ...result };
}

function parseF2(text: string): ParsedScan | null {
  const parts = text.split('$').map((s) => s.trim());
  if (parts.length < 4) return null;

  const vendor = parts[0];
  const partNo = parts[1];
  const sl = parts[2];
  const dateRaw = parts[3];

  let revRaw = parts[6] ?? '';
  if (!revRaw || revRaw.toUpperCase() === 'NA') {
    revRaw = parts.find((p) => p.includes('#')) ?? '#';
  }
  const rev = normaliseRev(revRaw);

  let dispatchDate: string | null = null;
  if (dateRaw && dateRaw.toUpperCase() !== 'NA') {
    const [dd, mm, yyyy] = dateRaw.split('.');
    dispatchDate = buildDate(yyyy, mm, dd);
  }

  return { format: 'F2', partNo, revNo: rev, vendorCode: vendor, partSlNo: sl, dispatchDate };
}

function parseF3(text: string): ParsedScan | null {
  const t = text.trim();
  const layouts = [
    { partLen: 14, vendorLen: 6 },
    { partLen: 14, vendorLen: 7 },
    { partLen: 14, vendorLen: 8 },
  ];

  for (const { partLen, vendorLen } of layouts) {
    const total = partLen + 2 + vendorLen + 2 + 2 + 6;
    if (t.length !== total) continue;

    let offset = 0;
    const partNo = t.slice(offset, offset + partLen).replace(/^00/, ''); offset += partLen;
    const revRaw = t.slice(offset, offset + 2); offset += 2;
    const vendor = t.slice(offset, offset + vendorLen); offset += vendorLen;
    const month = t.slice(offset, offset + 2); offset += 2;
    const year = '20' + t.slice(offset, offset + 2); offset += 2;
    const sl = t.slice(offset, offset + 6);

    const rev = normaliseRev(revRaw);
    const dispatchDate = buildDate(year, month, null);

    return {
      format: 'F3',
      partNo: partNo.trim(),
      revNo: rev,
      vendorCode: vendor,
      partSlNo: sl,
      dispatchDate,
    };
  }
  return null;
}

function parseF4(text: string): ParsedScan | null {
  const segments = text.split('#').map((s) => s.trim());
  if (segments.length < 3) return null;

  const seg0 = segments[0];
  const seg1 = segments[1];
  const seg2 = segments[2];

  if (!seg0.startsWith('P') || !seg1.startsWith('T') || !seg2.startsWith('V')) return null;

  const partNo = seg0.slice(1, -1);
  const revNo = seg0.slice(-1);

  if (seg1.length < 15) return null;
  const dd = seg1.slice(1, 3);
  const mm = seg1.slice(3, 5);
  const yyyy = seg1.slice(5, 9);
  const sl = seg1.slice(9, 15);

  const vendor = seg2;
  const dispatchDate = buildDate(yyyy, mm, dd);

  return { format: 'F4', partNo, revNo, vendorCode: vendor, partSlNo: sl, dispatchDate };
}

function parseF5(text: string): ParsedScan | null {
  const t = text.trim();
  if (t.length !== 28) return null;

  const partNo = t.slice(0, 8);
  const revNo = t.slice(8, 9);
  const vendor = t.slice(9, 16);
  const dd = t.slice(16, 18);
  const mm = t.slice(18, 20);
  const year = '20' + t.slice(20, 22);
  const sl = t.slice(22, 28);

  const dispatchDate = buildDate(year, mm, dd);

  return { format: 'F5', partNo, revNo, vendorCode: vendor, partSlNo: sl, dispatchDate };
}

function parseF6(text: string): ParsedScan | null {
  const result = parseF1core(text);
  if (!result) return null;
  if (!result.vendorCode.includes('-')) return null;
  return { format: 'F6', ...result };
}

function buildDate(year: string, month: string, day: string | null): string | null {
  try {
    const y = String(year).padStart(4, '20');
    const m = String(month).padStart(2, '0');
    const d = day ? String(day).padStart(2, '0') : '01';
    if (isNaN(new Date(`${y}-${m}-${d}`).getTime())) return null;
    return `${y}-${m}-${d}`;
  } catch {
    return null;
  }
}

export function parseScanText(scannedText: string): ParsedScan | null {
  if (!scannedText) return null;
  const text = scannedText.trim();
  if (isF2(text)) return parseF2(text);
  if (isF4(text)) return parseF4(text);
  if (isF1orF6(text)) return parseF6(text) ?? parseF1(text);
  if (isF5(text)) return parseF5(text);
  if (isF3(text)) return parseF3(text);
  return null;
}
