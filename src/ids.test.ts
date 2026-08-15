import { describe, expect, it } from "vitest";
import { randomUuid } from "./ids.js";

describe("randomUuid", () => {
  it("uses the native secure-context implementation when available", () => {
    const expected = "123e4567-e89b-42d3-a456-426614174000" as `${string}-${string}-${string}-${string}-${string}`;
    expect(
      randomUuid({
        randomUUID: () => expected,
        getRandomValues: (value) => value,
      }),
    ).toBe(expected);
  });

  it("creates an RFC 4122 v4 identifier without randomUUID", () => {
    const value = randomUuid({
      getRandomValues: (array) => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(
          0xab,
        );
        return array;
      },
    });
    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
