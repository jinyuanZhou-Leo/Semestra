# Semestra

一个现代化的学期管理应用，帮助学生组织课程、追踪学业进度和管理作业。

## 技术栈

- **后端**: Python FastAPI + SQLite
- **前端**: React + Vite + TypeScript

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

*最后更新: 2026-01-26*
