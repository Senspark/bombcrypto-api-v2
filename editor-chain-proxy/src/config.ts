import { cleanEnv, port, str } from "envalid";

export const config = cleanEnv(process.env, {
  PORT: port({ default: 8555 }),
  // Bind address. Default is loopback-only (guardrail: a bare `npm start` must
  // never be reachable off the dev machine). Under Docker set HOST=0.0.0.0 so the
  // forwarded port reaches the process, and publish the port to 127.0.0.1 ONLY
  // (see compose.yaml) — host-side exposure stays loopback-only either way.
  HOST: str({ default: "127.0.0.1" }),
});
