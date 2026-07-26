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
  initialContent: string;
  loading: boolean;
  loadError: string | null;
  isDirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
}

/**
 * 单实例 EditorPane，跟随 activePath 渲染。
 * 关键设计：
 * - 用 path={filePath} 让 monaco 内部按 URI 缓存 model
 * - 切 Tab 时 monaco 自动 setModel，不卸载 Editor，避免 Canceled 错误
 * - 内容用 defaultValue（非受控），避免回写打断 IME
 * - dirty 真相在外部 dirtySet，本组件通过 isDirty prop 接收
 */
export default function EditorPane({
  filePath, fileName, initialContent, loading, loadError, isDirty, onDirtyChange, onSaved,
}: EditorPaneProps) {
  const [saving, setSaving] = useState(false);
  type EditorOnMountParam = Parameters<NonNullable<Parameters<typeof Editor>[0]['onMount']>>[0];
  const editorRef = useRef<EditorOnMountParam | null>(null);
  const addNotification = useAppStore((s) => s.addNotification);

  // contentRef 跟随当前文件最新内容（Monaco onChange 同步）
  const contentRef = useRef(initialContent);
  // savingRef 让 Ctrl+S handler 拿到最新状态
  const savingRef = useRef(false);

  const isEditable = isEditableFile(fileName);

  // 文件切换时同步 contentRef（initialContent 是父组件预加载好的）
  useEffect(() => {
    contentRef.current = initialContent;
  }, [filePath, initialContent]);

  const handleSave = useCallback(async () => {
    if (!isEditable || !isDirty || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await fileApi.write(filePath, contentRef.current, 'utf-8');
      onDirtyChange(false);
      addNotification({ type: 'success', message: `${fileName} 已保存` });
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      addNotification({ type: 'error', message: `保存失败: ${msg}` });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [isEditable, isDirty, filePath, fileName, onDirtyChange, onSaved, addNotification]);

  // Ctrl/Cmd+S 触发保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const handleEditorMount = (editor: EditorOnMountParam) => {
    editorRef.current = editor;
    editor.focus();
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-zinc-900">
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
          path={filePath}
          language={detectLanguage(fileName)}
          defaultValue={initialContent}
          theme="vs-dark"
          onMount={handleEditorMount}
          onChange={(val) => {
            contentRef.current = val || '';
            if (!isDirty) onDirtyChange(true);
          }}
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
            {loadError && <span className="text-rose-400 ml-2">· {loadError}</span>}
          </div>
          <pre className="whitespace-pre-wrap">{initialContent}</pre>
        </div>
      )}
    </div>
  );
}
