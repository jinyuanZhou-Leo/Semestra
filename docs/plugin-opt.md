# Plugin Framework Decoupling Refactor Plan

## Summary
本次重构把插件体系收敛为三个边界明确的层次：`plugin descriptor`、`plugin sdk`、`host runtime`。目标是让普通插件不再要求宿主后端登记或前端了解内部 registry，只有 builtin 插件保留宿主耦合能力；同时把插件 contract 从“前端代码生成后端 manifest”改为“仓库内独立静态声明，前后端共同消费”。

默认采用激进重构，不保留旧 authoring API，也不保留普通插件继续通过 `backend/plugin_governance.py` 注册的路径。builtin-dashboard、builtin-setting 和确实依赖宿主私有逻辑的 builtin domain plugin 继续由 host 管理；其余插件全部转为 descriptor 驱动。

## Key Changes

### 1. Descriptor 成为唯一 contract source
- 为每个插件引入独立静态声明文件，建议统一为 `plugin.json` 和可选 `setup.schema.json`。
- `plugin.json` 至少包含：
  - `id`
  - `classification`: `host-shell` | `builtin` | `external`
  - `visibility`: `public` | `hidden`
  - `install_by_default`
  - `enable_by_default`
  - `requires_authorization`
  - `requires_program_lms_integration`
  - `supports_unassigned_course`
  - `tab_contributions`
  - `widget_contributions`
  - `settings_sections`
- `setup.schema.json` 描述 setup fields、sections、persist 策略、required、enum、默认值和跨字段声明式校验规则。
- 前端直接读取 descriptor 构建 catalog、setup UI 和 authoring metadata；后端直接读取同一份 descriptor 构建 `PluginDefinition` 和 setup validation。
- 删除“后端运行依赖 frontend Vite SSR 生成 manifest”这一设计，移除 backend 对 `frontend/scripts/generate-plugin-setup-manifest.mjs` 产物的启动依赖。

### 2. Backend 只保留 host/builtin policy，不再硬编码普通插件
- 重构 `backend/plugin_governance.py`：
  - 保留一个很小的 `builtin host policy registry`，只描述宿主特有插件和确有宿主逻辑的 builtin 插件。
  - 普通插件的 install/default/availability/settings/setup 全部从 descriptor 加载。
- 取消普通插件在 Python 常量表中的显式登记；`pomodoro`、`world-clock`、`tab-template`、`course-resources` 之类插件不再出现在 host registry。
- `setup_review` callback 仅允许 builtin host-managed 插件使用；external/builtin-but-public 插件统一走声明式验证，不允许再向 host 注入 Python 回调。
- `list_plugin_definitions()`、catalog、activation、runtime resolution 统一消费加载后的 descriptor model，不再依赖散落常量过滤。
- `host reserved` 不再由字符串黑名单表达，改为基于 descriptor classification 判断：
  - `host-shell`: 宿主页壳层 tab，不进入 public plugin catalog
  - `builtin`: 宿主自带插件，可公开或隐藏
  - `external`: 普通插件

### 3. Frontend 暴露单一 SDK，移除 internal import
- 新建唯一作者入口，例如 `frontend/src/plugin-sdk/index.ts`，作为插件作者唯一 import surface。
- SDK 导出：
  - `definePlugin`
  - `defineTab`
  - `defineWidget`
  - `defineSettingsSection`
  - `defineSetup`
  - `usePluginHost`
  - `usePluginRuntimeInstance`
  - `usePluginUiState`
  - 所有公共类型
- 统一插件声明形态，改为单入口 default export：
  ```ts
  export default definePlugin({
    id: 'course-resources',
    metadata: { ... },
    tabs: [defineTab({ ... })],
    widgets: [defineWidget({ ... })],
    settingsSections: [defineSettingsSection({ ... })],
    setup: defineSetup({ ... }),
  })
  ```
- 停止让插件作者直接 import：
  - `plugin-system/contracts`
  - `plugin-system/types`
  - `services/tabRegistry`
  - `services/widgetRegistry`
  - `services/pluginSettingsRegistry`
- `public-types.ts` 不再简单 re-export 内部 registry types；改为 SDK 自己定义稳定公共类型，内部 loader/registry 负责适配。
- 重写模板插件和现有示例插件，保证仓库内插件作者示例全部只使用 SDK。

### 4. 内置插件分类和 catalog 规则统一建模
- 用 descriptor 字段代替前后端重复常量：
  - 替代 `HOST_RESERVED_PLUGIN_IDS`
  - 替代 `HOST_RESERVED_TAB_TYPES`
