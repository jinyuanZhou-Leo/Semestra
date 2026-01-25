Grade Calculator Widget

## UI
该插件UI由一个表格组成，表格支持行的增删改查，表格的每一行包含以下字段：
Assessment Name, Percentage(占比，接受0%-100%的数字), Grade Received(接受正数百分比，默认为0)

## 逻辑
表格最下方显示Total Percentage(权重的和)， Total Grade(经过计算该科百分比成绩), 和Total Grade Scaled(经过GPA Scaling对照表计算后的成绩，如4.0).这两项数据为实时计算，计算后会更新所属Course的Grade Scaled属性和Grade Percentage属性

占比求和必须等于100%，当占比求和不等于100%时，Total Grade显示为红色"Invalid"