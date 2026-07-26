import { useEffect, useState, useCallback } from 'react';
import { gitApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import type { GitCommit } from '@/types';
import GitDiffView from '@/components/file-manager/GitDiffView';
import {
  Loader2, ChevronRight, ChevronDown, RefreshCw, GitBranch, GitCommit as GitCommitIcon,
  Check, Plus, Minus, ArrowUp, ArrowDown, Inbox,
} from 'lucide-react';

/** 单个改动文件条目 */
interface ChangeEntry {
  file: string;        // 相对 repo 根的路径
  status: string;      // M/A/D/R/C/untracked/conflict
  x: string;           // staged 状态码
  y: string;           // 工作区状态码
  basename: string;    // 文件名（不含目录）
  dirname: string;     // 目录部分
}

interface GitPanelProps {
  repoPath: string;
  refreshKey: number;        // 外部触发刷新（保存/commit 等）
  onCommit?: () => void;     // commit 成功后通知父组件刷新文件树徽章
}

export default function GitPanel({ repoPath, refreshKey }: GitPanelProps) {
  const [branch, setBranch] = useState<string>('');
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [collapsedStaged, setCollapsedStaged] = useState(false);
  const [collapsedChanges, setCollapsedChanges] = useState(false);
  const [collapsedHistory, setCollapsedHistory] = useState(true);
  const [collapsedDiff, setCollapsedDiff] = useState(true);
  const [diffPatch, setDiffPatch] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  // ===== 加载状态 =====
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, branchRes] = await Promise.all([
        gitApi.workingStatus(repoPath),
        gitApi.branch(repoPath).catch(() => ({ data: { branch: '', ahead: 0, behind: 0 } })),
      ]);
      const data = statusRes.data as { isGitRepo: boolean; changes: any[] };
      const bdata = branchRes.data as { branch: string; ahead: number; behind: number };
      setBranch(bdata.branch || 'HEAD');
      setAhead(bdata.ahead || 0);
      setBehind(bdata.behind || 0);
      setChanges((data.changes || []).map((c: any) => {
        const slashIdx = c.file.lastIndexOf('/');
        return {
          file: c.file,
          status: c.status,
          x: c.x,
          y: c.y,
          basename: slashIdx >= 0 ? c.file.slice(slashIdx + 1) : c.file,
          dirname: slashIdx >= 0 ? c.file.slice(0, slashIdx) : '',
        };
      }));
      // changes 变了，旧 diff 已失效，重置
      setDiffPatch('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      addNotification({ type: 'error', message: `Git 状态加载失败: ${msg}` });
    } finally {
      setLoading(false);
    }
  }, [repoPath, addNotification]);

  useEffect(() => { loadStatus(); }, [loadStatus, refreshKey]);

  // 拆分 staged / unstaged
  const staged = changes.filter(c => c.x !== ' ' && c.x !== '?');
  const unstaged = changes.filter(c => c.y !== ' ' || c.x === '?');
  // untracked 文件 (??) 只在 unstaged 显示，不在 staged
  const stagedClean = staged.filter(c => c.x !== '?');
  const unstagedClean = unstaged.filter(c => !(c.x === '?' && c.y === '?') || c.status === 'untracked');

  // ===== Stage / Unstage =====
  const stageFile = useCallback(async (file: string) => {
    try {
      await gitApi.stage(repoPath, [file]);
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      addNotification({ type: 'error', message: `暂存失败: ${msg}` });
    }
  }, [repoPath, loadStatus, addNotification]);

  const stageAll = useCallback(async () => {
    try {
      await gitApi.stage(repoPath);
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      addNotification({ type: 'error', message: `暂存全部失败: ${msg}` });
    }
  }, [repoPath, loadStatus, addNotification]);

  const unstageFile = useCallback(async (file: string) => {
    try {
      await gitApi.unstage(repoPath, [file]);
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      addNotification({ type: 'error', message: `取消暂存失败: ${msg}` });
    }
  }, [repoPath, loadStatus, addNotification]);

  const unstageAll = useCallback(async () => {
    try {
      await gitApi.unstage(repoPath);
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      addNotification({ type: 'error', message: `取消全部失败: ${msg}` });
    }
  }, [repoPath, loadStatus, addNotification]);

  // ===== Commit =====
  const handleCommit = useCallback(async () => {
    const msg = commitMsg.trim();
    if (!msg) {
      addNotification({ type: 'error', message: '请输入提交信息' });
      return;
    }
    if (stagedClean.length === 0) {
      addNotification({ type: 'error', message: '暂存区为空，请先 stage 文件' });
      return;
    }
    setCommitting(true);
    try {
      await gitApi.commit(repoPath, msg);
      addNotification({ type: 'success', message: `已提交: ${msg.slice(0, 40)}` });
      setCommitMsg('');
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交失败';
      addNotification({ type: 'error', message: `提交失败: ${msg}` });
    } finally {
      setCommitting(false);
    }
  }, [commitMsg, stagedClean.length, repoPath, loadStatus, addNotification]);

  // ===== 工作区 Diff 折叠展开 =====
  const toggleFullDiff = useCallback(async () => {
    if (!collapsedDiff) {
      setCollapsedDiff(true);
      return;
    }
    setCollapsedDiff(false);
    if (diffPatch) return;
    setDiffLoading(true);
    try {
      const res = await gitApi.workingDiff(repoPath);
      setDiffPatch((res.data as { patch?: string }).patch || '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      addNotification({ type: 'error', message: `Diff 加载失败: ${msg}` });
    } finally {
      setDiffLoading(false);
    }
  }, [collapsedDiff, diffPatch, repoPath, addNotification]);

  if (loading && changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        <span className="text-xs">加载 Git 状态...</span>
      </div>
    );
  }

  const totalChanges = changes.length;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200">
      {/* 顶部：分支 + 刷新 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 shrink-0">
        <GitBranch className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-xs font-medium truncate flex-1" title={branch}>{branch || 'HEAD'}</span>
        {(ahead > 0 || behind > 0) && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-500 shrink-0">
            {ahead > 0 && <span className="flex items-center text-emerald-400"><ArrowUp className="w-2.5 h-2.5" />{ahead}</span>}
            {behind > 0 && <span className="flex items-center text-amber-400"><ArrowDown className="w-2.5 h-2.5" />{behind}</span>}
          </span>
        )}
        <button onClick={loadStatus} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200" title="刷新">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* 滚动区 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* 提交输入 */}
        <div className="p-2 border-b border-zinc-800 shrink-0">
          <textarea
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="提交信息（Ctrl+Enter 提交）"
            rows={2}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleCommit();
              }
            }}
            className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
          />
          <button
            onClick={handleCommit}
            disabled={committing || !commitMsg.trim() || stagedClean.length === 0}
            className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {committing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            提交{stagedClean.length > 0 ? ` (${stagedClean.length})` : ''}
          </button>
        </div>

        {/* Staged Changes */}
        <SectionHeader
          label="Staged Changes"
          count={stagedClean.length}
          collapsed={collapsedStaged}
          onToggle={() => setCollapsedStaged(v => !v)}
          actionIcon={<Minus className="w-3 h-3" />}
          actionTitle="取消全部暂存"
          onAction={stagedClean.length > 0 ? unstageAll : undefined}
        />
        {!collapsedStaged && stagedClean.map(c => (
          <ChangeRow
            key={`s-${c.file}`}
            entry={c}
            stage="staged"
            onStage={() => unstageFile(c.file)}
          />
        ))}

        {/* Changes */}
        <SectionHeader
          label="Changes"
          count={unstagedClean.length}
          collapsed={collapsedChanges}
          onToggle={() => setCollapsedChanges(v => !v)}
          actionIcon={<Plus className="w-3 h-3" />}
          actionTitle="暂存全部"
          onAction={unstagedClean.length > 0 ? stageAll : undefined}
        />
        {!collapsedChanges && unstagedClean.map(c => (
          <ChangeRow
            key={`u-${c.file}`}
            entry={c}
            stage="unstaged"
            onStage={() => stageFile(c.file)}
          />
        ))}

        {/* 空状态 */}
        {totalChanges === 0 && !loading && (
          <div className="px-3 py-8 text-center text-zinc-600">
            <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">无未提交改动</p>
          </div>
        )}

        {/* 完整工作区 Diff */}
        {totalChanges > 0 && (
          <>
            <SectionHeader
              label="工作区 Diff"
              count={null}
              collapsed={collapsedDiff}
              onToggle={toggleFullDiff}
            />
            {!collapsedDiff && (
              <div className="border-t border-zinc-800 bg-zinc-900/30">
                {diffLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  </div>
                ) : diffPatch ? (
                  <div className="p-2">
                    <GitDiffView patch={diffPatch} repoPath={repoPath} hash="WORKING" disableExpand />
                  </div>
                ) : (
                  <div className="px-3 py-3 text-[11px] text-zinc-600 italic">无内容</div>
                )}
              </div>
            )}
          </>
        )}

        {/* 提交历史 */}
        <SectionHeader
          label="提交历史"
          count={null}
          collapsed={collapsedHistory}
          onToggle={() => setCollapsedHistory(v => !v)}
        />
        {!collapsedHistory && (
          <HistoryView repoPath={repoPath} addNotification={addNotification} />
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, count, collapsed, onToggle, actionIcon, actionTitle, onAction }: {
  label: string;
  count: number | null;
  collapsed: boolean;
  onToggle: () => void;
  actionIcon?: React.ReactNode;
  actionTitle?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-zinc-900/60 group">
      <button onClick={onToggle} className="flex items-center gap-1 flex-1 min-w-0 text-left">
        {collapsed ? <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" /> : <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />}
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold truncate">{label}</span>
        {count !== null && count > 0 && (
          <span className="text-[10px] text-zinc-600">{count}</span>
        )}
      </button>
      {actionIcon && onAction && (
        <button
          onClick={onAction}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100"
          title={actionTitle}
        >
          {actionIcon}
        </button>
      )}
    </div>
  );
}

function ChangeRow({ entry, stage, onStage }: {
  entry: ChangeEntry;
  stage: 'staged' | 'unstaged';
  onStage: () => void;
}) {
  const { letter, color } = statusMeta(entry.status, stage);
  return (
    <div className="group flex items-center gap-1.5 pl-4 pr-2 py-1 hover:bg-zinc-800/60 text-xs">
      <span className={`w-3 shrink-0 text-center text-[10px] font-mono font-bold ${color}`}>{letter}</span>
      <span className="truncate text-zinc-200 flex-1 min-w-0">{entry.basename}</span>
      {entry.dirname && <span className="text-[10px] text-zinc-600 truncate shrink-0">{entry.dirname}</span>}
      <button
        onClick={onStage}
        className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 shrink-0"
        title={stage === 'staged' ? '取消暂存 (−)' : '暂存 (+)'}
      >
        {stage === 'staged' ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
      </button>
    </div>
  );
}

function statusMeta(status: string, _stage: 'staged' | 'unstaged') {
  switch (status) {
    case 'M': return { letter: 'M', color: 'text-amber-400' };
    case 'A': return { letter: 'A', color: 'text-emerald-400' };
    case 'D': return { letter: 'D', color: 'text-rose-400' };
    case 'R': return { letter: 'R', color: 'text-sky-400' };
    case 'C': return { letter: 'C', color: 'text-sky-400' };
    case 'untracked': return { letter: 'U', color: 'text-emerald-400' };
    case 'conflict': return { letter: '!', color: 'text-rose-400' };
    default: return { letter: status, color: 'text-zinc-400' };
  }
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
    if (expanded === hash) { setExpanded(null); return; }
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

  if (commits.length === 0 && loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="pb-2">
      <div className="text-[10px] text-zinc-600 px-3 pb-1">共 {total} 次提交</div>
      {commits.map((commit) => {
        const isOpen = expanded === commit.hash;
        return (
          <div key={commit.hash} className="mx-1 mb-1 rounded bg-zinc-900/40 border border-zinc-800/60 overflow-hidden">
            <button
              onClick={() => toggleDiff(commit.hash)}
              className="w-full p-2 flex items-start gap-2 hover:bg-zinc-800/60 transition-colors text-left"
            >
              <ChevronRight className={`w-3 h-3 mt-0.5 shrink-0 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              <GitCommitIcon className="w-3 h-3 mt-0.5 shrink-0 text-zinc-500" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-zinc-200 truncate">{commit.message}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  <span className="font-mono text-emerald-400/70">{commit.hash.slice(0, 7)}</span>
                  <span className="mx-1">·</span>
                  <span className="text-zinc-400">{commit.author}</span>
                </p>
              </div>
            </button>
            {isOpen && (
              <div className="px-2 pb-2 pt-1 border-t border-zinc-800 bg-zinc-950/40">
                {diffLoading && !diffCache[commit.hash] ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  </div>
                ) : (
                  <GitDiffView patch={diffCache[commit.hash] || ''} repoPath={repoPath} hash={commit.hash} />
                )}
              </div>
            )}
          </div>
        );
      })}
      {hasMore && !loading && (
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
