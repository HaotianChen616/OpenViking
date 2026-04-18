import { describe, expect, it } from "vitest";

import { setTextContent, extractTextContent } from "../../sccs/utils.js";

describe("setTextContent", () => {
  it("replaces string content with text block array", () => {
    const msg = { role: "tool", content: "original text" };
    const result = setTextContent(msg, "compressed");
    expect(result.content).toEqual([{ type: "text", text: "compressed" }]);
  });

  it("replaces first text block in array content, preserving other blocks", () => {
    const msg = {
      role: "toolResult",
      content: [
        { type: "text", text: "original text" },
        { type: "image", source: { data: "base64..." } },
      ],
    };
    const result = setTextContent(msg, "compressed");
    expect(result.content).toEqual([
      { type: "text", text: "compressed" },
      { type: "image", source: { data: "base64..." } },
    ]);
  });

  it("preserves image block when it appears before text block", () => {
    const msg = {
      role: "toolResult",
      content: [
        { type: "image", source: { data: "base64..." } },
        { type: "text", text: "original text" },
      ],
    };
    const result = setTextContent(msg, "compressed");
    expect(result.content).toEqual([
      { type: "image", source: { data: "base64..." } },
      { type: "text", text: "compressed" },
    ]);
  });

  it("prepends text block when array has no existing text block", () => {
    const msg = {
      role: "toolResult",
      content: [
        { type: "image", source: { data: "screenshot.png" } },
      ],
    };
    const result = setTextContent(msg, "added text");
    expect(result.content).toEqual([
      { type: "text", text: "added text" },
      { type: "image", source: { data: "screenshot.png" } },
    ]);
  });

  it("preserves multiple non-text blocks", () => {
    const msg = {
      role: "toolResult",
      content: [
        { type: "text", text: "original" },
        { type: "image", source: { data: "img1" } },
        { type: "image", source: { data: "img2" } },
      ],
    };
    const result = setTextContent(msg, "replaced");
    expect(result.content).toHaveLength(3);
    expect(result.content[0]).toEqual({ type: "text", text: "replaced" });
    expect(result.content[1]).toEqual({ type: "image", source: { data: "img1" } });
    expect(result.content[2]).toEqual({ type: "image", source: { data: "img2" } });
  });

  it("replaces only the first text block when multiple exist", () => {
    const msg = {
      role: "toolResult",
      content: [
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ],
    };
    const result = setTextContent(msg, "replaced");
    expect(result.content).toEqual([
      { type: "text", text: "replaced" },
      { type: "text", text: "second" },
    ]);
  });

  it("preserves other message properties", () => {
    const msg = { role: "tool", content: "text", toolUseId: "abc123" };
    const result = setTextContent(msg, "compressed");
    expect(result.role).toBe("tool");
    expect(result.toolUseId).toBe("abc123");
    expect(result.content).toEqual([{ type: "text", text: "compressed" }]);
  });

  it("handles undefined content", () => {
    const msg = { role: "tool" };
    const result = setTextContent(msg, "fallback");
    // undefined content falls through to the fallback path
    expect(result.content).toEqual([{ type: "text", text: "fallback" }]);
  });
});

describe("extractTextContent + setTextContent round-trip", () => {
  it("extractTextContent reads the replaced text from setTextContent result", () => {
    const msg = {
      role: "toolResult",
      content: [
        { type: "image", source: { data: "img" } },
        { type: "text", text: "original" },
      ],
    };
    const replaced = setTextContent(msg, "[REF_ID: abc123] (Summary: ...)");
    expect(extractTextContent(replaced.content)).toBe("[REF_ID: abc123] (Summary: ...)");
  });
});
