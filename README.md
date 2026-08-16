# QuarkfanTools Platform Console

The authenticated Dashboard includes a searchable in-product manual covering first-time setup, routine operations, troubleshooting, and security maintenance. Operators can jump directly from each guide to the relevant control-plane page.

Authenticated operations console and BFF for QuarkfanTools 3.0. It exposes center status, Bot operations, channels, context, models, capabilities, executions, schedules, resources, policies, audit and diagnostics without exposing internal center ports to browsers. Configuration pages use concise defaults with discoverable advanced sections for infrequent routing, scope, retry, adapter and security fields.

The navigation and list/detail interaction contract is documented in `docs/information-architecture.md`.

The “扩展与插件” page manages Runtime Providers, revisioned Runtime Profiles and the cross-center extension inventory. Provider detail pages expose capability negotiation, isolation, probe, lifecycle and logs. Lifecycle changes are admin-only in both UI and BFF authorization.
