import { useState, useEffect } from 'react';
import { fileApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  Loader2,
  Check
} from 'lucide-react';

interface DirectoryPickerProps {
  currentPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

interface DirectoryNode {
  name: string;
  path: string;
  isExpanded: boolean;
  children: DirectoryNode[];
}

export default function DirectoryPicker({ currentPath, onSelect, onClose }: DirectoryPickerProps) {
  const [tree, setTree] = useState<DirectoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/']));
  const [selectedPath, setSelectedPath] = useState(currentPath);

  const addNotification = useAppStore((s) => s.addNotification);

  // Load directories at a specific path
  const loadDirectories = async (path: string): Promise<string[]> => {
    try {
      const res = await fileApi.list(path);
      const items = res.data.items || [];
      return items
        .filter((item: { type: string }) => item.type === 'directory')
        .map((item: { name: string }) => item.name)
        .sort((a: string, b: string) => a.localeCompare(b));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载目录失败';
      addNotification({ type: 'error', message: msg });
      return [];
    }
  };

  // Initial load
  useEffect(() => {
    const initTree = async () => {
      setLoading(true);
      try {
        const dirs = await loadDirectories('/');
        const rootNodes: DirectoryNode[] = dirs.map(name => ({
          name,
          path: `/${name}`,
          isExpanded: false,
          children: []
        }));
        setTree(rootNodes);
      } finally {
        setLoading(false);
      }
    };
    initTree();
  }, []);

  // Expand a directory node
  const expandNode = async (node: DirectoryNode) => {
    if (node.isExpanded) {
      // Collapse
      setExpandedDirs(prev => {
        const next = new Set(prev);
        next.delete(node.path);
        return next;
      });
      return;
    }

    // Expand
    setExpandedDirs(prev => new Set([...prev, node.path]));

    // Load children if not loaded
    if (node.children.length === 0) {
      const dirs = await loadDirectories(node.path);
      const childNodes: DirectoryNode[] = dirs.map(name => ({
        name,
        path: node.path === '/' ? `/${name}` : `${node.path}/${name}`,
        isExpanded: false,
        children: []
      }));

      setTree(prev => updateNodeChildren(prev, node.path, childNodes));
    }
  };

  // Update node children in tree
  const updateNodeChildren = (nodes: DirectoryNode[], targetPath: string, newChildren: DirectoryNode[]): DirectoryNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return { ...node, children: newChildren };
      }
      if (node.children.length > 0) {
        return { ...node, children: updateNodeChildren(node.children, targetPath, newChildren) };
      }
      return node;
    });
  };

  // Render tree node
  const renderNode = (node: DirectoryNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedDirs.has(node.path);
    const isSelected = selectedPath === node.path;
    const paddingLeft = 12 + depth * 20;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 py-2 px-3 cursor-pointer transition-colors ${
            isSelected ? 'bg-emerald-600/20 text-emerald-400' : 'hover:bg-zinc-800 text-zinc-300'
          }`}
          style={{ paddingLeft }}
          onClick={() => setSelectedPath(node.path)}
          onDoubleClick={() => {
            setSelectedPath(node.path);
            onSelect(node.path);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              expandNode(node);
            }}
            className="p-0.5 rounded hover:bg-zinc-700 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
          {isExpanded ? <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" /> : <Folder className="w-4 h-4 text-amber-400 shrink-0" />}
          <span className="flex-1 text-sm truncate">{node.name}</span>
          {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
        </div>
        {isExpanded && node.children.length > 0 && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Breadcrumb navigation
  const navigateToPath = (path: string) => {
    setSelectedPath(path);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Folder className="w-5 h-5 text-amber-400" />
            选择目标目录
          </h3>
        </div>

        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 overflow-x-auto">
          <button
            onClick={() => navigateToPath('/')}
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <Home className="w-4 h-4" />
          </button>
          {selectedPath !== '/' && selectedPath.split('/').filter(Boolean).map((part, i, arr) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="w-3 h-3 text-zinc-600" />
              <button
                onClick={() => navigateToPath(`/${arr.slice(0, i + 1).join('/')}`)}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                {part}
              </button>
            </span>
          ))}
        </div>

        {/* Tree view */}
        <div className="flex-1 overflow-auto min-h-0 bg-zinc-800/30 rounded-lg border border-zinc-700/50 p-2 mb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Folder className="w-12 h-12 mb-2 opacity-30" />
              <p>无目录</p>
            </div>
          ) : (
            <div>
              {/* Root path */}
              <div
                className={`flex items-center gap-2 py-2 px-3 cursor-pointer transition-colors ${
                  selectedPath === '/' ? 'bg-emerald-600/20 text-emerald-400' : 'hover:bg-zinc-800 text-zinc-300'
                }`}
                onClick={() => setSelectedPath('/')}
                onDoubleClick={() => {
                  setSelectedPath('/');
                  onSelect('/');
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedDirs(prev => {
                      const next = new Set(prev);
                      if (next.has('/')) {
                        next.delete('/');
                      } else {
                        next.add('/');
                      }
                      return next;
                    });
                  }}
                  className="p-0.5 rounded hover:bg-zinc-700 transition-colors"
                >
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedDirs.has('/') ? 'rotate-90' : ''}`} />
                </button>
                {expandedDirs.has('/') ? <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" /> : <Folder className="w-4 h-4 text-amber-400 shrink-0" />}
                <span className="flex-1 text-sm">根目录</span>
                {selectedPath === '/' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              </div>

              {/* Child directories */}
              {expandedDirs.has('/') && tree.map(node => renderNode(node))}
            </div>
          )}
        </div>

        {/* Selected path display */}
        <div className="px-3 py-2 mb-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <p className="text-xs text-zinc-500 mb-1">选择的路径</p>
          <code className="text-sm text-emerald-400 font-mono">{selectedPath}</code>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onSelect(selectedPath)}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            确定移动到此处
          </button>
        </div>
      </div>
    </div>
  );
}
