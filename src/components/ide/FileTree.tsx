import { useEffect, useState, useCallback } from 'react';
import { fileApi } from '@/api/client';
import type { FileItem, RawFileItem } from '@/types';
import { ChevronRight, Folder, File as FileIcon, RefreshCw } from 'lucide-react';

export type GitStatusMap = Map<string, string>; // 相对 repo 根的 file path → status

interface FileTreeProps {
  rootPath: string;
  activeFilePath: string | null;
  gitStatus: GitStatusMap | null;
  onOpenFile: (file: FileItem) => void;
}

interface TreeNodeProps {
  dirPath: string;       // 完整路径（含 rootPath 前缀），用于调 list
  rootPath: string;      // IDE 根目录，用于把 file.path 转成相对 repo 路径
  depth: number;
  activeFilePath: string | null;
  gitStatus: GitStatusMap | null;
  onOpenFile: (file: FileItem) => void;
}

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
      // 目录优先，再按名称
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function relToRepo(filePath: string, rootPath: string): string {
  // filePath 形如 "/flux-front/src/App.tsx"，rootPath 形如 "/flux-front"
  const rel = filePath.startsWith(rootPath) ? filePath.slice(rootPath.length) : filePath;
  return rel.replace(/^\/+/, '');
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

function TreeNode({ dirPath, rootPath, depth, activeFilePath, gitStatus, onOpenFile }: TreeNodeProps) {
  const [items, setItems] = useState<FileItem[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

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

  if (loading && items === null) {
    return <div className="text-xs text-zinc-600 py-1" style={{ paddingLeft: depth * 12 + 16 }}>加载中...</div>;
  }
  if (!items || items.length === 0) {
    return <div className="text-xs text-zinc-600 italic py-1" style={{ paddingLeft: depth * 12 + 16 }}>（空）</div>;
  }

  return (
    <>
      {items.map((item) => {
        const isOpen = expanded.has(item.path);
        const isActive = item.path === activeFilePath;
        const gitRel = relToRepo(item.path, rootPath);
        const status = gitStatus?.get(gitRel);
        return (
          <div key={item.path}>
            <div
              onClick={() => item.isDirectory ? toggle(item.path) : onOpenFile(item)}
              className={`group flex items-center gap-1 py-1 pr-2 cursor-pointer text-xs transition-colors ${
                isActive ? 'bg-emerald-500/15 text-white' : 'text-zinc-300 hover:bg-zinc-800/60'
              }`}
              style={{ paddingLeft: depth * 12 + 4 }}
            >
              {item.isDirectory ? (
                <>
                  <ChevronRight className={`w-3 h-3 shrink-0 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <Folder className={`w-3.5 h-3.5 shrink-0 ${isOpen ? 'text-amber-300' : 'text-amber-400'}`} />
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
            </div>
            {item.isDirectory && isOpen && (
              <TreeNode
                dirPath={item.path}
                rootPath={rootPath}
                depth={depth + 1}
                activeFilePath={activeFilePath}
                gitStatus={gitStatus}
                onOpenFile={onOpenFile}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default function FileTree({ rootPath, activeFilePath, gitStatus, onOpenFile }: FileTreeProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">资源管理器</span>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200"
          title="刷新"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <TreeNode
          key={refreshKey}
          dirPath={rootPath}
          rootPath={rootPath}
          depth={0}
          activeFilePath={activeFilePath}
          gitStatus={gitStatus}
          onOpenFile={onOpenFile}
        />
      </div>
    </div>
  );
}
