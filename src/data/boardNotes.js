/** Compose / parse structured board notes stored in board.body (+ department as zone) */

export const BOARD_ZONES = ['พระราม 5', 'งานนอกพื้นที่', 'อู่', 'ต่างจังหวัด', 'อื่นๆ'];

export const BOARD_STATUSES = [
  { key: 'wait', label: 'รอ' },
  { key: 'doing', label: 'กำลังทำ' },
  { key: 'parts', label: 'รออะไหล่' },
  { key: 'done', label: 'เสร็จ' },
];

const LABELS = {
  status: 'สถานะ',
  tech: 'ช่าง',
  techId: 'ช่างID',
  problem: 'ปัญหา',
  location: 'สถานที่',
  parts: 'อะไหล่',
  note: 'หมายเหตุ',
};

export function composeBoardBody({
  status,
  techId,
  techName,
  problem,
  location,
  parts,
  note,
}) {
  const lines = [];
  const statusLabel = BOARD_STATUSES.find((s) => s.key === status)?.label || status || '';
  if (statusLabel) lines.push(`${LABELS.status}: ${statusLabel}`);
  if (techId) lines.push(`${LABELS.techId}: ${techId}`);
  if (techName) lines.push(`${LABELS.tech}: ${techName}`);
  if (problem?.trim()) lines.push(`${LABELS.problem}: ${problem.trim()}`);
  if (location?.trim()) lines.push(`${LABELS.location}: ${location.trim()}`);
  if (parts?.trim()) lines.push(`${LABELS.parts}: ${parts.trim()}`);
  if (note?.trim()) lines.push(`${LABELS.note}: ${note.trim()}`);
  return lines.join('\n');
}

export function parseBoardBody(text) {
  const raw = (text || '').trim();
  const empty = {
    status: 'wait',
    techId: '',
    techName: '',
    problem: '',
    location: '',
    parts: '',
    note: '',
    raw,
  };
  if (!raw) return empty;

  const result = { ...empty };
  const known = Object.values(LABELS);
  const hasStructured = known.some((l) => raw.includes(`${l}:`));
  if (!hasStructured) {
    result.problem = raw;
    return result;
  }

  const lines = raw.split('\n');
  let currentKey = null;
  const buckets = {
    status: [],
    tech: [],
    techId: [],
    problem: [],
    location: [],
    parts: [],
    note: [],
  };

  for (const line of lines) {
    let matched = false;
    for (const [key, label] of Object.entries(LABELS)) {
      if (line.startsWith(`${label}:`)) {
        currentKey = key;
        const rest = line.slice(label.length + 1).trim();
        if (rest) buckets[key].push(rest);
        matched = true;
        break;
      }
    }
    if (!matched && currentKey) {
      buckets[currentKey].push(line.trim());
    } else if (!matched && !currentKey) {
      buckets.problem.push(line.trim());
    }
  }

  const statusText = buckets.status.filter(Boolean).join(' ');
  const found = BOARD_STATUSES.find((s) => statusText.includes(s.label) || statusText === s.key);
  result.status = found ? found.key : 'wait';
  result.techId = buckets.techId.filter(Boolean).join(' ').trim();
  result.techName = buckets.tech.filter(Boolean).join(' ').trim();
  result.problem = buckets.problem.filter(Boolean).join('\n');
  result.location = buckets.location.filter(Boolean).join('\n');
  result.parts = buckets.parts.filter(Boolean).join('\n');
  result.note = buckets.note.filter(Boolean).join('\n');
  return result;
}

export function statusBadgeColor(statusKey) {
  switch (statusKey) {
    case 'doing':
      return '#2E4A8A';
    case 'parts':
      return '#C9A227';
    case 'done':
      return '#1FA97A';
    default:
      return '#6B7693';
  }
}

export function groupNotesByZone(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const zone = (row.department || '').trim() || 'อื่นๆ';
    if (!map.has(zone)) map.set(zone, []);
    map.get(zone).push(row);
  }
  // pinned already sorted by API; keep zone order: known zones first
  const ordered = [];
  for (const z of BOARD_ZONES) {
    if (map.has(z)) {
      ordered.push({ zone: z, notes: map.get(z) });
      map.delete(z);
    }
  }
  for (const [zone, notes] of map.entries()) {
    ordered.push({ zone, notes });
  }
  return ordered;
}
