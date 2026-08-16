# Plugin Control Plane

## Product meaning

QuarkfanTools follows **Everything extensible is a plugin** at extension boundaries. This does not mean every business record is shown as a plugin, and it does not move center-owned configuration into the Console. It means replaceable implementations register behind stable contracts and can be discovered, probed, composed, upgraded and isolated without changing consumers.

The shared model is:

1. **Definition** describes a stable extension point and contract.
2. **Provider** is one installed implementation of that contract.
3. **Binding/Profile** selects and configures Providers for a tenant, Bot or runtime path.
4. **Consumer** depends on the contract and a resolved snapshot, not implementation code.

Cordis supplies the trusted in-process composition kernel for Runtime Center. Other centers may use process, worker or service isolation while exposing the same management contract. A plugin mechanism is not a security sandbox by itself.

## Console locations

The left navigation exposes **插件与扩展** with three secondary views:

| View       | What it manages                                                                | Typical operation                                                                     |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 运行时插件 | Runtime Provider implementations                                               | inspect contract, probe, view logs, change lifecycle                                  |
| 运行方案   | Revisioned Runtime Profiles                                                    | combine runtime, model policy, context, capability, governance and fallback Providers |
| 平台插件   | Provider inventory owned by MG, CH, MH, CR, Scheduler, Resource and Governance | inspect generation, isolation, capability and center-owned lifecycle                  |

Center business pages remain separate:

- **模型** manages service providers, concrete model deployments and routing policies.
- **能力** manages installable capability packages, capabilities and Bot authorization.
- **通道** manages configured channel accounts and routes. Internal SDK/backend registrations are intentionally absent.

This separation keeps plugin infrastructure visible without making users edit low-level registry records as if they were business entities.

## Lifecycle language

| State/action   | User meaning                                                         |
| -------------- | -------------------------------------------------------------------- |
| 验证           | Check contract and readiness before use                              |
| 启用           | Make the Provider eligible for new resolution                        |
| 灰度           | Allow controlled canary selection                                    |
| 停止接收新任务 | Enter `draining`; existing work may finish, new work is not assigned |
| 停用           | Remove the Provider from active selection                            |
| 重新验证       | Recheck a disabled or failed Provider before reuse                   |

The UI uses “停止接收新任务” instead of the internal word “排空”. Lifecycle mutation remains administrator-only and is enforced again by the Console BFF.

## Safe operating sequence

1. Open a Provider detail and inspect its contract, isolation mode and latest probe.
2. Run a probe before first use or after an upgrade.
3. Create or revise a Runtime Profile rather than hard-coding Provider IDs in consumers.
4. When replacing an active Provider, stop assigning new work, wait for existing work to finish, then disable it.
5. Keep a verified fallback in critical profiles and inspect lifecycle logs after every change.

The Console shows a global progress indicator for mutations and a durable success/error notice. Unsupported operations explain why they cannot run instead of silently doing nothing.
