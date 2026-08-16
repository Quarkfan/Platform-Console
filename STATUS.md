# Platform Console Status

The Dashboard now includes a permanent searchable usage-manual page and a complete Provider -> model deployment -> routing policy setup path, so a new operator can finish first-run configuration without using raw APIs.

Version `0.1.0` is deployed. Better Auth accounts, roles, same-origin protected BFF, forced initial password change, all center management pages, local Bot chat, schedules, logs, diagnostics, Browser UI and read-only system assistant are implemented. Overview probes liveness, readiness and version independently; diagnostics collect only bounded, redacted operational metadata. Internal HTTP deployments use a Web Crypto UUID fallback and no longer require a secure context to render the Capability page. Fifteen tests pass, and all fifteen pages pass desktop/mobile layout acceptance.
