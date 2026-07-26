import { useState, useEffect, useCallback, useRef } from 'react';
import { fileApi, gitApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import { Loader2, Lock } from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';
import type { editor as MonacoEditorNS } from 'monaco-editor';

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

/** 解析 unified diff（unified=0）→ 行级 segments，用于 Monaco gutter decorations */
interface DiffSegment {
  type: 'added' | 'modified' | 'removed';
  startLine: number;
  endLine: number;
}

function parsePatchForGutter(patch: string): DiffSegment[] {
  if (!patch) return [];
  const segments: DiffSegment[] = [];
  const lines = patch.split('\n');
  let i = 0;
  // 跳过 header（diff --git / --- / +++）直到第一个 hunk
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      const newStart = parseInt(m[2]);
      i++;
      let curNew = newStart;
      let firstAddedLine = -1;
      let lastAddedLine = -1;
      let addedCount = 0;
      let removedCount = 0;
      while (i < lines.length) {
        const l = lines[i];
        if (l.startsWith('@@') || l.startsWith('diff ')) break;
        if (l.startsWith('+')) {
          if (firstAddedLine === -1) firstAddedLine = curNew;
          lastAddedLine = curNew;
          curNew++;
          addedCount++;
        } else if (l.startsWith('-')) {
          removedCount++;
        } else if (l.startsWith(' ')) {
          curNew++;
        }
        i++;
      }
      if (addedCount > 0 && removedCount > 0) {
        segments.push({ type: 'modified', startLine: firstAddedLine, endLine: lastAddedLine });
      } else if (addedCount > 0) {
        segments.push({ type: 'added', startLine: firstAddedLine, endLine: lastAddedLine });
      } else if (removedCount > 0) {
        // 删除发生在 newStart 行之前；在 newStart 行的 gutter 放红色标记
        // 若 newStart 超出文件末尾（删除发生在末尾），仍标注在 newStart
        segments.push({ type: 'removed', startLine: newStart, endLine: newStart });
      }
    } else {
      i++;
    }
  }
  return segments;
}

interface EditorPaneProps {
  filePath: string;
  fileName: string;
  initialContent: string;
  loading: boolean;
  loadError: string | null;
  isDirty: boolean;
  repoPath?: string;            // Git 仓库根（相对路径，相对 server root），非 git 仓库不传
  repoRelFile?: string;         // 当前文件相对 repo 的路径，用于拉 file diff
  gitRefreshKey?: number;       // 外部触发 git diff 重新拉取（保存/commit/stage 后）
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
 * - gutter stripe：拉单文件 working diff，解析后用 decorations 标识 added/modified/removed 行
 */
export default function EditorPane({
  filePath, fileName, initialContent, loading, loadError, isDirty,
  repoPath, repoRelFile, gitRefreshKey, onDirtyChange, onSaved,
}: EditorPaneProps) {
  const [saving, setSaving] = useState(false);
  type EditorOnMountParam = Parameters<NonNullable<Parameters<typeof Editor>[0]['onMount']>>[0];
  const editorRef = useRef<EditorOnMountParam | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const decorationsRef = useRef<string[]>([]);
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

  const handleEditorMount = (editor: EditorOnMountParam, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.focus();
  };

  // ===== Git gutter decorations =====
  const applyGitDecorations = useCallback((patch: string) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const segments = parsePatchForGutter(patch);
    const decorations: MonacoEditorNS.IModelDeltaDecoration[] = segments.map(s => {
      const range = new monaco.Range(s.startLine, 1, s.endLine, 1);
      if (s.type === 'added') {
        return {
          range,
          options: {
            isWholeLine: true,
            className: 'git-added-line',
            glyphMarginClassName: 'git-added-glyph',
          },
        };
      }
      if (s.type === 'modified') {
        return {
          range,
          options: {
            isWholeLine: true,
            className: 'git-modified-line',
            glyphMarginClassName: 'git-modified-glyph',
          },
        };
      }
      return {
        range,
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'git-removed-glyph',
        },
      };
    });
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }, []);

  // 文件加载/切换 + 外部 git 刷新触发时拉取 diff
  useEffect(() => {
    if (!repoPath || !repoRelFile) {
      // 非 git 仓库或路径未知：清空已有装饰
      const editor = editorRef.current;
      if (editor) decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await gitApi.fileDiff(repoPath, repoRelFile);
        if (cancelled) return;
        const patch = (res.data as { patch?: string }).patch || '';
        applyGitDecorations(patch);
      } catch {
        // 静默失败：可能是新文件还没 add，或 git 不可用
        if (!cancelled) {
          const editor = editorRef.current;
          if (editor) decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [repoPath, repoRelFile, gitRefreshKey, applyGitDecorations]);

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
            glyphMargin: true,
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
