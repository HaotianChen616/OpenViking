import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { resolve } from "node:path";

type ContentBlock = { type?: unknown; text?: unknown };
type MessageLike = { role?: unknown; content?: unknown };
const REF_ID_RE = /\[REF_ID: ([a-f0-9]{32})\]/i;
/** Strict MD5 hex pattern — only 32 hex chars (case-insensitive) allowed as refId */
const STRICT_REF_ID_RE = /^[a-f0-9]{32}$/i;

export function md5Hex(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

export function hasRefId(text: string): boolean {
  return REF_ID_RE.test(text);
}

/**
 * Extract and validate a refId from a string.
 * - If the string matches [REF_ID: <hash>], extract the hash.
 * - Otherwise, treat the trimmed string as a raw refId.
 * - Returns null if the result is not a valid 32-char hex MD5 hash.
 * - Returned value is always lowercase for consistent file naming.
 */
export function normalizeRefId(value: string): string | null {
  const match = value.match(REF_ID_RE);
  const candidate = match ? match[1] : value.trim();
  return STRICT_REF_ID_RE.test(candidate) ? candidate.toLowerCase() : null;
}

export function resolveHomePath(pathValue: string): string {
  if (!pathValue) {
    return pathValue;
  }
  return pathValue.startsWith("~/")
    ? resolve(homedir(), pathValue.slice(2))
    : resolve(pathValue);
}

export function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((block: ContentBlock) =>
        block && typeof block === "object" && typeof block.text === "string" ? block.text : "",
      )
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object") {
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }
  return "";
}

/**
 * Replace text content in a message while preserving non-text content blocks (e.g. images).
 * - If content is a string, replace it with [{ type: "text", text }].
 * - If content is an array of ContentBlocks, replace the first text block and keep others.
 *   If no text block exists, prepend one.
 * - If content is an object or other, replace it with [{ type: "text", text }].
 */
export function setTextContent(message: MessageLike, text: string): MessageLike {
  const content = message.content;
  // String content — simple replacement
  if (typeof content === "string") {
    return { ...message, content: [{ type: "text", text }] };
  }
  // Array content — preserve non-text blocks, replace/add text block
  if (Array.isArray(content)) {
    let replaced = false;
    const updated = content.map((block: ContentBlock) => {
      if (!replaced && block && typeof block === "object" && block.type === "text") {
        replaced = true;
        return { ...block, text };
      }
      return block;
    });
    if (!replaced) {
      // No existing text block found — prepend one
      updated.unshift({ type: "text", text });
    }
    return { ...message, content: updated };
  }
  // Fallback (object or other)
  return { ...message, content: [{ type: "text", text }] };
}

export function isToolRole(role: unknown): boolean {
  return role === "tool" || role === "toolResult" || role === "tool_result";
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateTokensForMessages(messages: MessageLike[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(extractTextContent(msg.content)), 0);
}
