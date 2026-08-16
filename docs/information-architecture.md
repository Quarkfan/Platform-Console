# Platform Console 信息架构

## 导航层级

左侧主导航按操作意图分组：

- 工作台：运行概览、系统助手。
- 配置中心：机器人、通道、上下文、模型、能力、扩展与插件。
- 运行与运维：消息、执行、调度、资源、浏览器、治理。
- 系统管理：账号、系统设置。
- 辅助入口：使用手册固定在左侧底部，不占用主要业务层级。

中心边界仍由后端仓库决定；菜单分组只服务于操作员认知，不建立新的跨中心耦合。

## 列表与详情原则

可管理实体默认先进入列表页。列表负责搜索、状态、核心摘要以及新增、编辑、删除、探测、立即执行等明确动作，不同时展开编辑表单。

新增或编辑进入独立详情状态：

- 标题明确显示新增或编辑对象。
- 页面提供浅层的“返回列表”按钮。
- 高频字段直接展示；低频、协议、范围、重试、安全和原始 JSON 放在“高级配置”折叠区。
- 保存成功返回列表；取消不修改持久数据。

同一个中心包含多类实体时，使用左侧二级导航和页内 tab 呈现清晰实体边界；编辑时只显示当前实体详情，其他实体列表暂时隐藏。模型中心区分“服务商 / 模型部署 / 使用策略”，能力中心区分“能力目录 / 机器人授权 / 导入与更新 / 创建能力”，插件控制面区分“运行时插件 / 运行方案 / 平台插件”。

“插件与扩展”使用三级视图：运行时插件、运行方案、平台插件。Provider 与平台插件从列表进入详情，详情展示身份、隔离、契约、能力协商、探针、生命周期和日志；平台插件还展示持久化代次、安装时间和状态更新时间，使重启恢复与版本升级可直接核验。运行方案使用列表/编辑详情并保留高级组合配置。生命周期变更只对管理员显示并由 BFF 再次强制校验，内部 `draining` 动作在 UI 中表达为“停止接收新任务”。完整模型见 `docs/plugin-control-plane.md`。

## Page guidance and interaction feedback

Every operational page places a page-specific guide below the title. It explains the page purpose, concepts, configuration order and resulting effects; the full searchable manual remains in the auxiliary navigation.

List views preserve one entity per visual row. Cells do not wrap, wide datasets scroll horizontally, and only the primary command stays visible when an entity has many operations. Remaining commands open from the three-dot action menu. Forms use common control heights and bottom alignment so labels, inputs, selects, checkboxes and submit buttons share a stable baseline.

Every React Query mutation drives a global progress strip. Successful operations emit a completion notice; failed operations retain the server message. Clicking a disabled action reports its title or required configuration instead of failing silently.

## 实现约束

- 登录成功后必须读取 `/api/me` 确认会话已建立，再进入控制台；认证失败、Cookie 被拒绝或网络异常时保留表单并显示可操作的错误，不得直接刷新造成闪回。
- 公网 HTTPS 与本机 SSH 隧道使用同库同密钥但独立 Cookie 策略；只有精确回环 Host 可以使用非 Secure 的 host-only Cookie，公网策略不可因隧道兼容而降级。
- 页面主 hash 保持中心级导航稳定；详情状态由页面组件管理，后续需要可分享深链时再提升为嵌套路由。
- 所有图标按钮必须有可读 `title`；新增、保存、返回等明确命令使用图标加文本。
- 桌面和移动端都必须检查横向溢出、按钮文字裁切、表单覆盖和返回路径。
- UI acceptance 必须先进入新增或编辑详情，再检查高级配置；不得用列表页存在隐藏表单来冒充入口。
