import { describe, expect, it } from "vitest";
import { navGroups, pageGuides } from "./App";

describe("console information architecture", () => {
  it("provides page guidance for every primary navigation page", () => {
    const pages = navGroups.flatMap((group) => group.items);
    expect(pages.map((page) => page.id).sort()).toEqual(
      Object.keys(pageGuides).sort(),
    );
    for (const page of pages) {
      const guide = pageGuides[page.id];
      expect(guide.intro.length).toBeGreaterThan(10);
      expect(guide.concepts.length).toBeGreaterThan(0);
      expect(guide.configure.length).toBeGreaterThan(0);
      expect(guide.effects.length).toBeGreaterThan(0);
    }
  });

  it("keeps secondary navigation identifiers unique within each page", () => {
    for (const page of navGroups.flatMap((group) => group.items)) {
      const ids = page.children?.map((child) => child.id) ?? [];
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
