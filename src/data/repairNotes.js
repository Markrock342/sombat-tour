/** Compose / parse structured repair notes stored in repair.r_repair_list */

const LABELS = {
  symptom: 'อาการ',
  location: 'สถานที่',
  parts: 'อะไหล่',
  action: 'ดำเนินการ',
  type: 'ประเภท',
};

export const REPAIR_TYPES = [
  { key: 'normal', label: 'ซ่อมปกติ' },
  { key: 'breakdown', label: 'เสียกลางทาง' },
  { key: 'offsite', label: 'งานนอกพื้นที่' },
];

export function composeRepairList({ type, symptom, location, parts, action }) {
  const lines = [];
  const typeLabel = REPAIR_TYPES.find((t) => t.key === type)?.label;
  if (typeLabel && type !== 'normal') lines.push(`${LABELS.type}: ${typeLabel}`);
  if (symptom?.trim()) lines.push(`${LABELS.symptom}: ${symptom.trim()}`);
  if (location?.trim()) lines.push(`${LABELS.location}: ${location.trim()}`);
  if (parts?.trim()) lines.push(`${LABELS.parts}: ${parts.trim()}`);
  if (action?.trim()) lines.push(`${LABELS.action}: ${action.trim()}`);
  return lines.join('\n');
}

export function parseRepairList(text) {
  const raw = (text || '').trim();
  const empty = { type: 'normal', symptom: '', location: '', parts: '', action: '', raw };
  if (!raw) return empty;

  const result = { ...empty };
  const known = Object.values(LABELS);
  const hasStructured = known.some((l) => raw.includes(`${l}:`));
  if (!hasStructured) {
    result.symptom = raw;
    return result;
  }

  const lines = raw.split('\n');
  let currentKey = null;
  const buckets = { type: [], symptom: [], location: [], parts: [], action: [] };

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
      buckets.symptom.push(line.trim());
    }
  }

  result.symptom = buckets.symptom.filter(Boolean).join('\n');
  result.location = buckets.location.filter(Boolean).join('\n');
  result.parts = buckets.parts.filter(Boolean).join('\n');
  result.action = buckets.action.filter(Boolean).join('\n');

  const typeText = buckets.type.filter(Boolean).join(' ');
  const found = REPAIR_TYPES.find((t) => typeText.includes(t.label));
  if (found) result.type = found.key;
  else if (/เสียกลางทาง|roadside|breakdown/i.test(raw)) result.type = 'breakdown';
  else if (/นอกพื้นที่|offsite/i.test(raw)) result.type = 'offsite';

  return result;
}

export function repairListSections(text) {
  const p = parseRepairList(text);
  const sections = [];
  if (p.symptom) sections.push({ label: LABELS.symptom, value: p.symptom });
  if (p.location) sections.push({ label: LABELS.location, value: p.location });
  if (p.parts) sections.push({ label: LABELS.parts, value: p.parts });
  if (p.action) sections.push({ label: LABELS.action, value: p.action });
  if (!sections.length && p.raw) sections.push({ label: 'รายการซ่อม', value: p.raw });
  return sections;
}
