import { useEffect, useMemo, useState } from "react";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  Archive,
  BookOpen,
  Bot,
  Boxes,
  Brain,
  CalendarClock,
  CircleHelp,
  Check,
  ChevronRight,
  CircleUser,
  Database,
  Download,
  Gauge,
  GitBranch,
  History,
  KeyRound,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Play,
  Pause,
  Plus,
  Plug,
  Radio,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";
import { authClient } from "./auth-client";
import { api, center } from "./api";
import { randomUuid } from "./ids";
type Nav = {
  id: string;
  label: string;
  icon: any;
  children?: Array<{ id: string; label: string }>;
};
export const navGroups: Array<{ label: string; items: Nav[] }> = [
  {
    label: "工作台",
    items: [
      { id: "overview", label: "运行概览", icon: Gauge },
      { id: "assistant", label: "系统助手", icon: CircleHelp },
    ],
  },
  {
    label: "配置中心",
    items: [
      { id: "bots", label: "机器人", icon: Bot },
      { id: "channels", label: "通道", icon: Radio },
      { id: "context", label: "上下文", icon: Brain },
      {
        id: "models",
        label: "模型",
        icon: Sparkles,
        children: [
          { id: "providers", label: "服务商" },
          { id: "deployments", label: "模型部署" },
          { id: "policies", label: "使用策略" },
        ],
      },
      {
        id: "capabilities",
        label: "能力",
        icon: Boxes,
        children: [
          { id: "list", label: "能力目录" },
          { id: "bindings", label: "机器人授权" },
          { id: "import", label: "导入与更新" },
          { id: "create", label: "创建能力" },
        ],
      },
      {
        id: "runtime-extensions",
        label: "插件与扩展",
        icon: Plug,
        children: [
          { id: "providers", label: "运行时插件" },
          { id: "profiles", label: "运行方案" },
          { id: "platform", label: "平台插件" },
        ],
      },
    ],
  },
  {
    label: "运行与运维",
    items: [
      { id: "messages", label: "消息", icon: MessageSquare },
      { id: "executions", label: "执行", icon: Activity },
      { id: "schedules", label: "调度", icon: CalendarClock },
      { id: "resources", label: "资源", icon: Database },
      { id: "browser", label: "浏览器", icon: Search },
      { id: "governance", label: "治理", icon: ShieldCheck },
    ],
  },
  {
    label: "系统管理",
    items: [
      { id: "accounts", label: "账号", icon: CircleUser },
      { id: "settings", label: "系统设置", icon: Settings },
    ],
  },
];
const nav = navGroups.flatMap((group) => group.items);
const endpoint: Record<string, [string, string]> = {
  bots: ["runtime", "/v1/bots"],
  channels: ["mg", "/v1/channels"],
  messages: ["mg", "/v1/messages"],
  context: ["ch", "/v1/sources"],
  models: ["mh", "/v1/providers"],
  capabilities: ["cr", "/v1/capabilities"],
  executions: ["runtime", "/v1/executions"],
  schedules: ["scheduler", "/v1/tasks"],
  resources: ["resource", "/v1/resources"],
  governance: ["governance", "/v1/approvals"],
};
function parseObjectJson(value: string, label: string) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label}必须是有效的 JSON 对象`);
  }
}
type ManualGuide = {
  title: string;
  summary: string;
  steps: string[];
  page: string;
  action: string;
};
type ManualSection = {
  id: string;
  label: string;
  guides: ManualGuide[];
};
const manualSections: ManualSection[] = [
  {
    id: "start",
    label: "快速开始",
    guides: [
      {
        title: "确认平台可以工作",
        summary: "先确认所有中心都已就绪，再开始配置业务。",
        steps: [
          "打开运行概览并刷新状态。",
          "确认每项服务都显示“已就绪”；异常项先生成排障包。",
          "首次登录后立即修改初始密码。",
        ],
        page: "overview",
        action: "查看运行概览",
      },
      {
        title: "接入第一个模型",
        summary: "机器人需要 Provider、模型部署和使用策略三层配置。",
        steps: [
          "添加 Model Provider，填写协议、Base URL 和 API Key。",
          "在模型部署中选择 Provider，填写平台实际使用的模型 ID。",
          "创建固定、轮流或随机策略；多模型场景建议开启失败切换。",
        ],
        page: "models",
        action: "配置模型",
      },
      {
        title: "创建并测试机器人",
        summary: "先在控制台完成一次直接对话，再连接外部通道。",
        steps: [
          "填写唯一 Bot ID、名称、Runtime 和模型策略。",
          "按职责撰写系统提示词，并保存机器人。",
          "点击机器人列表中的“对话”，发送一条测试消息。",
        ],
        page: "bots",
        action: "创建机器人",
      },
      {
        title: "连接飞书通道",
        summary: "每个通道账号绑定到一个机器人，凭据由治理中心加密保存。",
        steps: [
          "准备飞书应用的 App ID、App Secret，并选择已测试的机器人。",
          "优先使用长连接；群聊场景保留“仅在 @ 时响应”。",
          "保存后执行通道检测；需要读取用户数据时再完成用户授权。",
        ],
        page: "channels",
        action: "连接通道",
      },
    ],
  },
  {
    id: "operate",
    label: "日常操作",
    guides: [
      {
        title: "添加知识与记忆来源",
        summary: "上下文页面管理知识来源、绑定关系和召回范围。",
        steps: [
          "先上传或确认资源，再创建上下文来源。",
          "把来源绑定到需要使用它的机器人。",
          "通过检索结果确认内容已入库且范围正确。",
        ],
        page: "context",
        action: "管理上下文",
      },
      {
        title: "安装和授权能力",
        summary: "Skill、工作流、命令、浏览器和媒体能力统一在能力页面管理。",
        steps: [
          "导入前查看来源、权限和风险等级。",
          "遇到同名冲突时选择新版本、旧版本或手动编辑。",
          "启用能力并绑定到指定机器人后再执行测试。",
        ],
        page: "capabilities",
        action: "管理能力",
      },
      {
        title: "创建和观察定时任务",
        summary: "任务保存后可以立即运行，并持续查看上下次时间和运行日志。",
        steps: [
          "选择每日、每周、间隔或 Cron，并核对时区。",
          "填写目标机器人和完整任务 Prompt。",
          "先点立即运行验证，再确认下次执行时间和最近运行结果。",
        ],
        page: "schedules",
        action: "管理调度",
      },
      {
        title: "使用浏览器与媒体处理",
        summary: "浏览器自动化和 FFmpeg 任务都会产生可审计的执行与资源记录。",
        steps: [
          "浏览器任务必须填写目标地址和允许访问的域名。",
          "登录、下载、提交等敏感动作可能需要治理审批。",
          "生成的截图、视频、音频和诊断文件在资源页面查看。",
        ],
        page: "browser",
        action: "打开浏览器任务",
      },
    ],
  },
  {
    id: "troubleshoot",
    label: "故障排查",
    guides: [
      {
        title: "机器人没有回复",
        summary: "按通道、消息、执行、模型的顺序定位，最快找到中断位置。",
        steps: [
          "确认机器人启用、通道检测通过，群聊消息是否正确 @。",
          "在消息页面确认消息已进入，在执行页面确认任务已创建。",
          "执行失败时检查模型策略、审批状态和相关中心日志。",
        ],
        page: "messages",
        action: "检查消息",
      },
      {
        title: "定时任务没有运行",
        summary: "不要盲目等待，直接检查启用状态、下次时间和运行记录。",
        steps: [
          "核对任务时区、表达式、启用状态和下次执行时间。",
          "点击立即运行，确认机器人和 Prompt 本身能够执行。",
          "查看任务日志；执行已创建但失败时转到执行页面继续追踪。",
        ],
        page: "schedules",
        action: "检查调度",
      },
      {
        title: "任务等待审批或外部登录",
        summary: "高风险动作会停在检查点，批准后可以从原位置继续。",
        steps: [
          "在治理页面查看待处理审批、风险和请求来源。",
          "确认动作和目标正确后批准；不明确的请求应拒绝。",
          "浏览器外部登录完成后返回原任务继续运行。",
        ],
        page: "governance",
        action: "查看治理",
      },
      {
        title: "生成排障包",
        summary: "需要支持时导出脱敏日志包，不必截图或复制大量错误信息。",
        steps: [
          "点击侧边栏底部的“一键排障”。",
          "等待浏览器下载 ZIP 文件。",
          "排障包只含受限运行元数据；发送前仍应确认接收对象。",
        ],
        page: "overview",
        action: "返回概览",
      },
    ],
  },
  {
    id: "security",
    label: "安全与维护",
    guides: [
      {
        title: "账号与权限",
        summary: "管理员负责配置与账号，操作员执行日常工作，只读账号用于查看。",
        steps: [
          "为每位使用者创建独立账号，不共享管理员密码。",
          "按职责授予 admin、operator 或 viewer。",
          "人员离开或职责变化时立即停用账号。",
        ],
        page: "accounts",
        action: "管理账号",
      },
      {
        title: "配置迁移与备份",
        summary: "业务配置可以导出，服务器数据和密钥需要按运维流程单独备份。",
        steps: [
          "在系统设置导出配置包，导出内容不包含密钥。",
          "导入前先预检；系统会下载当前配置作为回退副本。",
          "服务器升级前执行完整备份，并验证备份校验和。",
        ],
        page: "settings",
        action: "打开系统设置",
      },
    ],
  },
];
type PageGuideContent = {
  intro: string;
  concepts: string[];
  configure: string[];
  effects: string[];
};
export const pageGuides: Record<string, PageGuideContent> = {
  overview: {
    intro: "查看各中心是否存活、依赖是否就绪，是开始配置和排障的第一站。",
    concepts: ["进程存活表示服务可访问", "依赖就绪表示服务可以承接业务"],
    configure: ["通常无需配置", "发现异常时先刷新，再生成排障包"],
    effects: ["确认平台当前可用性", "快速定位故障所在中心"],
  },
  assistant: {
    intro:
      "读取平台只读状态，回答配置和排障问题，并生成需要人工确认的配置草稿。",
    concepts: ["回答不会直接修改配置", "草稿必须由有权限的用户确认"],
    configure: ["描述目标、对象和当前现象", "检查草稿后前往对应页面执行"],
    effects: ["缩短跨页面排查时间", "保留人工决策和审计边界"],
  },
  bots: {
    intro: "机器人是运行职责、模型策略、上下文和能力授权的组合入口。",
    concepts: [
      "Runtime 决定执行内核",
      "模型策略、上下文和能力分别由对应中心管理",
    ],
    configure: [
      "先准备模型策略",
      "填写职责提示词并保存",
      "通过对话入口验证后再绑定通道",
    ],
    effects: ["生成独立运行身份和工作区", "通道消息可以路由到该机器人"],
  },
  channels: {
    intro:
      "这里只管理实际接入的消息通道账号及其机器人路由，不展示内部 SDK 注册信息。",
    concepts: [
      "一个通道账号对应一套平台凭据",
      "消息接收与发送保持账号和机器人隔离",
    ],
    configure: [
      "准备飞书 App ID 与 App Secret",
      "选择机器人和接收方式",
      "保存后执行检测，按需完成用户授权",
    ],
    effects: ["飞书消息进入指定机器人", "机器人输出从绑定账号投递回通道"],
  },
  context: {
    intro:
      "上下文中心统一管理知识来源与短、中、长期记忆，并决定哪些机器人可以召回它们。",
    concepts: [
      "来源描述内容从哪里来",
      "绑定描述哪个机器人可以用以及优先级",
      "TTL 控制内容多久后视为过期",
    ],
    configure: [
      "先创建文件、网页、飞书或外部来源",
      "再建立来源与机器人的绑定",
      "按需设置新鲜度、标签和作用域",
    ],
    effects: ["运行时按范围召回知识和记忆", "不同机器人之间不会默认共享上下文"],
  },
  models: {
    intro:
      "按服务商、模型部署、使用策略三层管理所有模型类型，不限于大语言模型。",
    concepts: [
      "服务商负责协议、地址和凭据",
      "模型部署对应具体模型 ID 和能力",
      "使用策略负责固定、轮流、随机和失败切换",
    ],
    configure: [
      "先添加并检测服务商",
      "再登记模型部署",
      "最后创建策略并分配给机器人",
    ],
    effects: [
      "模型可被统一路由、统计和故障切换",
      "图像、音频、视频模型也可由能力封装调用",
    ],
  },
  capabilities: {
    intro:
      "能力目录统一管理 Skill、命令、工作流、MCP、浏览器、媒体和自定义应用。",
    concepts: [
      "能力包是可安装版本",
      "能力是包内可解析的功能",
      "机器人授权决定谁能在什么触发方式下调用",
    ],
    configure: [
      "在目录确认能力状态和风险",
      "导入或创建能力包",
      "在机器人授权中选择能力、机器人和允许触发方式",
    ],
    effects: ["运行时按授权解析和注入能力", "凭据、触发方式和风险保持可审计"],
  },
  "runtime-extensions": {
    intro:
      "这是插件架构的控制面：查看、组合和管理各中心已经注册的 Provider，而不是复制中心业务配置。",
    concepts: [
      "Provider 是可替换实现",
      "运行方案把运行时插件与模型、能力、上下文组合",
      "平台插件显示各中心扩展的生命周期",
    ],
    configure: [
      "先检测插件并查看能力合同",
      "创建运行方案并选择备用 Provider",
      "停止接收新任务后再停用正在工作的插件",
    ],
    effects: ["扩展可以独立升级和替换", "失败插件可隔离，消费者只依赖稳定合同"],
  },
  messages: {
    intro:
      "查看 Message Gateway 标准化后的消息历史，用于追踪消息从哪里来、属于谁和流向哪里。",
    concepts: [
      "消息、账号、会话和发送人都有独立标识",
      "历史查询不等于自动补处理",
    ],
    configure: ["通常无需配置", "按标识和时间确认消息是否进入网关"],
    effects: [
      "定位接收、标准化和路由问题",
      "为调度补处理等上层能力提供查询依据",
    ],
  },
  executions: {
    intro:
      "查看机器人运行实例、状态和结果，是消息、调度与实际运行之间的追踪入口。",
    concepts: [
      "执行记录一次运行请求",
      "等待审批和失败是明确状态，不应盲目等待",
    ],
    configure: ["按机器人、来源和时间查看", "失败时打开详情并沿关联 ID 排查"],
    effects: ["确认任务是否真正进入运行时", "获得结果、错误和耗时证据"],
  },
  schedules: {
    intro: "创建周期任务、立即验证，并持续查看上次执行、下次执行和运行日志。",
    concepts: [
      "计划决定何时触发",
      "错过策略决定离线恢复方式",
      "立即执行不改变原计划",
    ],
    configure: [
      "选择每天、每周、间隔或 Cron",
      "填写机器人、时区和完整 Prompt",
      "先立即执行，再确认下次时间",
    ],
    effects: ["调度中心按计划创建运行请求", "重试、追赶和日志让过程可见"],
  },
  resources: {
    intro: "查看存储、缓存、工作区、诊断包和 FFmpeg 媒体任务等平台资源。",
    concepts: ["资源记录与实际文件分离", "清理策略只删除满足条件的受管资源"],
    configure: [
      "查看容量和保留时间",
      "创建媒体任务或下载诊断产物",
      "清理前确认范围",
    ],
    effects: ["控制磁盘增长", "统一管理截图、音视频和排障文件"],
  },
  browser: {
    intro:
      "运行受域名约束的浏览器 Agent 或确定性工作流，用于读网页、截图和经过治理的交互。",
    concepts: [
      "Agent 根据目标规划步骤",
      "工作流按固定动作执行",
      "登录、提交和下载可能触发审批",
    ],
    configure: [
      "填写起始网址",
      "选择 Agent 或工作流",
      "Agent 模式选择模型策略并描述目标",
    ],
    effects: [
      "产生可审计的浏览器会话和结果",
      "截图、录像和下载文件进入资源中心",
    ],
  },
  governance: {
    intro: "管理审批、凭据引用、脱敏和审计，阻止高风险能力静默执行。",
    concepts: ["批准只针对当前请求", "凭据保存后业务中心只持有引用"],
    configure: ["核对请求人、动作、目标和风险", "明确后批准，不明确则拒绝"],
    effects: ["暂停或恢复受控执行", "形成可追溯的安全记录"],
  },
  accounts: {
    intro: "管理控制台用户和角色，不用于管理飞书或模型服务商账号。",
    concepts: [
      "管理员负责配置和账号",
      "操作员负责日常执行",
      "只读用户只能查看",
    ],
    configure: ["每人创建独立账号", "按职责选择角色", "人员变动时及时停用"],
    effects: ["控制管理面的访问范围", "保留独立操作身份"],
  },
  settings: {
    intro:
      "管理平台级偏好、模型使用总策略和配置迁移；具体实体仍在各中心页面维护。",
    concepts: [
      "高级配置默认收起",
      "导出包不包含密钥",
      "系统设置不替代中心业务配置",
    ],
    configure: ["设置平台默认策略", "需要迁移时先导出备份并预检导入包"],
    effects: ["统一全局行为", "支持受控配置迁移和回退"],
  },
};

function PageGuide({ page }: { page: string }) {
  const guide = pageGuides[page];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (!guide) return null;
  return (
    <>
      <button
        className="page-guide-trigger secondary compact-button"
        type="button"
        onClick={() => setOpen(true)}
      >
        <BookOpen size={16} />
        <span>本页指引</span>
      </button>
      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <section
            className="guide-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`guide-${page}-title`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-title">
              <div>
                <span className="eyebrow">使用说明</span>
                <h3 id={`guide-${page}-title`}>本页指引</h3>
              </div>
              <button
                className="icon-button"
                type="button"
                title="关闭指引"
                aria-label="关闭指引"
                onClick={() => setOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <p className="guide-intro">{guide.intro}</p>
            <div className="page-guide-grid">
              {[
                ["概念理解", guide.concepts],
                ["怎么使用与配置", guide.configure],
                ["执行后会发生什么", guide.effects],
              ].map(([title, lines]) => (
                <section key={title as string}>
                  <strong>{title as string}</strong>
                  <ul>
                    {(lines as string[]).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ActionMenu({ children }: { children: React.ReactNode }) {
  const [position, setPosition] = useState<{ top: number; left: number }>();
  return (
    <>
      <button
        className="icon-button"
        title="更多操作"
        aria-label="更多操作"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({
            top: Math.min(rect.bottom + 6, window.innerHeight - 220),
            left: Math.max(12, rect.right - 210),
          });
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      {position && (
        <div
          className="action-menu-backdrop"
          onClick={() => setPosition(undefined)}
        >
          <div
            className="action-menu"
            style={position}
            onClick={() => setPosition(undefined)}
          >
            {children}
          </div>
        </div>
      )}
    </>
  );
}

function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="form-actions">{children}</div>;
}

export const healthPresentation: Record<
  string,
  { label: string; className: string }
> = {
  healthy: { label: "健康", className: "ready" },
  ready: { label: "健康", className: "ready" },
  degraded: { label: "降级", className: "degraded" },
  error: { label: "异常", className: "failed" },
  failed: { label: "异常", className: "failed" },
  unavailable: { label: "不可用", className: "failed" },
  disabled: { label: "已停用", className: "disabled" },
  configured: { label: "未检测", className: "pending" },
};

function HealthSummary({
  status,
  checkedAt,
  error,
  latencyMs,
}: {
  status?: string;
  checkedAt?: string;
  error?: string;
  latencyMs?: number;
}) {
  const presentation = healthPresentation[status ?? "configured"] ?? {
    label: status || "未检测",
    className: "pending",
  };
  return (
    <div className="health-summary" title={error || undefined}>
      <span className={`status-pill ${presentation.className}`}>
        {presentation.label}
      </span>
      <small>
        {checkedAt
          ? `最后检查 ${new Date(checkedAt).toLocaleString()}${latencyMs == null ? "" : ` · ${latencyMs} ms`}`
          : "尚未执行健康检查"}
      </small>
      {error && <small className="health-error">{error}</small>}
    </div>
  );
}

function OperationFeedback() {
  const mutating = useIsMutating();
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"success" | "error">("success");
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (
        event as CustomEvent<{ message: string; kind: "success" | "error" }>
      ).detail;
      setMessage(detail.message);
      setKind(detail.kind);
      window.setTimeout(
        () => setMessage(""),
        detail.kind === "error" ? 6000 : 2500,
      );
    };
    window.addEventListener("qft-operation", listener);
    const disabledHint = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(
        "button:disabled",
      ) as HTMLButtonElement | null;
      if (!button) return;
      setKind("error");
      setMessage(
        button.dataset.disabledReason ||
          button.title ||
          (mutating > 0
            ? "操作正在进行，请稍候。"
            : "请先完成必填配置后再操作。"),
      );
      window.setTimeout(() => setMessage(""), 3500);
    };
    document.addEventListener("pointerdown", disabledHint, true);
    return () => {
      window.removeEventListener("qft-operation", listener);
      document.removeEventListener("pointerdown", disabledHint, true);
    };
  }, [mutating]);
  return (
    <>
      {mutating > 0 && (
        <div
          className="global-progress"
          role="progressbar"
          aria-label="操作进行中"
        >
          <span />
        </div>
      )}
      {message && <div className={`operation-toast ${kind}`}>{message}</div>}
    </>
  );
}
function Login() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.username({ username, password });
      if (result.error) {
        setError("用户名或密码错误");
        return;
      }
      try {
        await api("/api/me");
        location.reload();
      } catch {
        setError(
          "密码验证成功，但登录会话未能保存。请刷新页面后重试；通过 SSH 隧道访问时请使用 127.0.0.1 或 localhost。",
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录请求失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-panel">
        <div className="brand-mark">Q</div>
        <h1>QuarkfanTools</h1>
        <p>平台控制台</p>
        <form onSubmit={submit}>
          <label>
            用户名
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={busy}>
            <KeyRound size={17} />
            {busy ? "正在登录" : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
function ForcePasswordChange() {
  const client = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const change = useMutation({
    mutationFn: () =>
      api("/api/account/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["me"] }),
  });
  return (
    <main className="login">
      <section className="login-panel password-change-panel">
        <div className="brand-mark">Q</div>
        <h1>修改初始密码</h1>
        <p>首次登录需要设置新的管理员密码</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            change.mutate();
          }}
        >
          <label>
            当前密码
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            新密码
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label>
            确认新密码
            <input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {confirmation && confirmation !== newPassword && (
            <div className="error">两次输入的新密码不一致</div>
          )}
          {change.error && <div className="error">{String(change.error)}</div>}
          <button
            className="primary"
            disabled={
              change.isPending ||
              !currentPassword ||
              newPassword.length < 12 ||
              newPassword !== confirmation
            }
          >
            <KeyRound size={17} />
            {change.isPending ? "正在修改" : "修改密码"}
          </button>
        </form>
      </section>
    </main>
  );
}
const value = (v: unknown) =>
  v === undefined || v === null
    ? "-"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);
const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"],
    index = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024)),
    );
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};
function DataTable({ items }: { items: any[] }) {
  if (!items.length) return <div className="empty">暂无数据</div>;
  const keys = Object.keys(items[0])
    .filter(
      (k) =>
        !["config", "metadata", "raw", "data", "ciphertext", "path"].includes(
          k,
        ),
    )
    .slice(0, 7);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id ?? i}>
              {keys.map((k) => (
                <td key={k} title={value(item[k])}>
                  {value(item[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Overview() {
  const {
    data = {},
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["status"],
    queryFn: () => api<Record<string, any>>("/api/centers/status"),
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
  const statuses = Object.entries(data),
    live = statuses.filter(([, status]) => status.ok).length,
    ready = statuses.filter(([, status]) => status.ready).length,
    issues = statuses.length - ready;
  return (
    <>
      <Header
        title="运行概览"
        action={
          <div className="overview-refresh">
            <span>
              {dataUpdatedAt
                ? `最近检查 ${new Date(dataUpdatedAt).toLocaleTimeString()}`
                : "尚未检查"}
            </span>
            <button
              className="icon-button"
              title="刷新"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        }
      />
      <PageGuide page="overview" />
      <div className="status-summary" aria-label="平台健康摘要">
        <div>
          <span>服务</span>
          <strong>{statuses.length || "-"}</strong>
        </div>
        <div>
          <span>进程存活</span>
          <strong>{live}</strong>
        </div>
        <div>
          <span>依赖就绪</span>
          <strong>{ready}</strong>
        </div>
        <div className={issues ? "has-issues" : ""}>
          <span>需处理</span>
          <strong>{issues}</strong>
        </div>
      </div>
      <div className="status-grid">
        {isLoading ? (
          <div className="empty">正在检查服务</div>
        ) : (
          statuses.map(([name, s]) => (
            <div className="status-row" key={name}>
              <span className={s.ready ? "dot online" : "dot offline"} />
              <div className="status-name">
                <strong>{name.toUpperCase()}</strong>
                <span>{s.version ? `v${s.version}` : "版本未知"}</span>
              </div>
              <div className="status-meta">
                <span>
                  {s.ready ? "已就绪" : s.ok ? "依赖未就绪" : "不可用"}
                </span>
                <code>{s.latencyMs} ms</code>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
function Header({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">QUARKFANTOOLS 3.0</span>
        <h2>{title}</h2>
      </div>
      {action}
    </header>
  );
}
function Schedules({ items, refetch }: { items: any[]; refetch: () => void }) {
  const [selected, setSelected] = useState<any>();
  const runs = useQuery({
    queryKey: ["schedule-runs", selected?.id],
    queryFn: () =>
      center<any[]>(
        "scheduler",
        `/v1/runs${selected ? `?taskId=${selected.id}` : ""}`,
      ),
    enabled: !!selected,
  });
  const emptyDraft = {
    id: "",
    tenantId: "default",
    name: "",
    botId: "",
    enabled: true,
    scheduleType: "daily",
    time: "08:00",
    weekday: 1,
    intervalSeconds: 3600,
    cron: "0 8 * * 1-5",
    timezone: "Asia/Shanghai",
    prompt: "",
    retryMaxAttempts: 2,
    retryDelaySeconds: 30,
    misfire: "run-once",
    maxBackfill: 100,
  };
  const [draft, setDraft] = useState(emptyDraft);
  const [editorOpen, setEditorOpen] = useState(false);
  const save = useMutation({
    mutationFn: () => {
      const schedule =
        draft.scheduleType === "interval"
          ? { type: "interval", seconds: draft.intervalSeconds }
          : draft.scheduleType === "weekly"
            ? { type: "weekly", weekday: draft.weekday, time: draft.time }
            : draft.scheduleType === "cron"
              ? { type: "cron", expression: draft.cron }
              : { type: "daily", time: draft.time };
      return center(
        "scheduler",
        draft.id ? `/v1/tasks/${draft.id}` : "/v1/tasks",
        {
          method: draft.id ? "PUT" : "POST",
          body: JSON.stringify({
            tenantId: draft.tenantId,
            botId: draft.botId,
            name: draft.name,
            enabled: draft.enabled,
            schedule,
            timezone: draft.timezone,
            target: { type: "runtime", payload: { prompt: draft.prompt } },
            retry: {
              maxAttempts: draft.retryMaxAttempts,
              delaySeconds: draft.retryDelaySeconds,
            },
            misfire: draft.misfire,
            maxBackfill: draft.maxBackfill,
          }),
        },
      );
    },
    onSuccess: () => {
      setDraft({ ...emptyDraft });
      setEditorOpen(false);
      refetch();
    },
  });
  const run = useMutation({
    mutationFn: (id: string) =>
      center("scheduler", `/v1/tasks/${id}/run`, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: () => {
      if (draft.id) setDraft({ ...emptyDraft });
      refetch();
    },
  });
  const toggle = useMutation({
    mutationFn: (task: any) =>
      center("scheduler", `/v1/tasks/${task.id}/enabled`, {
        method: "PATCH",
        body: JSON.stringify({
          tenantId: task.tenantId,
          enabled: !task.enabled,
        }),
      }),
    onSuccess: refetch,
  });
  const remove = useMutation({
    mutationFn: (task: any) =>
      center(
        "scheduler",
        `/v1/tasks/${task.id}?tenantId=${encodeURIComponent(task.tenantId)}`,
        { method: "DELETE" },
      ),
    onSuccess: refetch,
  });
  return (
    <>
      {!editorOpen && (
        <>
          <div className="toolbar">
            <span className="toolbar-count">共 {items.length} 个任务</span>
            <button
              className="primary compact-button"
              onClick={() => {
                setDraft({ ...emptyDraft });
                setEditorOpen(true);
              }}
            >
              <Plus size={16} />
              新增任务
            </button>
          </div>
          <div className="schedule-list">
            {items.map((x) => (
              <div className="schedule-row" key={x.id}>
                <div>
                  <strong>{x.name}</strong>
                  <span>
                    {x.schedule?.type === "once" && x.lastRunAt
                      ? "已完成"
                      : x.enabled
                        ? "已启用"
                        : "已暂停"}{" "}
                    · {x.timezone}
                  </span>
                </div>
                <div className="schedule-times">
                  <span>上次 {x.lastRunAt ?? "尚未执行"}</span>
                  <span>下次 {x.nextRunAt ?? "无"}</span>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    x.schedule?.type === "once" && x.lastRunAt
                      ? window.alert("一次性任务已经执行完成，不能重复运行。")
                      : run.mutate(x.id)
                  }
                  disabled={run.isPending}
                >
                  <Play size={16} />
                  {run.isPending ? "正在提交" : "立即执行"}
                </button>
                <ActionMenu>
                  <button
                    onClick={() =>
                      x.schedule?.type === "once" && x.lastRunAt
                        ? window.alert("一次性任务已经结束，不能再暂停或恢复。")
                        : toggle.mutate(x)
                    }
                  >
                    {x.enabled ? <Pause size={16} /> : <Play size={16} />}
                    {x.enabled ? "暂停任务" : "恢复任务"}
                  </button>
                  <button onClick={() => setSelected(x)}>
                    <History size={16} />
                    运行日志
                  </button>
                  <button
                    onClick={() => {
                      if (
                        x.target?.type !== "runtime" ||
                        x.schedule?.type === "once"
                      ) {
                        window.alert("该系统任务或一次性任务不支持在此编辑。");
                        return;
                      }
                      setDraft({
                        id: x.id,
                        tenantId: x.tenantId,
                        name: x.name,
                        botId: x.botId,
                        enabled: x.enabled,
                        scheduleType: x.schedule.type,
                        time: x.schedule.time ?? "08:00",
                        weekday: x.schedule.weekday ?? 1,
                        intervalSeconds: x.schedule.seconds ?? 3600,
                        cron: x.schedule.expression ?? "0 8 * * 1-5",
                        timezone: x.timezone,
                        prompt: String(x.target.payload?.prompt ?? ""),
                        retryMaxAttempts: x.retry?.maxAttempts ?? 2,
                        retryDelaySeconds: x.retry?.delaySeconds ?? 30,
                        misfire: x.misfire ?? "run-once",
                        maxBackfill: x.maxBackfill ?? 100,
                      });
                      setEditorOpen(true);
                    }}
                  >
                    <Settings size={16} />
                    编辑任务
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => {
                      if (window.confirm(`确认删除调度任务“${x.name}”？`))
                        remove.mutate(x);
                    }}
                  >
                    <Trash2 size={16} />
                    删除任务
                  </button>
                </ActionMenu>
              </div>
            ))}
          </div>
        </>
      )}
      {editorOpen && (
        <section className="section-band schedule-create">
          <div className="section-title">
            <h3>{draft.id ? "编辑调度任务" : "新建调度任务"}</h3>
            <button
              className="secondary compact-button"
              onClick={() => {
                setDraft({ ...emptyDraft });
                setEditorOpen(false);
              }}
            >
              返回列表
            </button>
          </div>
          <div className="schedule-form">
            <label>
              任务名
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Bot ID
              <input
                value={draft.botId}
                onChange={(e) => setDraft({ ...draft, botId: e.target.value })}
              />
            </label>
            <label>
              计划类型
              <select
                value={draft.scheduleType}
                onChange={(e) =>
                  setDraft({ ...draft, scheduleType: e.target.value })
                }
              >
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="interval">间隔</option>
                <option value="cron">Cron</option>
              </select>
            </label>
            {draft.scheduleType === "interval" ? (
              <label>
                间隔秒数
                <input
                  type="number"
                  min={10}
                  value={draft.intervalSeconds}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      intervalSeconds: Number(e.target.value),
                    })
                  }
                />
              </label>
            ) : draft.scheduleType === "cron" ? (
              <label>
                Cron 表达式
                <input
                  value={draft.cron}
                  onChange={(e) => setDraft({ ...draft, cron: e.target.value })}
                />
              </label>
            ) : (
              <label>
                时间
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                />
              </label>
            )}
            {draft.scheduleType === "weekly" && (
              <label>
                星期
                <select
                  value={draft.weekday}
                  onChange={(e) =>
                    setDraft({ ...draft, weekday: Number(e.target.value) })
                  }
                >
                  <option value={1}>周一</option>
                  <option value={2}>周二</option>
                  <option value={3}>周三</option>
                  <option value={4}>周四</option>
                  <option value={5}>周五</option>
                  <option value={6}>周六</option>
                  <option value={0}>周日</option>
                </select>
              </label>
            )}
            <label>
              时区
              <input
                value={draft.timezone}
                onChange={(e) =>
                  setDraft({ ...draft, timezone: e.target.value })
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft({ ...draft, enabled: event.target.checked })
                }
              />
              启用
            </label>
            <details className="advanced-config wide-field">
              <summary>
                <Settings size={16} />
                高级配置 <small>重试与离线恢复方式</small>
              </summary>
              <p className="advanced-description">失败重试适合短暂网络异常；错过策略决定服务暂停后是否补跑。没有明确补处理要求时保留默认值，避免重复执行。</p>
              <div className="advanced-grid">
                <label>
                  重试次数
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={draft.retryMaxAttempts}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        retryMaxAttempts: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  重试延迟秒数
                  <input
                    type="number"
                    min={1}
                    value={draft.retryDelaySeconds}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        retryDelaySeconds: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  错过执行策略
                  <select
                    value={draft.misfire}
                    onChange={(event) =>
                      setDraft({ ...draft, misfire: event.target.value })
                    }
                  >
                    <option value="skip">跳过</option>
                    <option value="run-once">补跑一次</option>
                    <option value="catch-up">追赶执行</option>
                  </select>
                </label>
                <label>
                  最大追赶数量
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={draft.maxBackfill}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        maxBackfill: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
            </details>
            <label className="wide-field">
              Prompt
              <textarea
                rows={4}
                value={draft.prompt}
                onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
              />
            </label>
            <FormActions>
              <button
                className="primary"
                disabled={
                  !draft.name || !draft.botId || !draft.prompt || save.isPending
                }
                onClick={() => save.mutate()}
              >
                <CalendarClock size={16} />
                {draft.id ? "保存修改" : "保存任务"}
              </button>
            </FormActions>
          </div>
          {save.error && (
            <div className="error form-error">{String(save.error)}</div>
          )}
        </section>
      )}
      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setSelected(undefined)}
        >
          <section
            className="run-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} 运行日志`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-title">
              <div>
                <h3>{selected.name}</h3>
                <span>运行日志</span>
              </div>
              <button
                className="icon-button"
                title="关闭"
                onClick={() => setSelected(undefined)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="run-list">
              {(runs.data ?? []).map((entry) => (
                <div className="run-entry" key={entry.id}>
                  <div>
                    <strong>{entry.status}</strong>
                    <span>
                      {entry.trigger} · {entry.createdAt}
                    </span>
                  </div>
                  <pre>
                    {(entry.logs ?? [])
                      .map(
                        (log: any) => `${log.at} [${log.level}] ${log.message}`,
                      )
                      .join("\n")}
                  </pre>
                  {entry.error && <div className="error">{entry.error}</div>}
                </div>
              ))}
              {!runs.isLoading && !(runs.data ?? []).length && (
                <div className="empty">暂无运行记录</div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function BrowserPanel() {
  const [url, setUrl] = useState("https://example.com"),
    [mode, setMode] = useState<"agent" | "workflow">("agent"),
    [goal, setGoal] = useState("读取页面主要内容并总结"),
    [modelPolicyId, setModelPolicyId] = useState(""),
    [authenticationFlow, setAuthenticationFlow] = useState("none"),
    [result, setResult] = useState<any>(),
    [busy, setBusy] = useState(false);
  const policies = useQuery({
    queryKey: ["model-policies"],
    queryFn: () => center<any[]>("mh", "/v1/routing-policies"),
  });
  async function run() {
    setBusy(true);
    try {
      const host = new URL(url).hostname;
      setResult(
        await center(
          "browser",
          mode === "agent"
            ? "/v1/browser/agent-tasks"
            : "/v1/browser/workflows",
          {
            method: "POST",
            body: JSON.stringify({
              tenantId: "default",
              botId: "console",
              sessionKey: `console-${mode}`,
              startUrl: url,
              allowedDomains: [host],
              ...(mode === "agent"
                ? {
                    goal,
                    modelPolicyId: modelPolicyId || undefined,
                    authenticationFlow,
                    maxSteps: 20,
                    keepAlive: authenticationFlow !== "none",
                    recordVideo: true,
                  }
                : {
                    actions: [
                      { type: "extract", selector: "body" },
                      {
                        type: "screenshot",
                        name: "console-browser.png",
                      },
                    ],
                    keepAlive: false,
                  }),
              correlationId: randomUuid(),
            }),
          },
        ),
      );
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <section className="section-band">
        <div className="section-title">
          <h3>浏览器执行</h3>
          <div className="segmented">
            <button
              className={mode === "agent" ? "active" : ""}
              onClick={() => setMode("agent")}
            >
              自动任务
            </button>
            <button
              className={mode === "workflow" ? "active" : ""}
              onClick={() => setMode("workflow")}
            >
              精确步骤
            </button>
          </div>
        </div>
        <div className="browser-form">
          <label>
            目标网址
            <input value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          {mode === "agent" && (
            <>
              <label className="wide-field">
                任务目标
                <textarea
                  rows={3}
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                />
              </label>
              <label>
                模型策略
                <select
                  value={modelPolicyId}
                  onChange={(event) => setModelPolicyId(event.target.value)}
                >
                  <option value="">默认策略</option>
                  {(policies.data ?? []).map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                认证流程
                <select
                  value={authenticationFlow}
                  onChange={(event) =>
                    setAuthenticationFlow(event.target.value)
                  }
                >
                  <option value="none">无需认证</option>
                  <option value="external-wait">扫码 / OAuth / SSO</option>
                  <option value="credential-login">账号密码</option>
                  <option value="captcha-assisted">页面验证码</option>
                  <option value="otp-assisted">短信 / OTP</option>
                  <option value="manual-input">人工输入</option>
                </select>
              </label>
            </>
          )}
          <button
            className="primary"
            onClick={run}
            disabled={busy || !url || (mode === "agent" && !goal.trim())}
          >
            <Play size={16} />
            {busy ? "运行中" : "立即运行"}
          </button>
        </div>
      </section>
      {result && (
        <section className="section-band browser-result">
          <div className="section-title">
            <h3>执行结果</h3>
            <span>
              {result.status ?? (result.error ? "failed" : "completed")}
            </span>
          </div>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
function ContextPanel() {
  const client = useQueryClient();
  const sources = useQuery({
    queryKey: ["context-sources"],
    queryFn: () => center<any[]>("ch", "/v1/sources"),
  });
  const bindings = useQuery({
    queryKey: ["context-bindings"],
    queryFn: () => center<any[]>("ch", "/v1/bindings"),
  });
  const bots = useQuery({
    queryKey: ["bots"],
    queryFn: () => center<any[]>("runtime", "/v1/bots"),
  });
  const emptySource = {
    id: "",
    name: "",
    kind: "manual",
    enabled: true,
    freshnessTtlSeconds: 86400,
    scopeBotIds: "",
    scopeWorkspaceIds: "",
    configJson: "{}",
  };
  const emptyBinding = {
    id: "",
    sourceId: "",
    botId: "",
    enabled: true,
    priority: 100,
    maxAgeSeconds: 86400,
    tags: "",
  };
  const [source, setSource] = useState(emptySource);
  const [binding, setBinding] = useState(emptyBinding);
  const [editor, setEditor] = useState<"source" | "binding">();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["context-sources"] });
    void client.invalidateQueries({ queryKey: ["context-bindings"] });
  };
  const saveSource = useMutation({
    mutationFn: () =>
      center("ch", source.id ? `/v1/sources/${source.id}` : "/v1/sources", {
        method: source.id ? "PUT" : "POST",
        body: JSON.stringify({
          name: source.name,
          kind: source.kind,
          enabled: source.enabled,
          scope: {
            tenantId: "default",
            botIds: source.scopeBotIds.split(/[,，\s]+/).filter(Boolean),
            workspaceIds: source.scopeWorkspaceIds
              .split(/[,，\s]+/)
              .filter(Boolean),
          },
          config: parseObjectJson(source.configJson, "来源配置"),
          freshnessTtlSeconds: source.freshnessTtlSeconds,
        }),
      }),
    onSuccess: () => {
      setSource({ ...emptySource });
      setEditor(undefined);
      refresh();
    },
  });
  const removeSource = useMutation({
    mutationFn: (item: any) =>
      center("ch", `/v1/sources/${item.id}`, { method: "DELETE" }),
    onSuccess: (_result, item) => {
      if (source.id === item.id) setSource({ ...emptySource });
      refresh();
    },
  });
  const saveBinding = useMutation({
    mutationFn: () =>
      center("ch", binding.id ? `/v1/bindings/${binding.id}` : "/v1/bindings", {
        method: binding.id ? "PUT" : "POST",
        body: JSON.stringify({
          sourceId: binding.sourceId,
          botId: binding.botId,
          enabled: binding.enabled,
          priority: binding.priority,
          maxAgeSeconds: binding.maxAgeSeconds,
          tags: binding.tags.split(/[,，\s]+/).filter(Boolean),
        }),
      }),
    onSuccess: () => {
      setBinding({ ...emptyBinding });
      setEditor(undefined);
      refresh();
    },
  });
  const removeBinding = useMutation({
    mutationFn: (item: any) =>
      center("ch", `/v1/bindings/${item.id}`, { method: "DELETE" }),
    onSuccess: (_result, item) => {
      if (binding.id === item.id) setBinding({ ...emptyBinding });
      refresh();
    },
  });
  const error =
    saveSource.error ??
    removeSource.error ??
    saveBinding.error ??
    removeBinding.error;
  return (
    <div
      className={`stack context-workspace ${editor ? `editing edit-${editor}` : "listing"}`}
    >
      <section className="section-band source-section">
        <div className="section-title">
          <h3>上下文来源</h3>
          {!editor && (
            <div className="section-actions">
              <span>{sources.data?.length ?? 0} 个</span>
              <button
                className="primary compact-button"
                onClick={() => {
                  setSource({ ...emptySource });
                  setEditor("source");
                }}
              >
                <Plus size={16} />
                新增来源
              </button>
            </div>
          )}
        </div>
        <div className="model-entity-list">
          {(sources.data ?? []).map((item) => {
            const managed = item.config?.managedType === "runtime-transcript";
            return (
              <div className="model-entity-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.kind} · {managed ? "系统托管" : item.status}
                  </span>
                </div>
                <code>
                  {item.lastIngestedAt
                    ? `最近入库 ${item.lastIngestedAt}`
                    : "尚未入库"}
                </code>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    title={managed ? "系统托管来源不可编辑" : "编辑来源"}
                    disabled={managed}
                    onClick={() => {
                      setSource({
                        id: item.id,
                        name: item.name,
                        kind: item.kind,
                        enabled: item.enabled,
                        freshnessTtlSeconds: item.freshnessTtlSeconds ?? 86400,
                        scopeBotIds: (item.scope?.botIds ?? []).join(", "),
                        scopeWorkspaceIds: (
                          item.scope?.workspaceIds ?? []
                        ).join(", "),
                        configJson: JSON.stringify(item.config ?? {}, null, 2),
                      });
                      setEditor("source");
                    }}
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    className="icon-button danger-button"
                    title={managed ? "系统托管来源不可删除" : "删除来源"}
                    disabled={managed}
                    onClick={() => {
                      if (
                        window.confirm(
                          `确认删除上下文来源“${item.name}”及其记录？`,
                        )
                      )
                        removeSource.mutate(item);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="editor-heading">
          <strong>{source.id ? "编辑上下文来源" : "新增上下文来源"}</strong>
          <button
            className="secondary compact-button"
            onClick={() => {
              setSource({ ...emptySource });
              setEditor(undefined);
            }}
          >
            返回列表
          </button>
        </div>
        <div className="context-form">
          <input
            aria-label="来源名称"
            placeholder="来源名称"
            value={source.name}
            onChange={(event) =>
              setSource({ ...source, name: event.target.value })
            }
          />
          <select
            aria-label="来源类型"
            value={source.kind}
            onChange={(event) =>
              setSource({ ...source, kind: event.target.value })
            }
          >
            <option value="manual">人工维护</option>
            <option value="file">文件</option>
            <option value="url">网页</option>
            <option value="lark-document">飞书文档</option>
            <option value="lark-wiki">飞书知识库</option>
            <option value="skill-knowledge">Skill 知识</option>
            <option value="external">外部系统</option>
          </select>
          <label>
            新鲜度 TTL（秒）
            <input
              type="number"
              min={1}
              value={source.freshnessTtlSeconds}
              onChange={(event) =>
                setSource({
                  ...source,
                  freshnessTtlSeconds: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={source.enabled}
              onChange={(event) =>
                setSource({ ...source, enabled: event.target.checked })
              }
            />
            启用
          </label>
          <details className="advanced-config wide-field">
            <summary>
              <Settings size={16} />
              高级配置 <small>访问范围与来源专用参数</small>
            </summary>
            <p className="advanced-description">限制范围可防止知识被不相关的机器人或工作空间召回；JSON 只填写对应来源连接器要求的参数，普通人工来源保持为空对象。</p>
            <div className="advanced-grid">
              <label>
                限定机器人 ID
                <input
                  placeholder="多个值用逗号分隔"
                  value={source.scopeBotIds}
                  onChange={(event) =>
                    setSource({ ...source, scopeBotIds: event.target.value })
                  }
                />
              </label>
              <label>
                限定工作空间 ID
                <input
                  placeholder="多个值用逗号分隔"
                  value={source.scopeWorkspaceIds}
                  onChange={(event) =>
                    setSource({
                      ...source,
                      scopeWorkspaceIds: event.target.value,
                    })
                  }
                />
              </label>
              <label className="wide-field">
                来源配置（JSON）
                <textarea
                  rows={4}
                  spellCheck={false}
                  value={source.configJson}
                  onChange={(event) =>
                    setSource({ ...source, configJson: event.target.value })
                  }
                />
              </label>
            </div>
          </details>
          <FormActions>
            <button
              className="primary"
              disabled={!source.name || saveSource.isPending}
              onClick={() => saveSource.mutate()}
            >
              {source.id ? "保存修改" : "添加来源"}
            </button>
          </FormActions>
        </div>
      </section>
      <section className="section-band binding-section">
        <div className="section-title">
          <h3>机器人绑定</h3>
          {!editor && (
            <div className="section-actions">
              <span>{bindings.data?.length ?? 0} 个</span>
              <button
                className="primary compact-button"
                onClick={() => {
                  setBinding({ ...emptyBinding });
                  setEditor("binding");
                }}
              >
                <Plus size={16} />
                新增绑定
              </button>
            </div>
          )}
        </div>
        <div className="model-entity-list">
          {(bindings.data ?? []).map((item) => (
            <div className="model-entity-row" key={item.id}>
              <div>
                <strong>
                  {(sources.data ?? []).find(
                    (entry) => entry.id === item.sourceId,
                  )?.name ?? item.sourceId}
                </strong>
                <span>
                  {(bots.data ?? []).find((entry) => entry.id === item.botId)
                    ?.name ?? item.botId}{" "}
                  · 优先级 {item.priority}
                </span>
              </div>
              <code>{item.enabled ? "已启用" : "已停用"}</code>
              <div className="row-actions">
                <button
                  className="icon-button"
                  title="编辑绑定"
                  onClick={() => {
                    setBinding({
                      id: item.id,
                      sourceId: item.sourceId,
                      botId: item.botId,
                      enabled: item.enabled,
                      priority: item.priority,
                      maxAgeSeconds: item.maxAgeSeconds ?? 86400,
                      tags: (item.tags ?? []).join(", "),
                    });
                    setEditor("binding");
                  }}
                >
                  <Settings size={16} />
                </button>
                <button
                  className="icon-button danger-button"
                  title="删除绑定"
                  onClick={() => {
                    if (window.confirm("确认解除这个上下文绑定？"))
                      removeBinding.mutate(item);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="editor-heading">
          <strong>{binding.id ? "编辑机器人绑定" : "新增机器人绑定"}</strong>
          <button
            className="secondary compact-button"
            onClick={() => {
              setBinding({ ...emptyBinding });
              setEditor(undefined);
            }}
          >
            返回列表
          </button>
        </div>
        <div className="context-form">
          <select
            aria-label="绑定来源"
            value={binding.sourceId}
            onChange={(event) =>
              setBinding({ ...binding, sourceId: event.target.value })
            }
          >
            <option value="">选择来源</option>
            {(sources.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="绑定机器人"
            value={binding.botId}
            onChange={(event) =>
              setBinding({ ...binding, botId: event.target.value })
            }
          >
            <option value="">选择机器人</option>
            {(bots.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <label>
            优先级
            <input
              type="number"
              value={binding.priority}
              onChange={(event) =>
                setBinding({
                  ...binding,
                  priority: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            最大年龄（秒）
            <input
              type="number"
              min={1}
              value={binding.maxAgeSeconds}
              onChange={(event) =>
                setBinding({
                  ...binding,
                  maxAgeSeconds: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={binding.enabled}
              onChange={(event) =>
                setBinding({ ...binding, enabled: event.target.checked })
              }
            />
            启用
          </label>
          <details className="advanced-config wide-field">
            <summary>
              <Settings size={16} />
              高级配置 <small>检索筛选标签</small>
            </summary>
            <p className="advanced-description">标签用于在运行时筛选或归类该绑定。用逗号分隔；没有需要区分的检索场景时可以留空。</p>
            <div className="advanced-grid">
              <label className="wide-field">
                标签
                <input
                  placeholder="多个值用逗号分隔"
                  value={binding.tags}
                  onChange={(event) =>
                    setBinding({ ...binding, tags: event.target.value })
                  }
                />
              </label>
            </div>
          </details>
          <FormActions>
            <button
              className="primary"
              disabled={
                !binding.sourceId || !binding.botId || saveBinding.isPending
              }
              onClick={() => saveBinding.mutate()}
            >
              {binding.id ? "保存修改" : "添加绑定"}
            </button>
          </FormActions>
        </div>
        {error && <div className="error form-error">{String(error)}</div>}
      </section>
    </div>
  );
}
function ModelsPanel({
  view,
  onViewChange,
}: {
  view: "providers" | "deployments" | "policies";
  onViewChange: (view: "providers" | "deployments" | "policies") => void;
}) {
  const client = useQueryClient();
  const providers = useQuery({
    queryKey: ["model-providers"],
    queryFn: () => center<any[]>("mh", "/v1/providers"),
  });
  const deployments = useQuery({
    queryKey: ["model-deployments"],
    queryFn: () => center<any[]>("mh", "/v1/models"),
  });
  const policies = useQuery({
    queryKey: ["model-policies"],
    queryFn: () => center<any[]>("mh", "/v1/routing-policies"),
  });
  const bots = useQuery({
    queryKey: ["bots"],
    queryFn: () => center<any[]>("runtime", "/v1/bots"),
  });
  const emptyProvider = {
    id: "",
    name: "",
    protocol: "openai",
    baseUrl: "",
    apiKey: "",
    credentialRef: "",
    enabled: true,
    priority: 100,
    weight: 1,
    headersJson: "{}",
  };
  const emptyDeployment = {
    id: "",
    providerId: "",
    modelId: "",
    name: "",
    kind: "chat",
    enabled: true,
    capabilities: "",
    contextWindow: "",
    inputPricePerMillion: "",
    outputPricePerMillion: "",
    metadataJson: "{}",
  };
  const emptyPolicy = {
    id: "",
    name: "",
    mode: "round-robin",
    fixedDeploymentId: "",
    failoverOnFailure: true,
    maxAttempts: 3,
    enabled: true,
    deploymentIds: [] as string[],
  };
  const [provider, setProvider] = useState(emptyProvider);
  const [deployment, setDeployment] = useState(emptyDeployment);
  const [policy, setPolicy] = useState(emptyPolicy);
  const [editor, setEditor] = useState<"provider" | "deployment" | "policy">();
  const invalidateModels = () => {
    void client.invalidateQueries({ queryKey: ["model-providers"] });
    void client.invalidateQueries({ queryKey: ["model-deployments"] });
    void client.invalidateQueries({ queryKey: ["model-policies"] });
  };
  const saveProvider = useMutation({
    mutationFn: async () => {
      let credentialRef = provider.credentialRef || undefined;
      if (provider.apiKey) {
        const existing = credentialRef?.match(
          /^governance:default:([0-9a-f-]{36})$/i,
        )?.[1];
        if (existing) {
          await center("governance", `/v1/credentials/${existing}`, {
            method: "PUT",
            body: JSON.stringify({
              tenantId: "default",
              actorId: "platform-console",
              value: { apiKey: provider.apiKey },
              name: `${provider.name} API Key`,
              kind: "model-provider",
              correlationId: randomUuid(),
            }),
          });
        } else {
          const credential = await center<any>(
            "governance",
            "/v1/credentials",
            {
              method: "POST",
              body: JSON.stringify({
                tenantId: "default",
                name: `${provider.name} API Key`,
                kind: "model-provider",
                value: { apiKey: provider.apiKey },
              }),
            },
          );
          credentialRef = `governance:default:${credential.id}`;
        }
      }
      const body = {
        name: provider.name,
        protocol: provider.protocol,
        baseUrl: provider.baseUrl,
        credentialRef,
        enabled: provider.enabled,
        priority: provider.priority,
        weight: provider.weight,
        headers: parseObjectJson(provider.headersJson, "自定义请求头"),
      };
      return center(
        "mh",
        provider.id ? `/v1/providers/${provider.id}` : "/v1/providers",
        { method: provider.id ? "PUT" : "POST", body: JSON.stringify(body) },
      );
    },
    onSuccess: () => {
      setProvider({ ...emptyProvider });
      setEditor(undefined);
      invalidateModels();
    },
  });
  const saveDeployment = useMutation({
    mutationFn: () => {
      const body = {
        providerId: deployment.providerId,
        modelId: deployment.modelId,
        name: deployment.name,
        kind: deployment.kind,
        enabled: deployment.enabled,
        capabilities: deployment.capabilities.split(/[,，\s]+/).filter(Boolean),
        contextWindow: deployment.contextWindow
          ? Number(deployment.contextWindow)
          : undefined,
        inputPricePerMillion: deployment.inputPricePerMillion
          ? Number(deployment.inputPricePerMillion)
          : undefined,
        outputPricePerMillion: deployment.outputPricePerMillion
          ? Number(deployment.outputPricePerMillion)
          : undefined,
        metadata: parseObjectJson(deployment.metadataJson, "模型元数据"),
      };
      return center(
        "mh",
        deployment.id ? `/v1/models/${deployment.id}` : "/v1/models",
        {
          method: deployment.id ? "PUT" : "POST",
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: () => {
      setDeployment({ ...emptyDeployment });
      setEditor(undefined);
      invalidateModels();
    },
  });
  const savePolicy = useMutation({
    mutationFn: () => {
      const body = {
        name: policy.name,
        mode: policy.mode,
        deploymentIds: policy.deploymentIds,
        fixedDeploymentId:
          policy.mode === "fixed"
            ? policy.fixedDeploymentId || policy.deploymentIds[0]
            : undefined,
        failoverOnFailure: policy.failoverOnFailure,
        maxAttempts: policy.maxAttempts,
        enabled: policy.enabled,
      };
      return center(
        "mh",
        policy.id
          ? `/v1/routing-policies/${policy.id}`
          : "/v1/routing-policies",
        { method: policy.id ? "PUT" : "POST", body: JSON.stringify(body) },
      );
    },
    onSuccess: () => {
      setPolicy({ ...emptyPolicy, deploymentIds: [] });
      setEditor(undefined);
      invalidateModels();
    },
  });
  const probeProvider = useMutation({
    mutationFn: (id: string) =>
      center("mh", `/v1/providers/${id}/probe`, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: invalidateModels,
  });
  const removeEntity = useMutation({
    mutationFn: ({
      type,
      id,
    }: {
      type: "provider" | "model" | "policy";
      id: string;
    }) =>
      center(
        "mh",
        type === "provider"
          ? `/v1/providers/${id}`
          : type === "model"
            ? `/v1/models/${id}`
            : `/v1/routing-policies/${id}`,
        { method: "DELETE" },
      ),
    onSuccess: invalidateModels,
  });
  const remove = (
    type: "provider" | "model" | "policy",
    item: any,
    label: string,
  ) => {
    if (
      type === "policy" &&
      (bots.data ?? []).some((bot) => bot.modelPolicyId === item.id)
    ) {
      window.alert("该策略仍被机器人使用，请先修改对应机器人的模型策略。");
      return;
    }
    if (window.confirm(`确认删除“${label}”？有关联配置时系统会阻止删除。`))
      removeEntity.mutate({ type, id: item.id });
  };
  const modelError =
    saveProvider.error ??
    saveDeployment.error ??
    savePolicy.error ??
    probeProvider.error ??
    removeEntity.error;
  return (
    <div
      className={`stack models-workspace view-${view} ${editor ? `editing edit-${editor}` : "listing"}`}
    >
      <div className="subview-tabs" role="tablist" aria-label="模型管理视图">
        {[
          ["providers", "服务商"],
          ["deployments", "模型部署"],
          ["policies", "使用策略"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            role="tab"
            aria-selected={view === id}
            onClick={() => {
              setEditor(undefined);
              onViewChange(id as typeof view);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="section-band provider-section">
        <div className="section-title">
          <h3>模型服务商</h3>
          {!editor && (
            <div className="section-actions">
              <span>{providers.data?.length ?? 0} 个</span>
              <button
                className="primary compact-button"
                onClick={() => {
                  setProvider({ ...emptyProvider });
                  setEditor("provider");
                }}
              >
                <Plus size={16} />
                新增 Provider
              </button>
            </div>
          )}
        </div>
        <div className="model-entity-list">
          {(providers.data ?? []).map((item) => (
            <div className="model-entity-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.protocol}</span>
                <HealthSummary
                  status={item.enabled ? item.status : "disabled"}
                  checkedAt={item.lastProbeAt}
                  error={item.lastError}
                />
              </div>
              <code>{item.baseUrl}</code>
              <div className="row-actions">
                <button
                  className="secondary compact-button"
                  onClick={() => probeProvider.mutate(item.id)}
                  disabled={probeProvider.isPending}
                >
                  <Activity size={16} />
                  检测
                </button>
                <ActionMenu>
                  <button
                    onClick={() => {
                      setProvider({
                        id: item.id,
                        name: item.name,
                        protocol: item.protocol,
                        baseUrl: item.baseUrl,
                        apiKey: "",
                        credentialRef: item.credentialRef ?? "",
                        enabled: item.enabled,
                        priority: item.priority,
                        weight: item.weight,
                        headersJson: JSON.stringify(
                          item.headers ?? {},
                          null,
                          2,
                        ),
                      });
                      setEditor("provider");
                    }}
                  >
                    <Settings size={16} />
                    编辑服务商
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => remove("provider", item, item.name)}
                  >
                    <Trash2 size={16} />
                    删除服务商
                  </button>
                </ActionMenu>
              </div>
            </div>
          ))}
          {!providers.isLoading && !(providers.data ?? []).length && (
            <div className="empty">暂无 Provider</div>
          )}
        </div>
        <div className="editor-heading">
          <strong>{provider.id ? "编辑 Provider" : "新增 Provider"}</strong>
          <button
            className="secondary compact-button"
            onClick={() => {
              setProvider({ ...emptyProvider });
              setEditor(undefined);
            }}
          >
            返回列表
          </button>
        </div>
        <div className="model-provider-form">
          <input
            aria-label="Provider 名称"
            placeholder="名称"
            value={provider.name}
            onChange={(event) =>
              setProvider({ ...provider, name: event.target.value })
            }
          />
          <select
            aria-label="Provider 协议"
            value={provider.protocol}
            onChange={(event) =>
              setProvider({ ...provider, protocol: event.target.value })
            }
          >
            <option value="openai">OpenAI compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
            <option value="stable-diffusion">Stable Diffusion</option>
            <option value="custom-http">Custom HTTP</option>
          </select>
          <input
            aria-label="Provider Base URL"
            placeholder="Base URL"
            value={provider.baseUrl}
            onChange={(event) =>
              setProvider({ ...provider, baseUrl: event.target.value })
            }
          />
          <input
            aria-label="Provider API Key"
            placeholder={
              provider.id ? "API Key（留空则保持不变）" : "API Key（加密保存）"
            }
            type="password"
            value={provider.apiKey}
            onChange={(event) =>
              setProvider({ ...provider, apiKey: event.target.value })
            }
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={provider.enabled}
              onChange={(event) =>
                setProvider({ ...provider, enabled: event.target.checked })
              }
            />
            启用
          </label>
          <details className="advanced-config wide-field">
            <summary>
              <Settings size={16} />
              高级配置 <small>路由优先级、流量比例和协议兼容项</small>
            </summary>
            <p className="advanced-description">
              只有多个 Provider 共同提供同类模型，或上游要求额外认证/租户信息时才需要调整；首次接入请保留默认值。
            </p>
            <div className="advanced-grid">
              <label>
                调度优先级
                <input
                  type="number"
                  value={provider.priority}
                  onChange={(event) =>
                    setProvider({
                      ...provider,
                      priority: Number(event.target.value),
                    })
                  }
                />
                <small className="field-help">数值越小越先被路由；同优先级的 Provider 再按权重分配。</small>
              </label>
              <label>
                权重
                <input
                  type="number"
                  min={1}
                  value={provider.weight}
                  onChange={(event) =>
                    setProvider({
                      ...provider,
                      weight: Number(event.target.value),
                    })
                  }
                />
                <small className="field-help">同一优先级下的流量比例，例如 1 和 3 约为 25% 与 75%。</small>
              </label>
              <label className="wide-field">
                自定义请求头（JSON）
                <textarea
                  rows={4}
                  spellCheck={false}
                  value={provider.headersJson}
                  onChange={(event) =>
                    setProvider({
                      ...provider,
                      headersJson: event.target.value,
                    })
                  }
                />
                <small className="field-help">
                  仅在上游要求 API Key 之外的固定 Header 时填写，例如 <code>{'{"HTTP-Referer":"https://example.com","X-Title":"QuarkfanTools"}'}</code>。每个键和值都必须是字符串；不要在这里重复保存 API Key 或临时用户令牌。
                </small>
              </label>
            </div>
          </details>
          <FormActions>
            <button
              className="primary"
              onClick={() => saveProvider.mutate()}
              disabled={
                !provider.name || !provider.baseUrl || saveProvider.isPending
              }
            >
              {provider.id ? "保存修改" : "添加 Provider"}
            </button>
          </FormActions>
        </div>
      </section>
      <section className="section-band deployment-section">
        <div className="section-title">
          <h3>模型部署</h3>
          {!editor && (
            <div className="section-actions">
              <span>{deployments.data?.length ?? 0} 个</span>
              <button
                className="primary compact-button"
                onClick={() => {
                  setDeployment({ ...emptyDeployment });
                  setEditor("deployment");
                }}
              >
                <Plus size={16} />
                新增模型
              </button>
            </div>
          )}
        </div>
        <div className="model-entity-list">
          {(deployments.data ?? []).map((item) => (
            <div className="model-entity-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.modelId} · {item.kind} ·{" "}
                  {item.enabled ? "已启用" : "已停用"}
                </span>
              </div>
              <code>
                {(providers.data ?? []).find(
                  (entry) => entry.id === item.providerId,
                )?.name ?? item.providerId}
              </code>
              <div className="row-actions">
                <button
                  className="icon-button"
                  title="编辑模型"
                  onClick={() => {
                    setDeployment({
                      id: item.id,
                      providerId: item.providerId,
                      modelId: item.modelId,
                      name: item.name,
                      kind: item.kind,
                      enabled: item.enabled,
                      capabilities: (item.capabilities ?? []).join(", "),
                      contextWindow: item.contextWindow
                        ? String(item.contextWindow)
                        : "",
                      inputPricePerMillion:
                        item.inputPricePerMillion == null
                          ? ""
                          : String(item.inputPricePerMillion),
                      outputPricePerMillion:
                        item.outputPricePerMillion == null
                          ? ""
                          : String(item.outputPricePerMillion),
                      metadataJson: JSON.stringify(
                        item.metadata ?? {},
                        null,
                        2,
                      ),
                    });
                    setEditor("deployment");
                  }}
                >
                  <Settings size={16} />
                </button>
                <button
                  className="icon-button danger-button"
                  title="删除模型"
                  onClick={() => remove("model", item, item.name)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {!deployments.isLoading && !(deployments.data ?? []).length && (
            <div className="empty">暂无模型部署</div>
          )}
        </div>
        <div className="editor-heading">
          <strong>{deployment.id ? "编辑模型部署" : "新增模型部署"}</strong>
          <button
            className="secondary compact-button"
            onClick={() => {
              setDeployment({ ...emptyDeployment });
              setEditor(undefined);
            }}
          >
            返回列表
          </button>
        </div>
        <div className="model-form">
          <select
            aria-label="模型所属 Provider"
            value={deployment.providerId}
            onChange={(event) =>
              setDeployment({ ...deployment, providerId: event.target.value })
            }
          >
            <option value="">选择 Provider</option>
            {(providers.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            aria-label="模型 ID"
            placeholder="模型 ID，例如 gpt-5-mini"
            value={deployment.modelId}
            onChange={(event) =>
              setDeployment({ ...deployment, modelId: event.target.value })
            }
          />
          <input
            aria-label="模型显示名称"
            placeholder="显示名称"
            value={deployment.name}
            onChange={(event) =>
              setDeployment({ ...deployment, name: event.target.value })
            }
          />
          <select
            aria-label="模型类型"
            value={deployment.kind}
            onChange={(event) =>
              setDeployment({ ...deployment, kind: event.target.value })
            }
          >
            <option value="chat">对话</option>
            <option value="completion">文本补全</option>
            <option value="embedding">向量嵌入</option>
            <option value="rerank">重排</option>
            <option value="vision">视觉理解</option>
            <option value="image-generation">图像生成</option>
            <option value="image-edit">图像编辑</option>
            <option value="speech-to-text">语音转文字</option>
            <option value="text-to-speech">文字转语音</option>
            <option value="video-generation">视频生成</option>
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={deployment.enabled}
              onChange={(event) =>
                setDeployment({ ...deployment, enabled: event.target.checked })
              }
            />
            启用
          </label>
          <details className="advanced-config wide-field">
            <summary>
              <Settings size={16} />
              高级配置 <small>能力声明、上下文上限、成本与适配器元数据</small>
            </summary>
            <p className="advanced-description">
              这些字段用于路由判断、用量估算和特殊适配器。没有来自模型服务商的明确参数时，留空比猜测更安全。
            </p>
            <div className="advanced-grid">
              <label>
                能力标签
                <input
                  placeholder="tools, vision"
                  value={deployment.capabilities}
                  onChange={(event) =>
                    setDeployment({
                      ...deployment,
                      capabilities: event.target.value,
                    })
                  }
                />
                <small className="field-help">逗号分隔，例如 tools、vision；用于让调用方筛选支持的模型。</small>
              </label>
              <label>
                上下文窗口
                <input
                  type="number"
                  min={1}
                  value={deployment.contextWindow}
                  onChange={(event) =>
                    setDeployment({
                      ...deployment,
                      contextWindow: event.target.value,
                    })
                  }
                />
                <small className="field-help">该模型单次请求可容纳的 Token 总数，用于在发送前裁剪上下文。</small>
              </label>
              <label>
                输入价格 / 百万 Token
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={deployment.inputPricePerMillion}
                  onChange={(event) =>
                    setDeployment({
                      ...deployment,
                      inputPricePerMillion: event.target.value,
                    })
                  }
                />
                <small className="field-help">仅用于成本估算和统计，不会改变服务商实际计费。</small>
              </label>
              <label>
                输出价格 / 百万 Token
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={deployment.outputPricePerMillion}
                  onChange={(event) =>
                    setDeployment({
                      ...deployment,
                      outputPricePerMillion: event.target.value,
                    })
                  }
                />
                <small className="field-help">仅用于成本估算和统计，不会改变服务商实际计费。</small>
              </label>
              <label className="wide-field">
                元数据（JSON）
                <textarea
                  rows={4}
                  spellCheck={false}
                  value={deployment.metadataJson}
                  onChange={(event) =>
                    setDeployment({
                      ...deployment,
                      metadataJson: event.target.value,
                    })
                  }
                />
                <small className="field-help">为特定适配器保留的附加声明。只填写该适配器文档要求的 JSON；普通 OpenAI 兼容模型保持 <code>{'{}'}</code>。</small>
              </label>
            </div>
          </details>
          <FormActions>
            <button
              className="primary"
              onClick={() => saveDeployment.mutate()}
              disabled={
                !deployment.providerId ||
                !deployment.modelId ||
                !deployment.name ||
                saveDeployment.isPending
              }
            >
              {deployment.id ? "保存修改" : "添加模型"}
            </button>
          </FormActions>
        </div>
      </section>
      <section className="section-band policy-section">
        <div className="section-title">
          <h3>使用策略</h3>
          {!editor && (
            <div className="section-actions">
              <span>{policies.data?.length ?? 0} 个</span>
              <button
                className="primary compact-button"
                onClick={() => {
                  setPolicy({ ...emptyPolicy, deploymentIds: [] });
                  setEditor("policy");
                }}
              >
                <Plus size={16} />
                新增策略
              </button>
            </div>
          )}
        </div>
        <div className="model-entity-list">
          {(policies.data ?? []).map((item) => (
            <div className="model-entity-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.mode} · {item.deploymentIds.length} 个模型 ·{" "}
                  {item.enabled ? "已启用" : "已停用"}
                </span>
              </div>
              <code>{item.failoverOnFailure ? "失败切换" : "单次尝试"}</code>
              <div className="row-actions">
                <button
                  className="icon-button"
                  title="编辑策略"
                  onClick={() => {
                    setPolicy({
                      id: item.id,
                      name: item.name,
                      mode: item.mode,
                      fixedDeploymentId: item.fixedDeploymentId ?? "",
                      failoverOnFailure: item.failoverOnFailure,
                      maxAttempts: item.maxAttempts,
                      enabled: item.enabled,
                      deploymentIds: [...item.deploymentIds],
                    });
                    setEditor("policy");
                  }}
                >
                  <Settings size={16} />
                </button>
                <button
                  className="icon-button danger-button"
                  title="删除策略"
                  onClick={() => remove("policy", item, item.name)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {!policies.isLoading && !(policies.data ?? []).length && (
            <div className="empty">暂无使用策略</div>
          )}
        </div>
        <div className="editor-heading">
          <strong>{policy.id ? "编辑使用策略" : "新增使用策略"}</strong>
          <button
            className="secondary compact-button"
            onClick={() => {
              setPolicy({ ...emptyPolicy, deploymentIds: [] });
              setEditor(undefined);
            }}
          >
            返回列表
          </button>
        </div>
        <div className="policy-form">
          <div className="policy-main-fields">
            <input
              aria-label="策略名称"
              placeholder="策略名称"
              value={policy.name}
              onChange={(event) =>
                setPolicy({ ...policy, name: event.target.value })
              }
            />
            <select
              aria-label="策略模式"
              value={policy.mode}
              onChange={(event) =>
                setPolicy({ ...policy, mode: event.target.value })
              }
            >
              <option value="fixed">固定</option>
              <option value="round-robin">轮流</option>
              <option value="random">随机</option>
            </select>
            <label>
              最大尝试次数
              <input
                type="number"
                min={1}
                max={10}
                value={policy.maxAttempts}
                onChange={(event) =>
                  setPolicy({
                    ...policy,
                    maxAttempts: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <fieldset className="deployment-options">
            <legend>参与路由的模型</legend>
            {(deployments.data ?? []).map((item) => (
              <label className="checkbox" key={item.id}>
                <input
                  type="checkbox"
                  checked={policy.deploymentIds.includes(item.id)}
                  onChange={(event) =>
                    setPolicy({
                      ...policy,
                      deploymentIds: event.target.checked
                        ? [...policy.deploymentIds, item.id]
                        : policy.deploymentIds.filter((id) => id !== item.id),
                    })
                  }
                />
                {item.name}
              </label>
            ))}
          </fieldset>
          <div className="policy-options-row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={policy.failoverOnFailure}
                onChange={(event) =>
                  setPolicy({
                    ...policy,
                    failoverOnFailure: event.target.checked,
                  })
                }
              />
              失败时切换下一个
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={policy.enabled}
                onChange={(event) =>
                  setPolicy({ ...policy, enabled: event.target.checked })
                }
              />
              启用策略
            </label>
            {policy.mode === "fixed" && (
              <label>
                固定使用的模型
                <select
                  aria-label="固定模型"
                  value={policy.fixedDeploymentId}
                  onChange={(event) =>
                    setPolicy({
                      ...policy,
                      fixedDeploymentId: event.target.value,
                    })
                  }
                >
                  <option value="">使用第一个已选模型</option>
                  {(deployments.data ?? [])
                    .filter((item) => policy.deploymentIds.includes(item.id))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          <FormActions>
            <button
              className="primary"
              onClick={() => savePolicy.mutate()}
              disabled={
                !policy.name ||
                !policy.deploymentIds.length ||
                savePolicy.isPending
              }
            >
              {policy.id ? "保存修改" : "添加策略"}
            </button>
          </FormActions>
        </div>
        {modelError && (
          <div className="error form-error">{String(modelError)}</div>
        )}
      </section>
    </div>
  );
}
function ChannelsPanel() {
  const client = useQueryClient();
  const bots = useQuery({
    queryKey: ["bots"],
    queryFn: () => center<any[]>("runtime", "/v1/bots"),
  });
  const channels = useQuery({
    queryKey: ["channels"],
    queryFn: () => center<any[]>("mg", "/v1/channels"),
  });
  const routes = useQuery({
    queryKey: ["routes"],
    queryFn: () => center<any[]>("mg", "/v1/routes"),
  });
  const emptyDraft = {
    id: "",
    name: "",
    botId: "",
    appId: "",
    appSecret: "",
    verificationToken: "",
    encryptKey: "",
    credentialRef: "",
    config: {} as Record<string, any>,
    configJson: "{}",
    enabled: true,
    transport: "long-connection",
    requireMention: true,
  };
  const [draft, setDraft] = useState(emptyDraft);
  const [editorOpen, setEditorOpen] = useState(false);
  const [oauthScopes, setOauthScopes] = useState("search:docs:read");
  const save = useMutation({
    mutationFn: async () => {
      let credentialRef = draft.credentialRef || undefined;
      if (draft.appSecret) {
        const value = {
          appId: draft.appId,
          appSecret: draft.appSecret,
          verificationToken: draft.verificationToken || undefined,
          encryptKey: draft.encryptKey || undefined,
        };
        const existing = credentialRef?.match(
          /^governance:default:([0-9a-f-]{36})$/i,
        )?.[1];
        if (existing) {
          await center("governance", `/v1/credentials/${existing}`, {
            method: "PUT",
            body: JSON.stringify({
              tenantId: "default",
              actorId: "platform-console",
              value,
              name: `${draft.name} 飞书凭据`,
              kind: "lark-app",
              correlationId: randomUuid(),
            }),
          });
        } else {
          const credential = await center<any>(
            "governance",
            "/v1/credentials",
            {
              method: "POST",
              body: JSON.stringify({
                tenantId: "default",
                name: `${draft.name} 飞书凭据`,
                kind: "lark-app",
                value,
              }),
            },
          );
          credentialRef = `governance:default:${credential.id}`;
        }
      }
      const channel = await center<any>(
        "mg",
        draft.id ? `/v1/channels/${draft.id}` : "/v1/channels",
        {
          method: draft.id ? "PUT" : "POST",
          body: JSON.stringify({
            channel: "lark",
            tenantId: "default",
            accountId: draft.appId,
            botId: draft.botId,
            name: draft.name,
            enabled: draft.enabled,
            credentialRef,
            config: {
              ...draft.config,
              ...parseObjectJson(draft.configJson, "通道配置"),
              transport: draft.transport,
            },
          }),
        },
      );
      const sinks = await center<any[]>("mg", "/v1/sinks");
      let runtimeSink = sinks.find(
        (sink) =>
          sink.kind === "runtime" &&
          sink.endpoint === "http://runtime-center:4105/v1/executions",
      );
      if (!runtimeSink) {
        runtimeSink = await center<any>("mg", "/v1/sinks", {
          method: "POST",
          body: JSON.stringify({
            name: "Runtime Center",
            kind: "runtime",
            endpoint: "http://runtime-center:4105/v1/executions",
            authTokenRef: "env:QFT_RUNTIME_SINK",
            timeoutMs: 300000,
            maxAttempts: 5,
          }),
        });
      }
      const existingRoutes = (routes.data ?? []).filter(
        (route) => route.channelAccountId === channel.id,
      );
      if (existingRoutes.length) {
        await Promise.all(
          existingRoutes.map((route) =>
            center("mg", "/v1/routes", {
              method: "POST",
              body: JSON.stringify({
                ...route,
                name: `${draft.name} -> ${draft.botId}`,
                botId: draft.botId,
                requireMention: draft.requireMention,
                autonomousReply:
                  bots.data?.find((bot) => bot.id === draft.botId)
                    ?.autonomousReplyBeta ?? false,
              }),
            }),
          ),
        );
      } else {
        await center("mg", "/v1/routes", {
          method: "POST",
          body: JSON.stringify({
            name: `${draft.name} -> ${draft.botId}`,
            botId: draft.botId,
            channelAccountId: channel.id,
            sinkId: runtimeSink.id,
            allowBotMessages: false,
            requireMention: draft.requireMention,
            autonomousReply:
              bots.data?.find((bot) => bot.id === draft.botId)
                ?.autonomousReplyBeta ?? false,
            conversationTypes: ["dm", "group", "channel", "thread"],
          }),
        });
      }
      return channel;
    },
    onSuccess: () => {
      setDraft({ ...emptyDraft, config: {}, configJson: "{}" });
      setEditorOpen(false);
      void client.invalidateQueries({ queryKey: ["channels"] });
      void client.invalidateQueries({ queryKey: ["routes"] });
    },
  });
  const removeChannel = useMutation({
    mutationFn: async (channel: any) => {
      const linkedRoutes = (routes.data ?? []).filter(
        (route) => route.channelAccountId === channel.id,
      );
      await Promise.all(
        linkedRoutes.map((route) =>
          center("mg", `/v1/routes/${route.id}`, { method: "DELETE" }),
        ),
      );
      return center("mg", `/v1/channels/${channel.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_result, channel) => {
      if (draft.id === channel.id)
        setDraft({ ...emptyDraft, config: {}, configJson: "{}" });
      void client.invalidateQueries({ queryKey: ["channels"] });
      void client.invalidateQueries({ queryKey: ["routes"] });
    },
  });
  const probe = useMutation({
    mutationFn: (id: string) =>
      center("mg", `/v1/channels/${id}/probe`, { method: "POST", body: "{}" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["channels"] }),
  });
  const authorize = useMutation({
    mutationFn: (channelId: string) =>
      api<any>("/api/oauth/lark/start", {
        method: "POST",
        body: JSON.stringify({
          channelId,
          scopes: oauthScopes.split(/[,，\s]+/).filter(Boolean),
        }),
      }),
    onSuccess: (result) => location.assign(result.authorizationUrl),
  });
  const refreshOAuth = useMutation({
    mutationFn: (channelId: string) =>
      api<any>("/api/oauth/lark/refresh", {
        method: "POST",
        body: JSON.stringify({ channelId }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["channels"] }),
  });
  const oauthResult = new URLSearchParams(location.search).get("larkOAuth");
  return (
    <div className="stack">
      {!editorOpen && (
        <>
          <section className="section-band">
            <div className="section-title">
              <h3>通道账号</h3>
              <div className="section-actions">
                <span>{channels.data?.length ?? 0} 个</span>
                <button
                  className="primary compact-button"
                  onClick={() => {
                    setDraft({ ...emptyDraft, config: {}, configJson: "{}" });
                    setEditorOpen(true);
                  }}
                >
                  <Plus size={16} />
                  新增通道
                </button>
              </div>
            </div>
            <div className="oauth-toolbar">
              <label>
                用户授权权限
                <input
                  value={oauthScopes}
                  onChange={(event) => setOauthScopes(event.target.value)}
                  placeholder="search:docs:read"
                />
              </label>
              <span>多个权限用空格分隔，系统自动加入离线授权。</span>
            </div>
            {oauthResult && (
              <div className={oauthResult === "failed" ? "error" : "notice"}>
                飞书用户授权结果：{oauthResult}
              </div>
            )}
            <div className="channel-list">
              {(channels.data ?? []).map((channel) => (
                <div className="channel-row" key={channel.id}>
                  <div>
                    <strong>{channel.name}</strong>
                    <span>{channel.channel}</span>
                    <HealthSummary
                      status={channel.enabled ? channel.status : "disabled"}
                      checkedAt={channel.lastHeartbeatAt}
                      error={channel.lastError}
                    />
                  </div>
                  <code>
                    {channel.config?.botOpenId ?? channel.accountId} · 用户授权
                    {channel.config?.userOAuth?.status ?? "未授权"}
                  </code>
                  <div className="row-actions">
                    <button
                      className="secondary compact-button"
                      onClick={() => probe.mutate(channel.id)}
                      disabled={probe.isPending}
                    >
                      <Activity size={16} />
                      检测
                    </button>
                    <ActionMenu>
                      {channel.channel === "lark" && (
                        <button onClick={() => authorize.mutate(channel.id)}>
                          <KeyRound size={16} />
                          {channel.config?.userOAuth ? "重新授权" : "用户授权"}
                        </button>
                      )}
                      {channel.config?.userOAuth?.credentialRef && (
                        <button onClick={() => refreshOAuth.mutate(channel.id)}>
                          <RefreshCw size={16} />
                          刷新用户令牌
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const route = (routes.data ?? []).find(
                            (item) => item.channelAccountId === channel.id,
                          );
                          setDraft({
                            id: channel.id,
                            name: channel.name,
                            botId: channel.botId,
                            appId: channel.accountId,
                            appSecret: "",
                            verificationToken: "",
                            encryptKey: "",
                            credentialRef: channel.credentialRef ?? "",
                            config: channel.config ?? {},
                            configJson: JSON.stringify(
                              channel.config ?? {},
                              null,
                              2,
                            ),
                            enabled: channel.enabled,
                            transport:
                              channel.config?.transport ?? "long-connection",
                            requireMention: route?.requireMention ?? true,
                          });
                          setEditorOpen(true);
                        }}
                      >
                        <Settings size={16} />
                        编辑通道
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `确认删除通道“${channel.name}”及其专属消息路由？历史消息不会删除。`,
                            )
                          )
                            removeChannel.mutate(channel);
                        }}
                      >
                        <Trash2 size={16} />
                        删除通道
                      </button>
                    </ActionMenu>
                  </div>
                </div>
              ))}
              {!channels.isLoading && !(channels.data ?? []).length && (
                <div className="empty">暂无通道</div>
              )}
            </div>
            {(authorize.error || refreshOAuth.error || removeChannel.error) && (
              <div className="error form-error">
                {String(
                  authorize.error ?? refreshOAuth.error ?? removeChannel.error,
                )}
              </div>
            )}
          </section>
        </>
      )}
      {editorOpen && (
        <section className="section-band">
          <div className="section-title">
            <h3>{draft.id ? "编辑飞书通道" : "新增飞书通道"}</h3>
            <button
              className="secondary compact-button"
              onClick={() => {
                setDraft({ ...emptyDraft, config: {}, configJson: "{}" });
                setEditorOpen(false);
              }}
            >
              返回列表
            </button>
          </div>
          <div className="channel-form">
            <label>
              名称
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              机器人
              <select
                value={draft.botId}
                onChange={(e) => setDraft({ ...draft, botId: e.target.value })}
              >
                <option value="">请选择</option>
                {(bots.data ?? []).map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              App ID
              <input
                value={draft.appId}
                disabled={Boolean(draft.id)}
                onChange={(e) => setDraft({ ...draft, appId: e.target.value })}
              />
            </label>
            <label>
              App Secret
              <input
                type="password"
                placeholder={draft.id ? "留空则保持原凭据" : ""}
                value={draft.appSecret}
                onChange={(e) =>
                  setDraft({ ...draft, appSecret: e.target.value })
                }
              />
            </label>
            <label>
              接收方式
              <select
                value={draft.transport}
                onChange={(e) =>
                  setDraft({ ...draft, transport: e.target.value })
                }
              >
                <option value="long-connection">长连接</option>
                <option value="webhook">Webhook</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.requireMention}
                onChange={(e) =>
                  setDraft({ ...draft, requireMention: e.target.checked })
                }
              />
              群聊仅在 @ 机器人时响应
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft({ ...draft, enabled: event.target.checked })
                }
              />
              启用通道
            </label>
            <details className="advanced-config wide-field">
              <summary>
                <Settings size={16} />
                高级配置 <small>飞书事件验签与适配器参数</small>
              </summary>
              <p className="advanced-description">Webhook 接收方式通常需要 Verification Token 和 Encrypt Key，值应与飞书开放平台一致。适配器 JSON 只给已启用的通道适配器使用；不确定时保持 <code>{'{}'}</code>。</p>
              <div className="advanced-grid">
                <label>
                  Verification Token
                  <input
                    type="password"
                    value={draft.verificationToken}
                    onChange={(e) =>
                      setDraft({ ...draft, verificationToken: e.target.value })
                    }
                  />
                </label>
                <label>
                  Encrypt Key
                  <input
                    type="password"
                    value={draft.encryptKey}
                    onChange={(e) =>
                      setDraft({ ...draft, encryptKey: e.target.value })
                    }
                  />
                </label>
                <label className="wide-field">
                  通道适配器配置（JSON）
                  <textarea
                    rows={5}
                    spellCheck={false}
                    value={draft.configJson}
                    onChange={(event) =>
                      setDraft({ ...draft, configJson: event.target.value })
                    }
                  />
                </label>
              </div>
            </details>
            <FormActions>
              <button
                className="primary"
                disabled={
                  !draft.name ||
                  !draft.botId ||
                  !draft.appId ||
                  (!draft.id && !draft.appSecret) ||
                  save.isPending
                }
                onClick={() => save.mutate()}
              >
                <Radio size={16} />
                {draft.id ? "保存修改" : "保存通道"}
              </button>
            </FormActions>
          </div>
          {save.error && (
            <div className="error form-error">{String(save.error)}</div>
          )}
        </section>
      )}
    </div>
  );
}
function SettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [theme, setTheme] = useState(
      localStorage.getItem("qft-theme") ?? "system",
    ),
    [bundle, setBundle] = useState<any>(),
    [bundleName, setBundleName] = useState(""),
    [fileError, setFileError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  async function downloadConfiguration(preImport = false) {
    const response = await fetch("/api/config/export?tenantId=default", {
      credentials: "include",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? `导出失败（${response.status}）`);
    }
    const blob = await response.blob(),
      url = URL.createObjectURL(blob),
      link = document.createElement("a"),
      stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = preImport
      ? `quarkfantools-default-pre-import-${stamp}.json`
      : `quarkfantools-default-configuration-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  const exporting = useMutation({
      mutationFn: () => downloadConfiguration(),
    }),
    preview = useMutation({
      mutationFn: () =>
        api<any>("/api/config/import/preview", {
          method: "POST",
          body: JSON.stringify({ bundle }),
        }),
      onSuccess: () => setConfirmed(false),
    }),
    importing = useMutation({
      mutationFn: async () => {
        await downloadConfiguration(true);
        return api<any>("/api/config/import", {
          method: "POST",
          body: JSON.stringify({ bundle, confirm: true }),
        });
      },
      onSuccess: () => setConfirmed(false),
    });
  async function selectBundle(file?: File) {
    setBundle(undefined);
    setBundleName("");
    setFileError("");
    setConfirmed(false);
    preview.reset();
    importing.reset();
    if (!file) return;
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error("配置包不能超过 30 MB");
      const parsed = JSON.parse(await file.text());
      setBundle(parsed);
      setBundleName(file.name);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "配置包无法读取");
    }
  }
  return (
    <div className="settings-grid">
      <section className="section-band">
        <div className="section-title">
          <h3>界面</h3>
        </div>
        <label>
          主题
          <select
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value);
              localStorage.setItem("qft-theme", e.target.value);
              document.documentElement.dataset.theme = e.target.value;
            }}
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
      </section>
      <section className="section-band">
        <div className="section-title">
          <h3>平台</h3>
        </div>
        <p className="muted">
          模型服务在“模型”页面独立管理。系统设置只保存控制台与平台级偏好。
        </p>
      </section>
      {isAdmin && (
        <section className="section-band configuration-band">
          <div className="section-title">
            <div>
              <h3>配置迁移</h3>
              <p className="muted">
                导出不包含密钥；导入前会自动下载当前配置备份。
              </p>
            </div>
            <button
              className="secondary"
              disabled={exporting.isPending}
              onClick={() => exporting.mutate()}
            >
              <Download size={16} />
              {exporting.isPending ? "正在导出" : "导出配置"}
            </button>
          </div>
          <div className="configuration-import">
            <label className="secondary file-button">
              <Upload size={16} />
              选择配置包
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => void selectBundle(event.target.files?.[0])}
              />
            </label>
            <span className="configuration-filename">
              {bundleName || "尚未选择文件"}
            </span>
            <button
              className="secondary"
              disabled={!bundle || preview.isPending}
              onClick={() => preview.mutate()}
            >
              <ShieldCheck size={16} />
              {preview.isPending ? "正在预检" : "预检"}
            </button>
          </div>
          {fileError && <div className="error form-error">{fileError}</div>}
          {exporting.error && (
            <div className="error form-error">{String(exporting.error)}</div>
          )}
          {preview.error && (
            <div className="error form-error">{String(preview.error)}</div>
          )}
          {preview.data && (
            <div className="configuration-preview">
              <div className="configuration-summary">
                <span
                  className={`status-pill ${preview.data.valid ? "healthy" : "error"}`}
                >
                  {preview.data.valid ? "校验通过" : "校验失败"}
                </span>
                <strong>{preview.data.tenantId}</strong>
                <span>
                  {Object.values(
                    preview.data.counts as Record<string, number>,
                  ).reduce((sum, count) => sum + count, 0)}{" "}
                  个配置对象
                </span>
              </div>
              <div className="configuration-counts">
                {Object.entries(
                  preview.data.counts as Record<string, number>,
                ).map(([name, count]) => (
                  <span key={name}>
                    {name} <strong>{count}</strong>
                  </span>
                ))}
              </div>
              {(preview.data.missingSecrets as string[]).length > 0 && (
                <div className="warning">
                  缺少凭据：{preview.data.missingSecrets.join("、")}
                </div>
              )}
              {(preview.data.warnings as string[]).map((warning) => (
                <div className="muted" key={warning}>
                  {warning}
                </div>
              ))}
              <div className="configuration-confirm">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  我已核对预检结果，并理解跨中心导入不能原子回滚
                </label>
                <button
                  className="primary"
                  disabled={
                    !preview.data.valid || !confirmed || importing.isPending
                  }
                  onClick={() => importing.mutate()}
                >
                  <Upload size={16} />
                  {importing.isPending ? "正在导入" : "导入配置"}
                </button>
              </div>
            </div>
          )}
          {importing.data && (
            <div className="success form-error">
              已导入 {importing.data.imported} 个配置对象
            </div>
          )}
          {importing.error && (
            <div className="error form-error">{String(importing.error)}</div>
          )}
        </section>
      )}
    </div>
  );
}
function AccountsPanel() {
  const client = useQueryClient();
  const users = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const result = await authClient.admin.listUsers({
        query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
      });
      if (result.error) throw new Error(result.error.message ?? "账号读取失败");
      return result.data?.users ?? [];
    },
  });
  const [draft, setDraft] = useState({
    username: "",
    email: "",
    password: "",
    role: "viewer",
  });
  const create = useMutation({
    mutationFn: async () => {
      const result = await authClient.admin.createUser({
        name: draft.username,
        email: draft.email,
        password: draft.password,
        role: draft.role as any,
        data: { username: draft.username, displayUsername: draft.username },
      });
      if (result.error) throw new Error(result.error.message ?? "账号创建失败");
      return result.data;
    },
    onSuccess: () => {
      setDraft({ username: "", email: "", password: "", role: "viewer" });
      void client.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const result = await authClient.admin.setRole({
        userId,
        role: role as any,
      });
      if (result.error) throw new Error(result.error.message ?? "角色更新失败");
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ["accounts"] }),
  });
  const toggleBan = useMutation({
    mutationFn: async (user: any) => {
      const result = user.banned
        ? await authClient.admin.unbanUser({ userId: user.id })
        : await authClient.admin.banUser({
            userId: user.id,
            banReason: "Disabled from Platform Console",
          });
      if (result.error)
        throw new Error(result.error.message ?? "账号状态更新失败");
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ["accounts"] }),
  });
  return (
    <div className="stack">
      <section className="section-band">
        <div className="section-title">
          <h3>登录账号</h3>
          <span>{users.data?.length ?? 0} 个</span>
        </div>
        {users.error ? (
          <div className="error">{String(users.error)}</div>
        ) : (
          <div className="account-list">
            {(users.data ?? []).map((user: any) => (
              <div className="account-row" key={user.id}>
                <div>
                  <strong>
                    {user.displayUsername ?? user.username ?? user.name}
                  </strong>
                  <span>{user.email}</span>
                </div>
                <select
                  aria-label={`${user.name} 角色`}
                  value={user.role ?? "viewer"}
                  onChange={(event) =>
                    updateRole.mutate({
                      userId: user.id,
                      role: event.target.value,
                    })
                  }
                >
                  <option value="viewer">只读</option>
                  <option value="operator">运维</option>
                  <option value="admin">管理员</option>
                </select>
                <button
                  className="secondary"
                  onClick={() => toggleBan.mutate(user)}
                >
                  <ShieldCheck size={16} />
                  {user.banned ? "启用" : "禁用"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="section-band">
        <div className="section-title">
          <h3>新建账号</h3>
        </div>
        <div className="account-form">
          <input
            aria-label="新账号用户名"
            placeholder="用户名"
            value={draft.username}
            onChange={(e) => setDraft({ ...draft, username: e.target.value })}
          />
          <input
            aria-label="新账号邮箱"
            placeholder="邮箱"
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          <input
            aria-label="新账号密码"
            placeholder="至少 12 位密码"
            type="password"
            value={draft.password}
            onChange={(e) => setDraft({ ...draft, password: e.target.value })}
          />
          <select
            aria-label="新账号角色"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          >
            <option value="viewer">只读</option>
            <option value="operator">运维</option>
            <option value="admin">管理员</option>
          </select>
          <FormActions>
            <button
              className="primary"
              disabled={
                create.isPending ||
                !draft.username ||
                !draft.email ||
                draft.password.length < 12
              }
              onClick={() => create.mutate()}
            >
              <UserPlus size={16} />
              创建账号
            </button>
          </FormActions>
        </div>
        {create.error && (
          <div className="error form-error">{String(create.error)}</div>
        )}
      </section>
    </div>
  );
}
function BotsPanel() {
  const client = useQueryClient();
  const bots = useQuery({
    queryKey: ["bots"],
    queryFn: () => center<any[]>("runtime", "/v1/bots"),
  });
  const policies = useQuery({
    queryKey: ["model-policies"],
    queryFn: () => center<any[]>("mh", "/v1/routing-policies"),
  });
  const profiles = useQuery({
    queryKey: ["runtime-profiles"],
    queryFn: () =>
      center<any[]>("runtime", "/v1/runtime-profiles?tenantId=default"),
  });
  const channels = useQuery({
    queryKey: ["channels"],
    queryFn: () => center<any[]>("mg", "/v1/channels"),
  });
  const [chatBot, setChatBot] = useState<any>();
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [backfillResult, setBackfillResult] = useState<any>();
  const empty = {
    id: "",
    tenantId: "default",
    name: "",
    enabled: true,
    runtime: "model-tool-loop",
    runtimeProfileId: "",
    modelPolicyId: "",
    systemPrompt: "",
    description: "",
    purpose: "general",
    effectMode: "standard",
    capabilityPolicy: "resolved",
    maxConcurrentExecutions: 1,
    autonomousReplyBeta: false,
    historyBackfillBeta: false,
    maxBackfillMessages: 100,
  };
  const [draft, setDraft] = useState(empty);
  const [editingBotId, setEditingBotId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      const saved = await center(
        "runtime",
        editingBotId
          ? `/v1/bots/${encodeURIComponent(editingBotId)}`
          : "/v1/bots",
        {
          method: editingBotId ? "PUT" : "POST",
          body: JSON.stringify({
            ...draft,
            modelPolicyId: draft.modelPolicyId || undefined,
            runtimeProfileId: draft.runtimeProfileId || undefined,
            systemPrompt: draft.systemPrompt || undefined,
          }),
        },
      );
      const routes = await center<any[]>(
        "mg",
        `/v1/routes?botId=${encodeURIComponent(draft.id)}`,
      );
      await Promise.all(
        routes.map((route) =>
          center("mg", "/v1/routes", {
            method: "POST",
            body: JSON.stringify({
              ...route,
              autonomousReply: draft.autonomousReplyBeta,
            }),
          }),
        ),
      );
      return saved;
    },
    onSuccess: () => {
      setDraft(empty);
      setEditingBotId("");
      setEditorOpen(false);
      void client.invalidateQueries({ queryKey: ["bots"] });
    },
  });
  const removeBot = useMutation({
    mutationFn: async (bot: any) => {
      const linked = (channels.data ?? []).filter(
        (channel) => channel.botId === bot.id,
      );
      if (linked.length)
        throw new Error(
          `机器人仍绑定 ${linked.length} 个通道，请先删除或迁移这些通道。`,
        );
      return center("runtime", `/v1/bots/${encodeURIComponent(bot.id)}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_result, bot) => {
      if (draft.id === bot.id) {
        setDraft(empty);
        setEditingBotId("");
      }
      void client.invalidateQueries({ queryKey: ["bots"] });
    },
  });
  const chat = useMutation({
    mutationFn: async (prompt: string) => {
      const execution = await center<any>("runtime", "/v1/executions", {
        method: "POST",
        body: JSON.stringify({
          tenantId: chatBot.tenantId,
          botId: chatBot.id,
          prompt,
          conversationId: `console:${chatBot.id}`,
          source: {
            type: "console",
            conversationType: "dm",
            senderId: "console-user",
          },
        }),
      });
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const current = await center<any>(
          "runtime",
          `/v1/executions/${execution.id}`,
        );
        if (current.status === "succeeded") return current.response ?? "已完成";
        if (
          ["failed", "cancelled", "waiting_approval"].includes(current.status)
        )
          throw new Error(
            current.status === "waiting_approval"
              ? `执行等待审批：${current.approvalId ?? "请到治理页面处理"}`
              : (current.error ?? `执行${current.status}`),
          );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("等待执行结果超时");
    },
    onMutate: (prompt) => {
      setChatMessages((items) => [...items, { role: "user", content: prompt }]);
      setChatInput("");
    },
    onSuccess: (response) =>
      setChatMessages((items) => [
        ...items,
        { role: "assistant", content: response },
      ]),
  });
  const backfill = useMutation({
    mutationFn: async (bot: any) => {
      const job = await center<any>("scheduler", "/v1/history-backfills", {
        method: "POST",
        body: JSON.stringify({
          tenantId: bot.tenantId,
          botId: bot.id,
          lookbackSeconds: 90 * 86400,
          maxMessages: bot.maxBackfillMessages,
        }),
      });
      setBackfillResult(job);
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const current = await center<any>(
          "scheduler",
          `/v1/history-backfills/${job.id}?tenantId=${encodeURIComponent(bot.tenantId)}`,
        );
        setBackfillResult(current);
        if (["succeeded", "partial", "cancelled"].includes(current.status))
          return current;
        if (current.status === "failed")
          throw new Error(current.error ?? "历史补处理失败");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("等待历史补处理结果超时");
    },
    onSuccess: setBackfillResult,
  });
  const cancelBackfill = useMutation({
    mutationFn: () =>
      center<any>(
        "scheduler",
        `/v1/history-backfills/${backfillResult.id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ tenantId: backfillResult.tenantId }),
        },
      ),
    onSuccess: setBackfillResult,
  });
  return (
    <div className="stack">
      {!editorOpen && (
        <>
          <section className="section-band">
            <div className="section-title">
              <h3>机器人运行配置</h3>
              <div className="section-actions">
                <span>{bots.data?.length ?? 0} 个</span>
                <button
                  className="primary compact-button"
                  onClick={() => {
                    setDraft(empty);
                    setEditingBotId("");
                    setEditorOpen(true);
                  }}
                >
                  <Plus size={16} />
                  新增机器人
                </button>
              </div>
            </div>
            <div className="bot-list">
              {(bots.data ?? []).map((bot) => (
                <div className="bot-row" key={bot.id}>
                  <div>
                    <strong>{bot.name}</strong>
                    <span>
                      {bot.id} · {bot.runtime} ·{" "}
                      {bot.enabled ? "运行中" : "已停用"}
                    </span>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      setChatBot(bot);
                      setChatMessages([]);
                    }}
                  >
                    <MessageSquare size={16} />
                    对话
                  </button>
                  <ActionMenu>
                    <button
                      onClick={() =>
                        bot.historyBackfillBeta
                          ? backfill.mutate(bot)
                          : window.alert(
                              "请先在机器人编辑页启用历史补处理 Beta。",
                            )
                      }
                    >
                      <History size={16} />
                      补处理历史消息
                    </button>
                    <button
                      onClick={() => {
                        setDraft({ ...empty, ...bot });
                        setEditingBotId(bot.id);
                        setEditorOpen(true);
                      }}
                    >
                      <Settings size={16} />
                      编辑机器人
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => {
                        if (bot.purpose === "system-assistant") {
                          window.alert("系统助手是平台内置机器人，不能删除。");
                          return;
                        }
                        if (window.confirm(`确认删除机器人“${bot.name}”？`))
                          removeBot.mutate(bot);
                      }}
                    >
                      <Trash2 size={16} />
                      删除机器人
                    </button>
                  </ActionMenu>
                </div>
              ))}
              {!bots.isLoading && !(bots.data ?? []).length && (
                <div className="empty">暂无机器人</div>
              )}
            </div>
            {backfillResult && (
              <div className="operation-result">
                {backfillResult.status === "queued"
                  ? "等待调度"
                  : backfillResult.status === "running"
                    ? "处理中"
                    : backfillResult.status === "succeeded"
                      ? "处理完成"
                      : backfillResult.status === "partial"
                        ? "部分完成"
                        : backfillResult.status === "cancelled"
                          ? "已取消"
                          : "处理失败"}
                ：已处理 {backfillResult.completedConversations ?? 0}/
                {backfillResult.discoveredConversations ?? 0} 个会话，发现{" "}
                {backfillResult.fetched ?? 0} 条，新处理{" "}
                {backfillResult.accepted ?? 0} 条，跳过重复{" "}
                {backfillResult.duplicates ?? 0} 条
                {backfillResult.attachmentFailures
                  ? `，附件缓存失败 ${backfillResult.attachmentFailures} 个`
                  : ""}
                {backfillResult.errors?.length
                  ? `，${backfillResult.errors.length} 个会话失败`
                  : ""}
                {["queued", "running"].includes(backfillResult.status) && (
                  <button
                    className="secondary compact-button"
                    disabled={cancelBackfill.isPending}
                    onClick={() => cancelBackfill.mutate()}
                  >
                    <Pause size={14} />
                    取消
                  </button>
                )}
              </div>
            )}
            {backfill.error && (
              <div className="error form-error">{String(backfill.error)}</div>
            )}
          </section>
          {chatBot && (
            <div
              className="modal-backdrop"
              onMouseDown={() => setChatBot(undefined)}
            >
              <section
                className="chat-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={`${chatBot.name} 对话`}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="section-title">
                  <div>
                    <h3>{chatBot.name}</h3>
                    <span>直接对话</span>
                  </div>
                  <button
                    className="icon-button"
                    title="关闭"
                    onClick={() => setChatBot(undefined)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="chat-transcript">
                  {chatMessages.map((message, index) => (
                    <div className={`chat-message ${message.role}`} key={index}>
                      <strong>
                        {message.role === "user" ? "你" : chatBot.name}
                      </strong>
                      <p>{message.content}</p>
                    </div>
                  ))}
                  {!chatMessages.length && (
                    <div className="empty">开始一段新对话</div>
                  )}
                  {chat.isPending && <div className="muted">正在运行</div>}
                  {chat.error && (
                    <div className="error">{String(chat.error)}</div>
                  )}
                </div>
                <div className="chat-compose">
                  <textarea
                    rows={3}
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        chatInput.trim()
                      ) {
                        event.preventDefault();
                        chat.mutate(chatInput.trim());
                      }
                    }}
                  />
                  <button
                    className="primary"
                    disabled={!chatInput.trim() || chat.isPending}
                    onClick={() => chat.mutate(chatInput.trim())}
                  >
                    <Play size={16} />
                    发送
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )}
      {editorOpen && (
        <section className="section-band">
          <div className="section-title">
            <h3>{editingBotId ? "编辑机器人" : "新增机器人"}</h3>
            <button
              className="secondary compact-button"
              onClick={() => {
                setDraft(empty);
                setEditingBotId("");
                setEditorOpen(false);
              }}
            >
              返回列表
            </button>
          </div>
          <div className="bot-form">
            <label>
              Bot ID
              <input
                value={draft.id}
                disabled={Boolean(editingBotId)}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              />
            </label>
            <label>
              名称
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Runtime Profile
              <select
                value={draft.runtimeProfileId}
                onChange={(e) =>
                  setDraft({ ...draft, runtimeProfileId: e.target.value })
                }
              >
                <option value="">兼容模式（使用旧 Runtime 字段）</option>
                {(profiles.data ?? [])
                  .filter((profile) => profile.enabled)
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} · r{profile.revision}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              模型策略
              <select
                value={draft.modelPolicyId}
                onChange={(e) =>
                  setDraft({ ...draft, modelPolicyId: e.target.value })
                }
              >
                <option value="">未指定</option>
                {(policies.data ?? []).map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide-field">
              系统提示词
              <textarea
                rows={4}
                value={draft.systemPrompt}
                onChange={(e) =>
                  setDraft({ ...draft, systemPrompt: e.target.value })
                }
              />
            </label>
            <details className="advanced-config wide-field">
              <summary>
                <Settings size={16} />
                高级配置 <small>兼容运行时与安全边界</small>
              </summary>
              <p className="advanced-description">运行方案未配置时才使用兼容 Runtime；只读模式会阻止有副作用的能力。普通机器人通常保持默认的标准模式和已授权能力。</p>
              <div className="advanced-grid">
                <label>
                  兼容 Runtime
                  <select
                    value={draft.runtime}
                    disabled={Boolean(draft.runtimeProfileId)}
                    onChange={(event) =>
                      setDraft({ ...draft, runtime: event.target.value })
                    }
                  >
                    <option value="model-tool-loop">Model Tool Loop</option>
                    <option value="openai-agents">OpenAI Agents SDK</option>
                    <option value="claude-code">Claude Code SDK</option>
                  </select>
                </label>
                <label className="wide-field">
                  描述
                  <textarea
                    rows={3}
                    value={draft.description}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                  />
                </label>
                <label>
                  用途
                  <select
                    value={draft.purpose}
                    onChange={(event) =>
                      setDraft({ ...draft, purpose: event.target.value })
                    }
                  >
                    <option value="general">普通机器人</option>
                    <option value="system-assistant">系统助手</option>
                  </select>
                </label>
                <label>
                  副作用模式
                  <select
                    value={draft.effectMode}
                    onChange={(event) =>
                      setDraft({ ...draft, effectMode: event.target.value })
                    }
                  >
                    <option value="standard">标准</option>
                    <option value="read-only">只读</option>
                  </select>
                </label>
                <label>
                  能力策略
                  <select
                    value={draft.capabilityPolicy}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        capabilityPolicy: event.target.value,
                      })
                    }
                  >
                    <option value="resolved">加载已授权能力</option>
                    <option value="none">禁用全部能力</option>
                  </select>
                </label>
              </div>
            </details>
            <label>
              最大并发
              <input
                type="number"
                min={1}
                max={20}
                value={draft.maxConcurrentExecutions}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    maxConcurrentExecutions: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              最大回溯消息
              <input
                type="number"
                min={0}
                max={1000}
                value={draft.maxBackfillMessages}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    maxBackfillMessages: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />
              启用
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.autonomousReplyBeta}
                onChange={(e) =>
                  setDraft({ ...draft, autonomousReplyBeta: e.target.checked })
                }
              />
              上下文自主回复 Beta
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.historyBackfillBeta}
                onChange={(e) =>
                  setDraft({ ...draft, historyBackfillBeta: e.target.checked })
                }
              />
              历史补处理 Beta
            </label>
            <FormActions>
              <button
                className="primary"
                disabled={!draft.id || !draft.name || save.isPending}
                onClick={() => save.mutate()}
              >
                <Bot size={16} />
                {editingBotId ? "保存修改" : "保存机器人"}
              </button>
            </FormActions>
          </div>
          {save.error && (
            <div className="error form-error">{String(save.error)}</div>
          )}
          {removeBot.error && (
            <div className="error form-error">{String(removeBot.error)}</div>
          )}
        </section>
      )}
    </div>
  );
}
const capabilityDraftKey = "qft.capability-builder.draft.v1";
const capabilityDraftTemplate = (kind: "workflow" | "browser") => {
  const suffix = randomUuid(),
    id = `${kind}.custom.${suffix}`;
  return JSON.stringify(
    {
      package: { name: id, version: "1.0.0" },
      manifests: [
        kind === "workflow"
          ? {
              id,
              name: "Custom workflow",
              description: "Console-managed deterministic workflow",
              kind: "workflow",
              version: "1.0.0",
              inputSchema: { type: "object" },
              outputSchema: { type: "string" },
              runtime: { type: "workflow", requirements: [] },
              permissions: [],
              risk: "low",
              enabled: true,
              tags: ["workflow", "console-managed"],
              raw: {
                workflow: {
                  version: 1,
                  steps: [
                    {
                      id: "reply",
                      type: "template",
                      template: "Completed: {{input}}",
                    },
                  ],
                  output: "{{steps.reply}}",
                },
              },
            }
          : {
              id,
              name: "Browser workflow kit",
              description: "Governed Playwright workflow capability",
              kind: "browser",
              version: "1.0.0",
              inputSchema: {
                type: "object",
                properties: {
                  sessionKey: { type: "string" },
                  allowedDomains: {
                    type: "array",
                    items: { type: "string" },
                  },
                  actions: { type: "array", items: { type: "object" } },
                },
                required: ["sessionKey", "allowedDomains", "actions"],
                additionalProperties: false,
              },
              outputSchema: { type: "object" },
              runtime: {
                type: "center",
                providerRef: "browser.workflow",
                requirements: ["playwright"],
              },
              permissions: ["browser.network", "resource.write"],
              risk: "high",
              enabled: true,
              tags: ["browser", "playwright", "console-managed"],
            },
      ],
    },
    null,
    2,
  );
};
const capabilityDraftPayload = async (text: string) => {
  const parsed = JSON.parse(text),
    bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    ),
    contentHash = [...new Uint8Array(bytes)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  if (!parsed.package?.name || !parsed.package?.version)
    throw new Error("Draft package requires name and version");
  return {
    pkg: {
      name: parsed.package.name,
      version: parsed.package.version,
      source: {
        type: "directory",
        ref: `console-builder://${parsed.package.name}`,
      },
      contentHash,
      metadata: { managedBy: "capability-builder", schemaVersion: 1 },
    },
    manifests: parsed.manifests,
  };
};

function CapabilitiesPanel({
  items,
  view: capabilityView,
  onViewChange,
}: {
  items: any[];
  view: "list" | "bindings" | "import" | "create";
  onViewChange: (view: "list" | "bindings" | "import" | "create") => void;
}) {
  const client = useQueryClient();
  const packages = useQuery({
    queryKey: ["capability-packages"],
    queryFn: () => center<any[]>("cr", "/v1/packages"),
  });
  const bindings = useQuery({
    queryKey: ["capability-bindings"],
    queryFn: () => center<any[]>("cr", "/v1/bindings"),
  });
  const conflicts = useQuery({
    queryKey: ["capability-conflicts"],
    queryFn: () => center<any[]>("cr", "/v1/conflicts"),
  });
  const bots = useQuery({
    queryKey: ["bots"],
    queryFn: () => center<any[]>("runtime", "/v1/bots"),
  });
  const [archive, setArchive] = useState<File>();
  const [gitSkill, setGitSkill] = useState({
    repository: "",
    ref: "main",
    path: "",
  });
  const [appArchive, setAppArchive] = useState<File>();
  const [binding, setBinding] = useState({
    id: "",
    capabilityId: "",
    botId: "",
    enabled: true,
    configJson: "{}",
    credentialRefs: "",
    allowedTriggers: "",
  });
  const [bindingEditorOpen, setBindingEditorOpen] = useState(false);
  const [commandDraft, setCommandDraft] = useState({
    name: "",
    command: "",
    aliases: "",
    template: "",
    botId: "",
  });
  const [builderText, setBuilderText] = useState(
    () =>
      localStorage.getItem(capabilityDraftKey) ??
      capabilityDraftTemplate("workflow"),
  );
  const [builderConfirmed, setBuilderConfirmed] = useState(false);
  const [editing, setEditing] = useState<{
    conflict: any;
    path: string;
    content: string;
  }>();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["capabilities"] });
    void client.invalidateQueries({ queryKey: ["capability-packages"] });
    void client.invalidateQueries({ queryKey: ["capability-bindings"] });
    void client.invalidateQueries({ queryKey: ["capability-conflicts"] });
  };
  useEffect(() => {
    localStorage.setItem(capabilityDraftKey, builderText);
  }, [builderText]);
  const previewDraft = useMutation({
    mutationFn: async () =>
      center<any>("cr", "/v1/import/preview", {
        method: "POST",
        body: JSON.stringify(await capabilityDraftPayload(builderText)),
      }),
  });
  const publishDraft = useMutation({
    mutationFn: async () => {
      const payload = await capabilityDraftPayload(builderText);
      return center<any>("cr", "/v1/import", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          strategy: previewDraft.data?.package?.existingVersion
            ? "new"
            : undefined,
        }),
      });
    },
    onSuccess: () => {
      setBuilderConfirmed(false);
      void previewDraft.mutateAsync();
      refresh();
    },
  });
  const importSkill = useMutation({
    mutationFn: async () => {
      if (!archive) throw new Error("请选择 ZIP 文件");
      return center("cr", "/v1/skills/import-json", {
        method: "POST",
        body: JSON.stringify({
          name: archive.name,
          data: arrayBufferToBase64(await archive.arrayBuffer()),
        }),
      });
    },
    onSuccess: refresh,
  });
  const importGitSkill = useMutation({
    mutationFn: () =>
      center("cr", "/v1/skills/import-git", {
        method: "POST",
        body: JSON.stringify(gitSkill),
      }),
    onSuccess: refresh,
  });
  const importApp = useMutation({
    mutationFn: async () => {
      if (!appArchive) throw new Error("请选择 ZIP 文件");
      return center("cr", "/v1/apps/import-json", {
        method: "POST",
        body: JSON.stringify({
          name: appArchive.name,
          data: arrayBufferToBase64(await appArchive.arrayBuffer()),
        }),
      });
    },
    onSuccess: refresh,
  });
  const resolveConflict = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      center("cr", `/v1/conflicts/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution }),
      }),
    onSuccess: () => {
      setEditing(undefined);
      refresh();
    },
  });
  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await center(
        "cr",
        `/v1/conflicts/${editing.conflict.id}/files/${editing.path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`,
        {
          method: "PUT",
          body: JSON.stringify({ content: editing.content }),
        },
      );
      return resolveConflict.mutateAsync({
        id: editing.conflict.id,
        resolution: "edited",
      });
    },
  });
  const bind = useMutation({
    mutationFn: () => {
      const kind = items.find((item) => item.id === binding.capabilityId)?.kind;
      return center(
        "cr",
        binding.id ? `/v1/bindings/${binding.id}` : "/v1/bindings",
        {
          method: binding.id ? "PUT" : "POST",
          body: JSON.stringify({
            capabilityId: binding.capabilityId,
            botId: binding.botId,
            enabled: binding.enabled,
            config: parseObjectJson(binding.configJson, "能力绑定配置"),
            credentialRefs: binding.credentialRefs
              .split(/[,，\s]+/)
              .filter(Boolean),
            allowedTriggers: binding.allowedTriggers
              ? binding.allowedTriggers.split(/[,，\s]+/).filter(Boolean)
              : kind === "command"
                ? ["command", "manual", "scheduled"]
                : ["agent", "manual", "scheduled", "workflow"],
          }),
        },
      );
    },
    onSuccess: () => {
      setBinding({
        id: "",
        capabilityId: "",
        botId: "",
        enabled: true,
        configJson: "{}",
        credentialRefs: "",
        allowedTriggers: "",
      });
      setBindingEditorOpen(false);
      refresh();
    },
  });
  const removeBinding = useMutation({
    mutationFn: (id: string) =>
      center("cr", `/v1/bindings/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const removePackage = useMutation({
    mutationFn: (id: string) =>
      center("cr", `/v1/packages/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const createCommand = useMutation({
    mutationFn: async () => {
      const id = `command.custom.${randomUuid()}`;
      const command = commandDraft.command.trim().toLowerCase();
      const aliases = commandDraft.aliases
        .split(/[,，\s]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      await center("cr", "/v1/import", {
        method: "POST",
        body: JSON.stringify({
          pkg: {
            name: id,
            version: "1.0.0",
            source: { type: "directory", ref: `console://${id}` },
            contentHash: randomUuid(),
            metadata: { managedBy: "console" },
          },
          manifests: [
            {
              id,
              name: commandDraft.name.trim(),
              description: `确定性命令 ${command}`,
              kind: "command",
              version: "1.0.0",
              inputSchema: { type: "object" },
              outputSchema: { type: "string" },
              runtime: { type: "prompt", requirements: [] },
              permissions: [],
              risk: "low",
              enabled: true,
              tags: ["command", "console-managed"],
              raw: {
                command: {
                  command,
                  aliases,
                  priority: 100,
                  action: {
                    type: "template",
                    template: commandDraft.template,
                  },
                },
              },
            },
          ],
        }),
      });
      return center("cr", "/v1/bindings", {
        method: "POST",
        body: JSON.stringify({
          capabilityId: id,
          botId: commandDraft.botId,
          enabled: true,
          config: {},
          credentialRefs: [],
          allowedTriggers: ["command", "manual", "scheduled"],
        }),
      });
    },
    onSuccess: () => {
      setCommandDraft({
        name: "",
        command: "",
        aliases: "",
        template: "",
        botId: "",
      });
      refresh();
    },
  });
  const setCapabilityEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      center("cr", `/v1/capabilities/${encodeURIComponent(id)}/enabled`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: refresh,
  });
  const reviewedSkills = items.filter(
    (item) => item.kind === "skill" && item.raw?.review,
  );
  return (
    <div className={`stack capability-workspace view-${capabilityView}`}>
      <div className="subview-tabs" role="tablist" aria-label="能力管理视图">
        <button
          className={capabilityView === "list" ? "active" : ""}
          role="tab"
          aria-selected={capabilityView === "list"}
          onClick={() => onViewChange("list")}
        >
          能力目录
        </button>
        <button
          className={capabilityView === "bindings" ? "active" : ""}
          role="tab"
          aria-selected={capabilityView === "bindings"}
          onClick={() => onViewChange("bindings")}
        >
          机器人授权
        </button>
        <button
          className={capabilityView === "import" ? "active" : ""}
          role="tab"
          aria-selected={capabilityView === "import"}
          onClick={() => onViewChange("import")}
        >
          导入与更新
        </button>
        <button
          className={capabilityView === "create" ? "active" : ""}
          role="tab"
          aria-selected={capabilityView === "create"}
          onClick={() => onViewChange("create")}
        >
          创建能力
        </button>
      </div>
      <section className="section-band capability-import">
        <div className="section-title">
          <h3>导入 Skill</h3>
          <span>ZIP 中必须包含根 SKILL.md</span>
        </div>
        <div className="skill-import-row">
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => setArchive(event.target.files?.[0])}
          />
          <button
            className="primary"
            disabled={!archive || importSkill.isPending}
            onClick={() => importSkill.mutate()}
          >
            <Archive size={16} />
            导入
          </button>
        </div>
        {importSkill.error && (
          <div className="error form-error">{String(importSkill.error)}</div>
        )}
        <div className="subsection-title">
          <strong>从 GitHub 安装</strong>
          <span>ref 会固定为 commit；更新仍需冲突确认</span>
        </div>
        <div className="git-skill-form">
          <input
            aria-label="GitHub 仓库"
            placeholder="owner/repository"
            value={gitSkill.repository}
            onChange={(event) =>
              setGitSkill({ ...gitSkill, repository: event.target.value })
            }
          />
          <input
            aria-label="Git ref"
            placeholder="main"
            value={gitSkill.ref}
            onChange={(event) =>
              setGitSkill({ ...gitSkill, ref: event.target.value })
            }
          />
          <input
            aria-label="Skill 目录"
            placeholder="skills/example"
            value={gitSkill.path}
            onChange={(event) =>
              setGitSkill({ ...gitSkill, path: event.target.value })
            }
          />
          <button
            className="secondary"
            disabled={
              !gitSkill.repository.trim() ||
              !gitSkill.ref.trim() ||
              !gitSkill.path.trim() ||
              importGitSkill.isPending
            }
            onClick={() => importGitSkill.mutate()}
          >
            <GitBranch size={16} />
            安装
          </button>
        </div>
        {importGitSkill.error && (
          <div className="error form-error">{String(importGitSkill.error)}</div>
        )}
      </section>
      <section className="section-band capability-import">
        <div className="section-title">
          <div>
            <h3>导入自定义 App</h3>
            <span>ZIP 中必须包含根 app.json；Node App 由隔离 worker 执行</span>
          </div>
          <span className="status-pill planned">受控执行</span>
        </div>
        <div className="skill-import-row">
          <input
            type="file"
            accept=".zip,application/zip"
            aria-label="自定义 App ZIP"
            onChange={(event) => setAppArchive(event.target.files?.[0])}
          />
          <button
            className="primary"
            disabled={!appArchive || importApp.isPending}
            onClick={() => importApp.mutate()}
          >
            <Archive size={16} />
            导入 App
          </button>
        </div>
        <p className="muted">
          原生 executable、webview、网络型 App
          会保留配置并显示不可执行原因，不会在服务器上直接运行。
        </p>
        {importApp.error && (
          <div className="error form-error">{String(importApp.error)}</div>
        )}
      </section>
      {(conflicts.data ?? []).some(
        (conflict) => conflict.status === "open",
      ) && (
        <section className="section-band capability-conflicts">
          <div className="section-title">
            <h3>导入冲突</h3>
            <span>需要人工决定</span>
          </div>
          <div className="approval-list">
            {(conflicts.data ?? [])
              .filter((conflict) => conflict.status === "open")
              .map((conflict) => (
                <div className="approval-row" key={conflict.id}>
                  <div>
                    <strong>{conflict.logicalId}</strong>
                    <span>
                      {conflict.incoming.version} ·{" "}
                      {conflict.incoming.contentHash}
                    </span>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      resolveConflict.mutate({
                        id: conflict.id,
                        resolution: "new",
                      })
                    }
                  >
                    以新的为准
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      resolveConflict.mutate({
                        id: conflict.id,
                        resolution: "old",
                      })
                    }
                  >
                    以旧的为准
                  </button>
                  {conflict.editableFiles?.includes("SKILL.md") && (
                    <button
                      className="secondary"
                      onClick={() => {
                        const files =
                          conflict.incomingManifests?.[0]?.raw?.skill?.files ??
                          [];
                        const file = files.find(
                          (item: any) => item.path === "SKILL.md",
                        );
                        setEditing({
                          conflict,
                          path: "SKILL.md",
                          content: file?.content ?? "",
                        });
                      }}
                    >
                      <Wrench size={16} />
                      自己编辑
                    </button>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}
      {!!reviewedSkills.length && (
        <section className="section-band capability-review">
          <div className="section-title">
            <h3>Skill 审查</h3>
            <span>导入与启用相互独立</span>
          </div>
          <div className="approval-list">
            {reviewedSkills.map((item) => {
              const review = item.raw.review;
              const blocking = review.blocking ?? [];
              return (
                <div className="approval-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.enabled
                        ? "已启用"
                        : blocking.length
                          ? "审查未通过"
                          : "等待管理员启用"}
                      {review.warnings?.length
                        ? ` · ${review.warnings.join("；")}`
                        : ""}
                      {blocking.length ? ` · ${blocking.join("；")}` : ""}
                    </span>
                  </div>
                  <button
                    className="secondary"
                    disabled={
                      blocking.length > 0 || setCapabilityEnabled.isPending
                    }
                    onClick={() =>
                      setCapabilityEnabled.mutate({
                        id: item.id,
                        enabled: !item.enabled,
                      })
                    }
                  >
                    {item.enabled ? <Pause size={16} /> : <Check size={16} />}
                    {item.enabled ? "停用" : "审核并启用"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section className="section-band capability-commands">
        <div className="section-title">
          <h3>命令</h3>
          <span>确定性匹配，不经过模型</span>
        </div>
        <div className="command-form">
          <label>
            名称
            <input
              value={commandDraft.name}
              placeholder="门店快照"
              onChange={(event) =>
                setCommandDraft({ ...commandDraft, name: event.target.value })
              }
            />
          </label>
          <label>
            命令
            <input
              value={commandDraft.command}
              placeholder="/snapshot"
              onChange={(event) =>
                setCommandDraft({
                  ...commandDraft,
                  command: event.target.value,
                })
              }
            />
          </label>
          <label>
            别名
            <input
              value={commandDraft.aliases}
              placeholder="/snap, /save"
              onChange={(event) =>
                setCommandDraft({
                  ...commandDraft,
                  aliases: event.target.value,
                })
              }
            />
          </label>
          <label>
            机器人
            <select
              value={commandDraft.botId}
              onChange={(event) =>
                setCommandDraft({
                  ...commandDraft,
                  botId: event.target.value,
                })
              }
            >
              <option value="">选择机器人</option>
              {(bots.data ?? []).map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            回复模板
            <textarea
              value={commandDraft.template}
              placeholder="已收到：{args}"
              onChange={(event) =>
                setCommandDraft({
                  ...commandDraft,
                  template: event.target.value,
                })
              }
            />
          </label>
          <FormActions>
            <button
              className="primary"
              disabled={
                !commandDraft.name.trim() ||
                !commandDraft.command.trim().startsWith("/") ||
                !commandDraft.template.trim() ||
                !commandDraft.botId ||
                createCommand.isPending
              }
              onClick={() => createCommand.mutate()}
            >
              <Route size={16} />
              创建并绑定
            </button>
          </FormActions>
        </div>
        {createCommand.error && (
          <div className="error form-error">{String(createCommand.error)}</div>
        )}
        <DataTable items={items.filter((item) => item.kind === "command")} />
      </section>
      <section className="section-band capability-builder">
        <div className="section-title">
          <h3>Capability Builder</h3>
          <span>草稿 / 预检 / 确认 / 发布</span>
        </div>
        <div className="builder-toolbar">
          <button
            className="secondary"
            onClick={() => {
              setBuilderText(capabilityDraftTemplate("workflow"));
              setBuilderConfirmed(false);
              previewDraft.reset();
            }}
          >
            工作流模板
          </button>
          <button
            className="secondary"
            onClick={() => {
              setBuilderText(capabilityDraftTemplate("browser"));
              setBuilderConfirmed(false);
              previewDraft.reset();
            }}
          >
            <Search size={16} />
            浏览器模板
          </button>
        </div>
        <textarea
          className="manifest-editor"
          aria-label="Capability 草稿"
          spellCheck={false}
          value={builderText}
          onChange={(event) => {
            setBuilderText(event.target.value);
            setBuilderConfirmed(false);
            previewDraft.reset();
          }}
        />
        <div className="builder-actions">
          <button
            className="secondary"
            disabled={previewDraft.isPending}
            onClick={() => previewDraft.mutate()}
          >
            <Check size={16} />
            预检
          </button>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={builderConfirmed}
              onChange={(event) => setBuilderConfirmed(event.target.checked)}
            />
            确认按预检结果发布
          </label>
          <button
            className="primary"
            disabled={
              !previewDraft.data?.valid ||
              !builderConfirmed ||
              publishDraft.isPending
            }
            onClick={() => publishDraft.mutate()}
          >
            <Archive size={16} />
            发布能力包
          </button>
        </div>
        {previewDraft.data && (
          <div
            className={
              previewDraft.data.valid ? "operation-result" : "error form-error"
            }
          >
            {previewDraft.data.valid ? "预检通过" : "预检未通过"} · 新增{" "}
            {previewDraft.data.diff.added.length} · 更新{" "}
            {previewDraft.data.diff.updated.length} · 移除{" "}
            {previewDraft.data.diff.removed.length}
            {previewDraft.data.errors.map((error: any) => (
              <div key={`${error.code}:${error.capabilityId ?? "package"}`}>
                {error.code}: {error.message}
              </div>
            ))}
            {previewDraft.data.warnings.map((warning: any) => (
              <div key={`${warning.code}:${warning.capabilityId ?? "package"}`}>
                {warning.code}: {warning.message}
              </div>
            ))}
          </div>
        )}
        {(previewDraft.error || publishDraft.error) && (
          <div className="error form-error">
            {String(previewDraft.error ?? publishDraft.error)}
          </div>
        )}
      </section>
      <section className="section-band capability-inventory">
        <div className="section-title">
          <h3>
            {capabilityView === "bindings" && bindingEditorOpen
              ? binding.id
                ? "编辑能力授权"
                : "新增能力授权"
              : capabilityView === "bindings"
                ? "机器人授权"
                : "能力目录"}
          </h3>
          {capabilityView === "bindings" && bindingEditorOpen ? (
            <button
              className="secondary compact-button"
              onClick={() => {
                setBinding({
                  id: "",
                  capabilityId: "",
                  botId: "",
                  enabled: true,
                  configJson: "{}",
                  credentialRefs: "",
                  allowedTriggers: "",
                });
                setBindingEditorOpen(false);
              }}
            >
              返回列表
            </button>
          ) : capabilityView === "bindings" ? (
            <div className="section-actions">
              <span>{bindings.data?.length ?? 0} 条授权</span>
              <button
                className="primary compact-button"
                onClick={() => {
                  setBinding({
                    id: "",
                    capabilityId: "",
                    botId: "",
                    enabled: true,
                    configJson: "{}",
                    credentialRefs: "",
                    allowedTriggers: "",
                  });
                  setBindingEditorOpen(true);
                }}
              >
                <Plus size={16} />
                新增授权
              </button>
            </div>
          ) : (
            <span>
              {items.length} 个能力 /{" "}
              {packages.data?.filter((item) => item.state !== "removed")
                .length ?? 0}{" "}
              个能力包
            </span>
          )}
        </div>
        {capabilityView === "list" && (
          <>
            <div className="subsection-title">
              <strong>已安装能力包</strong>
              <span>能力包提供一个或多个可授权能力</span>
            </div>
            <div className="approval-list">
              {(packages.data ?? [])
                .filter((item) => item.state !== "removed")
                .map((item) => (
                  <div className="approval-row" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.version} · {item.state}
                      </span>
                    </div>
                    <button
                      className="icon-button danger"
                      title="卸载能力包"
                      disabled={removePackage.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `确认卸载能力包“${item.name}”？相关能力将停止解析。`,
                          )
                        )
                          removePackage.mutate(item.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </div>
            <div className="subsection-title">
              <strong>可用能力</strong>
              <span>具体功能、类型、风险和启用状态</span>
            </div>
            <DataTable items={items} />
          </>
        )}
        {capabilityView === "bindings" && bindingEditorOpen && (
          <div className="binding-form">
            <select
              value={binding.capabilityId}
              onChange={(event) =>
                setBinding({ ...binding, capabilityId: event.target.value })
              }
            >
              <option value="">选择能力</option>
              {items
                .filter((item) => item.enabled)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <select
              value={binding.botId}
              onChange={(event) =>
                setBinding({ ...binding, botId: event.target.value })
              }
            >
              <option value="">选择机器人</option>
              {(bots.data ?? []).map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={binding.enabled}
                onChange={(event) =>
                  setBinding({ ...binding, enabled: event.target.checked })
                }
              />
              启用
            </label>
            <details className="advanced-config wide-field">
              <summary>
                <Settings size={16} />
                高级配置 <small>触发范围、凭据与能力专用参数</small>
              </summary>
              <p className="advanced-description">触发方式限定能力可由哪些入口调用；凭据引用应填写治理中心中已保存的引用 ID，绝不填写密钥本身。JSON 仅用于该能力声明的专用参数。</p>
              <div className="advanced-grid">
                <label>
                  允许的触发方式
                  <input
                    placeholder="agent, manual, scheduled"
                    value={binding.allowedTriggers}
                    onChange={(event) =>
                      setBinding({
                        ...binding,
                        allowedTriggers: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  凭据引用
                  <input
                    placeholder="多个引用用逗号分隔"
                    value={binding.credentialRefs}
                    onChange={(event) =>
                      setBinding({
                        ...binding,
                        credentialRefs: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="wide-field">
                  绑定配置（JSON）
                  <textarea
                    rows={4}
                    spellCheck={false}
                    value={binding.configJson}
                    onChange={(event) =>
                      setBinding({ ...binding, configJson: event.target.value })
                    }
                  />
                </label>
              </div>
            </details>
            <FormActions>
              <button
                className="primary"
                disabled={
                  !binding.capabilityId || !binding.botId || bind.isPending
                }
                onClick={() => bind.mutate()}
              >
                <Route size={16} />
                {binding.id ? "保存绑定" : "授权给机器人"}
              </button>
            </FormActions>
          </div>
        )}
        {capabilityView === "bindings" && !bindingEditorOpen && (
          <div className="approval-list">
            {(bindings.data ?? []).map((item) => (
              <div className="approval-row" key={item.id}>
                <div>
                  <strong>
                    {items.find(
                      (capability) => capability.id === item.capabilityId,
                    )?.name ?? item.capabilityId}
                  </strong>
                  <span>
                    {(bots.data ?? []).find((bot) => bot.id === item.botId)
                      ?.name ?? item.botId}
                    {item.enabled ? " · 已启用" : " · 已停用"}
                  </span>
                </div>
                <button
                  className="icon-button"
                  title="编辑绑定"
                  onClick={() => {
                    setBinding({
                      id: item.id,
                      capabilityId: item.capabilityId,
                      botId: item.botId,
                      enabled: item.enabled,
                      configJson: JSON.stringify(item.config ?? {}, null, 2),
                      credentialRefs: (item.credentialRefs ?? []).join(", "),
                      allowedTriggers: (item.allowedTriggers ?? []).join(", "),
                    });
                    setBindingEditorOpen(true);
                  }}
                >
                  <Wrench size={16} />
                </button>
                <button
                  className="icon-button danger"
                  title="删除绑定"
                  onClick={() => {
                    if (window.confirm("确认删除这条能力绑定？"))
                      removeBinding.mutate(item.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {(bind.error || removeBinding.error || removePackage.error) && (
          <div className="error form-error">
            {String(bind.error ?? removeBinding.error ?? removePackage.error)}
          </div>
        )}
      </section>
      {editing && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setEditing(undefined)}
        >
          <section
            className="run-dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-title">
              <div>
                <h3>{editing.conflict.logicalId}</h3>
                <span>{editing.path}</span>
              </div>
              <button
                className="icon-button"
                title="关闭"
                onClick={() => setEditing(undefined)}
              >
                <X size={17} />
              </button>
            </div>
            <textarea
              className="skill-editor"
              value={editing.content}
              onChange={(event) =>
                setEditing({ ...editing, content: event.target.value })
              }
            />
            <FormActions>
              <button
                className="primary"
                disabled={saveEdit.isPending}
                onClick={() => saveEdit.mutate()}
              >
                <Check size={16} />
                保存并使用编辑版
              </button>
            </FormActions>
          </section>
        </div>
      )}
    </div>
  );
}

function arrayBufferToBase64(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function ExecutionsPanel({
  items,
  refetch,
}: {
  items: any[];
  refetch: () => void;
}) {
  const [selected, setSelected] = useState<any>();
  const events = useQuery({
    queryKey: ["execution-events", selected?.id],
    queryFn: () =>
      center<any[]>("runtime", `/v1/executions/${selected.id}/events`),
    enabled: !!selected,
    refetchInterval: selected?.status === "running" ? 1000 : false,
  });
  const action = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "cancel" | "resume" }) =>
      center("runtime", `/v1/executions/${id}/${verb}`, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: refetch,
  });
  return (
    <>
      <div className="execution-list">
        {items.map((execution) => (
          <div className="execution-row" key={execution.id}>
            <div>
              <strong>{execution.botId}</strong>
              <span>{execution.prompt}</span>
            </div>
            <span className={`status-pill ${execution.status}`}>
              {execution.status}
            </span>
            <span>{execution.createdAt}</span>
            {execution.status === "waiting_approval" ||
            execution.status === "failed" ? (
              <button
                className="secondary"
                onClick={() =>
                  action.mutate({ id: execution.id, verb: "resume" })
                }
              >
                <RotateCcw size={16} />
                恢复
              </button>
            ) : ["queued", "running"].includes(execution.status) ? (
              <button
                className="secondary"
                onClick={() =>
                  action.mutate({ id: execution.id, verb: "cancel" })
                }
              >
                <X size={16} />
                取消
              </button>
            ) : (
              <span />
            )}
            <button
              className="icon-button"
              title="事件日志"
              onClick={() => setSelected(execution)}
            >
              <History size={16} />
            </button>
          </div>
        ))}
        {!items.length && <div className="empty">暂无执行记录</div>}
      </div>
      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setSelected(undefined)}
        >
          <section
            className="run-dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-title">
              <div>
                <h3>{selected.botId}</h3>
                <span>{selected.id}</span>
              </div>
              <button
                className="icon-button"
                title="关闭"
                onClick={() => setSelected(undefined)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="run-list">
              {(events.data ?? []).map((event) => (
                <div className="run-entry" key={event.id}>
                  <div>
                    <strong>{event.type}</strong>
                    <span>
                      #{event.sequence} · {event.createdAt}
                    </span>
                  </div>
                  <pre>{JSON.stringify(event.data, null, 2)}</pre>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function GovernancePanel({ approverId }: { approverId: string }) {
  const client = useQueryClient();
  const approvals = useQuery({
    queryKey: ["approvals"],
    queryFn: () => center<any[]>("governance", "/v1/approvals"),
  });
  const audits = useQuery({
    queryKey: ["audits"],
    queryFn: () => center<any[]>("governance", "/v1/audit?tenantId=default"),
  });
  const resolve = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "approved" | "denied";
    }) =>
      center("governance", `/v1/approvals/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ approverId, status }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["approvals"] });
      void client.invalidateQueries({ queryKey: ["audits"] });
    },
  });
  return (
    <div className="stack">
      <section className="section-band">
        <div className="section-title">
          <h3>审批队列</h3>
          <span>{approvals.data?.length ?? 0} 个</span>
        </div>
        <div className="approval-list">
          {(approvals.data ?? []).map((approval) => (
            <div className="approval-row" key={approval.id}>
              <div>
                <strong>{approval.action}</strong>
                <span>{JSON.stringify(approval.resource)}</span>
              </div>
              <span className={`status-pill ${approval.status}`}>
                {approval.status}
              </span>
              <span>{approval.expiresAt}</span>
              {approval.status === "pending" && (
                <>
                  <button
                    className="secondary"
                    onClick={() =>
                      resolve.mutate({ id: approval.id, status: "approved" })
                    }
                  >
                    <Check size={16} />
                    批准
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      resolve.mutate({ id: approval.id, status: "denied" })
                    }
                  >
                    <X size={16} />
                    拒绝
                  </button>
                </>
              )}
            </div>
          ))}
          {!approvals.isLoading && !(approvals.data ?? []).length && (
            <div className="empty">暂无审批</div>
          )}
        </div>
      </section>
      <section className="section-band">
        <div className="section-title">
          <h3>审计记录</h3>
          <span>最近 {audits.data?.length ?? 0} 条</span>
        </div>
        <DataTable items={(audits.data ?? []).slice(0, 200)} />
      </section>
    </div>
  );
}

function ResourcesPanel({ items }: { items: any[] }) {
  const client = useQueryClient();
  const tenants = useMemo(() => {
    const values = [
      ...new Set(items.map((item) => String(item.tenantId ?? "default"))),
    ].sort();
    return values.length ? values : ["default"];
  }, [items]);
  const [tenantId, setTenantId] = useState("default"),
    [acl, setAcl] = useState({ resourceId: "", botIds: "" });
  useEffect(() => {
    if (!tenants.includes(tenantId)) setTenantId(tenants[0]!);
  }, [tenantId, tenants]);
  const tenantItems = useMemo(
    () =>
      items.filter((item) => String(item.tenantId ?? "default") === tenantId),
    [items, tenantId],
  );
  const jobs = useQuery({
    queryKey: ["media-jobs", tenantId],
    queryFn: () =>
      center<any[]>(
        "resource",
        `/v1/media/jobs?tenantId=${encodeURIComponent(tenantId)}`,
      ),
    refetchInterval: 2000,
  });
  const stats = useQuery({
    queryKey: ["resource-stats", tenantId],
    queryFn: () =>
      center<any>(
        "resource",
        `/v1/stats?tenantId=${encodeURIComponent(tenantId)}`,
      ),
  });
  const integrity = useMutation({
    mutationFn: (dryRun: boolean) =>
      center<any>("resource", "/v1/integrity/check", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          dryRun,
          removeMissing: !dryRun,
        }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["resources"] });
      void client.invalidateQueries({ queryKey: ["resource-stats"] });
    },
  });
  const updateAcl = useMutation({
    mutationFn: () =>
      center("resource", `/v1/resources/${acl.resourceId}/acl`, {
        method: "PATCH",
        body: JSON.stringify({
          tenantId,
          allowedBotIds: acl.botIds
            .split(/[,，\s]+/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      setAcl({ resourceId: "", botIds: "" });
      void client.invalidateQueries({ queryKey: ["resources"] });
    },
  });
  const action = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "cancel" | "retry" }) =>
      center("resource", `/v1/media/jobs/${id}/${verb}`, {
        method: "POST",
        body: JSON.stringify({ tenantId }),
      }),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["media-jobs"] }),
  });
  return (
    <div className="stack">
      <section className="section-band">
        <div className="section-title">
          <h3>空间与完整性</h3>
          <div className="section-actions">
            <select
              aria-label="资源租户"
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
                setAcl({ resourceId: "", botIds: "" });
              }}
            >
              {tenants.map((tenant) => (
                <option key={tenant} value={tenant}>
                  {tenant}
                </option>
              ))}
            </select>
            <span>{stats.data?.count ?? 0} 个对象</span>
          </div>
        </div>
        <div className="resource-stat-grid">
          <div>
            <span>逻辑空间</span>
            <strong>{formatBytes(stats.data?.logicalBytes ?? 0)}</strong>
          </div>
          <div>
            <span>物理空间</span>
            <strong>{formatBytes(stats.data?.physicalBytes ?? 0)}</strong>
          </div>
          <div>
            <span>去重节省</span>
            <strong>{formatBytes(stats.data?.deduplicatedBytes ?? 0)}</strong>
          </div>
          <div>
            <span>可清理</span>
            <strong>{stats.data?.unreferenced ?? 0}</strong>
          </div>
        </div>
        <div className="tool-band">
          <button
            className="secondary"
            disabled={integrity.isPending}
            onClick={() => integrity.mutate(true)}
          >
            <Search size={16} />
            检查完整性
          </button>
          <button
            className="secondary"
            disabled={integrity.isPending}
            onClick={() => integrity.mutate(false)}
          >
            <Wrench size={16} />
            修复失效记录
          </button>
        </div>
        {integrity.data && (
          <div className="notice">
            已检查 {integrity.data.checked} 个，缺失 {integrity.data.missing}
            个，损坏 {integrity.data.corrupt} 个。
          </div>
        )}
        {integrity.error && (
          <div className="error form-error">{String(integrity.error)}</div>
        )}
      </section>
      <section className="section-band">
        <div className="section-title">
          <h3>Bot 访问授权</h3>
          <span>空列表表示租户内共享</span>
        </div>
        <div className="binding-form">
          <select
            value={acl.resourceId}
            onChange={(event) => {
              const resource = tenantItems.find(
                (item) => item.id === event.target.value,
              );
              setAcl({
                resourceId: event.target.value,
                botIds: (resource?.allowedBotIds ?? []).join(", "),
              });
            }}
          >
            <option value="">选择资源</option>
            {tenantItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            value={acl.botIds}
            placeholder="bot-a, bot-b"
            onChange={(event) => setAcl({ ...acl, botIds: event.target.value })}
          />
          <FormActions>
            <button
              className="primary"
              disabled={!acl.resourceId || updateAcl.isPending}
              onClick={() => updateAcl.mutate()}
            >
              <ShieldCheck size={16} />
              保存授权
            </button>
          </FormActions>
        </div>
      </section>
      <section className="section-band">
        <div className="section-title">
          <h3>媒体任务</h3>
          <span>{jobs.data?.length ?? 0} 个</span>
        </div>
        <div className="media-list">
          {(jobs.data ?? []).map((job) => (
            <div className="media-row" key={job.id}>
              <div>
                <strong>{job.operation}</strong>
                <span>{job.request?.outputName}</span>
              </div>
              <span className={`status-pill ${job.status}`}>{job.status}</span>
              <progress max={100} value={job.progress ?? 0} />
              <span>{job.progress ?? 0}%</span>
              {["queued", "running"].includes(job.status) ? (
                <button
                  className="secondary"
                  onClick={() => action.mutate({ id: job.id, verb: "cancel" })}
                >
                  取消
                </button>
              ) : job.status === "failed" || job.status === "cancelled" ? (
                <button
                  className="secondary"
                  onClick={() => action.mutate({ id: job.id, verb: "retry" })}
                >
                  <RotateCcw size={16} />
                  重试
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          {!jobs.isLoading && !(jobs.data ?? []).length && (
            <div className="empty">暂无媒体任务</div>
          )}
        </div>
      </section>
      <section className="section-band">
        <div className="section-title">
          <h3>资源对象</h3>
          <span>{tenantItems.length} 个</span>
        </div>
        <DataTable items={tenantItems} />
      </section>
    </div>
  );
}

function SystemAssistant({ navigate }: { navigate: (page: string) => void }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<any[]>([
    {
      role: "assistant",
      answer:
        "我可以根据当前平台的只读状态回答配置、运行和排查问题，也可以生成待审核的配置草稿。",
    },
  ]);
  const query = useMutation({
    mutationFn: (value: string) =>
      api<any>("/api/assistant/query", {
        method: "POST",
        body: JSON.stringify({ tenantId: "default", question: value }),
      }),
    onSuccess: (result) =>
      setMessages((items) => [...items, { role: "assistant", ...result }]),
    onError: (error) =>
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          answer: error instanceof Error ? error.message : "系统助手执行失败",
          error: true,
        },
      ]),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = question.trim();
    if (!value || query.isPending) return;
    setMessages((items) => [...items, { role: "user", answer: value }]);
    setQuestion("");
    query.mutate(value);
  };
  return (
    <>
      <Header
        title="系统助手"
        action={<span className="status-pill planned">Beta · 只读</span>}
      />
      <PageGuide page="assistant" />
      <section className="assistant-workspace" aria-label="系统助手对话">
        <div className="assistant-scope">
          <ShieldCheck size={17} />
          <span>
            零工具权限；不会执行命令、工作流或修改配置。配置建议仅作为草稿展示。
          </span>
        </div>
        <div className="assistant-transcript" aria-live="polite">
          {messages.map((message, index) => (
            <article
              className={`assistant-message ${message.role}`}
              key={index}
            >
              <strong>{message.role === "user" ? "你" : "系统助手"}</strong>
              <p className={message.error ? "error" : ""}>{message.answer}</p>
              {message.navigation && (
                <button
                  className="secondary"
                  onClick={() => navigate(message.navigation.page)}
                >
                  <Route size={16} />
                  {message.navigation.label}
                </button>
              )}
              {message.draft && (
                <div className="assistant-draft">
                  <span>配置草稿</span>
                  <strong>{message.draft.title}</strong>
                  <pre>{JSON.stringify(message.draft.changes, null, 2)}</pre>
                </div>
              )}
            </article>
          ))}
          {query.isPending && (
            <div className="muted">正在读取平台状态并生成回答…</div>
          )}
        </div>
        <form className="assistant-compose" onSubmit={submit}>
          <textarea
            aria-label="向系统助手提问"
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例如：为什么定时任务没有运行？"
          />
          <button
            className="primary"
            disabled={!question.trim() || query.isPending}
          >
            <MessageSquare size={17} />
            发送
          </button>
        </form>
      </section>
    </>
  );
}

function Manual({ navigate }: { navigate: (page: string) => void }) {
  const [sectionId, setSectionId] = useState<string>(manualSections[0].id);
  const [search, setSearch] = useState("");
  const normalized = search.trim().toLocaleLowerCase();
  const selected = manualSections.find((section) => section.id === sectionId)!;
  const guides = (
    normalized
      ? manualSections.flatMap((section) => section.guides)
      : selected.guides
  ).filter((guide) =>
    [guide.title, guide.summary, ...guide.steps]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized),
  );
  return (
    <>
      <Header title="使用手册" />
      <div className="manual-toolbar">
        <div className="manual-search">
          <Search size={17} />
          <input
            aria-label="搜索使用手册"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索配置、调度、排障或安全"
          />
          {search && (
            <button
              className="icon-button"
              title="清除搜索"
              onClick={() => setSearch("")}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="manual-tabs" role="tablist" aria-label="手册分类">
          {manualSections.map((section) => (
            <button
              key={section.id}
              role="tab"
              aria-selected={!normalized && section.id === sectionId}
              className={
                !normalized && section.id === sectionId ? "active" : ""
              }
              onClick={() => {
                setSearch("");
                setSectionId(section.id);
              }}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>
      <section className="section-band manual-intro">
        <div>
          <BookOpen size={22} />
          <div>
            <h3>
              {normalized ? `“${search.trim()}”的搜索结果` : selected.label}
            </h3>
            <p>
              {normalized
                ? `找到 ${guides.length} 个相关操作。`
                : sectionId === "start"
                  ? "建议依次完成运行检查、模型、机器人和通道配置。"
                  : "按目标选择操作，完成后可直接跳转到对应页面。"}
            </p>
          </div>
        </div>
      </section>
      <div className="manual-guide-list">
        {guides.map((guide, index) => (
          <section className="manual-guide" key={guide.title}>
            <div className="manual-guide-index">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="manual-guide-copy">
              <h3>{guide.title}</h3>
              <p>{guide.summary}</p>
              <ol>
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <button className="secondary" onClick={() => navigate(guide.page)}>
              {guide.action}
              <ChevronRight size={16} />
            </button>
          </section>
        ))}
        {!guides.length && <div className="empty">没有找到相关手册内容</div>}
      </div>
    </>
  );
}

function RuntimeExtensionsPanel({
  isAdmin,
  mode,
  onModeChange,
}: {
  isAdmin: boolean;
  mode: "providers" | "profiles" | "platform";
  onModeChange: (mode: "providers" | "profiles" | "platform") => void;
}) {
  const client = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<any>();
  const [selectedPlatform, setSelectedPlatform] = useState<any>();
  const [editorOpen, setEditorOpen] = useState(false);
  const emptyProfile = {
    id: "",
    tenantId: "default",
    name: "",
    description: "",
    enabled: true,
    runtimeProviderId: "",
    modelPolicyId: "",
    contextPolicyId: "",
    capabilityBindingSetId: "",
    governancePolicyId: "",
    workspacePolicyId: "",
    promptSectionRefs: "",
    limitsJson: '{\n  "maxTurns": 8\n}',
    fallbackProviderIds: [] as string[],
  };
  const [profile, setProfile] = useState(emptyProfile);
  const providers = useQuery({
    queryKey: ["runtime-providers"],
    queryFn: () => center<any[]>("runtime", "/v1/runtime-providers"),
    refetchInterval: 15_000,
  });
  const profiles = useQuery({
    queryKey: ["runtime-profiles"],
    queryFn: () =>
      center<any[]>("runtime", "/v1/runtime-profiles?tenantId=default"),
  });
  const platformExtensions = useQuery({
    queryKey: ["platform-extensions"],
    queryFn: async () => {
      const centers = [
        "mg",
        "ch",
        "mh",
        "cr",
        "scheduler",
        "resource",
        "governance",
      ];
      const values = await Promise.allSettled(
        centers.map(async (centerName) => ({
          center: centerName,
          items: await center<any[]>(centerName, "/v1/extensions"),
        })),
      );
      return values.flatMap((result, index) => {
        if (result.status === "fulfilled") {
          return result.value.items.map((item) => ({
            ...item,
            center: result.value.center,
          }));
        }
        return [
          {
            center: centers[index],
            unavailable: true,
            error: String(result.reason),
            lifecycleState: "unavailable",
            descriptor: {
              providerId: `${centers[index]}.extension-catalog`,
              displayName: `${centers[index].toUpperCase()} 扩展目录不可用`,
              family: "control-plane",
              isolation: "unavailable",
              capabilities: {},
            },
          },
        ];
      });
    },
    refetchInterval: 15_000,
  });
  const providerLogs = useQuery({
    queryKey: [
      "runtime-provider-logs",
      selectedProvider?.descriptor?.providerId,
    ],
    queryFn: () =>
      center<any[]>(
        "runtime",
        `/v1/runtime-providers/${encodeURIComponent(selectedProvider.descriptor.providerId)}/logs`,
      ),
    enabled: Boolean(selectedProvider),
  });
  const platformLogs = useQuery({
    queryKey: [
      "platform-extension-logs",
      selectedPlatform?.center,
      selectedPlatform?.descriptor?.providerId,
    ],
    queryFn: () =>
      center<any[]>(
        selectedPlatform.center,
        `/v1/extensions/${encodeURIComponent(selectedPlatform.descriptor.providerId)}/logs`,
      ),
    enabled: Boolean(selectedPlatform),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["runtime-providers"] });
    void client.invalidateQueries({ queryKey: ["runtime-profiles"] });
    void client.invalidateQueries({ queryKey: ["runtime-provider-logs"] });
    void client.invalidateQueries({ queryKey: ["platform-extensions"] });
    void client.invalidateQueries({ queryKey: ["platform-extension-logs"] });
  };
  const probe = useMutation({
    mutationFn: (id: string) =>
      center(
        "runtime",
        `/v1/runtime-providers/${encodeURIComponent(id)}/probe`,
        {
          method: "POST",
          body: "{}",
        },
      ),
    onSuccess: (lastProbe: any) => {
      setSelectedProvider((current: any) =>
        current
          ? { ...current, lastProbe, updatedAt: lastProbe.checkedAt }
          : current,
      );
      refresh();
    },
  });
  const lifecycle = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      center(
        "runtime",
        `/v1/runtime-providers/${encodeURIComponent(id)}/lifecycle/${state}`,
        { method: "POST", body: "{}" },
      ),
    onSuccess: (record: any) => {
      setSelectedProvider(record);
      refresh();
    },
  });
  const platformProbe = useMutation({
    mutationFn: (item: any) =>
      center(
        item.center,
        `/v1/extensions/${encodeURIComponent(item.descriptor.providerId)}/probe`,
        { method: "POST", body: "{}" },
      ),
    onSuccess: (lastProbe: any, item) => {
      setSelectedPlatform((current: any) =>
        current
          ? {
              ...current,
              lastProbe,
              center: item.center,
              updatedAt: lastProbe.checkedAt,
            }
          : current,
      );
      refresh();
    },
  });
  const platformLifecycle = useMutation({
    mutationFn: ({ item, state }: { item: any; state: string }) =>
      center(
        item.center,
        `/v1/extensions/${encodeURIComponent(item.descriptor.providerId)}/lifecycle/${state}`,
        { method: "POST", body: "{}" },
      ),
    onSuccess: (record: any, variables) => {
      setSelectedPlatform({ ...record, center: variables.item.center });
      refresh();
    },
  });
  const saveProfile = useMutation({
    mutationFn: () => {
      const body = {
        id: profile.id || randomUuid(),
        tenantId: profile.tenantId,
        name: profile.name,
        description: profile.description || undefined,
        enabled: profile.enabled,
        runtimeProviderId: profile.runtimeProviderId,
        modelPolicyId: profile.modelPolicyId || undefined,
        contextPolicyId: profile.contextPolicyId || undefined,
        capabilityBindingSetId: profile.capabilityBindingSetId || undefined,
        governancePolicyId: profile.governancePolicyId || undefined,
        workspacePolicyId: profile.workspacePolicyId || undefined,
        promptSectionRefs: profile.promptSectionRefs
          .split(/[,，\s]+/)
          .filter(Boolean),
        limits: parseObjectJson(profile.limitsJson, "运行限制"),
        fallbackProviderIds: profile.fallbackProviderIds,
      };
      return center(
        "runtime",
        profile.id
          ? `/v1/runtime-profiles/${profile.id}`
          : "/v1/runtime-profiles",
        { method: profile.id ? "PUT" : "POST", body: JSON.stringify(body) },
      );
    },
    onSuccess: () => {
      setProfile({ ...emptyProfile, fallbackProviderIds: [] });
      setEditorOpen(false);
      refresh();
    },
  });
  const removeProfile = useMutation({
    mutationFn: (id: string) =>
      center("runtime", `/v1/runtime-profiles/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const openProfile = (item?: any) => {
    setProfile(
      item
        ? {
            ...emptyProfile,
            ...item,
            description: item.description ?? "",
            modelPolicyId: item.modelPolicyId ?? "",
            contextPolicyId: item.contextPolicyId ?? "",
            capabilityBindingSetId: item.capabilityBindingSetId ?? "",
            governancePolicyId: item.governancePolicyId ?? "",
            workspacePolicyId: item.workspacePolicyId ?? "",
            promptSectionRefs: (item.promptSectionRefs ?? []).join(", "),
            limitsJson: JSON.stringify(item.limits ?? {}, null, 2),
            fallbackProviderIds: [...(item.fallbackProviderIds ?? [])],
          }
        : { ...emptyProfile, fallbackProviderIds: [] },
    );
    setEditorOpen(true);
  };
  const transitionActions: Record<string, Array<[string, string]>> = {
    installed: [["验证", "verified"]],
    verified: [
      ["启用", "active"],
      ["灰度", "canary"],
    ],
    canary: [
      ["转为正式", "active"],
      ["停止接收新任务", "draining"],
    ],
    active: [
      ["停止接收新任务", "draining"],
      ["停用", "disabled"],
    ],
    draining: [
      ["恢复", "active"],
      ["停用", "disabled"],
    ],
    disabled: [["重新验证", "verified"]],
    failed: [["重新验证", "verified"]],
    retired: [],
  };
  const error =
    probe.error ??
    lifecycle.error ??
    platformProbe.error ??
    platformLifecycle.error ??
    saveProfile.error ??
    removeProfile.error;
  return (
    <div className="stack runtime-extension-workspace">
      <div
        className="segmented-control"
        role="tablist"
        aria-label="运行时扩展视图"
      >
        <button
          className={mode === "providers" ? "active" : ""}
          onClick={() => onModeChange("providers")}
        >
          运行时插件
        </button>
        <button
          className={mode === "profiles" ? "active" : ""}
          onClick={() => onModeChange("profiles")}
        >
          运行方案
        </button>
        <button
          className={mode === "platform" ? "active" : ""}
          onClick={() => onModeChange("platform")}
        >
          平台插件
        </button>
      </div>
      {mode === "providers" && !selectedProvider && (
        <section className="section-band">
          <div className="section-title">
            <h3>运行时插件</h3>
            <span>{providers.data?.length ?? 0} 个已安装实现</span>
          </div>
          <div className="model-entity-list">
            {(providers.data ?? []).map((record) => (
              <button
                className="model-entity-row selectable-row"
                key={record.descriptor.providerId}
                onClick={() => setSelectedProvider(record)}
              >
                <div>
                  <strong>{record.descriptor.displayName}</strong>
                  <span>
                    {record.descriptor.providerId} · {record.descriptor.version}
                  </span>
                  <HealthSummary
                    status={record.lastProbe?.status}
                    checkedAt={record.lastProbe?.checkedAt}
                    error={record.lastProbe?.reason}
                    latencyMs={record.lastProbe?.latencyMs}
                  />
                </div>
                <span
                  className={`status-pill ${record.lifecycleState === "active" ? "ready" : "degraded"}`}
                >
                  {record.lifecycleState}
                </span>
                <code>{record.descriptor.isolation}</code>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </section>
      )}
      {mode === "providers" && selectedProvider && (
        <section className="section-band provider-detail">
          <div className="section-title">
            <div>
              <h3>{selectedProvider.descriptor.displayName}</h3>
              <span>{selectedProvider.descriptor.providerId}</span>
            </div>
            <div className="section-actions">
              <button
                className="secondary compact-button"
                onClick={() => setSelectedProvider(undefined)}
              >
                返回列表
              </button>
              <button
                className="secondary compact-button"
                onClick={() =>
                  probe.mutate(selectedProvider.descriptor.providerId)
                }
                disabled={probe.isPending}
              >
                <Activity size={16} />
                检测
              </button>
              {isAdmin &&
                (transitionActions[selectedProvider.lifecycleState] ?? []).map(
                  ([label, state]) => (
                    <button
                      className="primary compact-button"
                      key={state}
                      onClick={() =>
                        lifecycle.mutate({
                          id: selectedProvider.descriptor.providerId,
                          state,
                        })
                      }
                      disabled={lifecycle.isPending}
                    >
                      {label}
                    </button>
                  ),
                )}
            </div>
          </div>
          <div className="detail-facts">
            <div>
              <span>生命周期</span>
              <strong>{selectedProvider.lifecycleState}</strong>
            </div>
            <div>
              <span>隔离方式</span>
              <strong>{selectedProvider.descriptor.isolation}</strong>
            </div>
            <div>
              <span>契约版本</span>
              <strong>{selectedProvider.descriptor.contractVersion}</strong>
            </div>
            <div>
              <span>健康状态</span>
              <HealthSummary
                status={selectedProvider.lastProbe?.status}
                checkedAt={selectedProvider.lastProbe?.checkedAt}
                error={selectedProvider.lastProbe?.reason}
                latencyMs={selectedProvider.lastProbe?.latencyMs}
              />
            </div>
          </div>
          <div className="detail-columns">
            <div>
              <h4>能力协商</h4>
              <div className="capability-matrix">
                {Object.entries(
                  selectedProvider.descriptor.capabilities ?? {},
                ).map(([name, enabled]) => (
                  <div key={name}>
                    <span>{name}</span>
                    <strong>{String(enabled)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4>生命周期日志</h4>
              <div className="compact-log">
                {(providerLogs.data ?? []).map((entry) => (
                  <div key={entry.id}>
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    <strong>{entry.action}</strong>
                    <p>{entry.message}</p>
                  </div>
                ))}
                {!providerLogs.data?.length && (
                  <div className="empty">暂无日志</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
      {mode === "profiles" && !editorOpen && (
        <section className="section-band">
          <div className="section-title">
            <h3>Runtime Profile</h3>
            <div className="section-actions">
              <span>{profiles.data?.length ?? 0} 个</span>
              <button
                className="primary compact-button"
                onClick={() => openProfile()}
              >
                <Plus size={16} />
                新建 Profile
              </button>
            </div>
          </div>
          <div className="model-entity-list">
            {(profiles.data ?? []).map((item) => (
              <div className="model-entity-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    r{item.revision} · {item.enabled ? "已启用" : "已停用"}
                  </span>
                </div>
                <code>{item.runtimeProviderId}</code>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    title="编辑 Profile"
                    onClick={() => openProfile(item)}
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    className="icon-button danger-button"
                    title="删除 Profile"
                    onClick={() =>
                      window.confirm(`确认删除“${item.name}”？`) &&
                      removeProfile.mutate(item.id)
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {!profiles.isLoading && !profiles.data?.length && (
              <div className="empty">暂无 Runtime Profile</div>
            )}
          </div>
        </section>
      )}
      {mode === "profiles" && editorOpen && (
        <section className="section-band">
          <div className="section-title">
            <h3>
              {profile.id ? "编辑 Runtime Profile" : "新建 Runtime Profile"}
            </h3>
            <button
              className="secondary compact-button"
              onClick={() => setEditorOpen(false)}
            >
              返回列表
            </button>
          </div>
          <div className="runtime-profile-form">
            <label>
              名称
              <input
                value={profile.name}
                onChange={(event) =>
                  setProfile({ ...profile, name: event.target.value })
                }
              />
            </label>
            <label>
              Runtime Provider
              <select
                value={profile.runtimeProviderId}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    runtimeProviderId: event.target.value,
                  })
                }
              >
                <option value="">选择 Provider</option>
                {(providers.data ?? [])
                  .filter((record) =>
                    ["active", "canary"].includes(record.lifecycleState),
                  )
                  .map((record) => (
                    <option
                      key={record.descriptor.providerId}
                      value={record.descriptor.providerId}
                    >
                      {record.descriptor.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <label className="wide-field">
              描述
              <textarea
                rows={3}
                value={profile.description}
                onChange={(event) =>
                  setProfile({ ...profile, description: event.target.value })
                }
              />
            </label>
            <label>
              模型策略 ID
              <input
                value={profile.modelPolicyId}
                onChange={(event) =>
                  setProfile({ ...profile, modelPolicyId: event.target.value })
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={profile.enabled}
                onChange={(event) =>
                  setProfile({ ...profile, enabled: event.target.checked })
                }
              />
              启用
            </label>
            <details className="advanced-config wide-field">
              <summary>
                <Settings size={16} />
                高级组合配置
              </summary>
              <div className="advanced-grid">
                <label>
                  上下文策略 ID
                  <input
                    value={profile.contextPolicyId}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        contextPolicyId: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  能力绑定集 ID
                  <input
                    value={profile.capabilityBindingSetId}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        capabilityBindingSetId: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  治理策略 ID
                  <input
                    value={profile.governancePolicyId}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        governancePolicyId: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  工作区策略 ID
                  <input
                    value={profile.workspacePolicyId}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        workspacePolicyId: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="wide-field">
                  提示词片段引用
                  <input
                    value={profile.promptSectionRefs}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        promptSectionRefs: event.target.value,
                      })
                    }
                    placeholder="多个引用用逗号分隔"
                  />
                </label>
                <label className="wide-field">
                  运行限制（JSON）
                  <textarea
                    rows={5}
                    spellCheck={false}
                    value={profile.limitsJson}
                    onChange={(event) =>
                      setProfile({ ...profile, limitsJson: event.target.value })
                    }
                  />
                </label>
                <fieldset className="wide-field">
                  <legend>准入备用 Provider</legend>
                  {(providers.data ?? [])
                    .filter(
                      (record) =>
                        record.descriptor.providerId !==
                        profile.runtimeProviderId,
                    )
                    .map((record) => (
                      <label
                        className="checkbox"
                        key={record.descriptor.providerId}
                      >
                        <input
                          type="checkbox"
                          checked={profile.fallbackProviderIds.includes(
                            record.descriptor.providerId,
                          )}
                          onChange={(event) =>
                            setProfile({
                              ...profile,
                              fallbackProviderIds: event.target.checked
                                ? [
                                    ...profile.fallbackProviderIds,
                                    record.descriptor.providerId,
                                  ]
                                : profile.fallbackProviderIds.filter(
                                    (id) => id !== record.descriptor.providerId,
                                  ),
                            })
                          }
                        />
                        {record.descriptor.displayName}
                      </label>
                    ))}
                </fieldset>
              </div>
            </details>
            <FormActions>
              <button
                className="primary"
                disabled={
                  !profile.name ||
                  !profile.runtimeProviderId ||
                  saveProfile.isPending
                }
                onClick={() => saveProfile.mutate()}
              >
                <Check size={16} />
                保存 Profile
              </button>
            </FormActions>
          </div>
        </section>
      )}
      {mode === "platform" && !selectedPlatform && (
        <section className="section-band">
          <div className="section-title">
            <h3>跨中心扩展目录</h3>
            <span>{platformExtensions.data?.length ?? 0} 个 Provider</span>
          </div>
          <div className="model-entity-list">
            {(platformExtensions.data ?? []).map((record) => (
              <button
                className="model-entity-row selectable-row"
                key={`${record.center}:${record.descriptor.providerId}`}
                onClick={() =>
                  !record.unavailable && setSelectedPlatform(record)
                }
                disabled={record.unavailable}
                title={record.unavailable ? record.error : undefined}
              >
                <div>
                  <strong>{record.descriptor.displayName}</strong>
                  <span>
                    {record.descriptor.providerId} · {record.descriptor.family}
                    {record.generation ? ` · 第 ${record.generation} 代` : ""}
                  </span>
                  <HealthSummary
                    status={record.lastProbe?.status}
                    checkedAt={record.lastProbe?.checkedAt}
                    error={record.lastProbe?.reason}
                  />
                </div>
                <span
                  className={`status-pill ${record.lifecycleState === "active" ? "ready" : "degraded"}`}
                >
                  {record.lifecycleState}
                </span>
                <code>
                  {record.center.toUpperCase()} · {record.descriptor.isolation}
                </code>
                <ChevronRight size={17} />
              </button>
            ))}
            {!platformExtensions.isLoading &&
              !platformExtensions.data?.length && (
                <div className="empty">暂无平台扩展</div>
              )}
          </div>
        </section>
      )}
      {mode === "platform" && selectedPlatform && (
        <section className="section-band provider-detail">
          <div className="section-title">
            <div>
              <h3>{selectedPlatform.descriptor.displayName}</h3>
              <span>
                {selectedPlatform.center.toUpperCase()} ·{" "}
                {selectedPlatform.descriptor.providerId}
              </span>
            </div>
            <div className="section-actions">
              <button
                className="secondary compact-button"
                onClick={() => setSelectedPlatform(undefined)}
              >
                返回列表
              </button>
              <button
                className="secondary compact-button"
                onClick={() => platformProbe.mutate(selectedPlatform)}
              >
                <Activity size={16} />
                检测
              </button>
              {isAdmin &&
                (transitionActions[selectedPlatform.lifecycleState] ?? []).map(
                  ([label, state]) => (
                    <button
                      className="primary compact-button"
                      key={state}
                      onClick={() =>
                        platformLifecycle.mutate({
                          item: selectedPlatform,
                          state,
                        })
                      }
                    >
                      {label}
                    </button>
                  ),
                )}
            </div>
          </div>
          <div className="detail-facts">
            <div>
              <span>所属中心</span>
              <strong>{selectedPlatform.center.toUpperCase()}</strong>
            </div>
            <div>
              <span>生命周期</span>
              <strong>{selectedPlatform.lifecycleState}</strong>
            </div>
            <div>
              <span>隔离方式</span>
              <strong>{selectedPlatform.descriptor.isolation}</strong>
            </div>
            <div>
              <span>契约版本</span>
              <strong>{selectedPlatform.descriptor.contractVersion}</strong>
            </div>
            <div>
              <span>持久化代次</span>
              <strong>第 {selectedPlatform.generation ?? 1} 代</strong>
            </div>
            <div>
              <span>安装时间</span>
              <strong>
                {selectedPlatform.installedAt
                  ? new Date(selectedPlatform.installedAt).toLocaleString()
                  : "未记录"}
              </strong>
            </div>
            <div>
              <span>状态更新时间</span>
              <strong>
                {selectedPlatform.updatedAt
                  ? new Date(selectedPlatform.updatedAt).toLocaleString()
                  : "未记录"}
              </strong>
            </div>
            <div>
              <span>健康状态</span>
              <HealthSummary
                status={selectedPlatform.lastProbe?.status}
                checkedAt={selectedPlatform.lastProbe?.checkedAt}
                error={selectedPlatform.lastProbe?.reason}
              />
            </div>
          </div>
          <div className="detail-columns">
            <div>
              <h4>能力协商</h4>
              <div className="capability-matrix">
                {Object.entries(
                  selectedPlatform.descriptor.capabilities ?? {},
                ).map(([name, enabled]) => (
                  <div key={name}>
                    <span>{name}</span>
                    <strong>{String(enabled)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4>生命周期日志</h4>
              <div className="compact-log">
                {(platformLogs.data ?? []).map((entry) => (
                  <div key={entry.id}>
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    <strong>{entry.action}</strong>
                    <p>{entry.message}</p>
                  </div>
                ))}
                {!platformLogs.data?.length && (
                  <div className="empty">暂无日志</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
      {error && <div className="error form-error">{String(error)}</div>}
    </div>
  );
}

function GenericPage({
  id,
  me,
  navigate,
}: {
  id: string;
  me: any;
  navigate: (page: string) => void;
}) {
  const [baseId, subview] = id.split("/"),
    pair = endpoint[baseId],
    query = useQuery({
      queryKey: [baseId],
      queryFn: () =>
        pair ? center<any[]>(pair[0], pair[1]) : Promise.resolve([]),
      enabled: !!pair,
    }),
    items = Array.isArray(query.data) ? query.data : [];
  if (baseId === "assistant") return <SystemAssistant navigate={navigate} />;
  if (baseId === "manual") return <Manual navigate={navigate} />;
  return (
    <>
      <Header
        title={nav.find((x) => x.id === baseId)?.label ?? baseId}
        action={
          <button
            className="icon-button"
            title="刷新"
            onClick={() => query.refetch()}
          >
            <RefreshCw size={18} />
          </button>
        }
      />
      <PageGuide page={baseId} />
      {baseId === "models" ? (
        <ModelsPanel
          view={
            (["providers", "deployments", "policies"].includes(subview)
              ? subview
              : "providers") as "providers" | "deployments" | "policies"
          }
          onViewChange={(view) => navigate(`models/${view}`)}
        />
      ) : baseId === "runtime-extensions" ? (
        <RuntimeExtensionsPanel
          isAdmin={me.user.role === "admin"}
          mode={
            (["providers", "profiles", "platform"].includes(subview)
              ? subview
              : "providers") as "providers" | "profiles" | "platform"
          }
          onModeChange={(mode) => navigate(`runtime-extensions/${mode}`)}
        />
      ) : baseId === "bots" ? (
        <BotsPanel />
      ) : baseId === "channels" ? (
        <ChannelsPanel />
      ) : baseId === "context" ? (
        <ContextPanel />
      ) : baseId === "schedules" ? (
        <Schedules items={items} refetch={() => void query.refetch()} />
      ) : baseId === "browser" ? (
        <BrowserPanel />
      ) : baseId === "capabilities" ? (
        <CapabilitiesPanel
          items={items}
          view={
            (["list", "bindings", "import", "create"].includes(subview)
              ? subview
              : "list") as "list" | "bindings" | "import" | "create"
          }
          onViewChange={(view) => navigate(`capabilities/${view}`)}
        />
      ) : baseId === "executions" ? (
        <ExecutionsPanel items={items} refetch={() => void query.refetch()} />
      ) : baseId === "governance" ? (
        <GovernancePanel approverId={me.user.id} />
      ) : baseId === "resources" ? (
        <ResourcesPanel items={items} />
      ) : baseId === "settings" ? (
        <SettingsPanel isAdmin={me.user.role === "admin"} />
      ) : baseId === "accounts" ? (
        <AccountsPanel />
      ) : (
        <DataTable items={items} />
      )}
    </>
  );
}
function AppShell({ me }: { me: any }) {
  const [page, setPage] = useState(() => location.hash.slice(1) || "overview"),
    qc = useQueryClient();
  const diagnostics = useMutation({
    mutationFn: async () => {
      const status = await api("/api/centers/status"),
        sources: Array<[string, string, string]> = [
          ["mg-runtime", "mg", "/v1/logs?limit=200"],
          ["mg-deliveries", "mg", "/v1/deliveries?limit=100"],
          ["cr-diagnostics", "cr", "/v1/diagnostics"],
          ["runtime-executions", "runtime", "/v1/executions?tenantId=default"],
          ["scheduler-runs", "scheduler", "/v1/runs"],
          ["governance-audit", "governance", "/v1/audit?tenantId=default"],
          ["resource-media", "resource", "/v1/media/jobs?tenantId=default"],
        ],
        snapshots = await Promise.allSettled(
          sources.map(([, name, path]) => center<any>(name, path)),
        ),
        metadataKeys = new Set([
          "id",
          "tenantId",
          "botId",
          "accountId",
          "channel",
          "kind",
          "type",
          "action",
          "status",
          "outcome",
          "risk",
          "error",
          "reason",
          "correlationId",
          "createdAt",
          "updatedAt",
          "startedAt",
          "finishedAt",
          "lastRunAt",
          "nextRunAt",
          "attempts",
          "progress",
        ]),
        project = (value: any) => {
          const values = Array.isArray(value) ? value.slice(0, 100) : [value];
          return values.map((item) =>
            item && typeof item === "object"
              ? Object.fromEntries(
                  Object.entries(item).filter(([key]) => metadataKeys.has(key)),
                )
              : item,
          );
        },
        logs = snapshots.map((result, index) => ({
          name: `${sources[index]![0]}.json`,
          content: JSON.stringify(
            result.status === "fulfilled"
              ? project(result.value)
              : { unavailable: true, error: String(result.reason) },
            null,
            2,
          ),
        }));
      return center<any>("resource", "/v1/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          tenantId: "default",
          sections: {
            status,
            generatedAt: new Date().toISOString(),
            scope: "operational-metadata-only",
          },
          logs,
        }),
      });
    },
    onSuccess: (r) =>
      window.open(
        `/api/center/resource/v1/resources/${r.item.id}/content?tenantId=default`,
        "_blank",
      ),
  });
  function choose(id: string) {
    const item = nav.find((entry) => entry.id === id);
    const target = item?.children?.length ? `${id}/${item.children[0].id}` : id;
    setPage(target);
    location.hash = target;
  }
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span>Q</span>
          <div>
            <strong>QuarkfanTools</strong>
            <small>Platform 3.0</small>
          </div>
        </div>
        <nav>
          {navGroups.map((group) => (
            <section className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map(({ id, label, icon: Icon, children }) => {
                const active = page === id || page.startsWith(`${id}/`);
                return (
                  <div className="nav-entry" key={id}>
                    <button
                      className={active ? "active" : ""}
                      onClick={() => choose(id)}
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                      <ChevronRight size={15} />
                    </button>
                    {active && children?.length && (
                      <div className="nav-children">
                        {children.map((child) => {
                          const childPage = `${id}/${child.id}`;
                          return (
                            <button
                              key={child.id}
                              className={page === childPage ? "active" : ""}
                              onClick={() => choose(childPage)}
                            >
                              <span>{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="aside-footer">
          <button
            className={page === "manual" ? "active" : ""}
            onClick={() => choose("manual")}
          >
            <BookOpen size={17} />
            使用手册
          </button>
          <button
            onClick={() => diagnostics.mutate()}
            disabled={diagnostics.isPending}
            title={
              diagnostics.error
                ? diagnostics.error instanceof Error
                  ? diagnostics.error.message
                  : "排障包生成失败"
                : "收集脱敏运行元数据并生成排障包"
            }
          >
            <Download size={17} />
            {diagnostics.isPending
              ? "正在收集"
              : diagnostics.error
                ? "排障失败，重试"
                : "一键排障"}
          </button>
          <button
            onClick={async () => {
              await authClient.signOut();
              qc.clear();
              location.reload();
            }}
          >
            <LogOut size={17} />
            退出登录
          </button>
        </div>
      </aside>
      <main className="content">
        <OperationFeedback />
        <div className="topbar">
          <span className="environment">
            <span className="dot online" />
            服务器
          </span>
          <span>
            {me.user.displayUsername ?? me.user.username ?? me.user.name} ·{" "}
            {me.user.role ?? "viewer"}
          </span>
        </div>
        <section className="page">
          {page === "overview" ? (
            <Overview />
          ) : (
            <GenericPage id={page} me={me} navigate={choose} />
          )}
        </section>
      </main>
    </div>
  );
}
export function App() {
  const { data, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<any>("/api/me"),
    retry: false,
  });
  if (isPending) return <div className="splash">QuarkfanTools</div>;
  return data ? (
    data.user.mustChangePassword ? (
      <ForcePasswordChange />
    ) : (
      <AppShell me={data} />
    )
  ) : (
    <Login />
  );
}
