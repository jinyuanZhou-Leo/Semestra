# Semestra

一个现代化的学期管理应用，帮助学生组织课程、追踪学业进度和管理作业。

## 技术栈

- **后端**: Python FastAPI + SQLite
- **前端**: React + Vite + TypeScript
- **样式**: Tailwind CSS + shadcn/ui
- **UI 组件**: Radix UI 原语

---

## 功能特性

- 📚 **课程管理**：按学期组织课程并追踪作业
- 📊 **成绩计算器**：内置 GPA 计算，支持自定义等级表
- 🧩 **插件系统**：可扩展的 Widget 和 Tab 插件，实现自定义功能
- 🎨 **现代化 UI**：基于 Tailwind CSS 和 shadcn/ui 组件构建
- 🌙 **深色模式**：完整的主题支持，自动深色模式
- 📱 **响应式设计**：在桌面和移动设备上无缝运行

---

## 环境要求

| 组件 | 版本要求 |
|------|----------|
| Python | >= 3.10 |
| Node.js | >= 18.x |
| npm | >= 9.x |

---

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd Semestra
```

### 2. 后端部署

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务 (开发模式)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端服务将运行在 `http://localhost:8000`

> **提示**: 也可以使用 `uv` 包管理器：`uv run uvicorn main:app --reload`
> 现在也可以在仓库根目录直接运行：`npm run dev:backend`

### 3. 前端部署

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将运行在 `http://localhost:5173`

> 现在也可以在仓库根目录直接运行：`npm run dev:frontend`

---

## 生产环境部署

### 后端

```bash
cd backend

# 使用 Gunicorn 运行（推荐）
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### 前端

```bash
cd frontend

# 构建生产版本
npm run build

# 构建产物在 dist/ 目录，可部署到任何静态文件服务器
```

---

## API 代理配置

开发环境下，前端通过 Vite 代理访问后端 API：

| 前端路径 | 后端目标 |
|----------|----------|
| `/api/*` | `http://127.0.0.1:8000/*` |
| `/docs` | `http://127.0.0.1:8000/docs` |

生产环境需要配置 Nginx 或其他反向代理实现相同效果。

---

## 目录结构

```
Semestra/
├── backend/                # 后端代码
│   ├── main.py            # FastAPI 入口
│   ├── models.py          # 数据库模型
│   ├── schemas.py         # Pydantic 模式
│   ├── crud.py            # 数据库操作
│   ├── auth.py            # 认证模块
│   ├── requirements.txt   # Python 依赖
│   └── semestra.db        # SQLite 数据库
├── frontend/              # 前端代码
│   ├── src/               # 源代码
│   ├── dist/              # 构建产物
│   ├── package.json       # Node.js 依赖
│   └── vite.config.ts     # Vite 配置
└── README.md              # 英文文档
```

---

## 运行测试

### 后端测试

```bash
cd backend
pytest
```

### 前端测试

```bash
cd frontend
npm run test
```

---

## API 文档

启动后端后访问 `http://localhost:8000/docs` 查看交互式 Swagger UI 文档。

---

## 插件开发

Semestra 提供了可扩展的插件系统，支持自定义 Widget 和 Tab。详细指南请参阅 [`PLUGIN_DEVELOPMENT.md`](./PLUGIN_DEVELOPMENT.md)。

### 快速概览

**Widget 插件**：Dashboard Tab 中显示的小型网格组件  
**Tab 插件**：作为独立标签页显示的全尺寸面板

### UI 开发指南

所有插件必须遵循以下规范：

- **使用 Tailwind CSS**：使用工具类进行样式设置（`className="flex gap-4 p-4"`）
- **使用 shadcn/ui 组件**：从 `../../components/ui/*` 导入以保持一致性
- **主题支持**：使用 Tailwind 颜色标记（`text-foreground`、`bg-card` 等）
- **响应式设计**：使用 Tailwind 响应式修饰符在不同屏幕尺寸上测试
- **可访问性**：确保键盘导航和 ARIA 标签

### 多尺寸 Widget 最佳实践

- **优先单一响应式组件**：使用一个 `.tsx`，通过 CSS 做尺寸适配（`clamp()`、容器查询、断点、CSS 变量）。
- **避免重复业务逻辑**：除非布局结构完全不同，不要为每个尺寸分别维护独立组件文件。
- **仅在结构差异大时拆分**：当紧凑态与大尺寸布局信息架构差异明显时，在同一入口组件内拆分子视图（如 `CompactView`、`FullView`）。
- **使用尺寸设计令牌**：为间距、字号、控件尺寸、视觉元素定义统一变量，保证各尺寸行为一致。
- **覆盖关键尺寸测试**：至少验证最小、中等、最大尺寸，避免 overflow 回归。

**示例**：
```tsx
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const MyWidget: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    return (
        <div className="h-full flex flex-col gap-4 p-4">
            <Input 
                value={settings.title}
                onChange={(e) => updateSettings({ ...settings, title: e.target.value })}
            />
            <Button onClick={handleAction}>保存</Button>
        </div>
    );
};
```

详细文档请参阅 [`PLUGIN_DEVELOPMENT.md`](./PLUGIN_DEVELOPMENT.md)。

---

## 常见问题

### Q: 数据库在哪里？
A: SQLite 数据库文件位于 `backend/semestra.db`，首次运行时自动创建。

### Q: 如何查看 API 文档？
A: 启动后端后访问 `http://localhost:8000/docs` 查看 Swagger UI。

### Q: 前端无法连接后端？
A: 确保后端运行在 8000 端口，前端开发服务器会自动代理请求。

### Q: 如何重置数据库？
A: 删除 `backend/semestra.db` 并重启后端，将自动创建新数据库。

---

## 一键启动脚本

**macOS/Linux (`start.sh`)**:
```bash
#!/bin/bash
# 启动后端
cd backend && source .venv/bin/activate && uvicorn main:app --reload &
# 启动前端
cd frontend && npm run dev
```

**Windows (`start.bat`)**:
```batch
@echo off
start cmd /k "cd backend && .venv\Scripts\activate && uvicorn main:app --reload"
start cmd /k "cd frontend && npm run dev"
```

---

## 许可证

MIT License

---

*最后更新: 2026-02-05*
