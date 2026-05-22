import { useState, useCallback, useEffect, useRef } from 'react';
import { fileApi, uploadApi, apiClient, systemApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import type { AxiosError } from 'axios';
import FileEditor from '@/components/file-manager/FileEditor';
import CompressDialog from '@/components/file-manager/CompressDialog';
import ExtractDialog from '@/components/file-manager/ExtractDialog';
import TrashView from '@/components/file-manager/TrashView';
import ToolsView from '@/components/file-manager/ToolsView';
import SelectionBar from '@/components/file-manager/SelectionBar';
import ActionSheet from '@/components/file-manager/ActionSheet';
import {
  Folder, File as FileIcon, ChevronRight, ChevronUp, ChevronDown, Home,
  RefreshCw, Search, Upload, FolderPlus, FilePlus,
  Trash2, Edit3, ArrowUpDown, Loader2, WifiOff,
  MoreVertical, Lock, Download, Scissors, Copy,
  FileArchive, Wrench, Plus, X, Check, Square, ClipboardCheck, Server, BookOpen
} from 'lucide-react';
import type { FileItem, RawFileItem } from '@/types';

/** Convert backend raw items to frontend FileItem format */
function normalizeItems(rawItems: RawFileItem[] | undefined, parentPath: string): FileItem[] {
  if (!rawItems || !Array.isArray(rawItems)) return [];
  return rawItems.map((item) => ({
    name: item.name,
    path: parentPath === '/' ? `/${item.name}` : `${parentPath}/${item.name}`,
    size: item.size || 0,
    modified: formatDate(item.modified),
    isDirectory: item.type === 'directory',
    permissions: item.permissions || (item.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--'),
    owner: 'root',
    group: 'root',
  }));
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '-';
  try {
    const d = new Date(isoDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return isoDate.slice(0, 16).replace('T', ' ');
  }
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [path, setPath] = useState('/');
  const [currentRoot, setCurrentRoot] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable address bar
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const pathInputRef = useRef<HTMLInputElement>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null);

  // Calculate context menu position to prevent overflow
  const getContextMenuPosition = (x: number, y: number) => {
    const menuWidth = 192; // w-48 = 12rem = 192px
    const menuHeight = 400; // approximate max height
    const padding = 8;

    let adjustedX = x;
    let adjustedY = y;

    // Check right boundary
    if (x + menuWidth > window.innerWidth - padding) {
      adjustedX = window.innerWidth - menuWidth - padding;
    }

    // Check left boundary
    if (adjustedX < padding) {
      adjustedX = padding;
    }

    // Check bottom boundary
    if (y + menuHeight > window.innerHeight - padding) {
      adjustedY = window.innerHeight - menuHeight - padding;
    }

    // Check top boundary
    if (adjustedY < padding) {
      adjustedY = padding;
    }

    return { x: adjustedX, y: adjustedY };
  };

  // Inline rename
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New file/folder
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newName, setNewName] = useState('');
  const newMenuRef = useRef<HTMLDivElement>(null);

  // Dialogs
  const [compressFiles, setCompressFiles] = useState<string[] | null>(null);
  const [extractFile, setExtractFile] = useState<FileItem | null>(null);
  const [chmodFile, setChmodFile] = useState<FileItem | null>(null);
  const [chmodValue, setChmodValue] = useState('755');

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);

  // Action sheet for mobile
  const [actionSheetFile, setActionSheetFile] = useState<FileItem | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  // FAB menu
  const [showFabMenu, setShowFabMenu] = useState(false);

  const isMobile = useAppStore((s) => s.isMobile);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const addNotification = useAppStore((s) => s.addNotification);
  const clipboard = useAppStore((s) => s.clipboard);
  const setClipboard = useAppStore((s) => s.setClipboard);
  const clearClipboard = useAppStore((s) => s.clearClipboard);

  const toAbs = useCallback((relPath: string) => {
    if (!currentRoot) return relPath;
    if (relPath === '/') return currentRoot;
    return `${currentRoot.replace(/\/$/, '')}${relPath}`;
  }, [currentRoot]);

  const toRel = useCallback((absPath: string) => {
    if (!currentRoot) return absPath;
    if (currentRoot === '/') return absPath;
    if (absPath === currentRoot) return '/';
    if (absPath.startsWith(currentRoot + '/'))
      return absPath.slice(currentRoot.length);
    return null;
  }, [currentRoot]);

  useEffect(() => {
    if (viewMode === 'node' || viewMode === 'skill') {
      systemApi.setRoot('/').then(() => setCurrentRoot('/')).catch(() => {});
    } else {
      systemApi.getRoot().then((res) => {
        const root = res.data.root || res.data || '/var/www/wwwroot';
        if (root !== '/var/www/wwwroot') {
          systemApi.setRoot('/var/www/wwwroot').then(() => setCurrentRoot('/var/www/wwwroot')).catch(() => setCurrentRoot(root));
        } else {
          setCurrentRoot(root);
        }
      }).catch(() => setCurrentRoot('/var/www/wwwroot'));
    }
  }, []);

  const loadFiles = useCallback(async (p: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fileApi.list(p);
      const items = normalizeItems(res.data.items, res.data.path || p);
      setFiles(items);
      setPath(res.data.path || p);
      if (res.data.root) setCurrentRoot(res.data.root);
      setSelected(new Set());
    } catch (err: unknown) {
      console.error('[Files] loadFiles error:', err);
      const axiosErr = err as AxiosError<{ error?: string; message?: string }>;
      if (axiosErr.response?.status === 404) {
        setLoadError('路径不存在');
      } else if (axiosErr.message === 'Network Error') {
        setLoadError('API 连接失败，请检查网络');
      } else {
        setLoadError(axiosErr.response?.data?.error || axiosErr.response?.data?.message || '请求失败');
      }
      setFiles([]);
      setPath(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFiles('/'); }, [loadFiles]);

  // Switch root and path when entering/leaving node/skill views
  const prevViewMode = useRef(viewMode);
  useEffect(() => {
    const prev = prevViewMode.current;
    const curr = viewMode;
    if (curr === prev) return;

    const needsRootSlash = curr === 'node' || curr === 'skill';
    const neededRootSlash = prev === 'node' || prev === 'skill';

    if (needsRootSlash && !neededRootSlash) {
      systemApi.setRoot('/').then(() => {
        setCurrentRoot('/');
        if (curr === 'node') { setPath('/var/server'); loadFiles('/var/server'); }
        else { setPath('/root/.skill'); loadFiles('/root/.skill'); }
      }).catch(() => {});
    } else if (!needsRootSlash && neededRootSlash) {
      systemApi.setRoot('/var/www/wwwroot').then(() => {
        setCurrentRoot('/var/www/wwwroot');
        setPath('/');
        loadFiles('/');
      }).catch(() => {});
    } else if (needsRootSlash && neededRootSlash) {
      if (curr === 'node') { setPath('/var/server'); loadFiles('/var/server'); }
      else { setPath('/root/.skill'); loadFiles('/root/.skill'); }
    }
    prevViewMode.current = viewMode;
  }, [viewMode]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // Close new menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    };
    if (showNewMenu) {
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [showNewMenu]);

  // Initialize chmodValue when chmodFile changes
  useEffect(() => {
    if (chmodFile) {
      // Convert symbolic permission to numeric if needed
      const perm = chmodFile.permissions;
      if (perm.startsWith('-')) {
        // Symbolic format like -rw-r--r--, convert to numeric
        const owner = perm.slice(1, 4);
        const group = perm.slice(4, 7);
        const other = perm.slice(7, 10);

        const toNumeric = (str: string) => {
          let num = 0;
          if (str.includes('r')) num += 4;
          if (str.includes('w')) num += 2;
          if (str.includes('x')) num += 1;
          return num;
        };

        setChmodValue(`${toNumeric(owner)}${toNumeric(group)}${toNumeric(other)}`);
      } else {
        setChmodValue(perm);
      }
    }
  }, [chmodFile]);

  const navigate = useCallback((file: FileItem) => {
    if (file.isDirectory) {
      const newPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
      loadFiles(newPath);
    } else {
      setEditingFile(file);
    }
  }, [path, loadFiles]);

  const goUp = () => {
    if (path === '/') return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    loadFiles(parts.length === 0 ? '/' : `/${parts.join('/')}`);
  };

  const goHome = () => loadFiles('/');

  const filtered = files
    .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return b.size - a.size;
      return new Date(b.modified).getTime() - new Date(a.modified).getTime();
    });

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  };

  const toggleSelectAll = () => {
    const allNames = filtered.map(f => f.name);
    if (selected.size === allNames.length && allNames.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allNames));
    }
  };

  const isAllSelected = filtered.length > 0 && selected.size === filtered.length;
  const isSomeSelected = selected.size > 0 && selected.size < filtered.length;

  // ===== Actions =====

  const handleRename = async (oldName: string) => {
    if (!renameValue || renameValue === oldName) {
      setRenaming(null);
      return;
    }
    const oldPath = path === '/' ? `/${oldName}` : `${path}/${oldName}`;
    const newPath = path === '/' ? `/${renameValue}` : `${path}/${renameValue}`;
    try {
      await fileApi.rename(oldPath, newPath);
      addNotification({ type: 'success', message: `已重命名为 ${renameValue}` });
      loadFiles(path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      addNotification({ type: 'error', message: `重命名失败: ${msg}` });
    }
    setRenaming(null);
    setContextMenu(null);
  };

  const handleChmod = async (file: FileItem, permissions: string) => {
    const filePath = file.path;
    try {
      await fileApi.setPermissions(filePath, permissions);
      addNotification({ type: 'success', message: `权限已修改为 ${permissions}` });
      loadFiles(path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      addNotification({ type: 'error', message: `修改权限失败: ${msg}` });
    }
    setChmodFile(null);
  };

  const handleDelete = async (names: string[]) => {
    const confirmed = window.confirm(`确定要删除以下 ${names.length} 个项目？\n${names.join('\n')}\n\n删除后将无法恢复！`);
    if (!confirmed) return;
    let success = 0;
    for (const name of names) {
      const filePath = path === '/' ? `/${name}` : `${path}/${name}`;
      const file = files.find((f) => f.name === name);
      const isDir = file?.isDirectory ?? false;
      try {
        if (isDir) {
          await fileApi.rmdir(filePath);
        } else {
          await fileApi.delete(filePath);
        }
        success++;
      } catch {
        addNotification({ type: 'error', message: `删除 ${name} 失败` });
      }
    }
    addNotification({ type: 'success', message: `已删除 ${success} 个项目` });
    setSelected(new Set());
    setContextMenu(null);
    loadFiles(path);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadApi.upload(file, path);
      addNotification({ type: 'success', message: `上传成功: ${file.name}` });
      loadFiles(path);
    } catch {
      addNotification({ type: 'error', message: '上传失败' });
    }
    e.target.value = '';
  };

  const handleNewFile = async () => {
    if (!newName) return;
    const filePath = path === '/' ? `/${newName}` : `${path}/${newName}`;
    try {
      await fileApi.write(filePath, '', 'utf-8');
      addNotification({ type: 'success', message: `文件 ${newName} 已创建` });
      loadFiles(path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      addNotification({ type: 'error', message: `创建失败: ${msg}` });
    }
    setNewName('');
    setShowNewFileDialog(false);
  };

  const handleNewFolder = async () => {
    if (!newName) return;
    try {
      await fileApi.mkdir(path, newName);
      addNotification({ type: 'success', message: `文件夹 ${newName} 已创建` });
      loadFiles(path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      addNotification({ type: 'error', message: `创建失败: ${msg}` });
    }
    setNewName('');
    setShowNewFolderDialog(false);
  };

  const handleDownload = async (file: FileItem) => {
    try {
      addNotification({ type: 'info', message: `正在准备下载: ${file.name}` });

      // Use axios to download with authentication
      const response = await apiClient.get('/files/download', {
        params: { path: file.path },
        responseType: 'blob',
      });

      // Create blob URL and trigger download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addNotification({ type: 'success', message: `下载完成: ${file.name}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '下载失败';
      addNotification({ type: 'error', message: `下载失败: ${msg}` });
    }
  };

  const selectedPaths = Array.from(selected).map(name => path === '/' ? `/${name}` : `${path}/${name}`);

  // Paste functionality
  const handlePaste = async (paths: string[], mode: 'move' | 'copy', targetPath: string) => {
    try {
      for (const fromPath of paths) {
        const name = fromPath.split('/').pop() || '';
        const toPath = targetPath === '/' ? `/${name}` : `${targetPath}/${name}`;
        if (mode === 'move') {
          await fileApi.move(fromPath, toPath);
        } else {
          await fileApi.copy(fromPath, toPath);
        }
      }
      addNotification({ type: 'success', message: mode === 'move' ? '移动完成' : '复制完成' });
      loadFiles(path);
      setSelected(new Set());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      addNotification({ type: 'error', message: `${mode === 'move' ? '移动' : '复制'}失败: ${msg}` });
    }
  };

  // Drag & drop
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files.length) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await uploadApi.upload(file, path);
        addNotification({ type: 'success', message: `上传成功: ${file.name}` });
      } catch {
        addNotification({ type: 'error', message: `上传失败: ${file.name}` });
      }
    }
    loadFiles(path);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // ===== View mode switcher (integrated into header) =====
  const viewButtons = [
    { id: 'files' as const, label: '文件', icon: Folder },
    { id: 'node' as const, label: 'node项目管理', icon: Server },
    { id: 'skill' as const, label: 'skill管理', icon: BookOpen },
    { id: 'trash' as const, label: '回收站', icon: Trash2 },
    { id: 'tools' as const, label: '工具', icon: Wrench },
  ];

  // Mobile editor overlay
  if (isMobile && editingFile) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950">
        <FileEditor filePath={editingFile.path} fileName={editingFile.name} onClose={() => setEditingFile(null)} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {/* ===== File list panel ===== */}
      <div className="flex flex-col w-full">

        {/* View mode tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
          {viewButtons.map((btn) => {
            const Icon = btn.icon;
            const isActive = viewMode === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => setViewMode(btn.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
                  ${isActive ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{btn.label}</span>
              </button>
            );
          })}
        </div>

        {/* Render different views */}
        {viewMode !== 'files' && viewMode !== 'node' && viewMode !== 'skill' ? (
          <div className="flex-1 min-h-0">
            {viewMode === 'trash' && <TrashView />}
            {viewMode === 'tools' && <ToolsView />}
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="border-b border-zinc-800 bg-zinc-900/50 shrink-0">
              {/* Row 1: nav buttons + search + actions */}
              <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5 md:pb-2.5 md:pt-2.5">
                <button onClick={goHome} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"><Home className="w-4 h-4" /></button>
                <button onClick={goUp} disabled={path === '/'} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => loadFiles(path)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>

                {/* Path - PC inline */}
                {!isMobile && (
                <div className="flex-1 min-w-0 hidden md:flex items-center gap-1 px-2">
                  {editingPath ? (
                    <input
                      ref={pathInputRef}
                      type="text"
                      value={pathInput}
                      onChange={(e) => setPathInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if ((e as any).nativeEvent?.isComposing) return;
                        if (e.key === 'Enter') {
                          setEditingPath(false);
                          const input = pathInput || '/';
                          const rel = toRel(input);
                          if (rel !== null) {
                            loadFiles(rel);
                          } else if (input.startsWith('/') && currentRoot && currentRoot !== '/') {
                            try {
                              await systemApi.setRoot('/');
                              setCurrentRoot('/');
                              loadFiles(input);
                            } catch {
                              addNotification({ type: 'error', message: `路径超出文件管理器范围，且无法自动切换根路径` });
                            }
                          } else {
                            loadFiles(input);
                          }
                        } else if (e.key === 'Escape') {
                          setEditingPath(false);
                        }
                      }}
                      className="w-full px-2 py-1 rounded-md bg-zinc-700/50 border border-emerald-500/50 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                      autoFocus
                    />
                  ) : (
                    <div
                      className="flex items-center gap-1 overflow-x-auto cursor-text flex-1"
                      onClick={() => {
                        setPathInput(toAbs(path));
                        setEditingPath(true);
                        setTimeout(() => pathInputRef.current?.select(), 0);
                      }}
                    >
                      {toAbs(path).split('/').filter(Boolean).map((part, i, arr) => (
                        <span key={i} className="flex items-center shrink-0">
                          <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const abs = `/${arr.slice(0, i + 1).join('/')}`;
                              const rel = toRel(abs);
                              if (rel !== null) {
                                loadFiles(rel);
                              } else if (abs.startsWith('/') && currentRoot && currentRoot !== '/') {
                                try {
                                  await systemApi.setRoot('/');
                                  setCurrentRoot('/');
                                  loadFiles(abs);
                                } catch {
                                  addNotification({ type: 'error', message: '路径超出文件管理器范围，且无法自动切换根路径' });
                                }
                              } else {
                                loadFiles(abs);
                              }
                            }}
                            className="text-xs text-zinc-400 hover:text-white whitespace-nowrap px-1"
                          >
                            {part}
                          </button>
                        </span>
                      ))}
                      {toAbs(path) === '/' && <span className="text-xs text-zinc-500 px-1">/</span>}
                    </div>
                  )}
                </div>
                )}

                {/* Search */}
                <div className="relative flex-1 md:flex-initial min-w-0 max-w-full md:max-w-52">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input type="text" placeholder="搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
                </div>

                <button onClick={() => setSortBy(sortBy === 'name' ? 'date' : 'name')} className="hidden md:block p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="切换排序"><ArrowUpDown className="w-4 h-4" /></button>

                {/* New dropdown - PC */}
                {!isMobile && (
                <div className="relative" ref={newMenuRef}>
                  <button
                    onClick={() => setShowNewMenu(!showNewMenu)}
                    className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                      ${showNewMenu
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white'
                      }`}
                  >
                    <FilePlus className={`w-4 h-4 transition-transform duration-200 ${showNewMenu ? 'rotate-45' : ''}`} />
                    新建
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showNewMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown menu with animation */}
                  <div className={`absolute right-0 top-full mt-2 z-30 transition-all duration-200 origin-top
                    ${showNewMenu
                      ? 'opacity-100 scale-100 visible'
                      : 'opacity-0 scale-95 invisible pointer-events-none'
                    }`}>
                    <div className="relative bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden min-w-[200px]">
                      {/* Glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 pointer-events-none" />

                      {/* Menu items */}
                      <div className="relative py-1">
                        <button
                          onClick={() => { setShowNewFolderDialog(true); setNewName(''); setShowNewMenu(false); }}
                          className="group/item w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 group-hover/item:bg-amber-500/30 group-hover/item:text-amber-300 transition-all">
                            <FolderPlus className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-200 group-hover/item:text-white">新建文件夹</div>
                            <div className="text-xs text-slate-500">创建新目录</div>
                          </div>
                        </button>

                        <button
                          onClick={() => { setShowNewFileDialog(true); setNewName(''); setShowNewMenu(false); }}
                          className="group/item w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover/item:bg-emerald-500/30 group-hover/item:text-emerald-300 transition-all">
                            <FilePlus className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-200 group-hover/item:text-white">新建文件</div>
                            <div className="text-xs text-slate-500">创建空白文件</div>
                          </div>
                        </button>

                        <div className="mx-4 my-1 border-t border-slate-700/50" />

                        <button
                          onClick={() => { fileInputRef.current?.click(); setShowNewMenu(false); }}
                          className="group/item w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 group-hover/item:bg-indigo-500/30 group-hover/item:text-indigo-300 transition-all">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-200 group-hover/item:text-white">上传文件</div>
                            <div className="text-xs text-slate-500">从本地上传</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Breadcrumb / Editable path - mobile only */}
            <div className="px-4 pb-2.5 md:pb-0 md:pt-0 md:hidden">
              {editingPath ? (
                <input
                  ref={pathInputRef}
                  type="text"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if ((e as any).nativeEvent?.isComposing) return;
                    if (e.key === 'Enter') {
                      setEditingPath(false);
                      const input = pathInput || '/';
                      const rel = toRel(input);
                      if (rel !== null) {
                        loadFiles(rel);
                      } else if (input.startsWith('/') && currentRoot && currentRoot !== '/') {
                        try {
                          await systemApi.setRoot('/');
                          setCurrentRoot('/');
                          loadFiles(input);
                        } catch {
                          addNotification({ type: 'error', message: `路径超出文件管理器范围，且无法自动切换根路径` });
                        }
                      } else {
                        loadFiles(input);
                      }
                    } else if (e.key === 'Escape') {
                      setEditingPath(false);
                    }
                  }}
                  onBlur={() => setEditingPath(false)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-emerald-500/50 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  autoFocus
                />
              ) : (
                <div
                  className="flex items-center gap-1 px-3 py-2 rounded-md bg-zinc-800/50 border border-zinc-700/50 overflow-x-auto cursor-text"
                  onClick={() => {
                    setPathInput(toAbs(path));
                    setEditingPath(true);
                    setTimeout(() => pathInputRef.current?.select(), 0);
                  }}
                >
                  {toAbs(path).split('/').filter(Boolean).map((part, i, arr) => (
                    <span key={i} className="flex items-center shrink-0">
                      <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const abs = `/${arr.slice(0, i + 1).join('/')}`;
                          const rel = toRel(abs);
                          if (rel !== null) {
                            loadFiles(rel);
                          } else if (abs.startsWith('/') && currentRoot && currentRoot !== '/') {
                            try {
                              await systemApi.setRoot('/');
                              setCurrentRoot('/');
                              loadFiles(abs);
                            } catch {
                              addNotification({ type: 'error', message: '路径超出文件管理器范围，且无法自动切换根路径' });
                            }
                          } else {
                            loadFiles(abs);
                          }
                        }}
                        className="text-sm text-zinc-400 hover:text-white whitespace-nowrap px-1.5 py-0.5 rounded hover:bg-zinc-700/50"
                      >
                        {part}
                      </button>
                    </span>
                  ))}
                  {toAbs(path) === '/' && <span className="text-sm text-zinc-500 px-1">/</span>}
                </div>
              )}
            </div>
            </div>

            {/* Drag overlay */}
            {dragOver && (
              <div className="absolute inset-0 z-40 bg-emerald-500/10 border-4 border-dashed border-emerald-500/40 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                  <p className="text-lg text-emerald-400 font-medium">释放以上传文件</p>
                </div>
              </div>
            )}

            {/* API Error Banner */}
            {loadError && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-400">{loadError}</span>
              </div>
            )}

            {/* New File/Folder Dialogs */}
            {showNewFileDialog && (
              <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-800/30">
                <div className="flex items-center gap-2">
                  <FilePlus className="w-4 h-4 text-zinc-400" />
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="文件名" className="flex-1 min-w-0 px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-sm text-white outline-none focus:border-emerald-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleNewFile()} />
                  <button onClick={handleNewFile} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs">创建</button>
                  <button onClick={() => setShowNewFileDialog(false)} className="px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 text-xs">取消</button>
                </div>
              </div>
            )}
            {showNewFolderDialog && (
              <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-800/30">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-zinc-400" />
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="文件夹名" className="flex-1 min-w-0 px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-sm text-white outline-none focus:border-emerald-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()} />
                  <button onClick={handleNewFolder} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs">创建</button>
                  <button onClick={() => setShowNewFolderDialog(false)} className="px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 text-xs">取消</button>
                </div>
              </div>
            )}

            {/* Selection bar (when items selected or clipboard has content) */}
            {(selected.size > 0 || clipboard) && !isMobile && (
              <SelectionBar
                count={selected.size}
                onCancel={() => setSelected(new Set())}
                onDelete={() => handleDelete(Array.from(selected))}
                onMove={() => setClipboard(selectedPaths, 'move')}
                onCopy={() => setClipboard(selectedPaths, 'copy')}
                onCompress={() => setCompressFiles(selectedPaths)}
                onRename={() => {
                  const name = Array.from(selected)[0];
                  if (name) {
                    setRenaming(name);
                    setRenameValue(name);
                  }
                }}
                onDownload={() => {
                  const name = Array.from(selected)[0];
                  if (name) {
                    const file = files.find(f => f.name === name);
                    if (file) handleDownload(file);
                  }
                }}
                clipboard={clipboard || undefined}
                onPaste={clipboard ? () => handlePaste(clipboard.paths, clipboard.mode!, path) : undefined}
                onClearClipboard={clearClipboard}
              />
            )}

            {/* File List Header */}
            <div className="grid grid-cols-[auto_36px_1fr_auto] md:grid-cols-[auto_40px_1fr_auto_auto_auto_auto] gap-2 px-4 py-2 border-b border-zinc-800 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <button
                onClick={toggleSelectAll}
                className="w-8 flex items-center justify-center hover:bg-zinc-800 rounded transition-colors"
                title={isAllSelected ? '取消全选' : '全选'}
              >
                {isAllSelected ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : isSomeSelected ? (
                  <div className="w-4 h-4 relative">
                    <div className="absolute inset-0 bg-emerald-400 rounded-sm" style={{ clipPath: 'inset(50% 0 0 0)' }} />
                  </div>
                ) : (
                  <Square className="w-4 h-4 text-zinc-600" />
                )}
              </button>
              <span></span>
              <span>名称</span>
              <span className="hidden md:block w-20 text-right">大小</span>
              <span className="hidden md:block w-32 text-right">修改时间</span>
              <span className="hidden md:block w-20 text-right">权限</span>
              <span className="hidden md:block w-8"></span>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500"><Folder className="w-12 h-12 mb-2 opacity-30" /><p>{searchQuery ? '未找到匹配项' : '空文件夹'}</p></div>
              ) : (
                filtered.map((file) => (
                  <div key={file.name}
                    className={`grid grid-cols-[auto_36px_1fr_auto] md:grid-cols-[auto_40px_1fr_auto_auto_auto_auto] gap-2 px-4 py-2 border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/40
                      ${selected.has(file.name) ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : ''}`}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const pos = getContextMenuPosition(e.clientX, e.clientY);
                      setContextMenu({ x: pos.x, y: pos.y, file });
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(file.name)}
                      className="w-8 flex items-center justify-center hover:bg-zinc-800 rounded transition-colors"
                      title={selected.has(file.name) ? '取消选择' : '选择'}
                    >
                      {selected.has(file.name) ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-600" />
                      )}
                    </button>

                    {/* Icon - clickable to open */}
                    <div className="w-8 flex items-center justify-center cursor-pointer hover:bg-zinc-800/50 rounded transition-colors" onClick={() => navigate(file)}>
                      {file.isDirectory ? <Folder className="w-5 h-5 text-amber-400" /> : <FileIcon className="w-5 h-5 text-zinc-400" />}
                    </div>

                    {/* Name - inline rename or display */}
                    <div className="flex flex-col min-w-0 justify-center">
                      {renaming === file.name ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="flex-1 min-w-0 px-2 py-0.5 rounded bg-zinc-800 border border-emerald-500 text-sm text-white outline-none" autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(file.name); if (e.key === 'Escape') setRenaming(null); }}
                            onBlur={() => handleRename(file.name)} />
                        </div>
                      ) : (
                        <span
                          className="text-sm text-zinc-200 truncate cursor-pointer hover:text-white transition-colors"
                          onClick={() => navigate(file)}
                        >{file.name}</span>
                      )}
                      {isMobile && <span className="text-xs text-zinc-500">{formatSize(file.size)} &middot; {file.permissions}</span>}
                    </div>

                    {/* More button - mobile & desktop */}
                    <button
                      ref={(el) => {
                        if (el) {
                          el.onclick = (e) => {
                            e.stopPropagation();
                            if (isMobile) {
                              setActionSheetFile(file);
                              setShowActionSheet(true);
                            } else {
                              const rect = el.getBoundingClientRect();
                              const pos = getContextMenuPosition(rect.left, rect.bottom + 4);
                              setContextMenu({ x: pos.x, y: pos.y, file });
                            }
                          };
                        }
                      }}
                      className="w-8 flex items-center justify-center hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-white"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Metadata - desktop only */}
                    <span className="hidden md:block w-20 text-right text-xs text-zinc-400 select-none">{formatSize(file.size)}</span>
                    <span className="hidden md:block w-32 text-right text-xs text-zinc-400 select-none">{file.modified}</span>
                    <span className="hidden md:block w-20 text-right text-xs text-zinc-500 font-mono select-none cursor-pointer hover:text-emerald-400" onClick={() => { setChmodFile(file); }}>{file.permissions}</span>

                    {/* Spacer for desktop column alignment */}
                    <span className="hidden md:block w-8"></span>
                  </div>
                ))
              )}
            </div>

            {/* Mobile bottom bar */}
            {isMobile && (
              <>
                {selected.size > 0 ? (
                  <div className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl bg-gradient-to-t from-slate-900 via-slate-900/95 to-slate-800/90 border-t border-slate-700/50 px-3 py-3 flex gap-2 overflow-x-auto shadow-2xl shadow-black/40">
                    <button onClick={() => handleDelete(Array.from(selected))} className="group flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500/20 text-rose-200 border border-rose-500/30 active:scale-95 transition-all shrink-0">
                      <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-medium">删除</span>
                    </button>
                    <button onClick={() => setClipboard(selectedPaths, 'move')} className="group flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 active:scale-95 transition-all shrink-0">
                      <Scissors className="w-5 h-5 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-medium">移动</span>
                    </button>
                    <button onClick={() => setClipboard(selectedPaths, 'copy')} className="group flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 active:scale-95 transition-all shrink-0">
                      <Copy className="w-5 h-5 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-medium">复制</span>
                    </button>
                    <button onClick={() => setCompressFiles(selectedPaths)} className="group flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 text-slate-200 border border-white/10 active:scale-95 transition-all shrink-0">
                      <FileArchive className="w-5 h-5 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-medium">压缩</span>
                    </button>
                    <button onClick={() => {
                      const name = Array.from(selected)[0];
                      if (name) { setRenaming(name); setRenameValue(name); }
                    }} disabled={selected.size !== 1} className={`group flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 text-slate-200 border border-white/10 active:scale-95 transition-all shrink-0 ${selected.size === 1 ? '' : 'opacity-40'}`}>
                      <Edit3 className="w-5 h-5 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-medium">重命名</span>
                    </button>
                    <button onClick={() => {
                      const name = Array.from(selected)[0];
                      if (name) {
                        const file = files.find(f => f.name === name);
                        if (file) setChmodFile(file);
                      }
                    }} disabled={selected.size !== 1} className={`group flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 text-slate-200 border border-white/10 active:scale-95 transition-all shrink-0 ${selected.size === 1 ? '' : 'opacity-40'}`}>
                      <Lock className="w-5 h-5 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-medium">权限</span>
                    </button>
                    <button onClick={() => {
                      const name = Array.from(selected)[0];
                      if (name) {
                        const file = files.find(f => f.name === name);
                        if (file) handleDownload(file);
                      }
                    }} disabled={selected.size !== 1} className={`group flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 text-slate-200 border border-white/10 active:scale-95 transition-all shrink-0 ${selected.size === 1 ? '' : 'opacity-40'}`}>
                      <Download className="w-5 h-5 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-medium">下载</span>
                    </button>
                    <button onClick={() => {
                      const name = Array.from(selected)[0];
                      if (name) {
                        const file = files.find(f => f.name === name);
                        if (file) {
                          setActionSheetFile(file);
                          setShowActionSheet(true);
                        }
                      }
                    }} disabled={selected.size !== 1} className={`group flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-700/50 text-slate-300 border border-slate-600/50 active:scale-95 transition-all shrink-0 ${selected.size === 1 ? '' : 'opacity-40'}`}>
                      <MoreVertical className="w-5 h-5 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-medium">更多</span>
                    </button>
                    <button onClick={() => setSelected(new Set())} className="group flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-700/50 text-slate-400 border border-slate-600/50 active:scale-90 transition-all shrink-0">
                      <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                  </div>
                ) : clipboard && clipboard.mode ? (
                  <div className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl bg-gradient-to-t from-slate-900 via-slate-900/95 to-slate-800/90 border-t border-slate-700/50 px-4 py-3 flex items-center justify-between shadow-2xl shadow-black/40">
                    <div className="flex items-center gap-2 text-emerald-200">
                      {clipboard.mode === 'move' ? <Scissors className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span className="text-xs">已{clipboard.mode === 'move' ? '剪切' : '复制'} {clipboard.paths.length} 项</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { handlePaste(clipboard.paths, clipboard.mode!, path); clearClipboard(); }} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 text-xs font-medium active:scale-95 transition-all">
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        粘贴到此处
                      </button>
                      <button onClick={clearClipboard} className="p-2 rounded-lg bg-slate-700/50 text-slate-400 border border-slate-600/50 active:scale-90 transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-around px-4 py-2.5 border-t border-zinc-800 bg-zinc-900 shrink-0">
                    <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-0.5 text-zinc-400 hover:text-emerald-400">
                      <Upload className="w-5 h-5" /><span className="text-[10px]">上传</span>
                    </button>
                  </div>
                )}

                {/* FAB Button */}
                <button
                  onClick={() => setShowFabMenu(!showFabMenu)}
                  className={`fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-20
                    ${showFabMenu
                      ? 'bg-rose-500 rotate-45 shadow-rose-500/40'
                      : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/40 hover:shadow-emerald-500/60'
                    }`}
                >
                  <Plus className="w-6 h-6 text-white" />
                </button>

                {/* FAB Menu - Enhanced mobile experience */}
                {showFabMenu && (
                  <div className="fixed bottom-36 right-4 z-20 flex flex-col gap-2">
                    <button onClick={() => { setShowNewFolderDialog(true); setNewName(''); setShowFabMenu(false); }} className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/95 backdrop-blur border border-slate-700/50 text-white shadow-xl hover:bg-slate-700/95 transition-all">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30 transition-all">
                        <FolderPlus className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">新建文件夹</div>
                        <div className="text-xs text-slate-400">创建新目录</div>
                      </div>
                    </button>
                    <button onClick={() => { setShowNewFileDialog(true); setNewName(''); setShowFabMenu(false); }} className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/95 backdrop-blur border border-slate-700/50 text-white shadow-xl hover:bg-slate-700/95 transition-all">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30 transition-all">
                        <FilePlus className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">新建文件</div>
                        <div className="text-xs text-slate-400">创建空白文件</div>
                      </div>
                    </button>
                    <button onClick={() => { fileInputRef.current?.click(); setShowFabMenu(false); }} className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/95 backdrop-blur border border-slate-700/50 text-white shadow-xl hover:bg-slate-700/95 transition-all">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/30 transition-all">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">上传文件</div>
                        <div className="text-xs text-slate-400">从本地上传</div>
                      </div>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Hidden file input for upload */}
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          </>
        )}
      </div>

      {/* Editor modal for desktop */}
      {!isMobile && editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingFile(null)}>
          <div className="w-[90vw] h-[85vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FileIcon className="w-5 h-5 text-zinc-400" />
                <h3 className="text-base font-semibold text-white truncate">{editingFile.name}</h3>
              </div>
              <button
                onClick={() => setEditingFile(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <FileEditor filePath={editingFile.path} fileName={editingFile.name} onClose={() => setEditingFile(null)} />
            </div>
          </div>
        </div>
      )}

      {/* ===== Context Menu ===== */}
      {contextMenu && (
        <div className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-48" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {/* 打开/编辑 */}
          <button onClick={() => { navigate(contextMenu.file); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white">
            {contextMenu.file.isDirectory ? <Folder className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}{contextMenu.file.isDirectory ? '打开' : '编辑'}
          </button>

          {/* 快速操作 */}
          <button onClick={() => { handleDownload(contextMenu.file); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white">
            <Download className="w-4 h-4" />下载
          </button>

          <div className="border-t border-zinc-700 my-1" />

          {/* 管理操作 */}
          <button onClick={() => { setRenaming(contextMenu.file.name); setRenameValue(contextMenu.file.name); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white">
            <Edit3 className="w-4 h-4" />重命名
          </button>
          <button onClick={() => { setChmodFile(contextMenu.file); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white">
            <Lock className="w-4 h-4" />修改权限
          </button>
          <button onClick={() => {
            const filePath = contextMenu.file.path;
            setClipboard([filePath], 'move');
            setSelected(new Set([contextMenu.file.name]));
            setContextMenu(null);
          }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white">
            <Scissors className="w-4 h-4" />移动
          </button>
          <button onClick={() => {
            const filePath = contextMenu.file.path;
            setClipboard([filePath], 'copy');
            setSelected(new Set([contextMenu.file.name]));
            setContextMenu(null);
          }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white">
            <Copy className="w-4 h-4" />复制
          </button>

          {/* 压缩/解压 */}
          {(contextMenu.file.name.endsWith('.zip') || contextMenu.file.name.endsWith('.tar') || contextMenu.file.name.endsWith('.tar.gz') || contextMenu.file.name.endsWith('.tgz')) && (
            <button onClick={() => { setExtractFile(contextMenu.file); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white">
              <FileArchive className="w-4 h-4" />解压
            </button>
          )}
          {!contextMenu.file.isDirectory && !(contextMenu.file.name.endsWith('.zip') || contextMenu.file.name.endsWith('.tar') || contextMenu.file.name.endsWith('.tar.gz') || contextMenu.file.name.endsWith('.tgz')) && (
            <button onClick={() => { setCompressFiles([contextMenu.file.path]); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white">
              <FileArchive className="w-4 h-4" />压缩
            </button>
          )}

          <div className="border-t border-zinc-700 my-1" />

          {/* 危险操作 */}
          <button onClick={() => { handleDelete([contextMenu.file.name]); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />删除
          </button>
        </div>
      )}

      {/* ===== Dialogs ===== */}
      {chmodFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setChmodFile(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                修改权限
              </h3>
              <button onClick={() => setChmodFile(null)} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-400 mb-4">{chmodFile.path}</p>

            {/* Permission presets */}
            <div className="mb-5">
              <label className="text-xs text-slate-500 mb-2 block">常用权限预设</label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setChmodValue('755')}
                  className={`px-3 py-2 rounded-lg text-sm font-mono font-medium transition-all ${
                    chmodValue === '755'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  755
                </button>
                <button
                  onClick={() => setChmodValue('644')}
                  className={`px-3 py-2 rounded-lg text-sm font-mono font-medium transition-all ${
                    chmodValue === '644'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  644
                </button>
                <button
                  onClick={() => setChmodValue('600')}
                  className={`px-3 py-2 rounded-lg text-sm font-mono font-medium transition-all ${
                    chmodValue === '600'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  600
                </button>
                <button
                  onClick={() => setChmodValue('777')}
                  className={`px-3 py-2 rounded-lg text-sm font-mono font-medium transition-all ${
                    chmodValue === '777'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  777
                </button>
              </div>
            </div>

            {/* Custom input */}
            <div className="mb-5">
              <label className="text-xs text-slate-500 mb-2 block">自定义权限 (数字格式，如 755)</label>
              <input
                type="text"
                value={chmodValue}
                onChange={(e) => setChmodValue(e.target.value.replace(/[^0-7]/g, ''))}
                placeholder="755"
                maxLength={3}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm font-mono outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            {/* Permission description */}
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 mb-5">
              <div className="text-xs text-slate-500 mb-2">权限说明</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="font-mono text-emerald-400">7</span>
                  <span className="text-slate-400">读写执行</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-amber-400">5</span>
                  <span className="text-slate-400">读执行</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-rose-400">0</span>
                  <span className="text-slate-400">无权限</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2">格式：所有者|组|其他 (如 755 = rwxr-xr-x)</div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleChmod(chmodFile, chmodValue)}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-medium transition-all"
              >
                应用权限
              </button>
              <button
                onClick={() => setChmodFile(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {compressFiles && (
        <CompressDialog selectedPaths={compressFiles} currentPath={path} onClose={() => setCompressFiles(null)} onSuccess={() => loadFiles(path)} />
      )}
      {extractFile && (
        <ExtractDialog filePath={extractFile.path} fileName={extractFile.name} currentPath={path} onClose={() => setExtractFile(null)} onSuccess={() => loadFiles(path)} />
      )}

      {/* Action Sheet for mobile */}
      <ActionSheet
        open={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        file={actionSheetFile}
        onAction={(action) => {
          if (!actionSheetFile) return;
          switch (action) {
            case 'open':
              navigate(actionSheetFile);
              break;
            case 'download':
              handleDownload(actionSheetFile);
              break;
            case 'rename':
              setRenaming(actionSheetFile.name);
              setRenameValue(actionSheetFile.name);
              break;
            case 'chmod':
              setChmodFile(actionSheetFile);
              break;
            case 'move':
              setClipboard([actionSheetFile.path], 'move');
              setSelected(new Set([actionSheetFile.name]));
              break;
            case 'copy':
              setClipboard([actionSheetFile.path], 'copy');
              setSelected(new Set([actionSheetFile.name]));
              break;
            case 'compress':
              setCompressFiles([actionSheetFile.path]);
              break;
            case 'extract':
              setExtractFile(actionSheetFile);
              break;
            case 'delete':
              handleDelete([actionSheetFile.name]);
              break;
          }
        }}
      />
    </div>
  );
}
