import { describe, expect, it } from "vitest";
import {
  assertCenterPath,
  assertConsoleProxyPath,
  isCenter,
} from "./centers.js";
describe("Console BFF boundary", () => {
  it("only accepts registered centers", () => {
    expect(isCenter("runtime")).toBe(true);
    expect(isCenter("metadata")).toBe(false);
  });
  it("blocks arbitrary upstream paths", () => {
    expect(assertCenterPath("/v1/tasks")).toBe("/v1/tasks");
    expect(assertCenterPath("/healthz")).toBe("/healthz");
    expect(() => assertCenterPath("/admin/raw-sql")).toThrow("not allowed");
    expect(() => assertCenterPath("//evil.test/v1")).toThrow("not allowed");
  });
  it("never exposes plaintext credential resolution to the browser", () => {
    expect(assertConsoleProxyPath("governance", "/v1/credentials")).toBe(
      "/v1/credentials",
    );
    expect(() =>
      assertConsoleProxyPath(
        "governance",
        "/v1/credentials/credential-1/resolve",
      ),
    ).toThrow("not exposed");
    expect(
      assertConsoleProxyPath("runtime", "/v1/credentials/id/resolve"),
    ).toBe("/v1/credentials/id/resolve");
  });
  it("keeps identity-bound Lark OAuth off the generic center proxy", () => {
    expect(() =>
      assertConsoleProxyPath(
        "mg",
        "/v1/channels/00000000-0000-4000-8000-000000000001/oauth/lark/start",
      ),
    ).toThrow("identity-bound");
    expect(() =>
      assertConsoleProxyPath("mg", "/v1/oauth/lark/callback"),
    ).toThrow("identity-bound");
  });
});
