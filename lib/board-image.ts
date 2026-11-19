export type ImageBoard = {
  name: string;
  data: {
    groups: {id: string; name: string; color: string}[];
    tasks: {groupId: string; title: string; description: string; color: string}[];
  };
};
type MeasureText = (text: string, size: number, bold: boolean) => number;
type ImageTask = ImageBoard['data']['tasks'][number];
type TextBlock = {lines: string[]; size: number; lineHeight: number; bold: boolean};
type PlannedTask = {task: ImageTask; title: TextBlock; detail: TextBlock; height: number};
export type BoardImage = {
  svg: string; width: number; height: number; groupCount: number; taskCount: number; fileBaseName: string;
};
export type BoardImageFile = Omit<BoardImage, 'svg'> & {blob: Blob; format: 'PNG' | 'SVG'};

const FONT = 'Arial, "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif';
const GROUP_WIDTH = 320, GAP = 24, PADDING = 32, CARD_PADDING = 14;
const xml = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const safeColor = (color: string, fallback = '#ffffff') => /^#[\da-f]{6}$/i.test(color) ? color : fallback;
function foreground(color: string) {
  const rgb = color.slice(1).match(/../g)!.map(value => parseInt(value, 16));
  return rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 150 ? '#172235' : '#f1f5ff';
}

// Explicit newlines and grapheme clusters are retained; no ellipsis or line limit.
export function wrapImageText(text: string, width: number, size: number, bold: boolean, measure: MeasureText): string[] {
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', {granularity: 'grapheme'}) : null;
  const lines: string[] = [];
  for (const paragraph of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    const characters = segmenter ? Array.from(segmenter.segment(paragraph), part => part.segment) : Array.from(paragraph);
    for (const character of characters) {
      const next = line + character;
      if (line && measure(next, size, bold) > width) {lines.push(line); line = character;}
      else line = next;
    }
    lines.push(line);
  }
  return lines;
}

