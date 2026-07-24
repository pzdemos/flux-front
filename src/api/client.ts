import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/flux/api';
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || '/flux/ws';

export { API_BASE_URL, WS_BASE_URL };

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('flux_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('flux_token');
      localStorage.removeItem('flux_auth');
      window.location.href = '/#/login';
    }
    return Promise.reject(error);
  }
);

// ===== Auth API =====
export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),
  register: (username: string, password: string) =>
    apiClient.post('/auth/register', { username, password }),
  changePassword: (oldPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { oldPassword, newPassword }),
};

// ===== File Management API =====
export const fileApi = {
  /** 1. 查询目录内容 */
  list: (path: string) =>
    apiClient.get('/files/list', { params: { path } }),

  /** 2. 创建目录 */
  mkdir: (path: string, name: string) =>
    apiClient.post('/files/mkdir', { path, name }),

  /** 3. 删除目录 */
  rmdir: (path: string) =>
    apiClient.delete('/files/rmdir', { params: { path } }),

  /** 4. 移动 */
  move: (from: string, to: string) =>
    apiClient.post('/files/move', { from, to }),

  /** 5. 复制 */
  copy: (from: string, to: string) =>
    apiClient.post('/files/copy', { from, to }),

  /** 6. 重命名 */
  rename: (path: string, newName: string) =>
    apiClient.post('/files/rename', { path, newName }),

  /** 7. 读取文件 */
  read: (path: string) =>
    apiClient.get('/files/read', { params: { path } }),

  /** 8. 写入文件 */
  write: (path: string, content: string, encoding?: string) =>
    apiClient.post('/files/write', { path, content, encoding: encoding || 'utf-8' }),

  /** 9. 删除文件（支持软删除） */
  delete: (path: string, soft?: boolean) =>
    apiClient.delete('/files/delete', { params: { path, soft: soft !== false } }),

  /** 10. 获取文件权限 */
  getPermissions: (path: string) =>
    apiClient.get('/files/permissions', { params: { path } }),

  /** 11. 修改文件权限 */
  setPermissions: (path: string, permissions: string) =>
    apiClient.put('/files/permissions', { path, permissions }),

  /** 12. 搜索文件 */
  search: (query: string, searchPath?: string) =>
    apiClient.get('/files/search', { params: { query, path: searchPath || '/' } }),

  /** 13. 批量删除 */
  batchDelete: (paths: string[]) =>
    apiClient.delete('/files/batch', { data: { paths } }),

  /** 14. 批量重命名 */
  batchRename: (items: string[], pattern: string, replacement: string, useRegex?: boolean) =>
    apiClient.post('/files/rename/batch', { items, pattern, replacement, useRegex: useRegex || false }),
};

