import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/app';
import { gitApi, fileApi } from '@/api/client';
import type { FileItem } from '@/types';
import FileTree, { type GitStatusMap, type ClipboardData, type NodeAction } from './FileTree';
import EditorTabs, { type OpenTab } from './EditorTabs';
import EditorPane from './EditorPane';
import GitPanel from './GitPanel';
import PromptDialog from './PromptDialog';
import ConfirmDialog from './ConfirmDialog';
import { ArrowLeft, GitBranch, FolderTree, Code2, FileText, RefreshCw } from 'lucide-react';

interface CodeWorkspaceProps {
  path: string;
}

type MobileView = 'tree' | 'editor' | 'git';

type DialogResult =
  | { kind: 'new-file'; parentDir: string }
  | { kind: 'new-dir'; parentDir: string }
  | { kind: 'rename'; file: FileItem }
  | { kind: 'delete'; file: FileItem }
  | { kind: 'paste-conflict'; source: string; targetDir: string; mode: 'copy' | 'move'; suggested: string }
  | null;

function joinPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir.replace(/\/$/, '')}/${name}`;
}

function basename(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1);
}

function isAncestorOrSelf(maybeChild: string, ancestor: string): boolean {
  return maybeChild === ancestor || maybeChild.startsWith(ancestor + '/');
}

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [dialog, setDialog] = useState<DialogResult>(null);
  const [busy, setBusy] = useState(false);

  // 文件操作运行中保持鼠标的对话上下文，避免 stale closure
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const dirtyRef = useRef(dirtySet);
  dirtyRef.current = dirtySet;

  // ===== Git 状态加载 =====
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

  const refreshAll = useCallback(() => {
    setRefreshKey(k => k + 1);
    loadGitStatus();
  }, [loadGitStatus]);

  // ===== Tab 管理 =====
  const openFile = useCallback((file: FileItem) => {
    setTabs(prev => {
      if (prev.find(t => t.path === file.path)) return prev;
      return [...prev, { path: file.path, name: file.name }];
    });
    setActivePath(file.path);
    if (isMobile) setMobileView('editor');
  }, [isMobile]);

  const closeTab = useCallback((filePath: string, skipConfirm = false) => {
    if (!skipConfirm && dirtyRef.current.has(filePath)) {
      if (!window.confirm('该文件有未保存修改，确定关闭？')) return false;
    }
    setTabs(prev => {
      const next = prev.filter(t => t.path !== filePath);
      setActivePath(prevActive => {
        if (prevActive !== filePath) return prevActive;
        return next.length > 0 ? next[next.length - 1].path : null;
      });
      return next;
    });
    setDirtySet(prev => {
      if (!prev.has(filePath)) return prev;
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
    return true;
  }, []);

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

  // 更新单个 tab 的 path（用于重命名）
  const renameTab = useCallback((oldPath: string, newPath: string) => {
    setTabs(prev => prev.map(t => {
      if (t.path !== oldPath) return t;
      return { path: newPath, name: basename(newPath) };
    }));
    setActivePath(prev => prev === oldPath ? newPath : prev);
    setDirtySet(prev => {
      if (!prev.has(oldPath)) return prev;
      const next = new Set(prev);
      next.delete(oldPath);
      next.add(newPath);
      return next;
    });
  }, []);

  // 替换路径前缀（用于移动目录）
  const rebaseTabs = useCallback((oldPrefix: string, newPrefix: string) => {
    setTabs(prev => prev.map(t => {
      if (!t.path.startsWith(oldPrefix + '/') && t.path !== oldPrefix) return t;
      const newPath = newPrefix + t.path.slice(oldPrefix.length);
      return { path: newPath, name: basename(newPath) };
    }));
    setActivePath(prev => {
      if (!prev) return prev;
      if (prev === oldPrefix) return newPrefix;
      if (prev.startsWith(oldPrefix + '/')) return newPrefix + prev.slice(oldPrefix.length);
      return prev;
    });
    setDirtySet(prev => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach(p => {
        if (p === oldPrefix) { next.add(newPrefix); changed = true; }
        else if (p.startsWith(oldPrefix + '/')) { next.add(newPrefix + p.slice(oldPrefix.length)); changed = true; }
        else next.add(p);
      });
      return changed ? next : prev;
    });
  }, []);

  // 关闭某目录及其后代下的所有 Tab（用于删除目录）
  const closeTabsUnder = useCallback((dirPath: string) => {
    const toClose = tabsRef.current
      .filter(t => isAncestorOrSelf(t.path, dirPath))
      .map(t => t.path);
    toClose.forEach(p => closeTab(p, true));
  }, [closeTab]);

  // ===== 文件操作 =====
  const handleAction = useCallback((action: NodeAction) => {
    switch (action.type) {
      case 'new-file':
        setDialog({ kind: 'new-file', parentDir: action.parentDir });
        break;
      case 'new-dir':
        setDialog({ kind: 'new-dir', parentDir: action.parentDir });
        break;
      case 'rename':
        setDialog({ kind: 'rename', file: action.file });
        break;
      case 'delete':
        setDialog({ kind: 'delete', file: action.file });
        break;
      case 'copy':
        setClipboard({ path: action.file.path, mode: 'copy' });
        addNotification({ type: 'info', message: `已复制: ${action.file.name}` });
        break;
      case 'cut':
        setClipboard({ path: action.file.path, mode: 'move' });
        addNotification({ type: 'info', message: `已剪切: ${action.file.name}` });
        break;
      case 'paste':
        if (!clipboard) return;
        if (clipboard.mode === 'move' && isAncestorOrSelf(action.targetDir, clipboard.path)) {
          addNotification({ type: 'error', message: '不能移动到自身或子目录' });
          return;
        }
        if (clipboard.path === action.targetDir) {
          addNotification({ type: 'error', message: '源和目标相同' });
          return;
        }
        void doPaste(clipboard, action.targetDir);
        break;
      case 'move-files':
        void doMoveFiles(action.sources, action.targetDir);
        break;
    }
  }, [clipboard, addNotification]);

  const doPaste = useCallback(async (clip: ClipboardData, targetDir: string) => {
    const sourceName = basename(clip.path);
    const targetPath = joinPath(targetDir, sourceName);
    setBusy(true);
    try {
      if (clip.mode === 'copy') {
        await fileApi.copy(clip.path, targetPath);
        addNotification({ type: 'success', message: `已复制到 ${targetDir}` });
      } else {
        await fileApi.move(clip.path, targetPath);
        rebaseTabs(clip.path, targetPath);
        addNotification({ type: 'success', message: `已移动到 ${targetDir}` });
        setClipboard(null);
      }
      refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      // 简单冲突检测：目标已存在
      if (/EEXIST|already exists/i.test(msg)) {
        const suggested = sourceName.replace(/(\.[^.]+)?$/, m => `_copy${m || ''}`);
        setDialog({ kind: 'paste-conflict', source: clip.path, targetDir, mode: clip.mode, suggested });
      } else {
        addNotification({ type: 'error', message: `粘贴失败: ${msg}` });
      }
    } finally {
      setBusy(false);
    }
  }, [addNotification, rebaseTabs, refreshAll]);

  const doMoveFiles = useCallback(async (sources: string[], targetDir: string) => {
    setBusy(true);
    try {
      for (const src of sources) {
        if (isAncestorOrSelf(targetDir, src)) {
          addNotification({ type: 'error', message: `不能移动到自身或子目录: ${basename(src)}` });
          continue;
        }
        const target = joinPath(targetDir, basename(src));
        await fileApi.move(src, target);
        rebaseTabs(src, target);
      }
      addNotification({ type: 'success', message: `已移动 ${sources.length} 项` });
      refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '移动失败';
      addNotification({ type: 'error', message: `移动失败: ${msg}` });
    } finally {
      setBusy(false);
    }
  }, [addNotification, rebaseTabs, refreshAll]);

  const doCreateFile = useCallback(async (parentDir: string, name: string) => {
    setBusy(true);
    try {
      const fullPath = joinPath(parentDir, name);
      await fileApi.write(fullPath, '');
      addNotification({ type: 'success', message: `已创建: ${name}` });
      setDialog(null);
      refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建失败';
      addNotification({ type: 'error', message: `创建失败: ${msg}` });
    } finally {
      setBusy(false);
    }
  }, [addNotification, refreshAll]);

  const doCreateDir = useCallback(async (parentDir: string, name: string) => {
    setBusy(true);
    try {
      await fileApi.mkdir(parentDir, name);
      addNotification({ type: 'success', message: `已创建目录: ${name}` });
      setDialog(null);
      refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建失败';
      addNotification({ type: 'error', message: `创建目录失败: ${msg}` });
    } finally {
      setBusy(false);
    }
  }, [addNotification, refreshAll]);

  const doRename = useCallback(async (file: FileItem, newName: string) => {
    setBusy(true);
    try {
      await fileApi.rename(file.path, newName);
      const newPath = joinPath(file.path.slice(0, file.path.lastIndexOf('/')), newName);
      renameTab(file.path, newPath);
      addNotification({ type: 'success', message: `已重命名为: ${newName}` });
      setDialog(null);
      refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '重命名失败';
      addNotification({ type: 'error', message: `重命名失败: ${msg}` });
    } finally {
      setBusy(false);
    }
  }, [addNotification, renameTab, refreshAll]);

  const doDelete = useCallback(async (file: FileItem) => {
    setBusy(true);
    try {
      if (file.isDirectory) {
        await fileApi.rmdir(file.path);
      } else {
        await fileApi.delete(file.path);
      }
      // 关闭受影响的 Tab
      if (file.isDirectory) {
        closeTabsUnder(file.path);
      } else {
        closeTab(file.path, true);
      }
      addNotification({ type: 'success', message: `已删除: ${file.name}` });
      setDialog(null);
      refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败';
      addNotification({ type: 'error', message: `删除失败: ${msg}` });
    } finally {
      setBusy(false);
    }
  }, [addNotification, closeTab, closeTabsUnder, refreshAll]);

  const doPasteWithRename = useCallback(async (source: string, targetDir: string, mode: 'copy' | 'move', newName: string) => {
    setBusy(true);
    try {
      const targetPath = joinPath(targetDir, newName);
      if (mode === 'copy') {
        await fileApi.copy(source, targetPath);
      } else {
        await fileApi.move(source, targetPath);
        rebaseTabs(source, targetPath);
        setClipboard(null);
      }
      addNotification({ type: 'success', message: `已${mode === 'copy' ? '复制' : '移动'}为: ${newName}` });
      setDialog(null);
      refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      addNotification({ type: 'error', message: `粘贴失败: ${msg}` });
    } finally {
      setBusy(false);
    }
  }, [addNotification, rebaseTabs, refreshAll]);

  // ===== 渲染 =====
  const fileTreeProps = {
    rootPath: path,
    activeFilePath: activePath,
    gitStatus,
    refreshKey,
    clipboard,
    onOpenFile: openFile,
    onAction: handleAction,
    onRefresh: refreshAll,
  };

  const editorArea = (
    <>
      {tabs.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <EditorTabs tabs={tabs} activePath={activePath} dirtySet={dirtySet} onSelect={setActivePath} onClose={(p) => closeTab(p)} />
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
    </>
  );

  const dialogNode = renderDialog({
    dialog, busy,
    onCreateFile: doCreateFile,
    onCreateDir: doCreateDir,
    onRename: doRename,
    onDelete: doDelete,
    onPasteWithRename: doPasteWithRename,
    onClose: () => !busy && setDialog(null),
  });

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
            <FileTree {...fileTreeProps} />
          </div>
          <div className={`absolute inset-0 ${mobileView === 'editor' ? '' : 'hidden'} flex flex-col`}>
            {editorArea}
          </div>
          {mobileView === 'git' && isGitRepo && (
            <div className="absolute inset-0">
              <GitPanel repoPath={path} />
            </div>
          )}
        </div>
        {dialogNode}
      </div>
    );
  }

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
        <div className={`shrink-0 border-r border-zinc-800 ${gitPanelOpen && isGitRepo ? 'w-[480px]' : 'w-64'}`}>
          <div className={`h-full ${gitPanelOpen ? 'grid grid-cols-2' : ''}`}>
            <div className="h-full min-w-0 border-r border-zinc-800">
              <FileTree {...fileTreeProps} />
            </div>
            {gitPanelOpen && (
              <div className="h-full min-w-0">
                <GitPanel repoPath={path} />
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          {editorArea}
        </div>
      </div>
      {dialogNode}
    </div>
  );
}

function renderDialog({
  dialog, busy,
  onCreateFile, onCreateDir, onRename, onDelete, onPasteWithRename, onClose,
}: {
  dialog: DialogResult;
  busy: boolean;
  onCreateFile: (dir: string, name: string) => void;
  onCreateDir: (dir: string, name: string) => void;
  onRename: (file: FileItem, newName: string) => void;
  onDelete: (file: FileItem) => void;
  onPasteWithRename: (source: string, targetDir: string, mode: 'copy' | 'move', newName: string) => void;
  onClose: () => void;
}) {
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'new-file':
      return (
        <PromptDialog
          title="新建文件"
          label={`路径: ${dialog.parentDir}/`}
          placeholder="例如: src/utils.ts"
          confirmText="创建"
          busy={busy}
          onConfirm={(name) => onCreateFile(dialog.parentDir, name)}
          onClose={onClose}
        />
      );
    case 'new-dir':
      return (
        <PromptDialog
          title="新建文件夹"
          label={`路径: ${dialog.parentDir}/`}
          placeholder="例如: components"
          confirmText="创建"
          busy={busy}
          onConfirm={(name) => onCreateDir(dialog.parentDir, name)}
          onClose={onClose}
        />
      );
    case 'rename':
      return (
        <PromptDialog
          title="重命名"
          label="新名称"
          defaultValue={dialog.file.name}
          confirmText="重命名"
          busy={busy}
          onConfirm={(name) => onRename(dialog.file, name)}
          onClose={onClose}
        />
      );
    case 'delete':
      return (
        <ConfirmDialog
          title="确认删除"
          message={dialog.file.isDirectory
            ? `将删除文件夹及其所有内容（移至回收站）`
            : `将移至回收站`}
          detail={dialog.file.path}
          confirmText="删除"
          danger
          busy={busy}
          onConfirm={() => onDelete(dialog.file)}
          onClose={onClose}
        />
      );
    case 'paste-conflict':
      return (
        <PromptDialog
          title="目标已存在同名"
          label={`保留为新名称 (${dialog.mode === 'copy' ? '复制' : '移动'})`}
          defaultValue={dialog.suggested}
          confirmText="确定"
          busy={busy}
          onConfirm={(name) => onPasteWithRename(dialog.source, dialog.targetDir, dialog.mode, name)}
          onClose={onClose}
        />
      );
  }
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
      <p className="text-[11px] text-zinc-700">支持 Ctrl/Cmd+S 快速保存 · 右键或拖拽管理文件</p>
    </div>
  );
}
