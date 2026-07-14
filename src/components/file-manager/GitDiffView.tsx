import { useMemo, useState, useCallback } from 'react';
import { ChevronRight, FilePlus, FileMinus, FilePen, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { gitApi } from '@/api/client';

interface DiffLine {
  type: 'context' | 'add' | 'del';
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

interface DiffHunk {
  header: string;
  oldStart: number;
  oldLen: number;
  newStart: number;
  newLen: number;
  lines: DiffLine[];
}

interface DiffFile {
  oldPath: string;
  newPath: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  binary?: boolean;
}

function parseDiff(patch: string): DiffFile[] {
  if (!patch) return [];
  const files: DiffFile[] = [];
  const lines = patch.split('\n');

  let current: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git')) {
      if (current) files.push(current);
      const m = line.match(/^diff --git a\/(.*) b\/(.*)$/);
      const p = m ? m[2] : line.slice(13);
      current = {
        oldPath: p,
        newPath: p,
        status: 'modified',
        additions: 0,
        deletions: 0,
        hunks: [],
      };
      currentHunk = null;
      continue;
    }

    if (!current) continue;

    if (line.startsWith('rename from ')) {
      current.oldPath = line.slice(12);
      current.status = 'renamed';
    } else if (line.startsWith('rename to ')) {
      current.newPath = line.slice(10);
      current.status = 'renamed';
    } else if (line.startsWith('copy from ')) {
      current.oldPath = line.slice(10);
    } else if (line.startsWith('copy to ')) {
      current.newPath = line.slice(8);
    } else if (line.startsWith('new file mode')) {
      current.status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      current.status = 'deleted';
    } else if (line.startsWith('--- ')) {
      const v = line.slice(4);
      if (v !== '/dev/null') current.oldPath = v.startsWith('a/') ? v.slice(2) : v;
    } else if (line.startsWith('+++ ')) {
      const v = line.slice(4);
      if (v !== '/dev/null') current.newPath = v.startsWith('b/') ? v.slice(2) : v;
    } else if (line.startsWith('Binary files') || line.startsWith('GIT binary patch')) {
      current.binary = true;
    } else if (line.startsWith('@@')) {
      const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (m) {
        const oldStart = parseInt(m[1]);
        const newStart = parseInt(m[3]);
        oldNo = oldStart;
        newNo = newStart;
        currentHunk = {
          header: line,
          oldStart,
          oldLen: m[2] ? parseInt(m[2]) : 1,
          newStart,
          newLen: m[4] ? parseInt(m[4]) : 1,
          lines: [],
        };
        current.hunks.push(currentHunk);
      }
    } else if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: 'add', text: line.slice(1), oldNo: null, newNo: newNo++ });
        current.additions++;
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({ type: 'del', text: line.slice(1), oldNo: oldNo++, newNo: null });
        current.deletions++;
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({ type: 'context', text: line.startsWith(' ') ? line.slice(1) : '', oldNo: oldNo++, newNo: newNo++ });
      }
    }
  }
  if (current) files.push(current);
  return files;
}

function statusMeta(status: DiffFile['status']) {
  switch (status) {
    case 'added': return { icon: FilePlus, color: 'text-emerald-400' };
    case 'deleted': return { icon: FileMinus, color: 'text-rose-400' };
    case 'renamed': return { icon: FileText, color: 'text-sky-400' };
    default: return { icon: FilePen, color: 'text-amber-400' };
  }
}

