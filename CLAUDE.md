# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server on port 3000
- `npm run build` - TypeScript compilation followed by Vite production build
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview the production build locally

## Architecture Overview

This is a React 19 + TypeScript + Vite application for a web-based file management and terminal interface. The app uses:

### State Management
- **Zustand** with localStorage persistence for global state
  - `auth.ts` - Authentication state (token, user, login/logout)
  - `terminal.ts` - Terminal tabs and settings (persisted to `flux_terminal` and `flux_terminal_settings`)
  - `app.ts` - Application-wide state

### Routing
- **React Router v7** with HashRouter (not BrowserRouter)
  - `/login` - Login page
  - `/*` - Protected route wrapping MainLayout
  - ProtectedRoute checks localStorage for `flux_auth` on mount

### API Layer
- Centralized **axios client** (`api/client.ts`) with:
  - Base URL: `https://www.haoaimei.top/flux/api`
  - 60-second timeout
  - Bearer token injection from `flux_token` in localStorage
  - 401 auto-redirect to login
  - Domain-specific APIs: `authApi`, `fileApi`, `uploadApi`, `downloadApi`, `compressApi`, `shareApi`, `trashApi`, `systemApi`, `databaseApi`, `nginxApi`, `sslApi`

### Directory Structure
```
src/
├── api/           # API client definitions and axios setup
├── components/
│   ├── ui/        # shadcn/ui components (Radix UI primitives)
│   ├── layout/    # MainLayout, Sidebar, Header
│   ├── shared/    # Shared components like NotificationContainer
│   └── file-manager/ # File management feature components
├── hooks/         # Custom React hooks (useDeviceType, useWebSocket, useFileManager)
├── pages/         # Route components (Login, Files, Terminal, Nginx, Database, SSL, Skill)
├── stores/        # Zustand stores with persistence
├── types/         # TypeScript type definitions
└── lib/           # Utility functions
```

### Key Technologies
- **Terminal**: xterm.js with addons (clipboard, fit, search, web-links)
- **File Editor**: Monaco Editor (@monaco-editor/react)
- **UI Components**: Radix UI primitives with Tailwind CSS
- **Forms**: react-hook-form with @hookform/resolvers and zod validation
- **HTTP Client**: axios with interceptors
- **WebSocket**: Custom hook for terminal WebSocket connections

### Development Proxy
Vite dev server proxies `/api` to `http://110.40.142.210/flux/api` (see `vite.config.ts`)

### Path Aliases
`@` is aliased to `./src` in tsconfig and vite.config

### Authentication Flow
1. Login stores token in localStorage as `flux_token`
2. User data stored in `flux_auth`
3. ProtectedRoute checks auth state on mount and restores from localStorage if needed
4. 401 responses clear storage and redirect to /#/login

### File Management Features
- Directory browsing, file read/write, permissions
- Chunked upload support for large files
- Compression/extraction (ZIP, TAR.GZ)
- Sharing with tokens and optional passwords
- Trash/recycle bin with restore
- File search, duplicates detection, checksums
- Disk usage statistics

### Terminal Features
- Multi-tab support with xterm.js
- WebSocket-based terminal sessions
- Persistent settings (font, theme, cursor blink, scrollback)
- Tab management (add, remove, reorder, close others/close all)
