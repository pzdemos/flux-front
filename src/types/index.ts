// ===== Auth Types =====
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  username: string;
  role: string;
}

// ===== File Types =====
export interface RawFileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  permissions: string;
  modified: string;
}

export interface FileItem {
  name: string;
  path: string;
  size: number;
  modified: string;
  isDirectory: boolean;
  permissions: string;
  owner: string;
  group: string;
}

export interface FileListResponse {
  path: string;
  items: RawFileItem[];
  root: string;
}

export interface FileReadResponse {
  path: string;
  content: string;
  size: number;
  modified: string;
}

export interface FilePermissionsResponse {
  path: string;
  permissions: string;
  type: string;
}

export interface SearchResult {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
}

export interface SearchResponse {
  query: string;
  searchPath: string;
  count: number;
  results: SearchResult[];
}

// ===== Trash Types =====
export interface TrashItem {
  id: string;
  originalPath: string;
  deletedAt: string;
  size: number;
}


// ===== Disk Types =====
export interface DiskUsageResponse {
  path: string;
  totalSize: number;
  fileCount: number;
  dirCount: number;
  formattedSize: string;
}

export interface DiskSystemResponse {
  total: string;
  used: string;
  available: string;
  usagePercent: string;
  mountPoint: string;
}

// ===== Compress Types =====
export interface CompressOptions {
  paths: string[];
  outputFilename: string;
}

export interface ExtractOptions {
  path: string;
  outputDir: string;
}

// ===== Upload Types =====
export interface ChunkStatus {
  exists: boolean;
  identifier: string;
  filename: string;
  totalChunks: number;
  uploadedChunks: number[];
}

// ===== App Types =====
export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  fontFamily: string;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export type DeviceType = 'desktop' | 'tablet' | 'mobile';

export type ViewMode = 'files' | 'trash' | 'tools';

// ===== Terminal Types =====
export interface TerminalTab {
  id: string;
  title: string;
  sessionId: string | null;
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR';
  createdAt: number;
}