function LineRow({ line }: { line: DiffLine }) {
  return (
    <div className={`flex ${
      line.type === 'add' ? 'bg-emerald-500/10' : line.type === 'del' ? 'bg-rose-500/10' : ''
    }`}>
      <span className={`shrink-0 w-10 text-right pr-2 select-none border-r border-zinc-800/50 font-mono ${
        line.type === 'add' ? 'text-emerald-500/60' : line.type === 'del' ? 'text-rose-500/60' : 'text-zinc-600'
      }`}>
        {line.oldNo ?? ''}
      </span>
      <span className={`shrink-0 w-10 text-right pr-2 pl-2 select-none border-r border-zinc-800/50 font-mono ${
        line.type === 'add' ? 'text-emerald-500/60' : line.type === 'del' ? 'text-rose-500/60' : 'text-zinc-600'
      }`}>
        {line.newNo ?? ''}
      </span>
      <span className={`shrink-0 w-5 text-center select-none font-mono ${
        line.type === 'add' ? 'text-emerald-400' : line.type === 'del' ? 'text-rose-400' : 'text-zinc-700'
      }`}>
        {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
      </span>
      <pre className={`flex-1 pl-2 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed ${
        line.type === 'add' ? 'text-emerald-200' : line.type === 'del' ? 'text-rose-200' : 'text-zinc-400'
      }`}>{line.text || ' '}</pre>
    </div>
  );
}

function ExpandButton({ dir, onClick, disabled }: { dir: 'up' | 'down'; onClick: () => void; disabled?: boolean }) {
  const Icon = dir === 'up' ? ChevronUp : ChevronDown;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 border-b border-zinc-800/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      title={dir === 'up' ? '展开上方上下文' : '展开下方上下文'}
    >
      <Icon className="w-3 h-3" />
      <span>{dir === 'up' ? '展开上方' : '展开下方'}</span>
    </button>
  );
}

function HunkView({ hunk, repoPath, hash, file, isAdded, isDeleted }: {
  hunk: DiffHunk;
  repoPath: string;
  hash: string;
  file: string;
  isAdded: boolean;
  isDeleted: boolean;
}) {
  // 已展开的上方/下方行数（渐进式：每次 +20）
  const [expandedTop, setExpandedTop] = useState(0);
  const [expandedBottom, setExpandedBottom] = useState(0);
  const [oldFileLines, setOldFileLines] = useState<string[] | null>(null);
  const [newFileLines, setNewFileLines] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<'top' | 'bottom' | null>(null);

  // 文件总行数（用于禁用按钮）
  // 顶部可展开范围：[1, hunk.oldStart - 1]；已展开 expandedTop 行后剩余 = hunk.oldStart - 1 - expandedTop
  const topRemaining = Math.max(0, hunk.oldStart - 1 - expandedTop);
  // 底部可展开范围：基于 new 版本，[hunkNewEnd + 1, fileTotal]
  const hunkNewEnd = hunk.newStart + hunk.newLen - 1;
  const bottomRemaining = newFileLines ? Math.max(0, newFileLines.length - hunkNewEnd - expandedBottom) : null;

  const fetchFile = useCallback(async (which: 'old' | 'new') => {
    const targetHash = which === 'old' ? `${hash}^` : hash;
    try {
      const res = await gitApi.file(repoPath, targetHash, file);
      const content = (res.data as any).content || '';
      const arr = content.split('\n');
      // 末尾换行会产生空字符串元素，去掉
      if (arr.length > 0 && arr[arr.length - 1] === '') arr.pop();
      if (which === 'old') setOldFileLines(arr);
      else setNewFileLines(arr);
      return arr;
    } catch {
      return null;
    }
  }, [repoPath, hash, file]);

  const expandTop = useCallback(async () => {
    if (loading) return;
    setLoading('top');
    let oldLines = oldFileLines;
    if (!oldLines) {
      const result = await fetchFile('old');
      if (!result) { setLoading(null); return; }
      oldLines = result;
    }
    setExpandedTop(n => n + 20);
    setLoading(null);
  }, [loading, oldFileLines, fetchFile]);

  const expandBottom = useCallback(async () => {
    if (loading) return;
    setLoading('bottom');
    let newLines = newFileLines;
    if (!newLines) {
      const result = await fetchFile('new');
      if (!result) { setLoading(null); return; }
      newLines = result;
    }
    setExpandedBottom(n => n + 20);
    setLoading(null);
  }, [loading, newFileLines, fetchFile]);

  // 构造上方展开的行（从 old 文件取，因为 old 文件的 oldStart 之前是 hunk 之前的代码）
  const topExtraLines: DiffLine[] = useMemo(() => {
    if (!expandedTop || !oldFileLines) return [];
    const startIdx = Math.max(0, hunk.oldStart - 1 - expandedTop);
    const endIdx = hunk.oldStart - 1;
    const slice = oldFileLines.slice(startIdx, endIdx);
    return slice.map((text, i) => ({
      type: 'context' as const,
      text,
      oldNo: startIdx + i + 1,
      newNo: startIdx + i + 1,
    }));
  }, [expandedTop, oldFileLines, hunk.oldStart]);

  const bottomExtraLines: DiffLine[] = useMemo(() => {
    if (!expandedBottom || !newFileLines) return [];
    const startIdx = hunkNewEnd;
    const endIdx = Math.min(newFileLines.length, hunkNewEnd + expandedBottom);
    const slice = newFileLines.slice(startIdx, endIdx);
    return slice.map((text, i) => ({
      type: 'context' as const,
      text,
      oldNo: startIdx + i + 1,
      newNo: startIdx + i + 1,
    }));
  }, [expandedBottom, newFileLines, hunkNewEnd]);

  // added 文件没有 "上方"（old 不存在），deleted 文件没有 "下方"（new 不存在）
  const canExpandTop = !isAdded && topRemaining > 0;
  const canExpandBottom = !isDeleted && bottomRemaining === null || (bottomRemaining !== null && bottomRemaining > 0);

  return (
    <div className="border-b border-zinc-800/50 last:border-b-0">
      {/* 上方展开按钮（在 hunk header 之前） */}
      {canExpandTop && (
        <ExpandButton dir="up" onClick={expandTop} disabled={loading === 'top'} />
      )}
      {/* 已展开的上方 context */}
      {topExtraLines.map((line, i) => (
        <LineRow key={`top-${i}`} line={line} />
      ))}

      {/* hunk header */}
      <div className="px-3 py-1 text-[10px] font-mono text-zinc-500 bg-zinc-900/40 border-y border-zinc-800/50">
        {hunk.header}
      </div>
      {/* hunk 内容 */}
      {hunk.lines.map((line, i) => (
        <LineRow key={i} line={line} />
      ))}

      {/* 已展开的下方 context */}
      {bottomExtraLines.map((line, i) => (
        <LineRow key={`bot-${i}`} line={line} />
      ))}
      {/* 下方展开按钮 */}
      {canExpandBottom && (
        <ExpandButton dir="down" onClick={expandBottom} disabled={loading === 'bottom'} />
      )}
    </div>
  );
}

