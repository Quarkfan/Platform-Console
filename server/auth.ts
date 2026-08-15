import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
export function createAuth(pool: Pool, allowSignup = false) {
  const secureCookies =
    process.env.AUTH_SECURE_COOKIES === undefined
      ? process.env.NODE_ENV === "production"
      : process.env.AUTH_SECURE_COOKIES === "true";
  return betterAuth({
    appName: "QuarkfanTools",
    database: pool,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: (
      process.env.TRUSTED_ORIGINS ??
      process.env.BETTER_AUTH_URL ??
      ""
    )
      .split(",")
      .filter(Boolean),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignup,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    plugins: [
      username({ minUsernameLength: 3, maxUsernameLength: 50 }),
      admin({ defaultRole: "viewer", adminRoles: ["admin"] }),
    ],
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 30 },
    advanced: { useSecureCookies: secureCookies },
  });
}
export async function prepareAuth(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.delete("options");
  const setup = new Pool({ connectionString: parsed.toString() });
  await setup.query("CREATE SCHEMA IF NOT EXISTS auth");
  await setup.end();
  const pool = new Pool({
    connectionString: parsed.toString(),
    options: "-c search_path=auth",
    max: 10,
  });
  const bootstrapAuth = createAuth(pool, true);
  await (await getMigrations(bootstrapAuth.options)).runMigrations();
  const securityTableExisted = Boolean(
    (await pool.query("SELECT to_regclass('auth.qft_user_security') AS name"))
      .rows[0]?.name,
  );
  await pool.query(
    'CREATE TABLE IF NOT EXISTS qft_user_security(user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,must_change_password boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now())',
  );
  const count = Number(
    (await pool.query('SELECT count(*) FROM "user"')).rows[0].count,
  );
  if (count === 0) {
    const usernameValue = process.env.INITIAL_ADMIN_USERNAME;
    const email = process.env.INITIAL_ADMIN_EMAIL;
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    if (!usernameValue || !email || !password || password.length < 12)
      throw new Error(
        "Empty auth database requires INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_EMAIL and a 12+ character INITIAL_ADMIN_PASSWORD",
      );
    const result = await bootstrapAuth.api.signUpEmail({
      body: {
        username: usernameValue,
        displayUsername: usernameValue,
        email,
        password,
        name: usernameValue,
      },
    });
    await pool.query('UPDATE "user" SET role=$1 WHERE id=$2', [
      "admin",
      result.user.id,
    ]);
    await pool.query(
      "INSERT INTO qft_user_security(user_id,must_change_password) VALUES($1,true)",
      [result.user.id],
    );
  } else if (!securityTableExisted) {
    await pool.query(
      'INSERT INTO qft_user_security(user_id,must_change_password) SELECT id,true FROM "user" WHERE role=$1 ON CONFLICT(user_id) DO NOTHING',
      ["admin"],
    );
  }
  return {
    auth: createAuth(pool, false),
    pool,
    async passwordChangeRequired(userId: string) {
      return Boolean(
        (
          await pool.query(
            "SELECT must_change_password FROM qft_user_security WHERE user_id=$1",
            [userId],
          )
        ).rows[0]?.must_change_password,
      );
    },
    async markPasswordChanged(userId: string) {
      await pool.query(
        "INSERT INTO qft_user_security(user_id,must_change_password,updated_at) VALUES($1,false,now()) ON CONFLICT(user_id) DO UPDATE SET must_change_password=false,updated_at=now()",
        [userId],
      );
    },
  };
}
export type ConsoleAuth = ReturnType<typeof createAuth>;
