# Semestra

[English](#english) | [中文](#中文)

---

## English

A modern, full-featured semester management application designed for students to organize courses, track academic progress, manage assignments, and calculate GPAs efficiently.

### Features

- 📚 **Course Management** - Organize courses by semester, track assignments, and manage course resources
- 📊 **Grade Calculator** - Built-in GPA calculation with customizable grading scales and weighted assessments
- 🧩 **Plugin System** - Extensible widget and tab plugins for custom functionality and personalization
- 🎨 **Modern UI** - Built with Tailwind CSS v4 and shadcn/ui components, with smooth animations
- 🌙 **Theme Support** - Full light/dark mode with automatic theme detection
- 📱 **Responsive Design** - Seamless experience across desktop and mobile devices
- 🔒 **Authentication** - Secure user authentication with Google OAuth integration
- 🌐 **Multi-language** - Support for multiple languages and localization

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite + TypeScript + React Router |
| **Styling** | Tailwind CSS v4 + shadcn/ui + Radix UI |
| **State Management** | React Query (TanStack Query) + Context API |
| **Backend** | Python FastAPI + SQLAlchemy + SQLite |
| **Package Manager** | npm (frontend), uv (Python) |
| **Build Tools** | Vite, Rolldown, TypeScript |
| **Linting** | oxlint (frontend) |

### Prerequisites

| Component | Version |
|-----------|---------|
| Node.js | >= 18.x |
| npm | >= 9.x |
| Python | >= 3.10 |
| uv | >= 0.1.0 (recommended) |

### Quick Start

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd Semestra
```

#### 2. Backend Setup

```bash
cd backend

# Option A: Using uv (recommended)
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Option B: Using pip
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Option C: From project root
npm run dev:backend
```

Backend will be available at `http://localhost:8000`

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Or from project root
npm run dev:frontend
```

Frontend will be available at `http://localhost:5173`

#### 4. Access the Application

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs (Swagger UI)

### Development Commands

**Frontend** (from `frontend/` directory):
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run oxlint
npm run test         # Run tests with Vitest
npm run preview      # Preview production build
```

**Backend** (from `backend/` directory):
```bash
uvicorn main:app --reload              # Development server
pytest                                  # Run tests
uv run uvicorn main:app --reload       # Using uv
```

**Root Level**:
```bash
npm run dev:frontend      # Start frontend dev server
npm run dev:backend       # Start backend server
npm run build             # Build frontend for production
```

### Project Structure

```
Semestra/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/         # Reusable React components
│   │   │   ├── ui/            # shadcn/ui components
│   │   │   └── ...            # Feature components
│   │   ├── pages/             # Page components (route-based)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── contexts/          # React Context providers
│   │   ├── services/          # API services and utilities
│   │   ├── plugins/           # Built-in plugins
│   │   ├── plugin-system/     # Plugin system core
│   │   ├── plugin-sdk/        # Plugin SDK for developers
│   │   ├── layouts/           # Layout components
│   │   ├── assets/            # Static assets
│   │   ├── lib/               # Utility functions and helpers
│   │   ├── App.tsx            # Main app component
│   │   ├── main.tsx           # Entry point
│   │   └── index.css          # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── .oxlintrc.json         # Linting configuration
│
├── backend/                     # Python FastAPI backend
│   ├── main.py               # FastAPI entry point
│   ├── auth.py               # Authentication & authorization
│   ├── api_*.py              # API route handlers
│   ├── crud.py               # Database CRUD operations
│   ├── crud_*.py             # Specialized CRUD modules
│   ├── models.py             # SQLAlchemy models
│   ├── schemas.py            # Pydantic schemas
│   ├── requirements.txt       # Python dependencies
│   ├── alembic/              # Database migrations
│   ├── .env.example          # Environment variables template
│   └── semestra.db          # SQLite database (auto-created)
│
├── docs/                      # Documentation files
├── package.json              # Root package.json
├── CLAUDE.md                # Development guidelines
├── LICENSE                  # MIT License
└── README.md               # This file
```

### API Documentation

Once the backend is running, visit **http://localhost:8000/docs** to explore the interactive Swagger UI documentation of all available API endpoints.

### Configuration

#### Environment Variables

Create a `.env` file in the `backend/` directory. See `.env.example` for reference:

```bash
cp backend/.env.example backend/.env
```

Common variables:
```env
DATABASE_URL=sqlite:///./semestra.db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### Frontend API Proxy

In development, the frontend proxies API requests to the backend via Vite configuration:

| Frontend Path | Backend Target |
|---------------|----------------|
| `/api/*` | `http://127.0.0.1:8000/*` |
| `/docs` | `http://127.0.0.1:8000/docs` |

For production, configure a reverse proxy (Nginx, Apache, etc.) to achieve the same routing.

### Production Deployment

#### Backend Deployment

```bash
cd backend

# Install gunicorn
pip install gunicorn

# Run with gunicorn (4 workers)
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

#### Frontend Deployment

```bash
cd frontend

# Build for production
npm run build

# Output is in dist/ directory
# Deploy to any static host (Vercel, Netlify, S3, Nginx, etc.)
```

For Vercel:
```bash
# Vercel CLI
vercel
```

### Testing

**Frontend Tests**:
```bash
cd frontend
npm run test           # Run all tests
npm run test -- --ui  # Run with UI
```

**Backend Tests**:
```bash
cd backend
pytest                # Run all tests
pytest -v            # Verbose output
pytest --cov         # With coverage
```

### GPA Scaling & Settings Inheritance

GPA scaling tables resolve in the following order (highest priority first):

1. **Program-level** `gpa_scaling_table`
2. **User-level** `gpa_scaling_table`
3. **App default** scaling table

If a higher-priority level has no table or an empty/invalid table, the system falls back to the next level.

### Plugin Development

Semestra features an extensible plugin system for creating custom widgets and tabs. For detailed guidance, see the plugin development documentation.

#### Plugin Types

- **Widget Plugins**: Small grid-based components for the dashboard
- **Tab Plugins**: Full-width panels that appear as separate tabs

#### Plugin Development Guidelines

- Use **Tailwind CSS** for styling with utility classes
- Use **shadcn/ui components** from `../../components/ui/*`
- Support **theme tokens** for light/dark mode (`text-foreground`, `bg-card`, etc.)
- Ensure **responsive design** using Tailwind breakpoints
- Implement **accessibility** with keyboard navigation and ARIA labels

#### Multi-size Widget Best Practice

- Create **one responsive component** using CSS-driven scaling (clamp(), container queries, breakpoints)
- Avoid duplicate logic across sizes; use CSS variables for flexibility
- Split components only when layout structure fundamentally differs
- Test at minimum, medium, and maximum widget sizes

**Example Plugin**:
```tsx
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const MyWidget: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <Input 
        value={settings.title}
        onChange={(e) => updateSettings({ ...settings, title: e.target.value })}
        placeholder="Enter title"
      />
      <Button onClick={handleAction}>Save</Button>
    </div>
  );
};

export default MyWidget;
```

### FAQ

**Q: Where is the database located?**  
A: The SQLite database is stored at `backend/semestra.db`. It's automatically created on first run.

**Q: Frontend can't connect to the backend?**  
A: Ensure the backend is running on port 8000. The frontend dev server will automatically proxy requests via Vite.

**Q: How do I reset the database?**  
A: Delete `backend/semestra.db` and restart the backend. A fresh database will be created automatically.

**Q: How do I use the plugin system?**  
A: Refer to the plugin development documentation for creating custom widgets and tabs.

**Q: Can I deploy to Vercel/Netlify?**  
A: The frontend can be deployed to any static host. The backend requires Python support (e.g., Railway, Render, Heroku).

### Development Notes

This project follows these principles:

- **React 19 with React Compiler** enabled for optimized rendering
- **Tailwind CSS v4** for modern utility-first styling
- **oxlint** for fast, reliable code linting
- **uv** for fast Python package management
- **TypeScript** for type safety throughout the frontend
- **Vite** for fast builds and development experience

### Contributing

Contributions are welcome! Please follow the development guidelines in `CLAUDE.md` when submitting changes.

### License

MIT License - see [LICENSE](./LICENSE) for details

### Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

## 中文

一个现代化的全功能学期管理应用，帮助学生高效地组织课程、追踪学业进度、管理作业和计算GPA。

### 主要功能

- 📚 **课程管理** - 按学期组织课程、追踪作业、管理课程资源
- 📊 **成绩计算器** - 内置GPA计算，支持自定义等级表和权重设置
- 🧩 **插件系统** - 可扩展的Widget和Tab插件，实现自定义功能
- 🎨 **现代UI** - 采用Tailwind CSS v4和shadcn/ui组件，提供流畅动画
- 🌙 **主题支持** - 完整的亮色/暗色模式，自动检测主题偏好
- 📱 **响应式设计** - 在桌面和移动设备上提供无缝体验
- 🔒 **身份验证** - 安全的用户认证，支持Google OAuth集成
- 🌐 **多语言支持** - 支持多种语言和本地化

### 技术栈

| 层级 | 技术 |
|-----|-----|
| **前端** | React 19 + Vite + TypeScript + React Router |
| **样式** | Tailwind CSS v4 + shadcn/ui + Radix UI |
| **状态管理** | React Query (TanStack Query) + Context API |
| **后端** | Python FastAPI + SQLAlchemy + SQLite |
| **包管理** | npm (前端), uv (Python) |
| **构建工具** | Vite, Rolldown, TypeScript |
| **代码检查** | oxlint (前端) |

### 环境要求

| 组件 | 版本要求 |
|------|---------|
| Node.js | >= 18.x |
| npm | >= 9.x |
| Python | >= 3.10 |
| uv | >= 0.1.0 (推荐) |

### 快速开始

#### 1. 克隆项目

```bash
git clone <repository-url>
cd Semestra
```

#### 2. 后端部署

```bash
cd backend

# 方案A：使用 uv (推荐)
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 方案B：使用 pip
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 方案C：从项目根目录
npm run dev:backend
```

后端服务将运行在 `http://localhost:8000`

#### 3. 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 或从项目根目录
npm run dev:frontend
```

前端服务将运行在 `http://localhost:5173`

#### 4. 访问应用

- **前端**: http://localhost:5173
- **API文档**: http://localhost:8000/docs (Swagger UI)

### 开发命令

**前端**（在 `frontend/` 目录下）：
```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run lint         # 运行 oxlint 代码检查
npm run test         # 使用 Vitest 运行测试
npm run preview      # 预览生产构建
```

**后端**（在 `backend/` 目录下）：
```bash
uvicorn main:app --reload              # 开发服务器
pytest                                  # 运行测试
uv run uvicorn main:app --reload       # 使用 uv 启动
```

**根目录**：
```bash
npm run dev:frontend      # 启动前端开发服务器
npm run dev:backend       # 启动后端服务器
npm run build             # 构建生产版本
```

### 项目结构

```
Semestra/
├── frontend/                    # React 前端应用
│   ├── src/
│   │   ├── components/         # 可复用的 React 组件
│   │   │   ├── ui/            # shadcn/ui 组件库
│   │   │   └── ...            # 功能组件
│   │   ├── pages/             # 页面组件（基于路由）
│   │   ├── hooks/             # 自定义 React Hooks
│   │   ├── contexts/          # React Context 提供者
│   │   ├── services/          # API 服务和工具函数
│   │   ├── plugins/           # 内置插件
│   │   ├── plugin-system/     # 插件系统核心
│   │   ├── plugin-sdk/        # 插件开发 SDK
│   │   ├── layouts/           # 布局组件
│   │   ├── assets/            # 静态资源
│   │   ├── lib/               # 工具函数和辅助函数
│   │   ├── App.tsx            # 主应用组件
│   │   ├── main.tsx           # 入口点
│   │   └── index.css          # 全局样式
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── .oxlintrc.json         # 代码检查配置
│
├── backend/                     # Python FastAPI 后端
│   ├── main.py               # FastAPI 入口点
│   ├── auth.py               # 身份验证和授权
│   ├── api_*.py              # API 路由处理器
│   ├── crud.py               # 数据库 CRUD 操作
│   ├── crud_*.py             # 专业 CRUD 模块
│   ├── models.py             # SQLAlchemy 数据模型
│   ├── schemas.py            # Pydantic 模式定义
│   ├── requirements.txt       # Python 依赖
│   ├── alembic/              # 数据库迁移
│   ├── .env.example          # 环境变量模板
│   └── semestra.db          # SQLite 数据库（自动创建）
│
├── docs/                      # 文档文件
├── package.json              # 根目录 package.json
├── CLAUDE.md                # 开发指南
├── LICENSE                  # MIT 许可证
└── README.md               # 本文件
```

### API文档

后端服务启动后，访问 **http://localhost:8000/docs** 可以查看所有可用API端点的交互式Swagger UI文档。

### 配置

#### 环境变量

在 `backend/` 目录创建 `.env` 文件。参考 `.env.example`：

```bash
cp backend/.env.example backend/.env
```

常见变量：
```env
DATABASE_URL=sqlite:///./semestra.db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### 前端API代理

开发环境中，前端通过Vite配置将API请求代理到后端：

| 前端路径 | 后端目标 |
|---------|---------|
| `/api/*` | `http://127.0.0.1:8000/*` |
| `/docs` | `http://127.0.0.1:8000/docs` |

生产环境需要配置反向代理（Nginx、Apache等）来实现相同的路由。

### 生产环境部署

#### 后端部署

```bash
cd backend

# 安装 gunicorn
pip install gunicorn

# 使用 gunicorn 运行（4个工作进程）
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

#### 前端部署

```bash
cd frontend

# 生产构建
npm run build

# 输出在 dist/ 目录
# 部署到任何静态服务器（Vercel、Netlify、S3、Nginx等）
```

Vercel部署：
```bash
# 使用 Vercel CLI
vercel
```

### 测试

**前端测试**：
```bash
cd frontend
npm run test           # 运行所有测试
npm run test -- --ui  # 使用UI运行
```

**后端测试**：
```bash
cd backend
pytest                # 运行所有测试
pytest -v            # 详细输出
pytest --cov         # 覆盖率报告
```

### GPA等级表与设置继承

GPA等级表的解析优先级如下（高优先级优先）：

1. **课程项目级** `gpa_scaling_table`
2. **用户级** `gpa_scaling_table`
3. **应用默认** 等级表

如果高优先级没有表或表无效，系统将回退到下一个等级。

### 插件开发

Semestra 提供可扩展的插件系统，用于创建自定义Widget和Tab。详细指南请参考插件开发文档。

#### 插件类型

- **Widget插件**：用于仪表板的小型网格组件
- **Tab插件**：显示为独立标签页的全宽面板

#### 插件开发指南

- 使用 **Tailwind CSS** 进行样式设计
- 使用 **shadcn/ui** 组件，从 `../../components/ui/*` 导入
- 支持 **主题令牌** 实现亮暗模式（`text-foreground`, `bg-card` 等）
- 确保 **响应式设计**，使用Tailwind响应式修饰符
- 实现 **无障碍设计**，支持键盘导航和ARIA标签

#### 多尺寸Widget最佳实践

- 创建 **单个响应式组件**，使用CSS驱动缩放（clamp()、容器查询、断点）
- 避免重复逻辑，使用CSS变量提供灵活性
- 仅当布局结构差异巨大时才分离组件
- 在最小、中等和最大Widget尺寸下测试

**插件示例**：
```tsx
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const MyWidget: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <Input 
        value={settings.title}
        onChange={(e) => updateSettings({ ...settings, title: e.target.value })}
        placeholder="输入标题"
      />
      <Button onClick={handleAction}>保存</Button>
    </div>
  );
};

export default MyWidget;
```

### 常见问题

**Q: 数据库在哪里？**  
A: SQLite数据库存储在 `backend/semestra.db`，首次运行时自动创建。

**Q: 前端无法连接到后端？**  
A: 确保后端在8000端口运行。前端开发服务器会通过Vite自动代理请求。

**Q: 如何重置数据库？**  
A: 删除 `backend/semestra.db` 并重启后端，新数据库将自动创建。

**Q: 如何使用插件系统？**  
A: 参考插件开发文档学习创建自定义Widget和Tab。

**Q: 能部署到Vercel/Netlify吗？**  
A: 前端可以部署到任何静态服务器。后端需要Python支持（如Railway、Render、Heroku）。

### 开发说明

本项目遵循以下原则：

- **React 19 + React Compiler** 启用优化渲染
- **Tailwind CSS v4** 用于现代化的工具类样式
- **oxlint** 进行快速可靠的代码检查
- **uv** 用于快速Python包管理
- **TypeScript** 提供前端类型安全
- **Vite** 提供快速构建和开发体验

### 贡献

欢迎提交贡献！提交变更前请参考 `CLAUDE.md` 中的开发指南。

### 许可证

MIT许可证 - 详见 [LICENSE](./LICENSE)

### 支持

如有问题、建议或功能请求，请在GitHub上提交Issue。

---

**Last Updated**: 2026-04-26
