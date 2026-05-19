import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/api/client';
import { useAppStore } from '@/stores/app';
import {
  FileText, Plus, Trash2, Edit3, Save, X,
  Upload, Download, Search, BookOpen
} from 'lucide-react';

interface SkillDoc {
  id: string;
  name: string;
  content: string;
  updatedAt: string;
}

export default function SkillPage() {
  const [docs, setDocs] = useState<SkillDoc[]>([]);
  const [search, setSearch] = useState('');
  const [activeDoc, setActiveDoc] = useState<SkillDoc | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/skill/docs');
      setDocs(res.data || []);
    } catch {
      addNotification({ type: 'error', message: '获取文档列表失败' });
    } finally {
      }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!activeDoc) return;
    try {
      await apiClient.put(`/skill/docs/${activeDoc.id}`, {
        name: editName,
        content: editContent,
      });
      addNotification({ type: 'success', message: '已保存' });
      setEditMode(false);
      load();
    } catch {
      addNotification({ type: 'error', message: '保存失败' });
    }
  };

  const handleCreate = async () => {
    if (!editName) return;
    try {
      await apiClient.post('/skill/docs', {
        name: editName,
        content: editContent,
      });
      addNotification({ type: 'success', message: '已创建' });
      setShowNew(false);
      setEditName('');
      setEditContent('');
      load();
    } catch {
      addNotification({ type: 'error', message: '创建失败' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/skill/docs/${id}`);
      addNotification({ type: 'success', message: '已删除' });
      if (activeDoc?.id === id) {
        setActiveDoc(null);
        setEditMode(false);
      }
      load();
    } catch {
      addNotification({ type: 'error', message: '删除失败' });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      await apiClient.post('/skill/docs', {
        name: file.name.replace('.md', ''),
        content,
      });
      addNotification({ type: 'success', message: '上传成功' });
      load();
    } catch {
      addNotification({ type: 'error', message: '上传失败' });
    }
    e.target.value = '';
  };

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      {/* Sidebar */}
      <div className="w-full md:w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        <div className="p-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索..."
                className="w-full pl-7 pr-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 outline-none"
              />
            </div>
            <button onClick={() => { setShowNew(true); setEditName(''); setEditContent(''); }} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>上传 .md 文件</span>
            <input type="file" accept=".md" onChange={handleUpload} className="hidden" />
          </label>
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.map((doc) => (
            <button
              key={doc.id}
              onClick={() => { setActiveDoc(doc); setEditMode(false); }}
              className={`w-full text-left px-3 py-2.5 border-b border-zinc-800/50 flex items-center gap-2 transition-colors
                ${activeDoc?.id === doc.id ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="text-sm truncate flex-1">{doc.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {showNew ? (
          <div className="flex flex-col h-full p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">新建文档</h3>
              <button onClick={() => setShowNew(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="文档名称"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none mb-3"
              autoFocus
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm font-mono p-4 rounded-lg resize-none outline-none min-h-0"
              placeholder="# Markdown内容"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm">创建</button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm">取消</button>
            </div>
          </div>
        ) : activeDoc ? (
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-white">{activeDoc.name}</h2>
                <span className="text-xs text-zinc-500">{activeDoc.updatedAt}</span>
              </div>
              <div className="flex items-center gap-1">
                {!editMode ? (
                  <>
                    <button
                      onClick={() => { setEditMode(true); setEditContent(activeDoc.content); setEditName(activeDoc.name); }}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([activeDoc.content], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${activeDoc.name}.md`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(activeDoc.id)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleSave} className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors">
                      <Save className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditMode(false)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Editor / Preview */}
            <div className="flex-1 flex min-h-0">
              {editMode ? (
                <div className="flex-1 flex flex-col">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-sm text-white outline-none"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 bg-zinc-950 text-zinc-300 font-mono text-sm p-4 resize-none outline-none"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-4">
                  <div
                    className="prose prose-invert prose-zinc max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(activeDoc.content) }}
                  />
                </div>
              )}
              {!editMode && (
                <div className="hidden lg:block w-1/2 border-l border-zinc-800 overflow-auto p-4 bg-zinc-900/30">
                  <div className="text-xs text-zinc-500 uppercase mb-2 font-medium">预览</div>
                  <div
                    className="prose prose-invert prose-zinc max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(activeDoc.content) }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <BookOpen className="w-16 h-16 mb-3 opacity-20" />
            <p>选择一个文档查看或编辑</p>
          </div>
        )}
      </div>
    </div>
  );
}

function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 text-sm">$1</code>')
    .replace(/```([\s\S]*?)```/gim, '<pre class="bg-zinc-800 rounded-lg p-4 overflow-x-auto"><code>$1</code></pre>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gim, '<ul class="list-disc list-inside space-y-1">$&</ul>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-emerald-400 hover:underline" target="_blank">$1</a>')
    .replace(/\n/gim, '<br/>');
  return html;
}