// ===== Upload/Download API =====
export const uploadApi = {
  /** 1. 单文件上传 */
  upload: (file: File, path?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (path) formData.append('path', path);
    return apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const percent = progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0;
        console.log(`Upload progress: ${percent}%`);
      },
    });
  },

  /** 2. 多文件上传 */
  uploadMultiple: (files: File[], path?: string) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (path) formData.append('path', path);
    return apiClient.post('/files/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** 3. 分片上传 */
  uploadChunk: (chunk: Blob, identifier: string, chunkNumber: number, totalChunks: number, filename: string, path?: string) => {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('identifier', identifier);
    formData.append('chunkNumber', String(chunkNumber));
    formData.append('totalChunks', String(totalChunks));
    formData.append('filename', filename);
    if (path) formData.append('path', path);
    return apiClient.post('/files/upload/chunk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** 4. 查询分片上传状态 */
  getChunkStatus: (identifier: string) =>
    apiClient.get(`/files/upload/chunks/${identifier}`),

  /** 5. 合并分片 */
  mergeChunks: (identifier: string, path?: string) =>
    apiClient.post('/files/upload/merge', { identifier, path }),

  /** 6. 取消分片上传 */
  cancelChunks: (identifier: string) =>
    apiClient.delete(`/files/upload/chunks/${identifier}`),
};

export const downloadApi = {
  /** 7. 下载文件 */
  download: (path: string) =>
    `${API_BASE_URL}/files/download?path=${encodeURIComponent(path)}`,

  /** 8. 文件夹打包下载 */
  downloadFolder: (path: string) =>
    `${API_BASE_URL}/files/download/folder?path=${encodeURIComponent(path)}`,

  /** 9. 远程下载 */
  remoteDownload: (url: string, filename: string, path?: string) =>
    apiClient.post('/files/download/remote', { url, filename, path }),
};

// ===== Compress/Extract API =====
export const compressApi = {
  /** 1. ZIP 压缩 */
  zip: (paths: string[], outputFilename: string) =>
    apiClient.post('/files/compress/zip', { paths, outputFilename }),

  /** 2. TAR.GZ 压缩 */
  tar: (paths: string[], outputFilename: string) =>
    apiClient.post('/files/compress/tar', { paths, outputFilename }),

  /** 3. ZIP 解压 */
  extractZip: (path: string, outputDir?: string) =>
    apiClient.post('/files/extract/zip', { path, outputDir }),

  /** 4. TAR.GZ 解压 */
  extractTar: (path: string, outputDir?: string) =>
    apiClient.post('/files/extract/tar', { path, outputDir }),
};

// ===== Trash API =====
export const trashApi = {
  /** 1. 查看回收站 */
  list: () =>
    apiClient.get('/files/trash'),

  /** 2. 恢复文件 */
  restore: (id: string) =>
    apiClient.post(`/files/trash/${id}/restore`),

  /** 3. 永久删除 */
  permanentDelete: (id: string) =>
    apiClient.delete(`/files/trash/${id}`),

  /** 4. 清空回收站 */
  clear: () =>
    apiClient.delete('/files/trash'),
};

// ===== Git API =====
export const gitApi = {
  status: (path: string) =>
    apiClient.get('/files/git/status', { params: { path } }),
  log: (path: string, page = 1, limit = 20) =>
    apiClient.get('/files/git/log', { params: { path, page, limit } }),
  diff: (path: string, hash: string) =>
    apiClient.get('/files/git/diff', { params: { path, hash } }),
  file: (path: string, hash: string, file: string) =>
    apiClient.get('/files/git/file', { params: { path, hash, file } }),
};

// ===== System Tools API =====
export const systemApi = {
  /** 1. 文件预览 */
  preview: (path: string, width?: number, height?: number) =>
    apiClient.get('/files/preview', { params: { path, width, height } }),

  /** 2. 缩略图 */
  thumbnail: (path: string, size?: number) =>
    apiClient.get('/files/preview/thumbnail', { params: { path, size }, responseType: 'blob' }),

  /** 3. 磁盘空间统计 */
  diskUsage: (path: string) =>
    apiClient.get('/files/disk/usage', { params: { path } }),

  /** 4. 系统磁盘信息 */
  diskSystem: () =>
    apiClient.get('/files/disk/system'),

  /** 5. 文件去重 */
  duplicates: (path: string, algorithm?: string) =>
    apiClient.get('/files/duplicates', { params: { path, algorithm: algorithm || 'md5' } }),

  /** 6. 计算校验和 */
  checksum: (path: string, algorithm?: string) =>
    apiClient.get('/files/checksum', { params: { path, algorithm: algorithm || 'sha256' } }),

  /** 7. 验证校验和 */
  verifyChecksum: (path: string, checksum: string, algorithm?: string) =>
    apiClient.post('/files/checksum/verify', { path, checksum, algorithm: algorithm || 'sha256' }),

  /** 8. 修改根路径 */
  setRoot: (root: string) =>
    apiClient.put('/files/root', { root }),

  /** 9. 获取当前根路径 */
  getRoot: () =>
    apiClient.get('/files/root'),

  /** 10. 获取系统状态 */
  getStatus: () =>
    apiClient.get('/system/status'),
};

// ===== Legacy Stub APIs (for old pages) =====
export const databaseApi = {
  listKeys: () => apiClient.get('/db/keys'),
  getValue: (key: string) => apiClient.get('/db/get', { params: { key } }),
  setValue: (key: string, value: string) => apiClient.post('/db/set', { key, value }),
  deleteKey: (key: string) => apiClient.delete('/db/del', { params: { key } }),
};

export const nginxApi = {
  getStatus: () => apiClient.get('/nginx/status'),
  listConfigs: () => apiClient.get('/nginx/configs'),
  getConfig: (file: string) => apiClient.get('/nginx/config', { params: { file } }),
  saveConfig: (file: string, content: string) => apiClient.post('/nginx/config', { file, content }),
  testConfig: () => apiClient.post('/nginx/test'),
  reload: () => apiClient.post('/nginx/reload'),
  getLogs: (type: string, lines: number) => apiClient.get('/nginx/logs', { params: { type, lines } }),
};

export const sslApi = {
  getCertificates: () => apiClient.get('/ssl/certificates'),
  requestLetsEncrypt: (domain: string) => apiClient.post('/ssl/letsencrypt', { domain }),
  uploadCloudflare: (domain: string, cert: string, key: string) => apiClient.post('/ssl/cloudflare', { domain, cert, key }),
  deleteCertificate: (domain: string) => apiClient.delete(`/ssl/certificates/${domain}`),
};

// ===== DNS Management API (Aliyun Alidns) =====
export interface DnsRecordInput {
  DomainName?: string;
  RR: string;
  Type: string;
  Value: string;
  TTL?: number;
  Priority?: number;
}

export const dnsApi = {
  getDomains: () => apiClient.get('/dns/domains'),
  getRecords: (domain: string) => apiClient.get('/dns/records', { params: { domain } }),
  addRecord: (data: DnsRecordInput) => apiClient.post('/dns/records', data),
  updateRecord: (recordId: string, data: DnsRecordInput) => apiClient.put(`/dns/records/${recordId}`, data),
  deleteRecord: (recordId: string, domain: string) =>
    apiClient.delete(`/dns/records/${recordId}`, { params: { domain } }),
};

// ===== ECS Management API (Aliyun ECS) =====
const ECS_DEFAULT_REGION = 'cn-hangzhou';

export interface EcsRegion {
  RegionId: string;
  RegionEndpoint: string;
  LocalName: string;
}

export interface EcsInstance {
  InstanceId: string;
  InstanceName: string;
  Status: string;
  InstanceType: string;
  RegionId: string;
  ZoneId: string;
  CPU: number;
  Memory: number;
  OSName: string;
  ImageId: string;
  HostName: string;
  Description: string;
  InstanceChargeType: string;
  InstanceNetworkType: string;
  PrivateIp: string | null;
  PublicIp: string | null;
  EipAddress: string | null;
  SecurityGroupIds: string[];
  CreationTime: string;
  ExpiredTime: string;
  IsSelf: boolean;
}

export interface EcsSecurityGroup {
  SecurityGroupId: string;
  SecurityGroupName: string;
  Description: string;
  VpcId: string;
  RegionId: string;
  SecurityGroupType: string;
}

export interface EcsSecurityGroupRule {
  SecurityGroupRuleId?: string;
  IpProtocol: string;
  PortRange: string;
  SourceCidrIp: string;
  DestCidrIp: string;
  Policy: string;
  Priority: string;
  Description: string;
  Direction: string;
  NicType: string;
  CreateTime?: string;
}

export interface EcsDisk {
  DiskId: string;
  DiskName: string;
  Description: string;
  Size: number;
  Category: string;
  Type: string;
  Status: string;
  InstanceId: string;
  Device: string;
  DiskChargeType: string;
  RegionId: string;
  ZoneId: string;
  CreationTime: string;
  ExpiredTime: string;
  DeleteWithInstance?: boolean;
}

export const ecsApi = {
  // 实例
  getRegions: () => apiClient.get('/ecs/regions'),
  getInstances: (region: string = ECS_DEFAULT_REGION) =>
    apiClient.get('/ecs/instances', { params: { region } }),
  getInstance: (id: string, region: string = ECS_DEFAULT_REGION) =>
    apiClient.get(`/ecs/instances/${id}`, { params: { region } }),
  startInstance: (id: string, region: string = ECS_DEFAULT_REGION) =>
    apiClient.post(`/ecs/instances/${id}/start`, null, { params: { region } }),
  stopInstance: (id: string, region: string = ECS_DEFAULT_REGION, body?: { forceStop?: boolean; confirmQuit?: boolean }) =>
    apiClient.post(`/ecs/instances/${id}/stop`, body || {}, { params: { region } }),
  rebootInstance: (id: string, region: string = ECS_DEFAULT_REGION, body?: { forceStop?: boolean }) =>
    apiClient.post(`/ecs/instances/${id}/reboot`, body || {}, { params: { region } }),

  // 安全组
  getSecurityGroups: (region: string = ECS_DEFAULT_REGION) =>
    apiClient.get('/ecs/security-groups', { params: { region } }),
  getSecurityGroupRules: (sgId: string, region: string = ECS_DEFAULT_REGION, direction: string = 'all') =>
    apiClient.get(`/ecs/security-groups/${sgId}/rules`, { params: { region, direction } }),
  addSecurityGroupRule: (
    sgId: string,
    data: { IpProtocol: string; PortRange: string; SourceCidrIp?: string; Policy: string; Priority?: string; Description?: string },
    region: string = ECS_DEFAULT_REGION
  ) => apiClient.post(`/ecs/security-groups/${sgId}/rules`, data, { params: { region } }),
  deleteSecurityGroupRule: (
    sgId: string,
    data: { IpProtocol: string; PortRange: string; SourceCidrIp?: string; Policy: string; Priority?: string },
    region: string = ECS_DEFAULT_REGION
  ) => apiClient.delete(`/ecs/security-groups/${sgId}/rules`, { params: { region }, data }),
  updateSecurityGroupRule: (
    sgId: string,
    ruleId: string,
    data: { IpProtocol: string; PortRange: string; SourceCidrIp?: string; Policy: string; Priority?: string; Description?: string },
    region: string = ECS_DEFAULT_REGION
  ) => apiClient.put(`/ecs/security-groups/${sgId}/rules/${ruleId}`, data, { params: { region } }),

  // 云盘
  getDisks: (region: string = ECS_DEFAULT_REGION, instanceId?: string) =>
    apiClient.get('/ecs/disks', { params: { region, instanceId } }),
  attachDisk: (diskId: string, data: { instanceId: string; device?: string }, region: string = ECS_DEFAULT_REGION) =>
    apiClient.post(`/ecs/disks/${diskId}/attach`, data, { params: { region } }),
  detachDisk: (diskId: string, data: { instanceId: string }, region: string = ECS_DEFAULT_REGION) =>
    apiClient.post(`/ecs/disks/${diskId}/detach`, data, { params: { region } }),
};

export default apiClient;

// ===== User Settings API =====
export const userSettingsApi = {
  get: () => apiClient.get('/user/settings'),
  update: (settings: { files_root?: string; ecs_region?: string; sg_region?: string; disk_region?: string }) =>
    apiClient.put('/user/settings', settings),
};
