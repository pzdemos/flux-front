import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getRoot: vi.fn(), setRoot: vi.fn(), list: vi.fn(),
  client: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

vi.mock('@/api/client', () => ({
  systemApi: { getRoot: api.getRoot, setRoot: api.setRoot },
  fileApi: { list: api.list }, apiClient: api.client, uploadApi: {}, gitApi: {},
}));
// These unrelated dialogs are closed throughout the root-initialization tests.
vi.mock('@/components/file-manager/FileEditor', () => ({ default: () => null }));
vi.mock('@/components/file-manager/CompressDialog', () => ({ default: () => null }));
vi.mock('@/components/file-manager/ExtractDialog', () => ({ default: () => null }));
vi.mock('@/components/file-manager/TrashView', () => ({ default: () => null }));
vi.mock('@/components/file-manager/ToolsView', () => ({ default: () => null }));
vi.mock('@/components/file-manager/SelectionBar', () => ({ default: () => null }));
vi.mock('@/components/file-manager/ActionSheet', () => ({ default: () => null }));
vi.mock('@/components/file-manager/GitDiffView', () => ({ default: () => null }));
vi.mock('@/components/file-manager/RemoteDownloadDialog', () => ({ default: () => null }));
vi.mock('@/components/file-manager/FilePreviewDialog', () => ({ default: () => null }));

import FilesPage from '@/pages/Files';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';

const settings = {
  files_root: '/srv/files', node_path: '/srv/node', skill_path: '/srv/skills',
  ecs_region: '', sg_region: '', disk_region: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAppStore.setState({ viewMode: 'files', isMobile: false, clipboard: null, notifications: [] });
  useAuthStore.setState({ settings: null });
  api.getRoot.mockResolvedValue({ data: { root: '/var/server', configured: true } });
  api.setRoot.mockResolvedValue({ data: { success: true } });
  api.list.mockImplementation(async (path: string) => ({
    data: { path, items: [{ name: 'notes.txt', type: 'file', size: 12, modified: '2026-01-01T00:00:00Z' }] },
  }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('file root initialization', () => {
  it('shows loading while configuration is unknown, then loads the existing root without PUT', async () => {
    let resolve!: (value: unknown) => void;
    api.getRoot.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    render(<FilesPage />);
    expect(screen.getByRole('status').textContent).toContain('正在加载文件根目录');
    expect(screen.queryByText('根路径未配置')).toBeNull();
    await act(async () => { resolve({ data: { root: '/var/server', configured: true } }); });
    expect(await screen.findAllByText('notes.txt')).not.toHaveLength(0);
    expect(api.list).toHaveBeenCalledWith('/');
    expect(api.setRoot).not.toHaveBeenCalled();
  });

  it('reports GET 403 as an access error and can retry successfully', async () => {
    api.getRoot.mockRejectedValueOnce({ response: { status: 403, data: '<html>Forbidden</html>' } });
    render(<FilesPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('HTTP 403');
    expect(screen.queryByText('根路径未配置')).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findAllByText('notes.txt')).not.toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reports a configured-root PUT 403 without claiming the root is missing', async () => {
    useAuthStore.setState({ settings });
    api.setRoot.mockRejectedValueOnce({ response: { status: 403, data: {} } });
    render(<FilesPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('HTTP 403');
    expect(screen.queryByText('根路径未配置')).toBeNull();
    expect(api.setRoot).toHaveBeenCalledWith('/srv/files');
    expect(api.list).not.toHaveBeenCalled();
  });

  it('reports a network failure without showing the configuration instructions', async () => {
    api.getRoot.mockRejectedValueOnce(new Error('Network Error'));
    render(<FilesPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('无法连接文件服务');
    expect(screen.queryByText('根路径未配置')).toBeNull();
    expect(screen.queryByRole('button', { name: '设置根路径' })).toBeNull();
  });

  it('shows the unconfigured state only when the server explicitly confirms it', async () => {
    api.getRoot.mockResolvedValueOnce({ data: { configured: false, root: null } });
    render(<FilesPage />);
    expect(await screen.findByText('根路径未配置')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.setRoot).not.toHaveBeenCalled();
  });

  it('loads files immediately after manually setting an initially missing root', async () => {
    api.getRoot.mockResolvedValueOnce({ data: { configured: false, root: null } });
    vi.spyOn(window, 'prompt').mockReturnValue('/srv/manual');
    render(<FilesPage />);
    await screen.findByText('根路径未配置');
    fireEvent.click(screen.getByRole('button', { name: '设置根路径' }));
    expect(await screen.findAllByText('notes.txt')).not.toHaveLength(0);
    expect(api.setRoot).toHaveBeenCalledWith('/srv/manual');
    expect(api.list).toHaveBeenCalledWith('/');
    expect(screen.queryByText('根路径未配置')).toBeNull();
  });

  it('keeps the existing Files, Node and Skill root/path switching protocol', async () => {
    useAuthStore.setState({ settings });
    render(<FilesPage />);
    await screen.findAllByText('notes.txt');
    expect(api.setRoot).toHaveBeenLastCalledWith('/srv/files');
    fireEvent.click(screen.getByRole('button', { name: 'node项目管理' }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith('/srv/node'));
    expect(api.setRoot).toHaveBeenLastCalledWith('/');
    fireEvent.click(screen.getByRole('button', { name: 'skill管理' }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith('/srv/skills'));
    expect(api.setRoot).toHaveBeenLastCalledWith('/');
    fireEvent.click(screen.getByRole('button', { name: '网站根目录' }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith('/'));
    expect(api.setRoot.mock.calls.map(call => call[0])).toEqual(['/srv/files', '/', '/', '/srv/files']);
  });

  it('treats malformed configuration responses as errors rather than unconfigured', async () => {
    api.getRoot.mockResolvedValueOnce({ data: {} });
    render(<FilesPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('响应无效');
    expect(screen.queryByText('根路径未配置')).toBeNull();
  });

  it('restores the files root when switching from Node or Skill to Trash or Tools', async () => {
    useAuthStore.setState({ settings });
    render(<FilesPage />);
    await screen.findAllByText('notes.txt');
    fireEvent.click(screen.getByRole('button', { name: 'node项目管理' }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith('/srv/node'));
    fireEvent.click(screen.getByRole('button', { name: '回收站' }));
    await waitFor(() => expect(api.setRoot).toHaveBeenLastCalledWith('/srv/files'));
    fireEvent.click(screen.getByRole('button', { name: 'skill管理' }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith('/srv/skills'));
    fireEvent.click(screen.getByRole('button', { name: '工具' }));
    await waitFor(() => expect(api.setRoot).toHaveBeenLastCalledWith('/srv/files'));
    expect(api.setRoot.mock.calls.map(call => call[0])).toEqual(['/srv/files', '/', '/srv/files', '/', '/srv/files']);
  });
});
