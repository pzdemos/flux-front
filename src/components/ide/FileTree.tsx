import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react';
import { fileApi } from '@/api/client';
import type { FileItem, RawFileItem } from '@/types';
import {
  ChevronRight, Folder, FolderOpen, File as FileIcon, RefreshCw,
  FilePlus, FolderPlus, Clipboard, Scissors, Copy as CopyIcon,
  Trash2, Edit3, MoreVertical,
} from 'lucide-react';

export type GitStatusMap = Map<string, string>;

export interface ClipboardData {
  path: string;
  mode: 'copy' | 'move';
}

export type NodeAction =
  | { type: 'new-file'; parentDir: string }
  | { type: 'new-dir'; parentDir: string }
  | { type: 'rename'; file: FileItem }
  | { type: 'delete'; file: FileItem }
  | { type: 'copy'; file: FileItem }
  | { type: 'cut'; file: FileItem }
  | { type: 'paste'; targetDir: string }
  | { type: 'move-files'; sources: string[]; targetDir: string };

interface FileTreeProps {
  rootPath: string;
  activeFilePath: string | null;
  gitStatus: GitStatusMap | null;
  refreshKey: number;
  clipboard: ClipboardData | null;
  onOpenFile: (file: FileItem) => void;
  onAction: (action: NodeAction) => void;
  onRefresh: () => void;
}

// 顶层上下文：通过 context 把 onAction 传给递归子节点，避免 prop drilling
const TreeCtx = createContext<{
  rootPath: string;
  activeFilePath: string | null;
  gitStatus: GitStatusMap | null;
  clipboard: ClipboardData | null;
  onOpenFile: (f: FileItem) => void;
  onAction: (a: NodeAction) => void;
  onContext: (e: React.MouseEvent, file: FileItem | null, parentDir: string) => void;
} | null>(null);

function normalizeItems(raw: RawFileItem[] | undefined, parentPath: string): FileItem[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      name: item.name,
      path: parentPath === '/' ? `/${item.name}` : `${parentPath.replace(/\/$/, '')}/${item.name}`,
      size: item.size || 0,
      modified: '',
      isDirectory: item.type === 'directory',
      permissions: item.permissions || '',
      owner: '',
      group: '',
      isGitRepo: item.isGitRepo,
    }))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function relToRepo(filePath: string, rootPath: string): string {
  const rel = filePath.startsWith(rootPath) ? filePath.slice(rootPath.length) : filePath;
  return rel.replace(/^\/+/, '');
}

function isDescendant(maybeChild: string, ancestor: string): boolean {
  return maybeChild === ancestor || maybeChild.startsWith(ancestor + '/');
}

function StatusBadge({ status }: { status: string }) {
  let letter = '';
  let color = '';
  switch (status) {
    case 'M': letter = 'M'; color = 'text-amber-400'; break;
    case 'A': letter = 'A'; color = 'text-emerald-400'; break;
    case 'D': letter = 'D'; color = 'text-rose-400'; break;
    case 'R': letter = 'R'; color = 'text-sky-400'; break;
    case 'C': letter = 'C'; color = 'text-sky-400'; break;
    case 'untracked': letter = 'U'; color = 'text-emerald-400'; break;
    case 'conflict': letter = '!'; color = 'text-rose-400'; break;
    default: letter = status; color = 'text-zinc-400';
  }
  return <span className={`text-[10px] font-mono font-bold shrink-0 ${color}`}>{letter}</span>;
}

interface TreeNodeProps {
  dirPath: string;
  depth: number;
}

