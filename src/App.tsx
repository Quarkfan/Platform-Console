import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Play,
  Pause,
  Plus,
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
type Nav = { id: string; label: string; icon: any };
const navGroups: Array<{ label: string; items: Nav[] }> = [
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
      { id: "models", label: "模型", icon: Sparkles },
      { id: "capabilities", label: "能力", icon: Boxes },
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
function Login() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await authClient.signIn.username({ username, password });
    setBusy(false);
    if (result.error) setError(result.error.message ?? "登录失败");
    else location.reload();
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
            <span>{items.length} 个任务</span>
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
                  onClick={() => run.mutate(x.id)}
                  disabled={
                    run.isPending ||
                    (x.schedule?.type === "once" && Boolean(x.lastRunAt))
                  }
                >
                  <Play size={16} />
                  立即执行
                </button>
                <button
                  className="icon-button"
                  title={x.enabled ? "暂停任务" : "恢复任务"}
                  onClick={() => toggle.mutate(x)}
                  disabled={x.schedule?.type === "once" && Boolean(x.lastRunAt)}
                >
                  {x.enabled ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  className="icon-button"
                  title="运行日志"
                  onClick={() => setSelected(x)}
                >
                  <History size={16} />
                </button>
                <button
                  className="icon-button"
                  title={
                    x.target?.type === "runtime" && x.schedule?.type !== "once"
                      ? "编辑任务"
                      : "该系统任务不支持在此编辑"
                  }
                  disabled={
                    x.target?.type !== "runtime" || x.schedule?.type === "once"
                  }
                  onClick={() => {
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
                </button>
                <button
                  className="icon-button danger-button"
                  title="删除任务"
                  onClick={() => {
                    if (window.confirm(`确认删除调度任务“${x.name}”？`))
                      remove.mutate(x);
                  }}
                >
                  <Trash2 size={16} />
                </button>
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
                高级配置
              </summary>
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
              高级配置
            </summary>
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
          <button
            className="primary"
            disabled={!source.name || saveSource.isPending}
            onClick={() => saveSource.mutate()}
          >
            {source.id ? "保存修改" : "添加来源"}
          </button>
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
              高级配置
            </summary>
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
          <button
            className="primary"
            disabled={
              !binding.sourceId || !binding.botId || saveBinding.isPending
            }
            onClick={() => saveBinding.mutate()}
          >
            {binding.id ? "保存修改" : "添加绑定"}
          </button>
        </div>
        {error && <div className="error form-error">{String(error)}</div>}
      </section>
    </div>
  );
}
function ModelsPanel() {
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
      className={`stack models-workspace ${editor ? `editing edit-${editor}` : "listing"}`}
    >
      <section className="section-band provider-section">
        <div className="section-title">
          <h3>Model Provider</h3>
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
                <span>
                  {item.protocol} · {item.enabled ? item.status : "已停用"}
                </span>
              </div>
              <code>{item.baseUrl}</code>
              <div className="row-actions">
                <button
                  className="icon-button"
                  title="检测 Provider"
                  onClick={() => probeProvider.mutate(item.id)}
                >
                  <Activity size={16} />
                </button>
                <button
                  className="icon-button"
                  title="编辑 Provider"
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
                      headersJson: JSON.stringify(item.headers ?? {}, null, 2),
                    });
                    setEditor("provider");
                  }}
                >
                  <Settings size={16} />
                </button>
                <button
                  className="icon-button danger-button"
                  title="删除 Provider"
                  onClick={() => remove("provider", item, item.name)}
                >
                  <Trash2 size={16} />
                </button>
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
              高级配置
            </summary>
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
              </label>
            </div>
          </details>
          <button
            className="primary"
            onClick={() => saveProvider.mutate()}
            disabled={
              !provider.name || !provider.baseUrl || saveProvider.isPending
            }
          >
            {provider.id ? "保存修改" : "添加 Provider"}
          </button>
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
              高级配置
            </summary>
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
              </label>
            </div>
          </details>
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
            启用
          </label>
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
          <div className="deployment-options">
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
          </div>
          {policy.mode === "fixed" && (
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
          )}
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
  const channelTypes = useQuery({
    queryKey: ["channel-types"],
    queryFn: () => center<any[]>("mg", "/v1/channel-types"),
  });
  const channelBackends = useQuery({
    queryKey: ["channel-backends"],
    queryFn: () => center<any[]>("mg", "/v1/channel-backends"),
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
              <h3>通道类型</h3>
              <span>{channelTypes.data?.length ?? 0} 种</span>
            </div>
            <div className="channel-list">
              {(channelTypes.data ?? []).map((item) => (
                <div className="channel-row" key={item.channel}>
                  <div>
                    <strong>{item.channel}</strong>
                    <span>{item.reason ?? "适配器可用"}</span>
                  </div>
                  <span className={`status-pill ${item.availability}`}>
                    {item.availability}
                  </span>
                  <code>{item.capabilities.length} capabilities</code>
                </div>
              ))}
            </div>
            <div className="model-entity-list">
              {(channelBackends.data ?? []).map((backend) => (
                <div className="model-entity-row" key={backend.id}>
                  <div>
                    <strong>{backend.id}</strong>
                    <span>
                      {backend.implementation} · {backend.availability}
                    </span>
                  </div>
                  <code>{backend.version}</code>
                </div>
              ))}
            </div>
          </section>
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
                    <span>
                      {channel.channel} · {channel.status}
                    </span>
                  </div>
                  <code>{channel.config?.botOpenId ?? channel.accountId}</code>
                  <div className="row-actions">
                    {channel.channel === "lark" && (
                      <>
                        <span className="oauth-state">
                          用户授权：
                          {channel.config?.userOAuth?.status ?? "未授权"}
                          {channel.config?.userOAuth?.missingScopes?.length
                            ? ` · 缺少 ${channel.config.userOAuth.missingScopes.length} 项权限`
                            : ""}
                        </span>
                        <button
                          className="secondary"
                          onClick={() => authorize.mutate(channel.id)}
                          disabled={authorize.isPending}
                        >
                          <KeyRound size={16} />
                          {channel.config?.userOAuth ? "重新授权" : "用户授权"}
                        </button>
                        {channel.config?.userOAuth?.credentialRef && (
                          <button
                            className="icon-button"
                            title="刷新用户令牌"
                            onClick={() => refreshOAuth.mutate(channel.id)}
                            disabled={refreshOAuth.isPending}
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}
                      </>
                    )}
                    <button
                      className="icon-button"
                      title="检测通道"
                      onClick={() => probe.mutate(channel.id)}
                    >
                      <Activity size={16} />
                    </button>
                    <button
                      className="icon-button"
                      title="编辑通道"
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
                    </button>
                    <button
                      className="icon-button danger-button"
                      title="删除通道"
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
                    </button>
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
                高级配置
              </summary>
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
                  <button
                    className="secondary"
                    disabled={!bot.historyBackfillBeta || backfill.isPending}
                    title={
                      bot.historyBackfillBeta
                        ? "从各会话持久游标继续补处理历史消息"
                        : "请先启用历史补处理 Beta"
                    }
                    onClick={() => backfill.mutate(bot)}
                  >
                    <History size={16} />
                    补处理历史
                  </button>
                  <button
                    className="icon-button"
                    title="编辑"
                    onClick={() => {
                      setDraft({ ...empty, ...bot });
                      setEditingBotId(bot.id);
                      setEditorOpen(true);
                    }}
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    className="icon-button danger-button"
                    title={
                      bot.purpose === "system-assistant"
                        ? "系统助手不能删除"
                        : "删除机器人"
                    }
                    disabled={bot.purpose === "system-assistant"}
                    onClick={() => {
                      if (window.confirm(`确认删除机器人“${bot.name}”？`))
                        removeBot.mutate(bot);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
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
              Runtime
              <select
                value={draft.runtime}
                onChange={(e) =>
                  setDraft({ ...draft, runtime: e.target.value })
                }
              >
                <option value="model-tool-loop">Model Tool Loop</option>
                <option value="openai-agents">OpenAI Agents SDK</option>
                <option value="claude-code">Claude Agent SDK</option>
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
                高级配置
              </summary>
              <div className="advanced-grid">
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
            <button
              className="primary"
              disabled={!draft.id || !draft.name || save.isPending}
              onClick={() => save.mutate()}
            >
              <Bot size={16} />
              {editingBotId ? "保存修改" : "保存机器人"}
            </button>
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

function CapabilitiesPanel({ items }: { items: any[] }) {
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
  const [capabilityView, setCapabilityView] = useState<
    "list" | "import" | "create"
  >("list");
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
          onClick={() => setCapabilityView("list")}
        >
          能力清单
        </button>
        <button
          className={capabilityView === "import" ? "active" : ""}
          role="tab"
          aria-selected={capabilityView === "import"}
          onClick={() => setCapabilityView("import")}
        >
          导入与更新
        </button>
        <button
          className={capabilityView === "create" ? "active" : ""}
          role="tab"
          aria-selected={capabilityView === "create"}
          onClick={() => setCapabilityView("create")}
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
            {bindingEditorOpen
              ? binding.id
                ? "编辑能力授权"
                : "新增能力授权"
              : "能力清单"}
          </h3>
          {bindingEditorOpen ? (
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
          ) : (
            <div className="section-actions">
              <span>
                {items.length} 个能力 /{" "}
                {packages.data?.filter((item) => item.state !== "removed")
                  .length ?? 0}{" "}
                个包
              </span>
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
          )}
        </div>
        {!bindingEditorOpen && (
          <>
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
            <DataTable items={items} />
          </>
        )}
        {bindingEditorOpen && (
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
                高级配置
              </summary>
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
          </div>
        )}
        {!bindingEditorOpen && (
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
            <button
              className="primary"
              disabled={saveEdit.isPending}
              onClick={() => saveEdit.mutate()}
            >
              <Check size={16} />
              保存并使用编辑版
            </button>
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
          <button
            className="primary"
            disabled={!acl.resourceId || updateAcl.isPending}
            onClick={() => updateAcl.mutate()}
          >
            <ShieldCheck size={16} />
            保存授权
          </button>
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

function GenericPage({
  id,
  me,
  navigate,
}: {
  id: string;
  me: any;
  navigate: (page: string) => void;
}) {
  const pair = endpoint[id],
    query = useQuery({
      queryKey: [id],
      queryFn: () =>
        pair ? center<any[]>(pair[0], pair[1]) : Promise.resolve([]),
      enabled: !!pair,
    }),
    items = Array.isArray(query.data) ? query.data : [];
  if (id === "assistant") return <SystemAssistant navigate={navigate} />;
  if (id === "manual") return <Manual navigate={navigate} />;
  return (
    <>
      <Header
        title={nav.find((x) => x.id === id)?.label ?? id}
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
      {id === "models" ? (
        <ModelsPanel />
      ) : id === "bots" ? (
        <BotsPanel />
      ) : id === "channels" ? (
        <ChannelsPanel />
      ) : id === "context" ? (
        <ContextPanel />
      ) : id === "schedules" ? (
        <Schedules items={items} refetch={() => void query.refetch()} />
      ) : id === "browser" ? (
        <BrowserPanel />
      ) : id === "capabilities" ? (
        <CapabilitiesPanel items={items} />
      ) : id === "executions" ? (
        <ExecutionsPanel items={items} refetch={() => void query.refetch()} />
      ) : id === "governance" ? (
        <GovernancePanel approverId={me.user.id} />
      ) : id === "resources" ? (
        <ResourcesPanel items={items} />
      ) : id === "settings" ? (
        <SettingsPanel isAdmin={me.user.role === "admin"} />
      ) : id === "accounts" ? (
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
    setPage(id);
    location.hash = id;
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
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={page === id ? "active" : ""}
                  onClick={() => choose(id)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  <ChevronRight size={15} />
                </button>
              ))}
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
