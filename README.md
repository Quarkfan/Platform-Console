# QuarkfanTools Platform Console

The authenticated Dashboard includes a searchable in-product manual covering first-time setup, routine operations, troubleshooting, and security maintenance. Operators can jump directly from each guide to the relevant control-plane page.

Authenticated operations console and BFF for QuarkfanTools 3.0. It exposes center status, Bot operations, channels, context, models, capabilities, executions, schedules, resources, policies, audit and diagnostics without exposing internal center ports to browsers. Configuration pages use concise defaults with discoverable advanced sections for infrequent routing, scope, retry, adapter and security fields.

The navigation and list/detail interaction contract is documented in `docs/information-architecture.md`.

Authentication supports the production HTTPS origin and the operator's loopback SSH-tunnel origin without weakening public cookies. Loopback cookie handling is selected only for `127.0.0.1`, `localhost` and `::1`; all other hosts use the Secure production auth instance.

The “插件与扩展” page manages Runtime Providers, revisioned Runtime Profiles and the cross-center extension inventory. Provider detail pages expose capability negotiation, isolation, probe, lifecycle and logs. Lifecycle changes are admin-only in both UI and BFF authorization. The product meaning, center boundaries and safe lifecycle sequence are documented in [docs/plugin-control-plane.md](docs/plugin-control-plane.md).

Every operational page includes a compact page-guide trigger that opens a dismissible explanation of concepts, configuration sequence and resulting effects. Advanced sections state their applicable scenario and JSON/credential safety boundary. Model, capability and plugin management use secondary navigation. Lists keep one record per row with horizontal overflow and compact overflow actions; forms share stable control dimensions, and all mutations expose progress plus success or actionable error feedback.

All configuration submit actions live in a dedicated full-width footer after the last field; only peer actions such as cancel may share that row. Detectable entities—including model providers, channel accounts, Runtime Providers and platform extensions—show an explicit Chinese health state, the last real check time, probe latency when available and the latest error without synthesizing success.
