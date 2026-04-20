import { describe, expect, it, vi } from "vitest";
import { compressToolMessages } from "../../sccs/compressor.js";
import {
  isStandardToolResultContent,
} from "../../sccs/utils.js";

import { describe, expect, it, vi } from "vitest";
import { compressToolMessages } from "../../sccs/compressor.js";
import {
  isStandardToolResultContent,
  extractTextContent,
  setTextContent,
} from "../../sccs/utils.js";

describe("SCCS Compressor - isStandardToolResultContent", () => {
  it("accepts array with single text block", () => {
    const content = [{ type: "text", text: "Tool output" }];
    expect(isStandardToolResultContent(content)).toBe(true);
  });

  it("accepts array with multiple text blocks", () => {
    const content = [
      { type: "text", text: "First part" },
      { type: "text", text: "Second part" }
    ];
    expect(isStandardToolResultContent(content)).toBe(true);
  });

  it("rejects null content", () => {
    expect(isStandardToolResultContent(null)).toBe(false);
    expect(isStandardToolResultContent(undefined)).toBe(false);
  });

  it("rejects empty array", () => {
    expect(isStandardToolResultContent([])).toBe(false);
  });

  it("rejects object content", () => {
    const content = { text: "Not an array" };
    expect(isStandardToolResultContent(content)).toBe(false);
  });

  it("rejects non-array non-string content", () => {
    expect(isStandardToolResultContent(123)).toBe(false);
    expect(isStandardToolResultContent(true)).toBe(false);
  });

  it("rejects string content", () => {
    const content = "Plain text content";
    expect(isStandardToolResultContent(content)).toBe(false);
  });

  it("rejects array with image_url blocks", () => {
    const content = [
      { type: "text", text: "Analysis" },
      { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
    ];
    expect(isStandardToolResultContent(content)).toBe(false);
  });

  it("rejects array with audio blocks", () => {
    const content = [
      { type: "audio", audio: { url: "https://example.com/audio.mp3" } }
    ];
    expect(isStandardToolResultContent(content)).toBe(false);
  });

  it("rejects array with blocks missing type field", () => {
    const content = [
      { text: "Missing type field" }
    ];
    expect(isStandardToolResultContent(content)).toBe(false);
  });

  it("rejects array with blocks having type: undefined", () => {
    const content = [
      { type: undefined, text: "Undefined type" }
    ];
    expect(isStandardToolResultContent(content)).toBe(false);
  });

  it("rejects array with blocks having non-text type but missing text field", () => {
    const content = [
      { type: "image_url" }  // type is not "text", no text field
    ];
    expect(isStandardToolResultContent(content)).toBe(false);
  });

  it("rejects array with non-object blocks", () => {
    const content = [
      "string instead of object",
      123
    ];
    expect(isStandardToolResultContent(content)).toBe(false);
  });
});

describe("SCCS Compressor - setTextContent and extractTextContent", () => {
  it("setTextContent replaces string content with text block array", () => {
    const msg = { role: "tool", content: "original text" };
    const result = setTextContent(msg, "compressed");
    expect(result.content).toEqual([{ type: "text", text: "compressed" }]);
  });

  it("setTextContent replaces first text block in array content", () => {
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

  it("extractTextContent extracts text from standard format", () => {
    const content = [{ type: "text", text: "Tool output" }];
    const extracted = extractTextContent(content);
    expect(extracted).toBe("Tool output");
  });

  it("extractTextContent handles string format", () => {
    const content = "Plain text content";
    const extracted = extractTextContent(content);
    expect(extracted).toBe("Plain text content");
  });

  it("extractTextContent handles multiple text blocks", () => {
    const content = [
      { type: "text", text: "First part" },
      { type: "text", text: "Second part" }
    ];
    const extracted = extractTextContent(content);
    expect(extracted).toBe("First part\nSecond part");
  });
});

describe("SCCS Compressor - compressToolMessages", () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
  };

  const mockStore = {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const config = {
    compressThreshold: 100,
    summaryMaxChars: 50,
    enableSmartSummary: false,
    storageTtlSeconds: 86400,
  };

  it("compresses standard tool result messages", async () => {
    const messages = [
      { role: "user", content: "User message" },
      { role: "toolResult", content: [{ type: "text", text: "a".repeat(200) }] },
      { role: "assistant", content: "Assistant message" },
    ];

    const result = await compressToolMessages({
      messages,
      config,
      store: mockStore,
      logger: mockLogger,
    });

    expect(result.compressedCount).toBe(1);
    expect(mockStore.set).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("[sccs] compressed tool output")
    );
  });

  it("skips compression for messages with non-standard content structure", async () => {
    const messages = [
      { role: "toolResult", content: [{ text: "Missing type field" }] },
    ];

    const result = await compressToolMessages({
      messages,
      config,
      store: mockStore,
      logger: mockLogger,
    });

    expect(result.compressedCount).toBe(0);
    expect(mockStore.set).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[sccs] skipped tool message #0: unexpected content structure"
    );
  });

  it("skips compression for messages with image_url content", async () => {
    const messages = [
      {
        role: "toolResult",
        content: [
          { type: "text", text: "Analysis" },
          { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
        ]
      },
    ];

    const result = await compressToolMessages({
      messages,
      config,
      store: mockStore,
      logger: mockLogger,
    });

    expect(result.compressedCount).toBe(0);
    expect(mockStore.set).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[sccs] skipped tool message #0: unexpected content structure"
    );
  });

  it("skips compression for string content (valid but not compressed due to length)", async () => {
    const messages = [
      { role: "toolResult", content: "Short text" },
    ];

    const result = await compressToolMessages({
      messages,
      config,
      store: mockStore,
      logger: mockLogger,
    });

    // String content is valid but too short to compress
    expect(result.compressedCount).toBe(0);
  });

  it("skips compression for object content (non-standard)", async () => {
    const messages = [
      { role: "toolResult", content: { text: "Not an array" } },
    ];

    const result = await compressToolMessages({
      messages,
      config,
      store: mockStore,
      logger: mockLogger,
    });

    expect(result.compressedCount).toBe(0);
    expect(mockStore.set).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[sccs] skipped tool message #0: unexpected content structure"
    );
  });

  it("compresses multiple standard messages, skips non-standard ones", async () => {
    const messages = [
      { role: "toolResult", content: [{ type: "text", text: "a".repeat(200) }] },  // should compress
      { role: "toolResult", content: [{ text: "Missing type" }] },  // should skip (non-standard)
      { role: "toolResult", content: [{ type: "text", text: "b".repeat(200) }] },  // should compress
      { role: "toolResult", content: [] },  // should skip (empty array)
    ];

    const result = await compressToolMessages({
      messages,
      config,
      store: mockStore,
      logger: mockLogger,
    });

    expect(result.compressedCount).toBe(2);
    expect(mockStore.set).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenCalledTimes(3);  // 3 non-standard messages
  });
});
