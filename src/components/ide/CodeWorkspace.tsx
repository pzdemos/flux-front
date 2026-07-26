import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/app';
import { gitApi } from '@/api/client';
import type { FileItem } from '@/types';
import FileTree, { type GitStatusMap } from './FileTree';
import EditorTabs, { type OpenTab } from './EditorTabs';
import EditorPane from './EditorPane';
import GitPanel from './GitPanel';
import { ArrowLeft, GitBranch, FolderTree, Code2, FileText, RefreshCw } from 'lucide-react';

interface CodeWorkspaceProps {
  path: string; // IDE 根目录，例如 "/flux-front"
}

type MobileView = 'tree' | 'editor' | 'git';

export default function CodeWorkspace({ path }: CodeWorkspaceProps) {
  const navigate = useNavigate();
  const isMobile = useAppStore((s) => s.isMobile);
  const addNotification = useAppStore((s) => s.addNotification);

  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [dirtySet, setDirtySet] = useState<Set<string>>(new Set());

  const [gitStatus, setGitStatus] = useState<GitStatusMap | null>(null);
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [gitRefreshing, setGitRefreshing] = useState(false);

  const [mobileView, setMobileView] = useState<MobileView>('tree');

  // 加载 git 状态
  const loadGitStatus = useCallback(async () => {
    setGitRefreshing(true);
    try {
      const res = await gitApi.workingStatus(path);
      const data = res.data as { isGitRepo: boolean; changes: { file: string; status: string }[] };
      setIsGitRepo(data.isGitRepo);
      const m: GitStatusMap = new Map();
      data.changes.forEach(c => m.set(c.file, c.status));
      setGitStatus(m);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      addNotification({ type: 'error', message: `Git 状态加载失败: ${msg}` });
    } finally {
      setGitRefreshing(false);
    }
  }, [path, addNotification]);

  useEffect(() => { loadGitStatus(); }, [loadGitStatus]);

  const openFile = useCallback((file: FileItem) => {
    setTabs(prev => {
      if (prev.find(t => t.path === file.path)) return prev;
      return [...prev, { path: file.path, name: file.name }];
    });
    setActivePath(file.path);
    if (isMobile) setMobileView('editor');
  }, [isMobile]);

  const closeTab = useCallback((filePath: string) => {
    if (dirtySet.has(filePath)) {
      if (!window.confirm('该文件有未保存修改，确定关闭？')) return;
    }
    setTabs(prev => {
      const next = prev.filter(t => t.path !== filePath);
      if (activePath === filePath) {
        setActivePath(next.length > 0 ? next[next.length - 1].path : null);
      }
      return next;
    });
    setDirtySet(prev => {
      if (!prev.has(filePath)) return prev;
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
  }, [activePath, dirtySet]);

  const handleDirtyChange = useCallback((filePath: string, dirty: boolean) => {
    setDirtySet(prev => {
      const has = prev.has(filePath);
      if (has === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(filePath);
      else next.delete(filePath);
      return next;
    });
  }, []);

  // 桌面：双栏；移动：单栏切换
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <TopBar
          path={path}
          isGitRepo={isGitRepo}
          gitRefreshing={gitRefreshing}
          onBack={() => navigate('/files')}
          onToggleGit={() => setMobileView('git')}
          onRefreshGit={loadGitStatus}
          compact
        />
        <MobileNav view={mobileView} onChange={setMobileView} isGitRepo={isGitRepo} hasTabs={tabs.length > 0} />
        <div className="flex-1 min-h-0 relative">
          <div className={`absolute inset-0 ${mobileView === 'tree' ? '' : 'hidden'}`}>
            <FileTree rootPath={path} activeFilePath={activePath} gitStatus={gitStatus} onOpenFile={openFile} />
          </div>
          <div className={`absolute inset-0 ${mobileView === 'editor' ? '' : 'hidden'} flex flex-col`}>
            {tabs.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <EditorTabs tabs={tabs} activePath={activePath} dirtySet={dirtySet} onSelect={setActivePath} onClose={closeTab} />
                <div className="flex-1 min-h-0">
                  {tabs.map(tab => (
                    <EditorPane
                      key={tab.path}
                      filePath={tab.path}
                      fileName={tab.name}
                      active={tab.path === activePath}
                      onDirtyChange={(d) => handleDirtyChange(tab.path, d)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {mobileView === 'git' && isGitRepo && (
            <div className="absolute inset-0">
              <GitPanel repoPath={path} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // 桌面布局
  return (
    <div className="flex flex-col h-full">
      <TopBar
        path={path}
        isGitRepo={isGitRepo}
        gitRefreshing={gitRefreshing}
        onBack={() => navigate('/files')}
        onToggleGit={() => setGitPanelOpen(o => !o)}
        onRefreshGit={loadGitStatus}
      />
      <div className="flex-1 min-h-0 flex">
        {/* 左侧：文件树 + (可选) Git 面板 */}
        <div className={`shrink-0 border-r border-zinc-800 ${gitPanelOpen && isGitRepo ? 'w-[480px]' : 'w-64'}`}>
          <div className={`h-full ${gitPanelOpen ? 'grid grid-cols-2' : ''}`}>
            <div className="h-full min-w-0 border-r border-zinc-800">
              <FileTree rootPath={path} activeFilePath={activePath} gitStatus={gitStatus} onOpenFile={openFile} />
            </div>
            {gitPanelOpen && (
              <div className="h-full min-w-0">
                <GitPanel repoPath={path} />
              </div>
            )}
          </div>
        </div>
        {/* 右侧：编辑区 */}
        <div className="flex-1 min-w-0 flex flex-col">
          {tabs.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <EditorTabs tabs={tabs} activePath={activePath} dirtySet={dirtySet} onSelect={setActivePath} onClose={closeTab} />
              <div className="flex-1 min-h-0 relative">
                {tabs.map(tab => (
                  <EditorPane
                    key={tab.path}
                    filePath={tab.path}
                    fileName={tab.name}
                    active={tab.path === activePath}
                    onDirtyChange={(d) => handleDirtyChange(tab.path, d)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TopBar({ path, isGitRepo, gitRefreshing, onBack, onToggleGit, onRefreshGit, compact }: {
  path: string;
  isGitRepo: boolean;
  gitRefreshing: boolean;
  onBack: () => void;
  onToggleGit: () => void;
  onRefreshGit: () => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
      <button onClick={onBack} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-300 hover:bg-zinc-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        {!compact && <span>返回</span>}
      </button>
      <div className="flex items-center gap-1.5 min-w-0 flex-1 text-xs">
        <FolderTree className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-zinc-400 truncate font-mono" title={path}>{path}</span>
      </div>
      {isGitRepo && (
        <>
          <button
            onClick={onRefreshGit}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
            title="刷新 Git 状态"
            disabled={gitRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${gitRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onToggleGit}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
            {!compact && <span>Git</span>}
          </button>
        </>
      )}
    </div>
  );
}

function MobileNav({ view, onChange, isGitRepo, hasTabs }: {
  view: MobileView;
  onChange: (v: MobileView) => void;
  isGitRepo: boolean;
  hasTabs: boolean;
}) {
  const items: { id: MobileView; label: string; icon: typeof FolderTree; show: boolean }[] = [
    { id: 'tree', label: '文件', icon: FolderTree, show: true },
    { id: 'editor', label: '编辑', icon: Code2, show: true },
    { id: 'git', label: 'Git', icon: GitBranch, show: isGitRepo },
  ];
  return (
    <div className="flex border-b border-zinc-800 bg-zinc-900 shrink-0">
      {items.filter(i => i.show).map(item => {
        const Icon = item.icon;
        const active = view === item.id;
        const disabled = item.id === 'editor' && !hasTabs;
        return (
          <button
            key={item.id}
            onClick={() => !disabled && onChange(item.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${
              active ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-zinc-400'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-3 bg-zinc-950">
      <FileText className="w-12 h-12 opacity-40" />
      <p className="text-sm">从左侧文件树选择文件以开始编辑</p>
      <p className="text-[11px] text-zinc-700">支持 Ctrl/Cmd+S 快速保存</p>
    </div>
  );
}
