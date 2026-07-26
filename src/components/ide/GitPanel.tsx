import { useEffect, useState, useCallback, useRef } from 'react';
import { gitApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import type { GitCommit } from '@/types';
import GitDiffView from '@/components/file-manager/GitDiffView';
import { Loader2, ChevronRight, ChevronDown, RefreshCw, GitBranch, FileDiff } from 'lucide-react';

interface GitPanelProps {
  repoPath: string;
}

type SubTab = 'changes' | 'history';

export default function GitPanel({ repoPath }: GitPanelProps) {
  const [tab, setTab] = useState<SubTab>('changes');
  const addNotification = useAppStore((s) => s.addNotification);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-zinc-800 shrink-0">
        <button
          onClick={() => setTab('changes')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
            tab === 'changes' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileDiff className="w-3.5 h-3.5" />
          改动
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
            tab === 'history' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          历史
        </button>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {tab === 'changes' ? (
          <ChangesView repoPath={repoPath} addNotification={addNotification} />
        ) : (
          <HistoryView repoPath={repoPath} addNotification={addNotification} />
        )}
      </div>
    </div>
  );
}

function ChangesView({ repoPath, addNotification }: { repoPath: string; addNotification: (n: { type: 'success' | 'error' | 'info'; message: string }) => void }) {
  const [patch, setPatch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gitApi.workingDiff(repoPath);
      setPatch((res.data as { patch?: string }).patch || '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      setError(msg);
      addNotification({ type: 'error', message: `Git diff 加载失败: ${msg}` });
    } finally {
      setLoading(false);
    }
  }, [repoPath, addNotification]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return <div className="px-3 py-4 text-xs text-rose-400">{error}</div>;
  }

  if (!patch.trim()) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-zinc-500">无未提交改动</p>
        <button onClick={load} className="mt-3 text-xs text-emerald-400 hover:underline">刷新</button>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[11px] text-zinc-500">对比 HEAD 的工作区改动</span>
        <button onClick={load} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200" title="刷新">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      <GitDiffView patch={patch} repoPath={repoPath} hash="WORKING" disableExpand />
    </div>
  );
}

function HistoryView({ repoPath, addNotification }: { repoPath: string; addNotification: (n: { type: 'success' | 'error' | 'info'; message: string }) => void }) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [diffCache, setDiffCache] = useState<Record<string, string>>({});
  const [diffLoading, setDiffLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadCommits = useCallback(async (pageNum: number, append: boolean) => {
    setLoading(true);
    try {
      const res = await gitApi.log(repoPath, pageNum, 20);
      const data = res.data as { commits: GitCommit[]; total: number; hasMore: boolean };
      setCommits(prev => append ? [...prev, ...data.commits] : data.commits);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      addNotification({ type: 'error', message: `Git 历史加载失败: ${msg}` });
    } finally {
      setLoading(false);
    }
  }, [repoPath, addNotification]);

  useEffect(() => { loadCommits(1, false); }, [loadCommits]);

  const toggleDiff = async (hash: string) => {
    if (expanded === hash) {
      setExpanded(null);
      return;
    }
    setExpanded(hash);
    if (diffCache[hash]) return;
    setDiffLoading(true);
    try {
      const res = await gitApi.diff(repoPath, hash);
      setDiffCache(prev => ({ ...prev, [hash]: (res.data as { patch?: string }).patch || '' }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      addNotification({ type: 'error', message: `Diff 加载失败: ${msg}` });
    } finally {
      setDiffLoading(false);
    }
  };

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto p-2 space-y-1.5"
      onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && hasMore && !loading) {
          loadCommits(page + 1, true);
        }
      }}
    >
      <div className="text-[11px] text-zinc-500 px-1 pb-1">共 {total} 次提交</div>
      {commits.length === 0 && loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        </div>
      ) : (
        commits.map((commit) => {
          const isOpen = expanded === commit.hash;
          return (
            <div key={commit.hash} className="rounded-md bg-zinc-900/60 border border-zinc-800 overflow-hidden">
              <button
                onClick={() => toggleDiff(commit.hash)}
                className="w-full p-2.5 flex items-start gap-2 hover:bg-zinc-800/60 transition-colors text-left"
              >
                <ChevronRight className={`w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-200 truncate">{commit.message}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    <span className="font-mono text-emerald-400/70">{commit.hash.slice(0, 7)}</span>
                    <span className="mx-1">·</span>
                    {commit.author}
                  </p>
                </div>
              </button>
              {isOpen && (
                <div className="px-2 pb-2 pt-1 border-t border-zinc-800 bg-zinc-950/40">
                  {diffLoading && !diffCache[commit.hash] ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    </div>
                  ) : (
                    <GitDiffView patch={diffCache[commit.hash] || ''} repoPath={repoPath} hash={commit.hash} />
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      {hasMore && !loading && commits.length > 0 && (
        <div className="flex items-center justify-center py-2">
          <button
            onClick={() => loadCommits(page + 1, true)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
          >
            <ChevronDown className="w-3 h-3" /> 加载更多
          </button>
        </div>
      )}
    </div>
  );
}
