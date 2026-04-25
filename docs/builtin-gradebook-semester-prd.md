# Builtin-gradebook插件 Semester中新增Tab页面 PRD

## 功能定位
1. 在用户已知当前学期课程的得分后，根据每门课的Credit数量以及是否计入GPA的设置，计算当前学期GPA的值。
2. 在该Semester下的课程没有完全出分的情况下提供What If推演，以及预设目标，计算达到目标所需得分的功能

## 参考
请参考builtin-gradebook中已有的Course上下问Tab的UI/UX设计，保持一致，但是有以下几个Exceptions:

1. DataTable不应当支持添加Course, Course是Semester的既有属性
2. DataTable应当有Course Name (要支持Alias), Category, Credit, 成绩(注意是Percentage)。具体的UI列名请自行决定，此处指说明功能，不指定明确的字段名
3. DataTable的Action Button不需要支持Edit

## Widget
去除Dashboard Tab中顶部的三个数据卡片，为现有Course中显示成绩的Gradebook Summary插件添加Semester的支持。
去除Course的Hide GPA Info字段。