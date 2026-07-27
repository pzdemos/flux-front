import { useEffect, useState } from 'react';
import { gitApi } from '@/api/client';
import GitDiffView from '@/components/file-manager/GitDiffView';
import type { DiffScope } from './EditorTabs';
import { Loader2, GitCompare, GitCommit as GitCommitIcon } from 'lucide-react';

interface DiffPaneProps {
  repoPath: string;
  /** working file diff */
  file?: string;
  scope?: DiffScope;
  /** commit hash for full commit diff */
  hash?: string;
  title: string;
  subtitle?: string;
  refreshKey?: number;
}

export default function DiffPane({
  repoPath,
  file,
  scope = 'all',
  hash,
  title,
  subtitle,
  refreshKey = 0,
}: DiffPaneProps) {
  const [patch, setPatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (hash) {
          const res = await gitApi.diff(repoPath, hash);
          if (!cancelled) setPatch((res.data as { patch?: string }).patch || '');
        } else if (file) {
          const res = await gitApi.fileDiff(repoPath, file, { unified: 3, scope });
          if (!cancelled) setPatch((res.data as { patch?: string }).patch || '');
        } else {
          if (!cancelled) setPatch('');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载 diff 失败');
          setPatch('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [repoPath, file, scope, hash, refreshKey]);

  const viewHash = hash || 'WORKING';

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-start gap-2 px-4 py-2.5 border-b border-zinc-800 shrink-0 bg-zinc-900/60">
        {hash
          ? <GitCommitIcon className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
          : <GitCompare className="w-4 h-4 mt-0.5 text-sky-400 shrink-0" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-white truncate">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate font-mono">{subtitle}</p>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 shrink-0 self-center">
          {hash ? 'Commit' : scope === 'staged' ? 'Staged' : scope === 'unstaged' ? 'Changes' : 'Working Tree'}
        </span>
      </div>

      <div className="flex-1 overflow-auto min-h-0 p-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-xs">加载对比...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-xs text-rose-400">{error}</div>
        ) : (
          <GitDiffView patch={patch} repoPath={repoPath} hash={viewHash} disableExpand={!hash} />
        )}
      </div>
    </div>
  );
}
