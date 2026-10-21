/**
 * KPI workbook parser. Pure ES module; no network, DOM or implicit global XLSX.
 * Public functions accept SheetJS workbooks (sparse or dense worksheets).
 * Column indices and header row indices are zero based; sourceRow is Excel's
 * one-based row number. Numeric percentages are returned in percentage points.
 *
 * parseSheet(wb, name, { mapping, dataStartRow, headerStartRow, headerEndRow,
 *   percentScale: 'auto'|'ratio'|'percent', confirmedDate, referenceYear,
 *   duplicatePolicy: 'error'|'first'|'last' }, XLSX)
 * A mapping field is a column number, null, or { column, scale, label }.
 * Unknown groups with meaningful child headings become stable metric_* keys.
 * Weight/score columns are never interpreted as a target or a gap.
 */

const IDENTITY = ['employeeId', 'name', 'store', 'job', 'rank'];
const METRIC_FIELDS = ['actual', 'target', 'progress', 'achievement', 'gap'];
const PERCENT_FIELDS = new Set(['progress', 'achievement', 'overallProgress', 'overallAchievement']);
const REQUIRED = ['employeeId', 'name', 'store'];
const FIELD_LABELS = {
  employeeId: '員編', name: '姓名', store: '門市', job: '職稱', rank: '排名',
  overallProgress: '總進度達成率', overallAchievement: '總達成率',
  actual: '實績', target: '目標', progress: '進度達成率', achievement: '達成率', gap: '差額'
};
const KNOWN = [
  ['a1399', 'A1399', /^(?:A|AQ)(?:V\+D)?1399/, '件'],
  ['a999', 'A999', /^(?:A|AQ)(?:V\+D)?999/, '件'],
  ['r1399', 'R1399', /^(?:R|RT)(?:V\+D)?1399/, '件'],
  ['r999', 'R999', /^(?:R|RT)(?:V\+D)?999/, '件'],
  ['broadband', '寬頻／好速', /好速|寬頻/, '點'],
  ['accessories', '配件', /配件/, '元'],
  ['film', '包膜／保貼', /包膜|保貼/, '元'],
  ['insurance', '保險', /保險/, '點'],
  ['netflix', 'Netflix', /NETFLIX/, '件'],
  ['video', '影音', /HBO|DISNEY|PRIMEVIDEO|影音/, '件'],
  ['vk', 'MyVideo／KKBOX', /MYVIDEO|KKBOX|^VK$/, '件'],
  ['magazine', '天下／開通', /天下|雜誌|週刊|APPLE.*GOOGLE.*服務/, '件'],
  ['tradeIn', '舊機回收', /舊換新|舊機回收|舊機換新|回收台數/, '台'],
  ['childrenWatch', '兒童錶', /兒童[錶表]/, '台'],
  ['specialMaintenance', '特維', /特維/, '件']
];

