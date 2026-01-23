# Semestra PRD

## 简介

Semestra 是一个以学生为中心的学习管理系统，旨在帮助学生直观地管理学期、课程以及相关学习资料。系统将 Course（课程） 作为最小单位，每个课程都有一个所属的 Semester（学期），Semester又属于一个Program。Semester和Course都配备一个专属的 Dashboard（仪表盘） 用于展示信息。用户可以通过点击卡片快速跳转到对应的 Semester Dashboard 或 Course Dashboard。Program是最高层级，

## 视觉设计要求
- 页面设置风格整体现代，简洁
- 避免使用蓝紫渐变等老套配色
- 支持深色模式
- 可以抽象成组件的UI元素可以抽象出来，统一页面设计，增加可维护性

## 系统架构概述
- 前端页面由React+Vite开发
- 后端使用Python, FastAPI, 数据库开发，提供数据增删改查与用户系统

### 用户系统
用户可以使用邮箱注册，登陆，登出，修改密码等功能。每一个用户应拥有独立的数据，用户与用户之间数据隔离。保留后续增加使用Google账号登陆的功能的可能性。

## 页面

1. 主页
列出当前用户所有的Program，用户可以点击Program的卡片进入对应的Program Dashboard。
2. Program Home Page
系统提供一个主页用于管理学期与课程，主页可以管理学期与课程(包括增删改查，以及拖拽调整顺序)，用户可以点击Semester和Course的卡片进入对应的Dashboard。
3. Semester Dashboard
详见Dashboard设计
Semester Dashboard 会包含一个不可删除的Widget，用于展示该学期的课程列表
4. Course Dashboard
详见Dashboard设计
5. 设置
设置页面的入口应该在navbar中，点击后进入设置页面，设置页面用于管理用户相关的设置以及系统设置(如主题，GPA Scaling换算方式等全局设置)


## 主要实体与属性

## 设置覆盖逻辑
当当前层级的某个设置未被修改时，则该层级的设置会继承自上一层级的设置。例如，如果一个Course没有设置GPA Scaling Table，则该Course会使用其所属Semester的GPA Scaling Table。如果该Semester也没有设置GPA Scaling Table，则该Semester会使用其所属Program的GPA Scaling Table。反之，如果当前层级的某个设置被修改，则该层级的设置会覆盖上一层级的设置，且不会影响到上一层级的设置。


### Program 属性

- **名称**：用来区分不同Program（如 “Computer Science”）。
- **包含Semester**：一个Program可以包含多个Semester，用户可在Program Dashboard或者主页中添加或移除Semester。
- **CGPA**：该Program的Cumulative GPA。(Scaled)
- **CGPA(Percentage)**：该Program的Cumulative GPA。(Percentage)
- **GPA Scaling Table**：该Program使用的GPA Scaling换算表。 分段映射，例如：85-100 -> 4.0, 80-84 -> 3.7
- **毕业要求Credit数量**：该Program的毕业要求Credit数量。
- **已修Credit数量**：该Program已修Credit数量。(自动计算得出)

#### CGPA计算逻辑：
所有Semester GPA的加权平均值，权重为该Semester的Credit数量。

### Semester（学期）属性

- **名称**：用来区分不同Semester（如 “Fall 2025”）。
- **包含课程**：一个Semester可以包含多门Course，用户可在Semester Dashboard或者主页中添加或移除Course。
- **成绩（Percentage）**：以百分制记录的该学期所有课程的平均成绩。
- **成绩（Scaled）**：转换后的分制成绩，便于不同评分标准之间比较。（先Scale后平均）
- **GPA Scaling Table**：该学期使用的GPA Scaling换算表。

### Course（课程）属性

- **名称**：例如 “Calculus I”。
- **Credit 数量**：课程的学分数量。
- **成绩（Percentage）**：以百分制记录的课程成绩。
- **成绩（Scaled）**：转换后的分制成绩，便于不同评分标准之间比较。
- **GPA Scaling Table**：该课程使用的GPA Scaling换算表。
- **是否参与计算GPA**：boolean类型，表示该课程是否参与计算GPA。
- **是否隐藏GPA信息**：boolean类型，表示该课程是否隐藏GPA信息。

