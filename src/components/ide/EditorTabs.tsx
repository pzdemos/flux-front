import { X } from 'lucide-react';

export interface OpenTab {
  path: string;
  name: string;
}

interface EditorTabsProps {
  tabs: OpenTab[];
  activePath: string | null;
  dirtySet: Set<string>;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export default function EditorTabs({ tabs, activePath, dirtySet, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center bg-zinc-900 border-b border-zinc-800 overflow-x-auto shrink-0">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        const dirty = dirtySet.has(tab.path);
        return (
          <div
            key={tab.path}
            className={`group flex items-center gap-2 pl-3 pr-2 py-2 text-xs border-r border-zinc-800 cursor-pointer whitespace-nowrap transition-colors ${
              active
                ? 'bg-zinc-950 text-white border-t-2 border-t-emerald-500'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800/60 border-t-2 border-t-transparent'
            }`}
            onClick={() => onSelect(tab.path)}
            title={tab.path}
          >
            <span className="truncate max-w-[180px]">{tab.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.path);
              }}
              className={`p-0.5 rounded hover:bg-zinc-700 transition-colors ${
                active ? 'text-zinc-300' : 'text-zinc-500 opacity-0 group-hover:opacity-100'
              } ${dirty ? 'opacity-100' : ''}`}
            >
              {dirty ? (
                <span className="block w-2 h-2 rounded-full bg-amber-400 group-hover:hidden" />
              ) : null}
              <X className={`w-3 h-3 ${dirty ? 'hidden group-hover:block' : 'block'}`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