function label(value) {
  if (value == null) return '';
  const v = isCell(value) ? value.v : value;
  if (v == null) return '';
  if (v instanceof Date) return dateISO(v);
  return String(v).normalize('NFKC').replace(/\u00a0/g, ' ').replace(/\r?\n/g, ' ').trim();
}
function compact(value) { return label(value).replace(/[\s_()（）\[\]【】]/g, '').toUpperCase(); }
function isCell(v) { return !!v && typeof v === 'object' && !(v instanceof Date) && ('v' in v || 'w' in v || 't' in v); }
function cellRaw(v) {
  if (!isCell(v)) return v instanceof Date ? dateISO(v) : v ?? null;
  return { value: v.v instanceof Date ? dateISO(v.v) : v.v ?? null, text: v.w ?? null, format: v.z ?? null, type: v.t ?? null };
}
function valueOf(v) { return isCell(v) ? v.v : v; }
function issue(code, message, details = {}) { return { code, message, ...details }; }
function addIssue(list, code, message, details = {}) {
  const i = issue(code, message, details);
  // One actionable warning per column/metric is enough for numeric ambiguity.
  const signature = `${code}|${details.column ?? ''}|${details.metricKey ?? ''}`;
  const repetitive = /PERCENT|UNKNOWN_UNIT|FORMULA_WITHOUT_VALUE/.test(code);
  if (!repetitive || !list.some(x => x._signature === signature)) {
    if (repetitive) Object.defineProperty(i, '_signature', { value: signature });
    list.push(i);
  }
}
function colName(c) {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}
function decodeCell(s) {
  const m = String(s).replace(/\$/g, '').match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  let c = 0; for (const ch of m[1].toUpperCase()) c = c * 26 + ch.charCodeAt(0) - 64;
  return { r: Number(m[2]) - 1, c: c - 1 };
}
function dimensions(ws) {
  // !ref frequently includes thousands of empty trailing TSV columns or Excel
  // formatting-only cells. Scan actual content, including dense SheetJS rows.
  const dense = ws?.['!data'] || (Array.isArray(ws) ? ws : null);
  let rows = 0, cols = 0; const rowColumns = new Map();
  const accept = (r, c, cell) => {
    if (!label(cell) && !(isCell(cell) && cell.f)) return;
    rows = Math.max(rows, r + 1); cols = Math.max(cols, c + 1);
    if (!rowColumns.has(r)) rowColumns.set(r, []);
    rowColumns.get(r).push(c);
  };
  if (dense) {
    for (const rk of Object.keys(dense)) {
      if (!/^\d+$/.test(rk) || !dense[rk]) continue;
      for (const ck of Object.keys(dense[rk])) if (/^\d+$/.test(ck)) accept(Number(rk), Number(ck), dense[rk][ck]);
    }
  } else for (const k of Object.keys(ws || {})) {
    const p = decodeCell(k); if (p) accept(p.r, p.c, ws[k]);
  }
  for (const columns of rowColumns.values()) columns.sort((a, b) => a - b);
  return { rows, cols, rowColumns, occupiedRows: [...rowColumns.keys()].sort((a, b) => a - b) };
}
function readCell(ws, r, c) {
  const dense = ws?.['!data'] || (Array.isArray(ws) ? ws : null);
  return dense ? dense[r]?.[c] ?? null : ws?.[`${colName(c)}${r + 1}`] ?? null;
}
function mergedCell(ws, r, c) {
  const direct = readCell(ws, r, c);
  if (label(direct)) return direct;
  const merge = (ws['!merges'] || []).find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
  return merge ? readCell(ws, merge.s.r, merge.s.c) : direct;
}
function identityField(s) {
  const t = compact(s).replace(/[:：]/g, '');
  if (/^(?:員編|員工編號|員工代碼|人員編號|人員代碼|同仁員編|同仁編號|EMPLOYEEID|EMPLOYEENO\.?|STAFFID|EMPID|工號)$/.test(t)) return 'employeeId';
  if (/^(?:姓名|員工姓名|同仁姓名|人員姓名|EMPLOYEENAME|STAFFNAME|NAME)$/.test(t)) return 'name';
  if (/^(?:門市|門市名稱|店點|店點名稱|店名|服務中心|服務中心名稱|營業店點名稱|營業點名稱|銷售店點名稱|STORE|STORENAME)$/.test(t)) return 'store';
  if (/^(?:職稱|店內職稱|職務|角色|ROLE|JOB)$/.test(t)) return 'job';
  if (/^(?:排名|個人排名|總排名|名次|RANK)$/.test(t)) return 'rank';
  return null;
}
function valueField(s) {
  const t = compact(s).replace(/[：:]/g, '');
  if (/權重|配重|加權|配分|得分|WEIGHT|SCORE/.test(t)) return 'ignored';
  if (/進度|PROGRESS/.test(t)) return 'progress';
  if (/達成率|完成率|ACHIEVEMENT/.test(t)) return 'achievement';
  if (/差額|差異|差距|缺口|尚差|GAP/.test(t)) return 'gap';
  if (/目標|應達|TARGET/.test(t)) return 'target';
  if (/實績|實際|累計|計件數|ACTUAL/.test(t) || /^(?:件數|點數|金額|數量|銷售數|台數)$/.test(t)) return 'actual';
  return null;
}
function overallField(labels) {
  const s = compact(labels.join(' '));
  if (/總進度|整體進度|綜合進度|OVERALLPROGRESS|TOTALPROGRESS/.test(s)) return 'overallProgress';
  if (/總達成|整體達成|OVERALLACHIEVEMENT|TOTALACHIEVEMENT/.test(s)) return 'overallAchievement';
  return null;
}
function hash(s) {
  let h = 2166136261;
  for (const ch of compact(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function metricCaption(s) {
  // Remove value-field suffixes so flat headers for one metric share one key.
  return label(s).replace(/(?:累計實績|進度達成率|進度|達成率|完成率|實績|實際|全月目標|月目標|目標|差額|差異|缺口|權重|加權得分|得分|ACTUAL|TARGET|PROGRESS|ACHIEVEMENT)(?:[\s:：]*[%％])?\s*$/i, '').trim();
}
function knownMetric(s) {
  const t = compact(s);
  if (!t || identityField(s) || overallField([s])) return null;
  for (const [key, title, re, unit] of KNOWN) if (re.test(t)) return { key, label: title, defaultUnit: unit };
  return null;
}
function genericGroup(s) {
  const t = compact(s);
  if (!t || identityField(s) || overallField([s]) || valueField(s) || /^[\d.,%+\-/]+$/.test(t)) return false;
  if (/^(?:一般項目|加減分項目?|KPI|上線數KPI|進度達成率|基本資料|人員資料|備註|權重|績效)$/.test(t)) return false;
  if (/資料日期|截止日|報表日期|統計區間|報表名稱|提醒[:：]|註[:：]/.test(t) || t.length > 65) return false;
  return true;
}
function inferredUnit(source, fallback = '未確認') {
  const s = compact(source);
  if (/點數|點$|單位[:：]?點/.test(s)) return '點';
  if (/營收|金額|面額|收入|營業額|單位[:：]?元/.test(s)) return '元';
  if (/台數|單位[:：]?台/.test(s)) return '台';
  if (/筆數|單位[:：]?筆/.test(s)) return '筆';
  if (/件數|計件|銷售數|上線數|開通數|數$|量$|續約|單位[:：]?件/.test(s)) return '件';
  if (/率$|占比|佔比|比例|百分比/.test(s)) return '%';
  return fallback;
}
function descriptor(column, text, scale = 'auto') { return { column, label: text || colName(column), scale }; }
function asDescriptor(d) {
  if (d == null || d === '' || d === -1) return null;
  if (Number.isInteger(d) && d >= 0) return descriptor(d);
  if (typeof d === 'string' && /^\d+$/.test(d)) return descriptor(Number(d));
  if (typeof d === 'object' && Number.isInteger(Number(d.column)) && Number(d.column) >= 0) return { ...d, column: Number(d.column), scale: d.scale || 'auto' };
  return null;
}
function looksLikePerson(ws, r, mapping) {
  const id = mapping.employeeId ? label(readCell(ws, r, mapping.employeeId.column)) : '';
  const name = mapping.name ? label(readCell(ws, r, mapping.name.column)) : '';
  return !!id && !!name && !identityField(id) && !identityField(name) && !/小計|合計|總計|全區|平均/.test(id) && !/[\s%]/.test(id);
}

// The observed 01-01-05 export omits all A:H identity headings. Recover its
// identity columns only after verifying independent structural signatures and
// multiple employee-shaped rows. A title or a familiar column offset alone is
// deliberately insufficient. The unknown column before rank is never used.
function recognize010105(ws, size, options) {
  if (options.profile === false) return null;
  const titleRows = size.occupiedRows.filter(r => (size.rowColumns.get(r) || []).some(c => /^上線數KPI進度達成率$/.test(compact(readCell(ws, r, c)))));
  if (!titleRows.length) return null;
  for (const groupRow of size.occupiedRows) {
    if (!titleRows.some(r => r < groupRow)) continue;
    for (const rankColumn of size.rowColumns.get(groupRow) || []) {
      if (rankColumn < 6 || identityField(readCell(ws, groupRow, rankColumn)) !== 'rank' || overallField([label(readCell(ws, groupRow, rankColumn + 1))]) !== 'overallProgress') continue;
      for (let leafRow = groupRow + 1; leafRow <= Math.min(groupRow + 5, size.rows - 1); leafRow++) {
        const blocks = [];
        for (let c = rankColumn + 2; c + 3 < size.cols; c += 4) {
          const fields = [0, 1, 2, 3].map(i => valueField(mergedCell(ws, leafRow, c + i)));
          if (fields.join('|') !== 'actual|target|ignored|progress' || !/權重|WEIGHT/.test(compact(mergedCell(ws, leafRow, c + 2)))) break;
          const caption = label(mergedCell(ws, groupRow, c));
          if (!caption || valueField(caption) || identityField(caption) || /參考件數$/.test(caption)) break;
          let section = '';
          for (let r = Math.max(0, groupRow - 8); r < groupRow; r++) {
            for (const cc of size.rowColumns.get(r) || []) {
              if (cc > c) break;
              const s = compact(readCell(ws, r, cc));
              if (/^(?:一般項目|加減分項目)$/.test(s)) section = s;
            }
          }
          blocks.push({ column: c, caption, section });
        }
        const anchorKeys = new Set(blocks.map(b => knownMetric(b.caption)?.key).filter(k => ['a999', 'r999', 'r1399'].includes(k)));
        if (blocks.length < 4 || anchorKeys.size < 2) continue;
        const identity = {
          store: descriptor(rankColumn - 5, '門市（已驗證 01-01-05 結構）'),
          job: descriptor(rankColumn - 4, '職稱（已驗證 01-01-05 結構）'),
          employeeId: descriptor(rankColumn - 3, '員編（已驗證 01-01-05 結構）'),
          name: descriptor(rankColumn - 2, '姓名（已驗證 01-01-05 結構）'),
          rank: descriptor(rankColumn, '排名')
        };
        let firstData = null, valid = 0, invalid = 0; const ids = new Set();
        for (const r of size.occupiedRows.filter(r => r > leafRow).slice(0, 24)) {
          const get = c => label(mergedCell(ws, r, c));
          const id = get(identity.employeeId.column), name = get(identity.name.column);
          if (!id && !name) continue;
          if (/^(?:合計|小計|總計|平均|全區)$/.test(id) || /^(?:合計|小計|總計|平均|全區)$/.test(name)) continue;
          const storeCode = get(rankColumn - 6), store = get(identity.store.column), role = get(identity.job.column);
          const validRow = /^[A-Z][A-Z0-9_-]{3,31}$/i.test(storeCode) && store.length >= 2 && !identityField(store)
            && /店長|業務|專員|督導|儲備|服務|銷售|顧問|主任|經理/.test(role)
            && /^[A-Z0-9][A-Z0-9._-]{3,31}$/i.test(id) && /\d/.test(id)
            && name.length >= 2 && name.length <= 50 && !identityField(name) && !/^\d+$/.test(name);
          if (validRow) { valid++; ids.add(id); firstData ??= r; } else invalid++;
        }
        if (valid < 3 || ids.size < 2 || invalid) continue;
        const notes = [];
        for (const r of size.occupiedRows.filter(r => r < groupRow)) for (const c of size.rowColumns.get(r) || []) {
          const s = label(readCell(ws, r, c));
          if (/預付卡|特維/.test(s) && /提醒|D\s*-\s*2|3\s*日|三日/i.test(s) && !notes.includes(s)) notes.push(s);
        }
        return {
          groupRow, leafRow, dataStartRow: firstData, identity, blocks,
          profile: { id: '01-01-05', label: '01-01-05 個人 KPI 報表', confidence: 'verified',
            reasons: ['報表標題、排名及總進度欄相符', `${blocks.length} 組連續實際數／目標數／權重／進度達成率欄位`, `${valid} 列人員結構通過核對；保留英數員編`], notes }
        };
      }
    }
  }
  return null;
}

function discoverHeader(ws, options, warnings) {
  const size = dimensions(ws), scan = Math.min(size.rows, options.maxHeaderRows || size.rows), cols = size.cols;
  const verified = recognize010105(ws, size, options);
  if (verified && !Number.isInteger(options.headerStartRow) && !Number.isInteger(options.headerEndRow) && !Number.isInteger(options.dataStartRow)) {
    const columns = Array.from({ length: cols }, (_, index) => ({ index, letter: colName(index), labels: [], label: colName(index) }));
    for (const [field, d] of Object.entries(verified.identity)) columns[d.column] = { index: d.column, letter: colName(d.column), labels: [FIELD_LABELS[field]], label: FIELD_LABELS[field] };
    const overallColumn = verified.identity.rank.column + 1;
    columns[overallColumn] = { index: overallColumn, letter: colName(overallColumn), labels: ['總進度達成率'], label: '總進度達成率' };
    for (const block of verified.blocks) for (let i = 0; i < 4; i++) {
      const index = block.column + i, labels = [block.caption, label(mergedCell(ws, verified.leafRow, index))];
      columns[index] = { index, letter: colName(index), labels, label: labels.join(' / ') };
    }
    return { startRow: verified.groupRow, endRow: verified.leafRow, dataStartRow: verified.dataStartRow, columns, identity: verified.identity, size, profile: verified.profile, profileBlocks: verified.blocks };
  }
  let best = { score: -1, row: 0, fields: {} };
  for (const r of size.occupiedRows.filter(r => r < scan)) {
    const fields = {};
    for (let c = 0; c < cols; c++) {
      const current = label(mergedCell(ws, r, c));
      const combined = r > 0 ? `${label(mergedCell(ws, r - 1, c))}${current}` : current;
      const field = identityField(current) || identityField(combined);
      if (field && fields[field] == null) fields[field] = descriptor(c, current);
    }
    const score = (fields.employeeId ? 5 : 0) + (fields.name ? 4 : 0) + (fields.store ? 3 : 0) + (fields.job ? 1 : 0);
    if (score > best.score) best = { score, row: r, fields };
  }
  const identity = { ...best.fields };
  for (const field of IDENTITY) if (options.mapping && field in options.mapping) identity[field] = asDescriptor(options.mapping[field]);
  let dataStart = options.dataStartRow;
  if (!Number.isInteger(dataStart)) {
    dataStart = -1;
    for (const r of size.occupiedRows.filter(r => r > best.row)) if (looksLikePerson(ws, r, identity)) { dataStart = r; break; }
    if (dataStart < 0) dataStart = Math.min(size.rows, best.row + 1);
  }
  let automaticStart = best.row;
  while (automaticStart > 0 && size.rowColumns.has(automaticStart - 1)) automaticStart--;
  for (const merge of ws['!merges'] || []) if (merge.s.r < automaticStart && merge.e.r >= best.row && merge.s.c < cols) automaticStart = merge.s.r;
  const start = Number.isInteger(options.headerStartRow) ? options.headerStartRow : automaticStart;
  const end = Number.isInteger(options.headerEndRow) ? options.headerEndRow : Math.max(start, dataStart - 1);
  const grid = [];
  for (let r = start; r <= end; r++) {
    grid.push(Array.from({ length: cols }, (_, c) => label(mergedCell(ws, r, c))));
  }
  // Tabular exports can lose merges. Fill only group headings over explicit child fields.
  for (let r = 0; r < grid.length - 1; r++) {
    let current = '';
    for (let c = 0; c < cols; c++) {
      const s = grid[r][c];
      const child = grid.slice(r + 1).some(row => METRIC_FIELDS.includes(valueField(row[c])));
      if (s) current = (knownMetric(s) || (genericGroup(s) && child)) ? s : '';
      else if (current && child) grid[r][c] = current;
    }
  }
  const columns = Array.from({ length: cols }, (_, c) => {
    const labels = [];
    for (const row of grid) if (row[c] && !labels.includes(row[c])) labels.push(row[c]);
    return { index: c, letter: colName(c), labels, label: labels.join(' / ') || colName(c) };
  });
  if (best.score < 9 && !options.mapping) addIssue(warnings, 'HEADER_NOT_FOUND', '未找到可確認的員編與姓名表頭，也未通過已知報表結構核對；請提供含完整表頭的原始報表。');
  return { startRow: start, endRow: end, dataStartRow: dataStart, columns, identity, size };
}

function discoverMapping(header, warnings) {
  const mapping = { ...header.identity, overallProgress: null, overallAchievement: null, metrics: {} };
  for (const field of IDENTITY) mapping[field] ??= null;
  const definitions = new Map();
  const knownGroups = new Map();
  const candidates = {};
  function set(field, value, target = mapping, path = field) {
    if (target[field]) {
      (candidates[path] ||= [target[field]]).push(value);
      target[field] = null;
      addIssue(warnings, 'AMBIGUOUS_COLUMN', `${path}有多個候選欄位，請於欄位設定確認。`, { field: path });
    } else if (candidates[path]) candidates[path].push(value);
    else target[field] = value;
  }
  for (const col of header.columns) {
    if (!col.labels.length || col.labels.some(identityField)) continue;
    const overall = overallField(col.labels);
    if (overall) {
      if (col.labels.some(x => valueField(x) === 'ignored')) continue;
      set(overall, descriptor(col.index, col.label)); continue;
    }
    let group = null, groupIndex = -1;
    for (let i = col.labels.length - 1; i >= 0; i--) {
      const found = knownMetric(col.labels[i]);
      if (found) { group = { ...found, sourceLabel: col.labels[i] }; groupIndex = i; break; }
    }
    let field = null;
    for (let i = col.labels.length - 1; i >= 0; i--) {
      const f = valueField(col.labels[i]);
      if (f) { field = f; break; }
    }
    if (!group && field && field !== 'ignored') {
      for (let i = col.labels.length - 2; i >= 0; i--) if (genericGroup(col.labels[i])) {
        group = { key: `metric_${hash(col.labels[i])}`, label: col.labels[i], sourceLabel: col.labels[i], defaultUnit: '未確認' };
        groupIndex = i; break;
      }
      // Flat custom headings such as「AI眼鏡銷售數 實績」are also usable.
      if (!group && col.labels.length === 1) {
        const stripped = col.labels[0].replace(/進度達成率|進度|達成率|完成率|累計實績|實績|實際|月目標|目標|差額|差異|缺口/g, '').trim();
        if (genericGroup(stripped)) group = { key: `metric_${hash(stripped)}`, label: stripped, sourceLabel: stripped, defaultUnit: '未確認' };
      }
    }
    if (!group) continue;
    // A group caption alone is not proof that the column contains actuals.
    if (groupIndex === col.labels.length - 1 && !/實績|實際|目標|進度|達成率|差額|差異|缺口|ACTUAL|TARGET|PROGRESS/i.test(col.labels.at(-1))) field = null;
    // Broad aliases can represent distinct report items, e.g. broadband count
    // and broadband points. Preserve both instead of overwriting one metric.
    const canonical = metricCaption(group.sourceLabel) || group.sourceLabel;
    const groups = knownGroups.get(group.key) || new Map();
    const canonicalKey = compact(canonical);
    if (groups.size && !groups.has(canonicalKey)) {
      const distinctKey = `${group.key}_${hash(canonical)}`;
      groups.set(canonicalKey, distinctKey);
      knownGroups.set(group.key, groups);
      group = { ...group, key: distinctKey, label: canonical };
    } else {
      const baseKey = group.key;
      if (!groups.has(canonicalKey)) groups.set(canonicalKey, baseKey);
      const resolvedKey = groups.get(canonicalKey);
      knownGroups.set(baseKey, groups);
      if (resolvedKey !== baseKey) group = { ...group, key: resolvedKey, label: canonical };
    }
    const existing = definitions.get(group.key);
    const unit = inferredUnit(canonical, group.defaultUnit);
    if (!existing) definitions.set(group.key, { key: group.key, label: group.label, sourceLabel: group.sourceLabel, unit, targetBasis: 'unknown' });
    else if (compact(existing.sourceLabel) !== compact(group.sourceLabel) && !existing.sourceLabels?.includes(group.sourceLabel)) {
      existing.sourceLabels ||= [existing.sourceLabel]; existing.sourceLabels.push(group.sourceLabel);
    }
    const metric = mapping.metrics[group.key] ||= { label: group.label, sourceLabel: group.sourceLabel, unit, actual: null, target: null, progress: null, achievement: null, gap: null };
    if (!field || field === 'ignored') continue;
    if (field === 'target') {
      const basis = /截至|應達|當日/.test(col.label) ? 'toDate' : /月目標|全月/.test(col.label) ? 'month' : 'unknown';
      metric.targetBasis = basis; definitions.get(group.key).targetBasis = basis;
    }
    set(field, descriptor(col.index, col.label), metric, `${group.key}.${field}`);
  }
  for (const def of definitions.values()) {
    const m = mapping.metrics[def.key];
    if (!METRIC_FIELDS.some(f => m[f])) addIssue(warnings, 'METRIC_FIELDS_UNMAPPED', `已找到「${def.sourceLabel}」，但無法確認實績／目標等子欄位，請手動設定。`, { metricKey: def.key });
    if (def.unit === '未確認') addIssue(warnings, 'UNKNOWN_UNIT', `「${def.sourceLabel}」未標示可確認的單位，請選擇件、點、元或其他單位。`, { metricKey: def.key });
  }
  return { mapping, metricDefinitions: [...definitions.values()], mappingCandidates: candidates };
}

function applyMapping(auto, options, warnings) {
  const mapping = { ...auto.mapping, metrics: {} }, defs = new Map(auto.metricDefinitions.map(d => [d.key, { ...d }]));
  for (const [key, m] of Object.entries(auto.mapping.metrics)) mapping.metrics[key] = { ...m };
  if (options.mapping) {
    for (const f of [...IDENTITY, 'overallProgress', 'overallAchievement']) if (f in options.mapping) mapping[f] = asDescriptor(options.mapping[f]);
    for (const [key, override] of Object.entries(options.mapping.metrics || {})) {
      if (override === null || override.enabled === false) { delete mapping.metrics[key]; defs.delete(key); continue; }
      const m = mapping.metrics[key] ||= {};
      for (const f of METRIC_FIELDS) if (f in override) m[f] = asDescriptor(override[f]);
      for (const f of ['label', 'sourceLabel', 'unit', 'targetBasis']) if (override[f] != null) m[f] = override[f];
      m.label ||= key; m.sourceLabel ||= m.label; m.unit ||= '未確認';
      defs.set(key, { ...defs.get(key), key, label: m.label, sourceLabel: m.sourceLabel, unit: m.unit, targetBasis: m.targetBasis || 'unknown' });
    }
  }
  for (const def of options.metricDefinitions || []) {
    if (mapping.metrics[def.key]) { defs.set(def.key, { ...defs.get(def.key), ...def }); Object.assign(mapping.metrics[def.key], { unit: def.unit || mapping.metrics[def.key].unit }); }
  }
  return { mapping, metricDefinitions: [...defs.values()] };
}

function parseNumeric(v, percent, scale, warnings, context) {
  const raw = valueOf(v);
  if (raw == null || raw === '' || /^(?:—|–|-|NA|N\/A|NULL|不適用|無)$/i.test(label(raw))) {
    if (isCell(v) && v.f && raw == null) addIssue(warnings, 'FORMULA_WITHOUT_VALUE', '公式儲存格沒有已計算值，請以 Excel 重新計算並儲存後上傳。', context);
    return null;
  }
  if (isCell(v) && v.t === 'e') { addIssue(warnings, 'CELL_ERROR', '來源儲存格有 Excel 錯誤，該值保留為未確認。', context); return null; }
  if (typeof raw === 'boolean' || raw instanceof Date) { addIssue(warnings, 'INVALID_NUMBER', '數值欄位含非數字內容，請確認欄位對應。', context); return null; }
  let text = String(raw).normalize('NFKC').trim();
  const explicitPercent = /%/.test(text);
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[,，\s%％]/g, '').replace(/^\((.*)\)$/, '$1');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
    addIssue(warnings, 'INVALID_NUMBER', '數值欄位含無法辨識內容，請確認欄位對應。', context); return null;
  }
  let n = Number(text) * (negative ? -1 : 1);
  if (!Number.isFinite(n)) return null;
  if (!percent || explicitPercent) return n;
  if (scale === 'ratio') return n * 100;
  if (scale === 'percent') return n;
  const format = isCell(v) ? String(v.z || '').replace(/"[^"]*"/g, '').replace(/\\./g, '') : '';
  if (typeof raw === 'number' && (format.includes('%') || (isCell(v) && /%/.test(String(v.w || ''))))) return n * 100;
  if (n === 0) return 0;
  if (Math.abs(n) <= 3) {
    addIssue(warnings, 'AMBIGUOUS_PERCENT', '百分比欄位沒有 % 格式且值介於 -3～3，無法判定是比例或百分點；請指定「比例值×100」或「已是百分比」。', context);
    return null;
  }
  addIssue(warnings, 'UNFORMATTED_PERCENT', '未帶 % 格式的數字暫以百分點顯示；請確認此欄單位，必要時調整百分比模式。', context);
  return n;
}
function stringCell(v) {
  if (isCell(v) && typeof v.v === 'number' && v.w && /^0\d+$/.test(v.w)) return v.w;
  return label(v).replace(/\\\*/g, '*');
}
function contentSignature(row) {
  return JSON.stringify([row.name, row.store, row.job, row.rank, row.overallProgress, row.overallAchievement, row.metrics]);
}

/** Normalize already mapped records. Return {rows,warnings,errors,duplicates,ok}. */
export function normalizeRows(inputRows, options = {}) {
  const warnings = [], errors = [], rows = [], duplicates = [], byId = new Map();
  const globalScale = options.percentScale || 'auto';
  for (let index = 0; index < (inputRows || []).length; index++) {
    const src = inputRows[index] || {}, sourceRow = src.sourceRow ?? index + 1;
    const row = { employeeId: stringCell(src.employeeId ?? src.empId), name: stringCell(src.name), store: stringCell(src.store), job: stringCell(src.job ?? src.role), rank: null, overallProgress: null, overallAchievement: null, metrics: {}, sourceRow, raw: {} };
    if (!row.employeeId || !row.name) {
      addIssue(warnings, 'ROW_MISSING_IDENTITY', '此列缺少員編或姓名，未納入人員清單。', { row: sourceRow }); continue;
    }
    if (!row.store) addIssue(warnings, 'ROW_MISSING_STORE', '此列缺少門市，請確認門市欄或合併儲存格。', { row: sourceRow });
    for (const f of ['employeeId', 'name', 'store', 'job', 'rank', 'overallProgress', 'overallAchievement']) row.raw[f] = cellRaw(src[f]);
    for (const f of ['rank', 'overallProgress', 'overallAchievement']) {
      const d = asDescriptor(options.mapping?.[f]);
      row[f] = parseNumeric(src[f], PERCENT_FIELDS.has(f), d?.scale === 'auto' ? globalScale : d?.scale || globalScale, warnings, { row: sourceRow, column: d?.column, field: f });
    }
    for (const [key, source] of Object.entries(src.metrics || {})) {
      const m = typeof source === 'object' && source !== null ? source : { progress: source };
      const map = options.mapping?.metrics?.[key] || {};
      const metric = { actual: null, target: null, progress: null, achievement: null, gap: null, unit: m.unit || map.unit || '未確認', targetBasis: m.targetBasis || map.targetBasis || 'unknown', raw: {} };
      for (const f of METRIC_FIELDS) {
        const d = asDescriptor(map[f]);
        metric.raw[f] = cellRaw(m[f]);
        const scale = d?.scale === 'auto' ? globalScale : d?.scale || globalScale;
        metric[f] = parseNumeric(m[f], PERCENT_FIELDS.has(f) || metric.unit === '%', scale, warnings, { row: sourceRow, column: d?.column, field: f, metricKey: key });
      }
      if (metric.target === 0) addIssue(warnings, 'ZERO_TARGET', '此項目目標為0，不由實績除以目標計算達成率；原報表有提供的進度／達成率仍保留。', { row: sourceRow, metricKey: key });
      row.metrics[key] = metric;
    }
    const existing = byId.get(row.employeeId);
    if (!existing) { byId.set(row.employeeId, { row, index: rows.length }); rows.push(row); continue; }
    const conflicting = contentSignature(existing.row) !== contentSignature(row);
    duplicates.push({ employeeId: row.employeeId, rows: [existing.row.sourceRow, sourceRow], conflicting, policy: options.duplicatePolicy || 'error' });
    if (!conflicting) { addIssue(warnings, 'DUPLICATE_IDENTICAL', '發現同員編的相同資料，已保留一列避免重複計算。', { rows: [existing.row.sourceRow, sourceRow] }); continue; }
    if (options.duplicatePolicy === 'last') {
      rows[existing.index] = row; byId.set(row.employeeId, { row, index: existing.index });
      addIssue(warnings, 'DUPLICATE_RESOLVED', '同員編資料不同，依指定設定保留最後一列。', { rows: [existing.row.sourceRow, sourceRow] });
    } else if (options.duplicatePolicy === 'first') addIssue(warnings, 'DUPLICATE_RESOLVED', '同員編資料不同，依指定設定保留第一列。', { rows: [existing.row.sourceRow, sourceRow] });
    else {
      existing.conflict = true;
      addIssue(errors, 'DUPLICATE_CONFLICT', '同員編出現不同績效資料，該員編暫不匯入，請確認工作表或明確選擇保留規則。', { rows: [existing.row.sourceRow, sourceRow] });
    }
  }
  const cleanRows = rows.filter(r => !byId.get(r.employeeId)?.conflict);
  return { rows: cleanRows, warnings, errors, duplicates, ok: errors.length === 0 };
}

function dateISO(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
function validDate(y, m, d) {
  y = Number(y); m = Number(m); d = Number(d); if (y > 0 && y < 300) y += 1911;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d ? dateISO(dt) : null;
}
function normalizedDateText(s) { return String(s).normalize('NFKC').replace(/(\d)[年月]/g, '$1/').replace(/(\d)日/g, '$1').replace(/[.\-]/g, '/'); }
function dateCellText(c, date1904) {
  if (!c) return '';
  if (valueOf(c) instanceof Date) return dateISO(valueOf(c));
  if (isCell(c) && typeof c.v === 'number' && /[ymd]/i.test(c.z || '')) {
    const origin = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    return dateISO(new Date(origin + Math.floor(c.v) * 86400000));
  }
  return label(c);
}
function detectDate(ws, header, options, workbook, warnings) {
  const rows = [];
  for (const r of header.size.occupiedRows.filter(r => r < header.dataStartRow)) {
    rows.push((header.size.rowColumns.get(r) || []).map(c => dateCellText(readCell(ws, r, c), workbook?.Workbook?.WBProps?.date1904)).join(' '));
  }
  const text = normalizedDateText(rows.join('\n'));
  const ym = text.match(/\b(20\d{2})(0[1-9]|1[0-2])\b/);
  const year = options.referenceYear || (ym ? Number(ym[1]) : null);
  const ranges = [];
  const fullRange = /(?:^|[^\d])(20\d{2}|1\d{2})\/(\d{1,2})\/(\d{1,2})\s*[~～至–—]\s*(?:(20\d{2}|1\d{2})\/)?(\d{1,2})\/(\d{1,2})(?!\d)/g;
  for (const m of text.matchAll(fullRange)) {
    const start = validDate(m[1], m[2], m[3]), end = validDate(m[4] || m[1], m[5], m[6]);
    if (start && end && start <= end) ranges.push({ start, end });
    else addIssue(warnings, 'INVALID_REPORT_DATE', '報表區間含無效日期或截止日早於起始日，請確認資料日期。');
  }
  if (!ranges.length && year) {
    const short = text.match(/(?:^|[^\d/])(\d{1,2})\/(\d{1,2})\s*[~～至–—]\s*(\d{1,2})\/(\d{1,2})(?!\d)/);
    if (short) { const start = validDate(year, short[1], short[2]), end = validDate(year, short[3], short[4]); if (start && end && start <= end) ranges.push({ start, end }); }
  }
  const tagged = [];
  const taggedRe = /(?:資料日期|資料日|統計迄日|截止日期|截止日|統計日期|報表日期|資料截止日)[^\d\n]{0,20}(20\d{2}|1\d{2})\/(\d{1,2})\/(\d{1,2})(?!\d)/g;
  for (const m of text.matchAll(taggedRe)) { const d = validDate(m[1], m[2], m[3]); if (d) tagged.push(d); else addIssue(warnings, 'INVALID_REPORT_DATE', '報表標示的資料日期無效，請手動確認。'); }
  let detectedDate = null, period = null, source = null;
  const ends = [...new Set(ranges.map(x => x.end))];
  if (ends.length === 1) { detectedDate = ends[0]; period = ranges.find(x => x.end === detectedDate); source = 'report-range'; }
  else if (ends.length > 1) addIssue(warnings, 'AMBIGUOUS_REPORT_DATE', '表頭有多組不同截止日期，請選擇本次資料截止日。');
  else if (new Set(tagged).size === 1) { detectedDate = tagged[0]; source = 'tagged-date'; }
  else if (new Set(tagged).size > 1) addIssue(warnings, 'AMBIGUOUS_REPORT_DATE', '表頭有多個資料日期，請手動確認。');
  if (detectedDate && tagged.some(d => d !== detectedDate)) addIssue(warnings, 'REPORT_DATE_MISMATCH', '報表區間截止日與標示日期不同，目前採區間截止日，請確認。');
  if (options.confirmedDate) {
    const m = normalizedDateText(options.confirmedDate).match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/), d = m && validDate(m[1], m[2], m[3]);
    if (d) { detectedDate = d; source = 'user-confirmed'; }
    else addIssue(warnings, 'INVALID_CONFIRMED_DATE', '手動指定日期無效，請使用 YYYY-MM-DD。');
  }
  if (!detectedDate) addIssue(warnings, 'DATE_NOT_FOUND', '未辨識到報表資料截止日；檔名或上傳日期不會自動視為資料日，請手動確認。');
  const dateInfo = detectedDate ? (() => {
    const [y, m, d] = detectedDate.split('-').map(Number), daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { date: detectedDate, source, month: `${y}-${String(m).padStart(2, '0')}`, elapsedDays: d, daysInMonth, calendarProgress: d / daysInMonth * 100, period };
  })() : null;
  return { detectedDate, dateInfo };
}

function prepareProfileDefinitions(header, mapping, definitions) {
  if (!header.profile) return;
  for (const def of definitions) {
    const metric = mapping.metrics[def.key];
    const block = header.profileBlocks.find(b => b.column === metric?.actual?.column);
    if (!block) continue;
    const caption = compact(block.caption);
    // In this verified report these are numerator/denominator COUNTS. The
    // progress cell contains the resulting ratio, not attainment of a target.
    const ratio = block.section === '加減分項目' && /^RT[升降]轉率/.test(caption);
    if (ratio || /^解約後NPOUT/.test(caption) || /^DS-AQNP$/.test(caption) || /^RT[升降]轉率.*(?:件數|轉數)/.test(caption)) def.unit = metric.unit = '件';
    def.calculation = 'source-only';
    if (ratio) { def.progressKind = 'ratio'; def.reminderEligible = false; }
  }
}

function profileBasisEvidence(header, definitions, mapping, rows, dateInfo, warnings) {
  if (!header.profile) return null;
  const referenceKeys = ['a999', 'r999', 'r1399'];
  const samplesFor = keys => {
    const samples = [];
    for (const [person, row] of rows.entries()) for (const key of keys) {
      const m = row.metrics[key];
      if (!m || !Number.isFinite(m.actual) || m.actual < 0 || !Number.isFinite(m.target) || m.target <= 0
        || !Number.isFinite(m.progress) || m.progress <= 0 || m.progress >= 250) continue;
      samples.push({ key, person, actual: m.actual, target: m.target, progress: m.progress });
    }
    return samples;
  };
  const summary = samples => ({ sampleCount: samples.length, metricCount: new Set(samples.map(s => s.key)).size, employeeCount: new Set(samples.map(s => s.person)).size });
  const samples = samplesFor(referenceKeys), counts = summary(samples);
  const evidence = { basis: 'unknown', ...counts, maxErrorPercentagePoints: null, reason: '' };
  const reliableDate = dateInfo && !warnings.some(w => /INVALID_REPORT_DATE|AMBIGUOUS_REPORT_DATE|REPORT_DATE_MISMATCH/.test(w.code))
    && (!dateInfo.period || dateInfo.period.start === `${dateInfo.month}-01`);
  const prediction = (s, basis) => s.actual / s.target * 100 * (basis === 'month' ? dateInfo.daysInMonth / dateInfo.elapsedDays : 1);
  const check = (observations, basis) => {
    const errors = observations.map(s => Math.abs(prediction(s, basis) - s.progress));
    return { matches: observations.length > 0 && observations.every((s, i) => errors[i] <= Math.max(0.15, Math.abs(s.progress) * 0.0005)), maxError: errors.length ? Math.max(...errors) : null };
  };
  if (!reliableDate) evidence.reason = '缺少可確認的整月起始區間或資料截止日，未推定目標基準。';
  else if (counts.sampleCount < 3 || counts.metricCount < 2 || counts.employeeCount < 2) evidence.reason = '未取得至少 3 筆、跨 2 項 KPI 及 2 位人員的未封頂原表進度，未推定目標基準。';
  else {
    const monthly = check(samples, 'month'), toDate = check(samples, 'toDate');
    if (monthly.matches !== toDate.matches) {
      evidence.basis = monthly.matches ? 'month' : 'toDate';
      evidence.maxErrorPercentagePoints = (monthly.matches ? monthly : toDate).maxError;
      evidence.reason = `${counts.sampleCount} 筆 A999／R999／R1399 原表進度與${evidence.basis === 'month' ? '整月目標按資料日進度' : '截至資料日目標'}一致；已排除 0% 及 250% 封頂值。`;
    } else evidence.reason = monthly.matches ? '整月及截至當日兩種基準均吻合，現有資料無法區分。' : '原表進度未一致吻合整月或截至當日基準，保留原值並請確認。';
  }
  for (const def of definitions) {
    const metric = mapping.metrics[def.key], block = header.profileBlocks.find(b => b.column === metric?.actual?.column);
    const values = rows.map(r => r.metrics[def.key]).filter(Boolean);
    def.active = values.some(m => Number.isFinite(m.progress) || Number.isFinite(m.achievement) || (Number.isFinite(m.target) && m.target > 0));
    def.reminderEligible = def.active && def.progressKind !== 'ratio';
    const isReverseOrAdjustment = /自退|解約後\s*NP\s*OUT/i.test(def.sourceLabel) || block?.section === '加減分項目';
    const metricSamples = samplesFor([def.key]);
    const metricCounts = summary(metricSamples);
    const linear = evidence.basis !== 'unknown' && def.unit !== '%' && !isReverseOrAdjustment
      && metricCounts.sampleCount >= 3 && metricCounts.employeeCount >= 2 && check(metricSamples, evidence.basis).matches;
    def.calculation = linear ? 'linear' : 'source-only';
    def.targetBasis = linear ? evidence.basis : 'unknown';
    metric.targetBasis = def.targetBasis;
    if (linear) def.basisEvidence = { basis: evidence.basis, ...metricCounts, maxErrorPercentagePoints: check(metricSamples, evidence.basis).maxError };
    for (const row of rows) if (row.metrics[def.key]) row.metrics[def.key].targetBasis = def.targetBasis;
  }
  header.profile.basisEvidence = evidence;
  if (evidence.basis === 'unknown') addIssue(warnings, 'TARGET_BASIS_UNCONFIRMED', evidence.reason);
  return evidence;
}

/** Parse one sheet. Mapping overrides are explicit and never depend on legacy column offsets. */
export function parseSheet(workbook, sheetName, options = {}, XLSX) { // XLSX is optional by design.
  const ws = workbook?.Sheets?.[sheetName];
  if (!ws) return { ok: false, sheetName, rows: [], preview: [], metricDefinitions: [], mapping: { metrics: {} }, warnings: [], errors: [issue('SHEET_NOT_FOUND', '找不到指定工作表。')], duplicates: [], detectedDate: null, dateInfo: null };
  const warnings = [], errors = [];
  const header = discoverHeader(ws, options, warnings);
  const auto = discoverMapping(header, warnings);
  const { mapping, metricDefinitions } = applyMapping(auto, options, warnings);
  prepareProfileDefinitions(header, mapping, metricDefinitions);
  // Once a user supplies an unambiguous override, remove the resolved warning.
  for (let i = warnings.length - 1; i >= 0; i--) {
    const w = warnings[i];
    if (w.code === 'AMBIGUOUS_COLUMN' && w.field) {
      const parts = w.field.split('.');
      const d = parts.length === 2 ? options.mapping?.metrics?.[parts[0]]?.[parts[1]] : options.mapping?.[w.field];
      if (asDescriptor(d)) warnings.splice(i, 1);
    } else if (w.code === 'UNKNOWN_UNIT' && metricDefinitions.find(m => m.key === w.metricKey)?.unit !== '未確認') warnings.splice(i, 1);
    else if (w.code === 'METRIC_FIELDS_UNMAPPED' && METRIC_FIELDS.some(f => mapping.metrics[w.metricKey]?.[f])) warnings.splice(i, 1);
  }
  const checkColumn = (d, field) => {
    const column = asDescriptor(d)?.column;
    if (column != null && column >= header.size.cols) errors.push(issue('COLUMN_OUT_OF_RANGE', `「${field}」指定欄位超出工作表範圍，請重新選擇。`, { field, column }));
  };
  for (const f of [...IDENTITY, 'overallProgress', 'overallAchievement']) checkColumn(mapping[f], f);
  for (const [key, m] of Object.entries(mapping.metrics)) for (const f of METRIC_FIELDS) checkColumn(m[f], `${key}.${f}`);
  for (const f of options.requiredFields || REQUIRED) if (!asDescriptor(mapping[f])) errors.push(issue('MISSING_COLUMN', `未辨識到「${FIELD_LABELS[f] || f}」欄位，請手動設定後再匯入。`, { field: f }));
  if (!mapping.overallProgress) addIssue(warnings, 'MISSING_OVERALL_PROGRESS', '未辨識到總進度欄位，無法依總進度判定80%／100%門檻；請設定欄位或僅檢閱個別項目。');
  if (!metricDefinitions.length) addIssue(warnings, 'NO_METRICS', '未辨識到 KPI 群組，請檢查表頭範圍或手動新增項目欄位。');
  const { detectedDate, dateInfo } = detectDate(ws, header, options, workbook, warnings);
  const mappedRows = [];
  const get = (r, d, merged = false) => { d = asDescriptor(d); return d ? (merged ? mergedCell(ws, r, d.column) : readCell(ws, r, d.column)) : null; };
  if (!errors.length) {
    for (let r = header.dataStartRow; r < header.size.rows; r++) {
      const id = stringCell(get(r, mapping.employeeId)), name = stringCell(get(r, mapping.name));
      if (!id && !name) continue;
      if (identityField(id) || identityField(name) || /^(?:合計|小計|總計|平均|全區)$/.test(id) || /^(?:合計|小計|總計|平均|全區)$/.test(name)) continue;
      const row = { employeeId: get(r, mapping.employeeId), name: get(r, mapping.name), store: get(r, mapping.store, true), job: get(r, mapping.job, true), rank: get(r, mapping.rank), overallProgress: get(r, mapping.overallProgress), overallAchievement: get(r, mapping.overallAchievement), metrics: {}, sourceRow: r + 1 };
      for (const def of metricDefinitions) {
        const m = mapping.metrics[def.key]; if (!m) continue;
        row.metrics[def.key] = { unit: def.unit, targetBasis: m.targetBasis || def.targetBasis || 'unknown' };
        for (const f of METRIC_FIELDS) row.metrics[def.key][f] = get(r, m[f]);
      }
      mappedRows.push(row);
    }
  }
  const result = normalizeRows(mappedRows, { ...options, mapping });
  warnings.push(...result.warnings); errors.push(...result.errors);
  const basisEvidence = profileBasisEvidence(header, metricDefinitions, mapping, result.rows, dateInfo, warnings);
  if (!result.rows.length && !errors.length) errors.push(issue('NO_PERSON_ROWS', '未找到可匯入的人員資料，請確認工作表、表頭與資料起始列。'));
  const publicHeader = { startRow: header.startRow, endRow: header.endRow, dataStartRow: header.dataStartRow, columns: header.columns };
  return { ok: errors.length === 0, sheetName, header: publicHeader, mapping, mappingCandidates: auto.mappingCandidates, metricDefinitions, rows: result.rows, preview: result.rows.slice(0, options.previewLimit ?? 5), rowCount: result.rows.length, detectedDate, dateInfo, profile: header.profile || null, basisEvidence, warnings, errors, duplicates: result.duplicates, requiresReview: errors.length > 0 || warnings.some(w => /AMBIGUOUS|MISSING|UNMAPPED|DATE_NOT_FOUND|UNKNOWN_UNIT|TARGET_BASIS_UNCONFIRMED/.test(w.code)) };
}

/** Inspect every worksheet, returning selectable candidate sheets plus safe previews. */
export function inspectWorkbook(workbook, XLSX, options = {}) {
  const sheets = (workbook?.SheetNames || Object.keys(workbook?.Sheets || {})).map(sheetName => {
    const parsed = parseSheet(workbook, sheetName, options, XLSX);
    const score = parsed.rows.length * 2 + parsed.metricDefinitions.length * 3 + (parsed.mapping?.employeeId ? 20 : 0) + (parsed.mapping?.overallProgress ? 10 : 0) - parsed.errors.length * 15;
    return { ...parsed, candidate: !!parsed.mapping?.employeeId && !!parsed.mapping?.name, score };
  });
  const candidates = sheets.filter(s => s.candidate).sort((a, b) => b.score - a.score);
  const warnings = [];
  if (!sheets.length) warnings.push(issue('EMPTY_WORKBOOK', '活頁簿沒有工作表。'));
  if (candidates.length > 1) warnings.push(issue('MULTIPLE_CANDIDATE_SHEETS', '找到多張可能的人員績效工作表，請確認要匯入的頁籤。'));
  return { sheets, candidates: candidates.map(s => s.sheetName), recommendedSheet: candidates[0]?.sheetName || sheets[0]?.sheetName || null, warnings };
}