// The image is laid out from saved data, independent of screen size, scroll,
// collapsed regions, free-layout overlap, and any transient dragging styles.
export function buildBoardImage(board: ImageBoard, now: Date, measure: MeasureText): BoardImage {
  const buckets = new Map<string, ImageTask[]>();
  for (const group of board.data.groups) buckets.set(group.id, []);
  const ungrouped: ImageTask[] = [];
  for (const task of board.data.tasks) {
    const bucket = buckets.get(task.groupId);
    if (bucket) bucket.push(task); else ungrouped.push(task);
  }
  const groups = board.data.groups.map(group => ({...group, tasks: buckets.get(group.id)!}));
  if (ungrouped.length) groups.push({id: '', name: '未分類', color: '#dbeafe', tasks: ungrouped});
  const columns = Math.max(1, Math.min(4, groups.length));
  const width = PADDING * 2 + columns * GROUP_WIDTH + (columns - 1) * GAP;
  const block = (text: string, available: number, size: number, bold: boolean): TextBlock => ({
    lines: wrapImageText(text, available, size, bold, measure), size, lineHeight: Math.ceil(size * 1.5), bold
  });
  const title = block(board.name || 'TaskBox', width - PADDING * 2, 28, true);
  const date = new Intl.DateTimeFormat('ja-JP', {dateStyle: 'medium', timeStyle: 'short'}).format(now);
  const metadata = block(`${date}  ·  ${groups.length} グループ / ${board.data.tasks.length} タスク`, width - PADDING * 2, 14, false);
  const legend = block('色分け：ボカクラ（水色） / Apop（黄） / Apop(selector)（橙）', width - PADDING * 2, 12, false);
  const metaY = 82 + (title.lines.length - 1) * title.lineHeight + 32;
  const legendY = metaY + metadata.lines.length * metadata.lineHeight + 5;
  const headerHeight = legendY + legend.lines.length * legend.lineHeight + 18;
  const plans = groups.map(group => {
    const heading = block(group.name, GROUP_WIDTH - 94, 18, true);
    const headingHeight = Math.max(56, heading.lines.length * heading.lineHeight + 24);
    const tasks: PlannedTask[] = group.tasks.map(task => {
      const taskTitle = block(task.title, GROUP_WIDTH - 24 - CARD_PADDING * 2, 16, true);
      const detail = block(task.description || '', GROUP_WIDTH - 24 - CARD_PADDING * 2, 14, false);
      const height = CARD_PADDING * 2 + taskTitle.lines.length * taskTitle.lineHeight
        + (task.description ? 8 + detail.lines.length * detail.lineHeight : 0);
      return {task, title: taskTitle, detail, height};
    });
    return {group, heading, headingHeight, tasks,
      height: headingHeight + 24 + (tasks.length ? tasks.reduce((total, task) => total + task.height + 10, -10) : 40)};
  });
  const positions: {x: number; y: number}[] = [];
  const columnBottoms = Array<number>(columns).fill(headerHeight);
  for (const plan of plans) {
    const column = columnBottoms.indexOf(Math.min(...columnBottoms));
    positions.push({x: PADDING + column * (GROUP_WIDTH + GAP), y: columnBottoms[column]});
    columnBottoms[column] += plan.height + GAP;
  }
  const height = Math.ceil((plans.length ? Math.max(...columnBottoms) - GAP : headerHeight + 76) + PADDING);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${xml(board.name || 'TaskBox')} — 全体の進捗</title>`,
    `<rect width="100%" height="100%" fill="#101b2e"/>`,
    `<g font-family="${xml(FONT)}" style="font-kerning:normal">`];
  const rect = (x: number, y: number, w: number, h: number, color: string, radius = 14) =>
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${color}"/>`);
  const drawText = (text: TextBlock, x: number, y: number, color: string) => {
    parts.push(`<text fill="${color}" font-size="${text.size}" font-weight="${text.bold ? 700 : 400}" xml:space="preserve">`);
    for (const [i, line] of text.lines.entries()) parts.push(`<tspan x="${x}" y="${y + i * text.lineHeight}">${xml(line)}</tspan>`);
    parts.push('</text>');
  };
  drawText({lines: ['TaskBox · 全体の進捗'], size: 16, lineHeight: 24, bold: true}, PADDING, 40, '#a7c7ff');
  drawText(title, PADDING, 82, '#f1f5ff');
  drawText(metadata, PADDING, metaY, '#b8c8df');
  drawText(legend, PADDING, legendY, '#9fb4d3');
  for (const [index, plan] of plans.entries()) {
    const {x, y} = positions[index];
    rect(x, y + 4, GROUP_WIDTH, plan.height, '#080f1c');
    rect(x, y, GROUP_WIDTH, plan.height, '#223550', 18);
    const color = safeColor(plan.group.color, '#dbeafe');
    rect(x, y, GROUP_WIDTH, plan.headingHeight, color, 16);
    drawText(plan.heading, x + 16, y + 30, foreground(color));
    rect(x + GROUP_WIDTH - 62, y + 14, 48, 28, '#ffffff', 14);
    drawText({lines: [String(plan.tasks.length)], size: 14, lineHeight: 21, bold: true}, x + GROUP_WIDTH - 50, y + 34, '#172235');
    let taskY = y + plan.headingHeight + 12;
    for (const task of plan.tasks) {
      const color = safeColor(task.task.color), textColor = foreground(color);
      rect(x + 12, taskY + 3, GROUP_WIDTH - 24, task.height, '#142238', 12);
      rect(x + 12, taskY, GROUP_WIDTH - 24, task.height, color, 12);
      drawText(task.title, x + 12 + CARD_PADDING, taskY + CARD_PADDING + task.title.size, textColor);
      if (task.task.description) drawText(task.detail, x + 12 + CARD_PADDING,
        taskY + CARD_PADDING + task.title.lines.length * task.title.lineHeight + 8 + task.detail.size, textColor);
      taskY += task.height + 10;
    }
    if (!plan.tasks.length) drawText(block('タスクなし', GROUP_WIDTH - 32, 14, false), x + 16, taskY + 22, '#b8c8df');
  }
  if (!plans.length) drawText(block('グループはまだありません', width - PADDING * 2, 16, false), PADDING, headerHeight + 35, '#b8c8df');
  parts.push('</g></svg>');
  const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('')
    + '_' + [now.getHours(), now.getMinutes(), now.getSeconds()].map(value => String(value).padStart(2, '0')).join('');
  const name = board.name.replace(/[\u0000-\u001f\\/:*?"<>|%]/g, '_').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 80) || 'TaskBox';
  return {svg: parts.join(''), width, height, groupCount: groups.length, taskCount: board.data.tasks.length, fileBaseName: `${name}_${stamp}`};
}

export async function createBoardImage(board: ImageBoard): Promise<BoardImageFile> {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  const measure: MeasureText = (text, size, bold) => {
    if (!context) return Array.from(text).length * size;
    context.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
    return context.measureText(text).width;
  };
  const {svg, ...metadata} = buildBoardImage(board, new Date(), measure);
  const svgBlob = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
  // Keep every task at readable size. Use a vector image instead of clipping or
  // shrinking a very large board past conservative mobile canvas limits.
  const fits = (scale: number) => metadata.width * scale <= 4096 && metadata.height * scale <= 4096
    && metadata.width * metadata.height * scale * scale <= 16_000_000;
  if (!context || !fits(1)) return {...metadata, blob: svgBlob, format: 'SVG'};
  const source = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve(); image.onerror = () => reject(new Error('画像を読み込めませんでした'));
      image.src = source;
    });
    const scale = fits(2) ? 2 : 1;
    canvas.width = metadata.width * scale; canvas.height = metadata.height * scale;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG画像を作成できませんでした');
    return {...metadata, width: canvas.width, height: canvas.height, blob, format: 'PNG'};
  } catch {
    return {...metadata, blob: svgBlob, format: 'SVG'};
  } finally {
    URL.revokeObjectURL(source); canvas.width = 0; canvas.height = 0;
  }
}
