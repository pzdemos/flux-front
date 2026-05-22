import { useState, useCallback, useEffect, useRef } from 'react';
import { fileApi, uploadApi, apiClient } from '@/api/client';
import { useAppStore } from '@/stores/app';
import FileEditor from '@/components/file-manager/FileEditor';
import CompressDialog from '@/components/file-manager/CompressDialog';
import ExtractDialog from '@/components/file-manager/ExtractDialog';
import TrashView from '@/components/file-manager/TrashView';
import PasteBar from '@/components/file-manager/PasteBar';
import ToolsView from '@/components/file-manager/ToolsView';
import SelectionBar from '@/components/file-manager/SelectionBar';
import ActionSheet from '@/components/file-manager/ActionSheet';
import {
  Folder, File as FileIcon, ChevronRight, ChevronUp, Home,
  RefreshCw, Search, Upload, FolderPlus, FilePlus,
  Trash2, Edit3, ArrowUpDown, Loader2, WifiOff,
  MoreVertical, Lock, Download, Scissors, Copy,
  FileArchive, Wrench, Plus, X, Check, Square
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
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [apiError, setApiError] = useState(false);

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

  // Inline chmod
  const [chmodding, setChmodding] = useState<string | null>(null);
  const [chmodValue, setChmodValue] = useState('');

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New file/folder
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newName, setNewName] = useState('');

  // Dialogs
  const [compressFiles, setCompressFiles] = useState<string[] | null>(null);
  const [extractFile, setExtractFile] = useState<FileItem | null>(null);

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

  const loadFiles = useCallback(async (p: string) => {
    setLoading(true);
    setApiError(false);
    try {
      const res = await fileApi.list(p);
      const items = normalizeItems(res.data.items, res.data.path || p);
      setFiles(items);
      setPath(res.data.path || p);
      setSelected(new Set());
    } catch (err: unknown) {
      console.error('[Files] loadFiles error:', err);
      setApiError(true);
      setFiles([]);
      setPath(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFiles('/'); }, [loadFiles]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

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

  const handleChmod = async (name: string) => {
    if (!chmodValue) { setChmodding(null); return; }
    const filePath = path === '/' ? `/${name}` : `${path}/${name}`;
    try {
      await fileApi.setPermissions(filePath, chmodValue);
      addNotification({ type: 'success', message: `权限已修改为 ${chmodValue}` });
      loadFiles(path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      addNotification({ type: 'error', message: `修改权限失败: ${msg}` });
    }
    setChmodding(null);
    setContextMenu(null);
  };

  const handleDelete = async (names: string[]) => {
    const confirmed = window.confirm(`确定要删除以下 ${names.length} 个项目？\n${names.join('\n')}\n\n删除后将无法恢复！`);
    if (!confirmed) return;
    let success = 0;
    for (const name of names) {
      const filePath = path === '/' ? `/${name}` : `${path}/${name}`;
      try {
        await fileApi.delete(filePath);
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
        {viewMode !== 'files' ? (
          <div className="flex-1 min-h-0">
            {viewMode === 'trash' && <TrashView />}
            {viewMode === 'tools' && <ToolsView />}
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50 shrink-0 flex-wrap">
              <button onClick={goHome} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"><Home className="w-4 h-4" /></button>
              <button onClick={goUp} disabled={path === '/'} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
              <button onClick={() => loadFiles(path)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>

              {/* Breadcrumb */}
              <div className="flex-1 min-w-0 flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/50 overflow-x-auto">
                {path.split('/').filter(Boolean).map((part, i, arr) => (
                  <span key={i} className="flex items-center shrink-0">
                    <ChevronRight className="w-3 h-3 text-zinc-600" />
                    <button onClick={() => loadFiles(`/${arr.slice(0, i + 1).join('/')}`)} className="text-xs text-zinc-400 hover:text-white px-1">{part}</button>
                  </span>
                ))}
                {path === '/' && <span className="text-xs text-zinc-500 px-1">/</span>}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input type="text" placeholder="搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 w-40 md:w-52" />
              </div>

              <button onClick={() => setSortBy(sortBy === 'name' ? 'date' : 'name')} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="切换排序"><ArrowUpDown className="w-4 h-4" /></button>

              {/* New dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">
                  <FilePlus className="w-4 h-4" />新建
                </button>
                <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-30 w-44 py-1 hidden group-hover:block">
                  <button onClick={() => { setShowNewFolderDialog(true); setNewName(''); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white"><FolderPlus className="w-4 h-4" />新建文件夹</button>
                  <button onClick={() => { setShowNewFileDialog(true); setNewName(''); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white"><FilePlus className="w-4 h-4" />新建文件</button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white">
                    <Upload className="w-4 h-4" />上传文件
                  </button>
                </div>
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
            {apiError && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-400">API 连接失败，请检查网络</span>
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

            {/* Batch delete bar (when items selected) */}
            {selected.size > 0 && !isMobile && (
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
              />
            )}

            {/* Paste bar when clipboard has content */}
            {clipboard && (
              <PasteBar
                currentPath={path}
                onPaste={handlePaste}
                onClear={clearClipboard}
              />
            )}

            {/* File List Header */}
            <div className="grid grid-cols-[auto_40px_1fr_auto_auto_auto_auto] gap-2 px-4 py-2 border-b border-zinc-800 text-xs font-medium text-zinc-500 uppercase tracking-wider">
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
              <span className="w-20 text-right hidden md:block">大小</span>
              <span className="w-32 text-right hidden md:block">修改时间</span>
              <span className="w-20 text-right hidden md:block">权限</span>
              <span className="w-8 hidden md:block"></span>
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
                    className={`grid grid-cols-[auto_40px_1fr_auto_auto_auto_auto] gap-2 px-4 py-2 border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/40
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
                      ) : chmodding === file.name ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Lock className="w-3.5 h-3.5 text-zinc-500" />
                          <input value={chmodValue} onChange={(e) => setChmodValue(e.target.value)} placeholder="755" className="w-16 px-2 py-0.5 rounded bg-zinc-800 border border-emerald-500 text-sm text-white outline-none font-mono" autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleChmod(file.name); if (e.key === 'Escape') setChmodding(null); }}
                            onBlur={() => handleChmod(file.name)} />
                        </div>
                      ) : (
                        <span
                          className="text-sm text-zinc-200 truncate cursor-pointer hover:text-white transition-colors"
                          onClick={() => navigate(file)}
                        >{file.name}</span>
                      )}
                      {isMobile && <span className="text-xs text-zinc-500">{formatSize(file.size)} &middot; {file.permissions}</span>}
                    </div>

                    {/* Metadata - read only */}
                    <span className="w-20 text-right text-xs text-zinc-400 hidden md:block select-none">{formatSize(file.size)}</span>
                    <span className="w-32 text-right text-xs text-zinc-400 hidden md:block select-none">{file.modified}</span>
                    <span className="w-20 text-right text-xs text-zinc-500 font-mono hidden md:block select-none cursor-pointer hover:text-emerald-400" onClick={() => { setChmodding(file.name); setChmodValue(file.permissions); }}>{file.permissions}</span>

                    {/* More button - desktop only */}
                    <button
                      ref={(el) => {
                        if (el) {
                          el.onclick = (e) => {
                            e.stopPropagation();
                            const rect = el.getBoundingClientRect();
                            const pos = getContextMenuPosition(rect.left, rect.bottom + 4);
                            setContextMenu({
                              x: pos.x,
                              y: pos.y,
                              file
                            });
                          };
                        }
                      }}
                      className="w-8 hidden md:flex items-center justify-center text-zinc-500 hover:text-white rounded hover:bg-zinc-800"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Mobile bottom bar */}
            {isMobile && (
              <>
                {selected.size > 0 ? (
                  <div className="fixed bottom-0 left-0 right-0 z-30 bg-zinc-900 border-t border-zinc-800 px-2 py-3 flex gap-1 overflow-x-auto">
                    <button onClick={() => handleDelete(Array.from(selected))} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 shrink-0">
                      <Trash2 className="w-5 h-5" /><span className="text-[10px]">删除</span>
                    </button>
                    <button onClick={() => setClipboard(selectedPaths, 'move')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 shrink-0">
                      <Scissors className="w-5 h-5" /><span className="text-[10px]">移动</span>
                    </button>
                    <button onClick={() => setClipboard(selectedPaths, 'copy')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-zinc-400 hover:text-sky-400 hover:bg-zinc-800 shrink-0">
                      <Copy className="w-5 h-5" /><span className="text-[10px]">复制</span>
                    </button>
                    <button onClick={() => setCompressFiles(selectedPaths)} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0">
                      <FileArchive className="w-5 h-5" /><span className="text-[10px]">压缩</span>
                    </button>
                    <button onClick={() => {
                      const name = Array.from(selected)[0];
                      if (name) { setRenaming(name); setRenameValue(name); }
                    }} disabled={selected.size !== 1} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg shrink-0 ${selected.size === 1 ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600'}`}>
                      <Edit3 className="w-5 h-5" /><span className="text-[10px]">重命名</span>
                    </button>
                    <button onClick={() => {
                      const name = Array.from(selected)[0];
                      if (name) { setChmodding(name); setChmodValue(''); }
                    }} disabled={selected.size !== 1} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg shrink-0 ${selected.size === 1 ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600'}`}>
                      <Lock className="w-5 h-5" /><span className="text-[10px]">权限</span>
                    </button>
                    <button onClick={() => {
                      const name = Array.from(selected)[0];
                      if (name) {
                        const file = files.find(f => f.name === name);
                        if (file) handleDownload(file);
                      }
                    }} disabled={selected.size !== 1} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg shrink-0 ${selected.size === 1 ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600'}`}>
                      <Download className="w-5 h-5" /><span className="text-[10px]">下载</span>
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
                    }} disabled={selected.size !== 1} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg shrink-0 ${selected.size === 1 ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600'}`}>
                      <MoreVertical className="w-5 h-5" /><span className="text-[10px]">更多</span>
                    </button>
                    <button onClick={() => setSelected(new Set())} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0">
                      <X className="w-5 h-5" /><span className="text-[10px]">取消</span>
                    </button>
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
                  className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:bg-emerald-500 transition-colors z-20"
                >
                  {showFabMenu ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                </button>

                {/* FAB Menu */}
                {showFabMenu && (
                  <div className="fixed bottom-36 right-4 z-20 flex flex-col gap-2">
                    <button onClick={() => { setShowNewFolderDialog(true); setNewName(''); setShowFabMenu(false); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-white shadow-lg hover:bg-zinc-700 transition-colors">
                      <FolderPlus className="w-5 h-5" /><span className="text-sm">新建文件夹</span>
                    </button>
                    <button onClick={() => { setShowNewFileDialog(true); setNewName(''); setShowFabMenu(false); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-white shadow-lg hover:bg-zinc-700 transition-colors">
                      <FilePlus className="w-5 h-5" /><span className="text-sm">新建文件</span>
                    </button>
                    <button onClick={() => { fileInputRef.current?.click(); setShowFabMenu(false); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-white shadow-lg hover:bg-zinc-700 transition-colors">
                      <Upload className="w-5 h-5" /><span className="text-sm">上传文件</span>
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
          <button onClick={() => { setChmodding(contextMenu.file.name); setChmodValue(contextMenu.file.permissions); setContextMenu(null); }}
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
              setChmodding(actionSheetFile.name);
              setChmodValue(actionSheetFile.permissions);
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
