import { useState, useEffect, useCallback } from 'react';
import { fileApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { X, Save, Loader2, FileText, Lock } from 'lucide-react';

interface FileEditorProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function FileEditor({ filePath, fileName, onClose, onSaved }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [meta, setMeta] = useState({ size: 0, modified: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  const isEditable = isEditableFile(fileName);

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fileApi.read(filePath);
      const data = res.data;
      const text = typeof data.content === 'string' ? data.content : JSON.stringify(data.content ?? data, null, 2);
      setContent(text);
      setMeta({ size: data.size || 0, modified: data.modified || '' });
      setDirty(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '无法读取文件';
      addNotification({ type: 'error', message: `读取失败: ${msg}` });
      setContent(`// 无法读取文件: ${filePath}\n// 错误: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [filePath, addNotification]);

  useEffect(() => { loadContent(); }, [loadContent]);

  const handleSave = async () => {
    if (!isEditable) return;
    setSaving(true);
    try {
      await fileApi.write(filePath, content, 'utf-8');
      setDirty(false);
      addNotification({ type: 'success', message: '文件已保存' });
      onSaved?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      addNotification({ type: 'error', message: `保存失败: ${msg}` });
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (dirty && !saving) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dirty, saving, content]);

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm text-zinc-200 font-medium truncate">{fileName}</span>
          {dirty && <span className="text-xs text-amber-400">已修改</span>}
          <span className="text-xs text-zinc-500 ml-2">{meta.size} bytes</span>
        </div>
        <div className="flex items-center gap-1">
          {isEditable && (
            <button onClick={handleSave} disabled={saving || !dirty}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              保存
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : isEditable ? (
        <textarea value={content} onChange={(e) => { setContent(e.target.value); setDirty(true); }}
          className="flex-1 bg-zinc-950 text-zinc-300 font-mono text-sm p-4 resize-none outline-none focus:ring-1 focus:ring-emerald-500/30 leading-relaxed"
          spellCheck={false} autoFocus />
      ) : (
        <div className="flex-1 bg-zinc-950 text-zinc-300 font-mono text-sm p-4 overflow-auto whitespace-pre-wrap">
          <div className="flex items-center gap-2 mb-4 text-zinc-500">
            <Lock className="w-4 h-4" />
            <span>此文件为只读预览</span>
          </div>
          {content}
        </div>
      )}
    </div>
  );
}

function isEditableFile(name: string): boolean {
  return /\.(txt|md|json|js|jsx|ts|tsx|html|css|scss|less|yaml|yml|xml|sh|bash|zsh|py|rb|go|rs|c|cpp|h|hpp|java|php|lua|sql|conf|config|ini|env|dockerfile|gitignore|log|vue|svelte|astro|cgi|pl|asm|dart|kt|swift|rs)$/i.test(name);
}
