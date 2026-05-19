import { useState, useCallback } from 'react';
import { fileApi } from '@/api/client';
import type { FileItem } from '@/types';
import { useAppStore } from '@/stores/app';

export function useFileManager() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const addNotification = useAppStore((s) => s.addNotification);

  const listFiles = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        const res = await fileApi.list(path);
        setFiles(res.data.files || []);
        setCurrentPath(path);
        setSelectedFiles(new Set());
      } catch (e: unknown) {
        addNotification({
          type: 'error',
          message: `加载失败: ${e instanceof Error ? e.message : 'Unknown error'}`,
        });
      } finally {
        setLoading(false);
      }
    },
    [addNotification]
  );

  const refresh = useCallback(() => {
    listFiles(currentPath);
  }, [listFiles, currentPath]);

  const toggleSelection = useCallback((name: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  return {
    files,
    currentPath,
    loading,
    selectedFiles,
    listFiles,
    refresh,
    setCurrentPath,
    toggleSelection,
  };
}