function FileBlock({ file, repoPath, hash }: { file: DiffFile; repoPath: string; hash: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const Meta = statusMeta(file.status);
  const Icon = Meta.icon;
  const displayPath = file.status === 'renamed' ? `${file.oldPath} → ${file.newPath}` : file.newPath;
  const isAdded = file.status === 'added';
  const isDeleted = file.status === 'deleted';

  return (
    <div className="border border-zinc-800 rounded-md overflow-hidden bg-zinc-950/40">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/40 transition-colors"
      >
        <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 transition-transform shrink-0 ${collapsed ? '' : 'rotate-90'}`} />
        <Icon className={`w-3.5 h-3.5 shrink-0 ${Meta.color}`} />
        <span className="flex-1 min-w-0 text-left text-xs font-mono text-zinc-200 truncate">{displayPath}</span>
        {!file.binary && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
            <span className="text-emerald-400">+{file.additions}</span>
            <span className="text-rose-400">-{file.deletions}</span>
          </span>
        )}
      </button>
      {!collapsed && !file.binary && (
        <div>
          {file.hunks.map((hunk, i) => (
            <HunkView
              key={i}
              hunk={hunk}
              repoPath={repoPath}
              hash={hash}
              file={file.newPath}
              isAdded={isAdded}
              isDeleted={isDeleted}
            />
          ))}
        </div>
      )}
      {file.binary && (
        <div className="px-3 py-3 text-xs text-zinc-500 italic">二进制文件，无法显示差异</div>
      )}
    </div>
  );
}

export default function GitDiffView({ patch, repoPath, hash }: { patch: string; repoPath: string; hash: string }) {
  const files = useMemo(() => parseDiff(patch), [patch]);
  const totals = useMemo(
    () => files.reduce((acc, f) => ({ a: acc.a + f.additions, d: acc.d + f.deletions }), { a: 0, d: 0 }),
    [files]
  );

  if (files.length === 0) {
    return <div className="text-xs text-zinc-500 italic py-4 text-center">无文件改动（可能是 merge commit 或空提交）</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{files.length} 个文件变更 · 点击 ↑/↓ 展开上下文</span>
        <span className="flex items-center gap-1.5 font-mono">
          <span className="text-emerald-400">+{totals.a}</span>
          <span className="text-rose-400">-{totals.d}</span>
        </span>
      </div>
      {files.map((file, i) => (
        <FileBlock key={i} file={file} repoPath={repoPath} hash={hash} />
      ))}
    </div>
  );
}