function TreeNode({ dirPath, depth }: TreeNodeProps) {
  const ctx = useContext(TreeCtx)!;
  const [items, setItems] = useState<FileItem[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fileApi.list(dirPath);
      setItems(normalizeItems(res.data.items, dirPath));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [dirPath]);

  useEffect(() => { load(); }, [load]);

  const toggle = (p: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (dropTarget) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(true);
  };

  const handleDragLeave = () => {
    if (dropTarget) setDropTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(false);
    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath || isDescendant(dirPath, sourcePath)) return;
    ctx.onAction({ type: 'move-files', sources: [sourcePath], targetDir: dirPath });
  };

  if (loading && items === null) {
    return <div className="text-xs text-zinc-600 py-1" style={{ paddingLeft: depth * 12 + 16 }}>加载中...</div>;
  }
  if (!items || items.length === 0) {
    return (
      <div
        className="text-xs text-zinc-600 italic py-1 flex items-center gap-1"
        style={{ paddingLeft: depth * 12 + 16 }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); ctx.onContext(e, null, dirPath); }}
      >
        （空）
      </div>
    );
  }

  return (
    <>
      {items.map((item) => {
        const isOpen = expanded.has(item.path);
        const isActive = item.path === ctx.activeFilePath;
        const gitRel = relToRepo(item.path, ctx.rootPath);
        const status = ctx.gitStatus?.get(gitRel);
        const isCut = ctx.clipboard?.mode === 'move' && ctx.clipboard.path === item.path;
        return (
          <div key={item.path}>
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', item.path);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={item.isDirectory ? handleDragOver : undefined}
              onDragLeave={item.isDirectory ? handleDragLeave : undefined}
              onDrop={item.isDirectory ? handleDrop : undefined}
              onClick={() => item.isDirectory ? toggle(item.path) : ctx.onOpenFile(item)}
              onContextMenu={(e) => { e.preventDefault(); ctx.onContext(e, item, dirPath); }}
              className={`group flex items-center gap-1 py-1 pr-1 cursor-pointer text-xs transition-colors ${
                isActive ? 'bg-emerald-500/15 text-white' : isCut ? 'text-zinc-600' : 'text-zinc-300 hover:bg-zinc-800/60'
              } ${dropTarget && item.isDirectory ? 'ring-1 ring-emerald-500 bg-emerald-500/10' : ''}`}
              style={{ paddingLeft: depth * 12 + 4 }}
              title={item.path}
            >
              {item.isDirectory ? (
                <>
                  <ChevronRight className={`w-3 h-3 shrink-0 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  {isOpen
                    ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                    : <Folder className="w-3.5 h-3.5 shrink-0 text-amber-400" />}
                </>
              ) : (
                <>
                  <span className="w-3 shrink-0" />
                  <FileIcon className={`w-3.5 h-3.5 shrink-0 ${status ? 'text-emerald-400' : 'text-zinc-500'}`} />
                </>
              )}
              <span className="flex-1 truncate">{item.name}</span>
              {status && <StatusBadge status={status} />}
              {item.isDirectory && item.isGitRepo && (
                <span className="text-[9px] text-orange-400 font-mono shrink-0" title="Git 仓库">git</span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); ctx.onContext(e, item, dirPath); }}
                className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100"
                title="更多操作"
              >
                <MoreVertical className="w-3 h-3" />
              </button>
            </div>
            {item.isDirectory && isOpen && (
              <TreeNode dirPath={item.path} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </>
  );
}

export default function FileTree({
  rootPath, activeFilePath, gitStatus, refreshKey, clipboard, onOpenFile, onAction, onRefresh,
}: FileTreeProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; file: FileItem | null; parentDir: string } | null>(null);

  const handleContext = useCallback((e: React.MouseEvent, file: FileItem | null, parentDir: string) => {
    setMenu({ x: e.clientX, y: e.clientY, file, parentDir });
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menu) return;
    const handler = () => setMenu(null);
    window.addEventListener('click', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [menu]);

  // 键盘 Escape 关闭
  useEffect(() => {
    if (!menu) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menu]);

  return (
    <TreeCtx.Provider value={{
      rootPath, activeFilePath, gitStatus, clipboard, onOpenFile, onAction, onContext: handleContext,
    }}>
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">资源管理器</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onAction({ type: 'new-file', parentDir: rootPath })}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400"
              title="在根目录新建文件"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onAction({ type: 'new-dir', parentDir: rootPath })}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-amber-400"
              title="在根目录新建文件夹"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <span className="w-px h-3 bg-zinc-700 mx-1" />
            <button
              onClick={onRefresh}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200"
              title="刷新"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto py-1"
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              handleContext(e, null, rootPath);
            }
          }}
        >
          <TreeNode key={refreshKey} dirPath={rootPath} depth={0} />
        </div>

        {menu && (
          <ContextMenu
            x={menu.x} y={menu.y} file={menu.file} parentDir={menu.parentDir}
            clipboard={clipboard}
            onAction={(a) => { onAction(a); setMenu(null); }}
          />
        )}
      </div>
    </TreeCtx.Provider>
  );
}

function ContextMenu({ x, y, file, parentDir, clipboard, onAction }: {
  x: number; y: number;
  file: FileItem | null;
  parentDir: string;
  clipboard: ClipboardData | null;
  onAction: (a: NodeAction) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // 防止超出视口
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + rect.width > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) ny = window.innerHeight - rect.height - 8;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  const isDir = file?.isDirectory ?? false;
  const targetDirForNew = file ? (isDir ? file.path : parentDir) : parentDir;

  const items: { label: string; icon: typeof FilePlus; action?: NodeAction; danger?: boolean; divider?: boolean; disabled?: boolean }[] = [];
  items.push({ label: '新建文件', icon: FilePlus, action: { type: 'new-file', parentDir: targetDirForNew } });
  items.push({ label: '新建文件夹', icon: FolderPlus, action: { type: 'new-dir', parentDir: targetDirForNew } });
  if (file) {
    items.push({ divider: true, label: '', icon: FilePlus });
    items.push({ label: '重命名', icon: Edit3, action: { type: 'rename', file } });
    items.push({ label: '复制', icon: CopyIcon, action: { type: 'copy', file } });
    items.push({ label: '剪切', icon: Scissors, action: { type: 'cut', file } });
    if (isDir && clipboard && !isDescendant(targetDirForNew, clipboard.path)) {
      items.push({
        label: `粘贴${clipboard.mode === 'copy' ? '（复制）' : '（剪切）'}`,
        icon: Clipboard,
        action: { type: 'paste', targetDir: targetDirForNew },
      });
    }
    items.push({ divider: true, label: '', icon: FilePlus });
    items.push({ label: '删除', icon: Trash2, action: { type: 'delete', file }, danger: true });
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 w-44 text-xs"
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => {
        if (it.divider) return <div key={i} className="border-t border-zinc-800 my-1" />;
        const Icon = it.icon;
        return (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => it.action && onAction(it.action)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed ${
              it.danger ? 'text-rose-400 hover:bg-rose-500/10' : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