- runtime catalog、marketplace catalog、homepage shell placement 统一读取 classification/visibility，而不是前端一份、后端一份 blacklist。
- homepage shell 规则单独保留在 host config，但只引用 descriptor 中标记为 `host-shell` 的 contribution，不再手写 tab id 常量列表作为权限边界。
- `include_host_reserved=True` 这类与当前实现不一致的伪能力删除或改成真正返回 `host-shell` + `builtin` 全集的行为。

### 5. Setup 与 settings 规则收敛
- Program settings、Semester overrides、setup state 的优先级继续保持，但来源统一为 descriptor schema。
- 声明式 setup schema 支持：
  - 基础字段类型
  - required
  - enum/options
  - persist target
  - summary labels
  - section grouping
  - 简单 cross-field rules
- host 不再从前端 setup DSL 编译 schema；前端 setup renderer 只消费 schema。
- 对于必须插件自绘的 setup/review UI，允许前端保留可选自定义 renderer，但数据 contract 仍来自 schema，不允许前端 renderer 定义后端语义。

## API / Interface Changes
- 后端内部 `PluginDefinition` 来源从“Python registry + generated frontend manifest”改为“descriptor loader + builtin host policy overlay”。
- 前端作者 API 从 `definePluginMetadata` / `definePluginRuntime` / `definePluginSettings` 三段式改为 `definePlugin(...)` 单入口。
- 插件公共类型不再从 `services/*` 暴露，改为 `plugin-sdk` 自有类型。
- descriptor 新增稳定分类字段：
  - `classification`
  - `visibility`
- descriptor 贡献项稳定字段：
  - `tab_contributions[].contexts`
  - `widget_contributions[].contexts`
  - `settings_sections[].contexts`
- builtin-only 后端扩展点：
  - `host_policy`
  - `host_review_hook`
  不对普通插件开放。

## Execution Order
1. 建立 descriptor schema 和 loader，先让前后端都能读取同一份静态声明。
2. 引入 `plugin-sdk` 单一作者入口，并在前端内部完成 registry 适配。
3. 把现有插件迁移到 `definePlugin(...)` + descriptor 模式，先迁移一个普通插件和一个 builtin 插件验证模型。
4. 重构 backend governance，使普通插件完全从 descriptor 加载，保留 builtin host overlay。
5. 删除 frontend manifest 生成链路和 backend 对 generated manifest 的运行依赖。
6. 删除前后端 `HOST_RESERVED_*` 黑名单和旧 authoring API。

## Test Plan
- 后端单元测试：
  - descriptor loader 能正确加载 builtin、external、host-shell 三类插件
  - 普通插件无需 Python registry 也能出现在 catalog、activation、runtime payload 中
  - builtin-only review hook 不可用于 external 插件
  - setup/schema validation 覆盖 required、enum、persist、cross-field rules
- 前端单元测试：
  - `definePlugin(...)` 可注册 tab/widget/settings/setup
  - 所有公共类型从 `plugin-sdk` 使用时不需要 import internal modules
  - public catalog 正确排除 `host-shell`，保留 `builtin public` 和 `external`
  - homepage shell 正确只消费 `host-shell`
- 集成测试：
  - 新增一个纯 external demo 插件，不改 backend host code，前后端都能识别、展示、启用
  - builtin-dashboard / builtin-setting 不出现在 public catalog，但继续在 homepage shell 工作
  - Program/Semester/Course 设置页仍能渲染 plugin settings section
  - setup review 流程对普通插件只依赖 schema，不依赖 Python callback
- 回归测试：
  - 现有 builtin-event-core、builtin-gradebook、course-resources 至少各跑一条典型启用与运行路径
  - runtime tabs/widgets ownership、unassigned-course support、availability gating 不回退

## Assumptions
- `builtin-dashboard` 和 `builtin-setting` 继续定义为 `host-shell + hidden`。
- `builtin-event-core`、`builtin-gradebook`、`builtin-canvas-integration` 允许继续作为 builtin；其中只有确有宿主逻辑者保留后端 host policy。
- 不保留旧插件 authoring 入口的长期兼容层；迁移完成后直接删除旧 API。
- 不支持普通插件自带后端可执行逻辑注入；普通插件后端能力限于 descriptor 声明和宿主提供的通用能力。
- 本次重构以“仓库内插件”为边界，不包含远程下载、签名校验、沙箱执行这类 marketplace/runtime isolation 能力。