## Dashboard 设计

每个 Dashboard 包含两部分：

- **标题栏**：位于页面上方，navbar下方，用于显示当前Dashboard的名称，返回按钮，Dashboard设置以及添加控件按钮
- **控件区**：一个支持自由拖拽布局的矩形网格区域，风格类似 Bento 布局。控件区采用 grid 布局，每个控件占用一定数量的行和列，具有 **最小尺寸**、**最大尺寸** 以及 **默认尺寸**。控件右下角含有设置图标，点击后可进入该控件的设置页面。在控件区无控件时，因提示用户“暂无控件，请点击…………添加控件”

## Program Home Page
- **Program Info**：由Hero gradient做背景，用大字号显示Program名称，毕业进度，GPA信息(GPA信息右侧要有一个隐藏的按钮，点击隐藏GPA信息，再次点击显示GPA信息，隐藏GPA的设置应该被保存)
- **Semester List(层级比Course List稍高)**：显示该Program的所有Semester，用户可以点击Semester进入对应的Dashboard。
- **Course List**：显示该Program的所有Course，用户可以点击Course进入对应的Dashboard。


## 控件(Widget)设计

每个控件都应该包含以下属性：
- **名称**：用于区分不同控件（如 “Course List”）。
- **id**：控件的标识符
- **最小尺寸**：控件的最小尺寸。
- **最大尺寸**：控件的最大尺寸。
- **默认尺寸**：控件的默认尺寸。
- **内容**：控件的内容。
- **是否允许删除**：控件是否允许被删除。
- **是否允许调整大小**：控件是否允许被调整大小。
- **是否允许调整位置**：控件是否允许被调整位置。

控件应当是interactive的，用户可以与控件进行交互。控件拥有对于所属对象(所属Semester或者所属Course，或者所属Course的所属Semester)配置的增删改查的能力。同时控件也可以拥有自己的内容和设置，这些内容和设置不依赖于所属对象，且可以被保存。

控件本质上是独立的插件，与页面**解耦**，可以由第三方开发者开发扩展。通过插件化设计，系统可以轻松增加新的功能组件，保持核心系统简洁。控件应当尽可能简化开发，通过设计标准统一的WidgetContext接口，提供尽可能方便简洁的方式增删改查系统数据

总结：
- **独立开发**：每个控件作为插件单独开发，遵循统一的接口，与核心页面逻辑解耦。
- **数据访问**：插件需具备对相应 Course 与 Semester 的读写权限，支持在用户交互时更新成绩、学分等信息。
- **可配置性**：插件的设置页面应提供必要的自定义选项，如显示方式、数据来源筛选等。
- **拖拽与布局**：插件在 Dashboard 中可通过拖拽调整位置与大小，但要遵循最小、最大尺寸限制，保证良好的视图效果。
- **插件设置**：在控件右下角点击设置图标，可进入设置界面调整插件参数或权限。


## Built-in Widgets

- **课程列表(默认存在于Semester Dashboard不可删除)**：列出该学期所有课程及其基本信息。点击课程名称或编号即可跳转至对应的 Course Dashboard。
- Counter**：用于记录课程相关信息的计数器，例如考勤次数、作业次数等。由文字，Increment，Max，Min属性组成


## 便捷功能

### ics快捷添加Semester
对于新建Semester，弹出一个窗口，该窗口支持以两种方式创建Semester, 1. 用户填写信息(现有) 2. 用户拖拽/选择上传ics文件，交由后端API处理后，新建一个包含了ics文件中Course的Semester。对于新建Course,依然只需要支持用户填写信息的方式。备注：在ics文件中可能存在类似于APS100 LEC0103的Course，请忽略LEC0103或类似的字段，这个字段仅说明了该Course的Section，不是Course名称的一部分。

### AI 学期总结(未来可以添加)


## 总结

Semestra 提供了灵活、可扩展的学习管理体验。通过把课程作为基本单位，并通过插件化设计向学期和课程 Dashboard 注入功能，系统既能满足学生对课程成绩与进度的关注，又能支持第三方开发更丰富的学习工具。用户可通过拖拽自由布局，实现个性化学习门户，并随时调整控制区域内各项插件的配置。