import { useState, useEffect, useCallback, useRef } from 'react';
import { fileApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { Loader2, Lock } from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

const extToLanguage: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', xml: 'xml', svg: 'xml',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', kt: 'kotlin', swift: 'swift', dart: 'dart',
  php: 'php', lua: 'lua', sql: 'sql', sh: 'shell', bash: 'shell', zsh: 'shell',
  md: 'markdown', yaml: 'yaml', yml: 'yaml',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  pl: 'perl', asm: 'assembly', vue: 'html', svelte: 'html', astro: 'html',
  conf: 'ini', ini: 'ini', dockerfile: 'dockerfile',
};

function detectLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return extToLanguage[ext] || (name.toUpperCase() === 'DOCKERFILE' ? 'dockerfile' : 'plaintext');
}

function isEditableFile(name: string): boolean {
  return /\.(txt|md|json|js|jsx|ts|tsx|html|css|scss|less|yaml|yml|xml|sh|bash|zsh|py|rb|go|rs|c|cpp|h|hpp|java|php|lua|sql|conf|config|ini|env|dockerfile|gitignore|log|vue|svelte|astro|cgi|pl|asm|dart|kt|swift|rs)$/i.test(name);
}

interface EditorPaneProps {
  filePath: string;
  fileName: string;
  active: boolean;
  onDirtyChange: (dirty: boolean) => void;
}

export default function EditorPane({ filePath, fileName, active, onDirtyChange }: EditorPaneProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  type EditorOnMountParam = Parameters<NonNullable<Parameters<typeof Editor>[0]['onMount']>>[0];
  const editorRef = useRef<EditorOnMountParam | null>(null);
  const addNotification = useAppStore((s) => s.addNotification);

  // refs 让全局 Ctrl+S handler 拿到最新值，不依赖重绑定
  const dirtyRef = useRef(false);
  const contentRef = useRef('');
  const savingRef = useRef(false);

  const isEditable = isEditableFile(fileName);

  const markDirty = useCallback((val: boolean) => {
    dirtyRef.current = val;
    onDirtyChange(val);
  }, [onDirtyChange]);

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fileApi.read(filePath);
      const data = res.data as { content?: string };
      const text = typeof data.content === 'string'
        ? data.content
        : JSON.stringify(data.content ?? data, null, 2);
      setContent(text);
      contentRef.current = text;
      markDirty(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '无法读取文件';
      addNotification({ type: 'error', message: `读取失败: ${msg}` });
      setContent(`// 无法读取文件: ${filePath}\n// 错误: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [filePath, addNotification, markDirty]);

  useEffect(() => { loadContent(); }, [loadContent]);

  const handleSave = useCallback(async () => {
    if (!isEditable || !dirtyRef.current || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await fileApi.write(filePath, contentRef.current, 'utf-8');
      markDirty(false);
      addNotification({ type: 'success', message: `${fileName} 已保存` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      addNotification({ type: 'error', message: `保存失败: ${msg}` });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [filePath, fileName, isEditable, addNotification, markDirty]);

  // 仅 active Tab 接管 Ctrl+S
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, handleSave]);

  useEffect(() => {
    if (active) editorRef.current?.focus();
  }, [active]);

  const handleEditorMount = (editor: EditorOnMountParam) => {
    editorRef.current = editor;
    if (active) editor.focus();
  };

  return (
    <div className={`flex flex-col h-full bg-zinc-900 ${active ? '' : 'hidden'}`}>
      {saving && (
        <div className="absolute top-2 right-4 z-10 text-xs text-emerald-400 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> 保存中...
        </div>
      )}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : isEditable ? (
        <Editor
          language={detectLanguage(fileName)}
          value={content}
          onChange={(val) => {
            const next = val || '';
            contentRef.current = next;
            setContent(next);
            if (!dirtyRef.current) markDirty(true);
          }}
          theme="vs-dark"
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            tabSize: 2,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 12 },
          }}
        />
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
