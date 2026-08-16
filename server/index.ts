import { join } from "node:path";
import { prepareAuth } from "./auth.js";
import { buildServer } from "./app.js";
import { requireInternalServiceToken } from "./config.js";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (
  !process.env.BETTER_AUTH_SECRET ||
  process.env.BETTER_AUTH_SECRET.length < 32
)
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
const { auth, loopbackAuth, passwordChangeRequired, markPasswordChanged } =
  await prepareAuth(databaseUrl);
await buildServer({
  auth,
  loopbackAuth,
  internalToken: requireInternalServiceToken(),
  staticRoot: join(process.cwd(), "dist"),
  larkOAuthRedirectBaseUrl:
    process.env.LARK_OAUTH_REDIRECT_BASE_URL ?? process.env.BETTER_AUTH_URL,
  passwordChangeRequired,
  markPasswordChanged,
}).listen({
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 8080),
});
