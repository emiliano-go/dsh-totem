// src/compaction/index.ts
import { BasicCompactionEngine as BasicCompactionEngine2 } from "@deepseek-ai/dsh-compaction-basic";

// src/compaction/engine.ts
import { BasicCompactionEngine } from "@deepseek-ai/dsh-compaction-basic";

// src/compaction/blocks.ts
import { createHash } from "node:crypto";
import { join as join2 } from "node:path";

// src/store.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
function dshHome() {
  return process.env.DSH_HOME ?? join(homedir(), ".dsh");
}
function stateDir() {
  return join(dshHome(), "totem");
}
function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

class JsonStore {
  path;
  initial;
  queue = Promise.resolve();
  constructor(path, initial) {
    this.path = path;
    this.initial = initial;
  }
  async read() {
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch {
      return clone(this.initial);
    }
  }
  async update(mutate) {
    const task = this.queue.then(async () => {
      const current = await this.read();
      const next = await mutate(current);
      await mkdir(dirname(this.path), { recursive: true });
      const temp = `${this.path}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temp, JSON.stringify(next, null, 2));
      await rename(temp, this.path);
      return next;
    });
    this.queue = task.then(() => {}, () => {});
    return task;
  }
}

// src/compaction/blocks.ts
function blockId(sessionId, compactionId) {
  return createHash("sha256").update(`${sessionId}\x00${compactionId}`).digest("hex").slice(0, 24);
}
function sessionFile(sessionId) {
  return `${createHash("sha256").update(sessionId).digest("hex").slice(0, 32)}.json`;
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function cleanBlock(value) {
  if (typeof value !== "object" || value === null)
    return;
  const block = value;
  if (typeof block.id !== "string" || typeof block.sessionId !== "string")
    return;
  if (typeof block.compactionId !== "string" || typeof block.summary !== "string")
    return;
  if (typeof block.provider !== "string" || typeof block.model !== "string")
    return;
  const tiers = finite(block.tier);
  const parents = Array.isArray(block.parentIds) ? block.parentIds.filter((parent) => typeof parent === "string") : [];
  return {
    id: block.id,
    sessionId: block.sessionId,
    compactionId: block.compactionId,
    summarySeq: finite(block.summarySeq),
    ...typeof block.replacementSeq === "number" ? { replacementSeq: block.replacementSeq } : {},
    startSeq: finite(block.startSeq),
    endSeq: finite(block.endSeq),
    shadowedSeqs: Array.isArray(block.shadowedSeqs) ? block.shadowedSeqs.filter((seq) => typeof seq === "number") : [],
    shadowedTokenCount: finite(block.shadowedTokenCount),
    summary: block.summary,
    tier: tiers > 0 ? tiers : 1,
    parentIds: parents,
    provider: block.provider,
    model: block.model,
    createdAt: typeof block.createdAt === "string" ? block.createdAt : new Date(0).toISOString()
  };
}

class ContextBlockStore {
  dir;
  stores = new Map;
  constructor(dir = join2(stateDir(), "compaction")) {
    this.dir = dir;
  }
  store(sessionId) {
    let store = this.stores.get(sessionId);
    if (store === undefined) {
      store = new JsonStore(join2(this.dir, sessionFile(sessionId)), []);
      this.stores.set(sessionId, store);
    }
    return store;
  }
  async read(sessionId) {
    const raw = await this.store(sessionId).read();
    return Array.isArray(raw) ? raw.flatMap((block) => {
      const cleaned = cleanBlock(block);
      return cleaned === undefined ? [] : [cleaned];
    }) : [];
  }
  async append(input) {
    const id = blockId(input.sessionId, input.compactionId);
    let result;
    await this.store(input.sessionId).update((blocks) => {
      const existing = blocks.find((block) => block.id === id);
      if (existing !== undefined) {
        result = existing;
        return blocks;
      }
      const shadowed = new Set(input.shadowedSeqs.map(Number));
      const parents = blocks.filter((block) => shadowed.has(block.summarySeq) || block.replacementSeq !== undefined && shadowed.has(block.replacementSeq));
      const block = {
        id,
        sessionId: input.sessionId,
        compactionId: input.compactionId,
        summarySeq: input.summarySeq,
        startSeq: input.startSeq,
        endSeq: input.endSeq,
        shadowedSeqs: [...shadowed].sort((a, b) => a - b),
        shadowedTokenCount: input.shadowedTokenCount,
        summary: input.summary,
        tier: parents.length === 0 ? 1 : Math.max(...parents.map((parent) => parent.tier)) + 1,
        parentIds: parents.map((parent) => parent.id),
        provider: input.provider,
        model: input.model,
        createdAt: new Date().toISOString()
      };
      result = block;
      return [...blocks, block];
    });
    if (result === undefined)
      throw new Error("totem: compact block was not persisted");
    return result;
  }
  async setReplacement(sessionId, compactionId, replacementSeq) {
    await this.store(sessionId).update((blocks) => {
      let changed = false;
      const next = blocks.map((block) => {
        if (block.compactionId !== compactionId || block.replacementSeq !== undefined)
          return block;
        changed = true;
        return { ...block, replacementSeq };
      });
      return changed ? next : blocks;
    });
  }
  async search(sessionId, query, limit = 5) {
    const needle = query.trim().toLowerCase();
    const blocks = await this.read(sessionId);
    const matches = needle.length === 0 ? blocks : blocks.filter((block) => block.summary.toLowerCase().includes(needle) || block.compactionId.toLowerCase().includes(needle) || block.id.toLowerCase().includes(needle));
    const bounded = Math.max(1, Math.min(50, Math.floor(limit)));
    return matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.summarySeq - a.summarySeq).slice(0, bounded);
  }
}

// src/distill.ts
import { BlockAssembler } from "@deepseek-ai/dsh-llm";
async function runOneShot(ctx, target, system, input, signal, sessionId, purpose = "totem-memory") {
  const deadline = AbortSignal.timeout(target.timeoutMs);
  const combined = signal === undefined ? deadline : AbortSignal.any([signal, deadline]);
  try {
    const assembler = new BlockAssembler;
    const options = {
      provider: target.provider,
      model: target.model,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: input }] }],
      maxTokens: target.maxTokens,
      purpose,
      ...sessionId === undefined ? {} : { sessionId },
      signal: combined
    };
    for await (const chunk of ctx.llm.stream(options))
      assembler.push(chunk);
    return assembler.blocks().filter((block) => block.type === "text").map((block) => block.text).join("");
  } catch {
    return;
  }
}

// src/compaction/summarize.ts
var SYSTEM = `You compress an engineering conversation for a coding agent that must continue the work after the older messages are removed.

Write one plain-text compact. Preserve, in this order:
1. The user's goal and every explicit constraint.
2. Decisions and why they were made.
3. Exact file paths, symbol names, commands, errors, versions, and values.
4. What was completed, what was verified, and what remains open.
5. Failed attempts and the lesson that makes them worth not repeating.

Omit greetings, restating the prompt, and generic advice. Do not invent facts. Do not use code fences or a preamble. Keep it dense and under 1,200 words.`;
function blockText(block) {
  if (typeof block !== "object" || block === null)
    return "";
  const record = block;
  switch (record.type) {
    case "text":
      return typeof record.text === "string" ? record.text : "";
    case "tool-call":
      return `Tool call ${String(record.name ?? "unknown")}(${typeof record.arguments === "string" ? record.arguments : JSON.stringify(record.arguments ?? {})})`;
    case "tool-result": {
      const content = Array.isArray(record.content) ? record.content.map(blockText).filter(Boolean).join(`
`) : typeof record.content === "string" ? record.content : "";
      return `Tool result:
${content}`;
    }
    case "reasoning":
      return "";
    default:
      return "";
  }
}
function messageText(message) {
  if (typeof message !== "object" || message === null)
    return "";
  const record = message;
  const role = typeof record.role === "string" ? record.role : "unknown";
  const content = Array.isArray(record.content) ? record.content.map(blockText).filter(Boolean).join(`
`) : typeof record.content === "string" ? record.content : "";
  if (content.trim().length === 0)
    return "";
  return `${role.toUpperCase()}:
${content}`;
}
function renderCompactionInput(input, maxBytes) {
  const tools = (input.tools ?? []).map((tool) => {
    const record = tool;
    return typeof record.name === "string" ? record.name : "";
  }).filter(Boolean);
  const header = tools.length === 0 ? "" : `Available tools: ${tools.join(", ")}

`;
  const body = input.messages.map(messageText).filter(Boolean).join(`

`);
  const text = `${header}${body}`;
  const limit = Math.max(1024, Math.floor(maxBytes));
  if (Buffer.byteLength(text, "utf8") <= limit)
    return text;
  return `${Buffer.from(text, "utf8").subarray(0, limit).toString("utf8")}

[transcript truncated at ${limit} bytes]`;
}
async function summarizeWithTotem(ctx, target, input, signal, sessionId, runner = runOneShot) {
  if (target === undefined)
    return;
  const transcript = renderCompactionInput(input, target.maxInputBytes);
  if (transcript.trim().length === 0)
    return;
  const text = await runner(ctx, target, SYSTEM, transcript, signal, sessionId, "totem-compact");
  const cleaned = text?.trim();
  return cleaned === undefined || cleaned.length === 0 ? undefined : cleaned;
}

// src/compaction/engine.ts
function textOf(blocks) {
  if (!Array.isArray(blocks))
    return "";
  return blocks.flatMap((block) => {
    if (typeof block !== "object" || block === null)
      return [];
    const record = block;
    return record.type === "text" && typeof record.text === "string" ? [record.text] : [];
  }).join(`
`);
}
function sessionIdOf(session) {
  return session?.id ? String(session.id) : "";
}

class TotemCompactionEngine extends BasicCompactionEngine {
  blocks;
  constructor(ctx, config) {
    super(ctx, config);
    this.blocks = new ContextBlockStore;
    ctx.on("session/event", (session, event) => {
      this.noteEvent(session, event);
    });
  }
  noteEvent(session, event) {
    if (typeof event !== "object" || event === null)
      return;
    const record = event;
    const sessionId = sessionIdOf(session);
    if (sessionId.length === 0)
      return;
    if (record.type === "compaction/summary") {
      const data = record.data;
      const summary = textOf(data?.summary);
      if (typeof data?.compactionId !== "string" || summary.length === 0)
        return;
      const shadowedSeqs = Array.isArray(data.shadowedSeqs) ? data.shadowedSeqs.filter((seq) => typeof seq === "number") : [];
      if (shadowedSeqs.length === 0)
        return;
      const start = typeof data.shadowedRange?.start === "number" ? data.shadowedRange.start : shadowedSeqs[0];
      const end = typeof data.shadowedRange?.end === "number" ? data.shadowedRange.end : shadowedSeqs[shadowedSeqs.length - 1];
      this.blocks.append({
        sessionId,
        compactionId: data.compactionId,
        summarySeq: typeof record.seq === "number" ? record.seq : 0,
        startSeq: start,
        endSeq: end,
        shadowedSeqs,
        shadowedTokenCount: typeof data.shadowedTokenCount === "number" ? data.shadowedTokenCount : 0,
        summary,
        provider: typeof data.provider === "string" ? data.provider : "unknown",
        model: typeof data.model === "string" ? data.model : "unknown"
      }).catch((error) => {
        this.ctx.logger?.warn(`dsh-totem: compact block was not archived: ${String(error)}`);
      });
      return;
    }
    if (record.type !== "user/message")
      return;
    const data = record.data;
    const source = data?.message?.source ?? data?.source;
    if (source?.kind !== "compact-checkpoint" || typeof source.compactionId !== "string")
      return;
    if (typeof record.seq !== "number")
      return;
    this.blocks.setReplacement(sessionId, source.compactionId, record.seq).catch(() => {});
  }
  async summarize(input, agent, signal) {
    if (signal?.aborted)
      throw signal.reason ?? new Error("compaction aborted");
    let totem;
    try {
      totem = this.ctx.get("totem");
    } catch {
      return super.summarize(input, agent, signal);
    }
    const target = totem?.compactionTarget();
    if (totem === undefined || target === undefined)
      return super.summarize(input, agent, signal);
    const sessionId = sessionIdOf(agent?.session);
    try {
      const text = await summarizeWithTotem(this.ctx, target, input, signal, sessionId.length === 0 ? undefined : sessionId);
      if (text === undefined) {
        if (signal?.aborted)
          throw signal.reason ?? new Error("compaction aborted");
        return super.summarize(input, agent, signal);
      }
      return {
        summary: [{ type: "text", text }],
        provider: target.provider,
        model: target.model,
        maxTokens: target.maxTokens,
        rawOutput: [{ type: "text", text }]
      };
    } catch (error) {
      if (signal?.aborted)
        throw error;
      this.ctx.logger?.warn(`dsh-totem: memory-agent compaction summary failed: ${String(error)}`);
      return super.summarize(input, agent, signal);
    }
  }
}

// src/compaction/tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
function text(value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}
function sessionIdOf2(agent) {
  const id = agent?.session?.id;
  return typeof id === "string" ? id : "";
}
function registerCompactionTools(ctx, blocks) {
  ctx.tools.register(defineTool({
    name: "compaction_search",
    description: "Search the compacts already produced in this session. Use when the live context no longer contains earlier decisions, paths, commands, or errors. Read-only; never restores the full old transcript.",
    parameters: {
      query: { type: "string", required: true, description: "Text to match against compact summaries, ids, and compaction ids." },
      limit: { type: "number", description: "Maximum compacts to return (default 5, max 50)." }
    },
    output: {
      schema: { type: "json" },
      render: (_args, value) => text(value)
    },
    async execute(args, exec) {
      const sessionId = sessionIdOf2(exec.agent);
      if (sessionId.length === 0) {
        return { sessionId: "", total: 0, blocks: [], error: "no active session" };
      }
      const limit = typeof args.limit === "number" ? args.limit : 5;
      const found = await blocks.search(sessionId, typeof args.query === "string" ? args.query : "", limit);
      return {
        sessionId,
        total: found.length,
        blocks: found.map((block) => ({
          id: block.id,
          compactionId: block.compactionId,
          tier: block.tier,
          parentIds: block.parentIds,
          summarySeq: block.summarySeq,
          replacementSeq: block.replacementSeq,
          startSeq: block.startSeq,
          endSeq: block.endSeq,
          shadowedTokenCount: block.shadowedTokenCount,
          provider: block.provider,
          model: block.model,
          createdAt: block.createdAt,
          summary: block.summary
        }))
      };
    }
  }));
}

// src/compaction/index.ts
var name = "totem-compaction";
var inject = [...BasicCompactionEngine2.inject, "totem", "tools"];
var Config = BasicCompactionEngine2.Config;
function apply(ctx, config) {
  const engine = new TotemCompactionEngine(ctx, config);
  registerCompactionTools(ctx, engine.blocks);
}
export {
  Config,
  apply,
  inject,
  name
};

//# debugId=560EFAF82E92F6BF64756E2164756E21
//# sourceMappingURL=index.js.map
