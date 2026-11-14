// src/tool-fs/index.ts
import z from "@deepseek-ai/schemastery";

// src/tool-fs/read.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/tool-fs/read-render.ts
import { FsError } from "@deepseek-ai/dsh-fs";
import { readLangHintForPath } from "@deepseek-ai/dsh-util-code-language";
var READ_MAX_LINE_LENGTH = 2000;
var READ_MAX_BYTES = 50 * 1024;
function newAccumulator() {
  return { lines: [], totalLines: 0, outputBytes: 0, truncatedByBytes: false };
}
function truncateLine(line, maxLineLength) {
  return line.length > maxLineLength ? `${line.substring(0, maxLineLength)}... (line truncated to ${maxLineLength} chars)` : line;
}
function lineByteSize(line, currentLineCount) {
  return Buffer.byteLength(line, "utf8") + (currentLineCount > 0 ? 1 : 0);
}
function consumeLine(acc, rawLine, request) {
  acc.totalLines += 1;
  if (acc.truncatedByBytes || acc.totalLines < request.offset || acc.lines.length >= request.limit)
    return;
  const text = truncateLine(rawLine, request.maxLineLength);
  const bytes = lineByteSize(text, acc.lines.length);
  if (acc.outputBytes + bytes > request.maxBytes) {
    acc.truncatedByBytes = true;
    return;
  }
  acc.outputBytes += bytes;
  acc.lines.push({ number: acc.totalLines, text });
}
function stripCarriageReturn(line) {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}
function finish(acc, request, displayPath) {
  if (!acc.truncatedByBytes && request.offset > acc.totalLines && !(acc.totalLines === 0 && request.offset === 1)) {
    throw new FsError(`offset ${request.offset} is out of range for "${displayPath}" (${acc.totalLines} lines)`, "FS_NOT_FOUND");
  }
  return { lines: acc.lines, totalLines: acc.totalLines, truncatedByBytes: acc.truncatedByBytes };
}
async function buildWindow(chunks, request, displayPath) {
  const acc = newAccumulator();
  const lineBufferCap = request.maxLineLength + 1;
  let lineBuffer = "";
  function appendToLineBuffer(segment) {
    if (lineBuffer.length >= lineBufferCap)
      return;
    lineBuffer += segment;
    if (lineBuffer.length > lineBufferCap)
      lineBuffer = lineBuffer.slice(0, lineBufferCap);
  }
  function flushLine() {
    consumeLine(acc, stripCarriageReturn(lineBuffer), request);
    lineBuffer = "";
  }
  for await (const chunk of chunks) {
    let startPos = 0;
    let newlinePos;
    while ((newlinePos = chunk.indexOf(`
`, startPos)) !== -1) {
      appendToLineBuffer(chunk.slice(startPos, newlinePos));
      flushLine();
      startPos = newlinePos + 1;
    }
    appendToLineBuffer(chunk.slice(startPos));
  }
  if (lineBuffer.length > 0)
    flushLine();
  return finish(acc, request, displayPath);
}
function formatReadOutput(displayPath, outcome) {
  const endLine = outcome.lines.at(-1)?.number ?? Math.max(0, outcome.offset - 1);
  let footer;
  if (outcome.truncatedByBytes) {
    footer = `(Output capped. Showing lines ${outcome.offset}-${endLine}. Use offset=${endLine + 1} to continue.)`;
  } else if (endLine < outcome.totalLines) {
    footer = `(Showing lines ${outcome.offset}-${endLine} of ${outcome.totalLines}. Use offset=${endLine + 1} to continue.)`;
  } else {
    footer = `(End of file - total ${outcome.totalLines} lines)`;
  }
  const body = outcome.lines.length > 0 ? `${outcome.lines.map((line) => `${line.number}: ${line.text}`).join(`
`)}

${footer}` : footer;
  return `<path>${displayPath}</path>
<type>file</type>
<content>
${body}
</content>`;
}
function isFileTextLine(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const { number, text } = value;
  return typeof number === "number" && Number.isInteger(number) && number >= 1 && typeof text === "string";
}
function readMetaFromMeta(meta) {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta))
    return;
  const { path, offset, lines, totalLines, lang } = meta;
  if (typeof path !== "string" || typeof totalLines !== "number" || typeof offset !== "number")
    return;
  if (!Number.isInteger(offset) || offset < 1)
    return;
  if (!Number.isInteger(totalLines) || totalLines < 0)
    return;
  if (!Array.isArray(lines) || !lines.every(isFileTextLine))
    return;
  if (lang !== undefined && typeof lang !== "string")
    return;
  let previous = offset - 1;
  for (const { number } of lines) {
    if (number <= previous || number > totalLines)
      return;
    previous = number;
  }
  return { path, offset, lines, totalLines, ...lang === undefined ? {} : { lang } };
}

// src/tool-fs/read-target.ts
import { FsError as FsError2 } from "@deepseek-ai/dsh-fs";

// src/tool-fs/session-cwd.ts
async function sessionResolveOptions(ctx, exec) {
  const cwd = exec.agent === undefined ? undefined : await ctx.workingDirectory.ensure(exec.agent, exec.signal);
  return { ...cwd !== undefined ? { cwd } : {}, signal: exec.signal };
}

// src/tool-fs/read-target.ts
async function resolveRegularReadTarget(ctx, exec, requestedPath) {
  const target = await ctx.fs.resolve(requestedPath, await sessionResolveOptions(ctx, exec));
  const info = await ctx.fs.stat(target, exec.signal);
  if (info === undefined) {
    ctx.emit("fs/observed", target, { kind: "absent" }, exec);
    throw new FsError2(`cannot read "${target.displayPath}": not found`, "FS_NOT_FOUND");
  }
  if (info.type !== "file") {
    throw new FsError2(`cannot read "${target.displayPath}": not a regular file`, "FS_NOT_REGULAR_FILE");
  }
  return { target, info };
}

// src/tool-fs/read.ts
var READ_LIMIT = 2000;
var STREAM_MIN_SIZE = 10 * 1024 * 1024;
function parsePositiveInteger(value, name) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}
function parseReadArgs(args, maxLimit) {
  if (args.file_path.trim().length === 0)
    throw new Error("file_path must be a non-empty string");
  const offset = args.offset === undefined ? 1 : parsePositiveInteger(args.offset, "offset");
  const limit = args.limit === undefined ? maxLimit : parsePositiveInteger(args.limit, "limit");
  if (limit > maxLimit)
    throw new Error(`limit must be less than or equal to ${maxLimit}`);
  return { filePath: args.file_path, offset, limit };
}
function applyReadTool(ctx, caps) {
  ctx.systemPrompt.section({
    name: "tool:read",
    order: ctx.systemPrompt.getSectionOrder("TOOL_READ"),
    text: ({ scope }) => ctx.tools.get("read", scope) === undefined ? "" : "Use the read tool — not shell commands like cat — to inspect text files. Use offset and limit to continue reading large files."
  });
  ctx.tools.register(defineTool({
    name: "read",
    description: "Read a UTF-8 text file and return line-numbered content.",
    parameters: {
      file_path: { type: "string", required: true, description: "Path to read, resolved by the filesystem backend." },
      offset: { type: "number", description: "1-based first line to return. Defaults to 1." },
      limit: { type: "number", description: `Maximum number of lines to return. Defaults to ${caps.limit}.` },
      memory: {
        type: "object",
        additionalProperties: false,
        required: true,
        description: "REQUIRED. Mark this read for Totem memory registration; the secondary memory model writes the durable text.",
        properties: {
          kind: { type: "string", required: true, enum: ["register"], description: 'Use "register".' },
          symbol: { type: "string", description: "Optional symbol this read is about." }
        }
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", required: true, description: "Canonical absolute path in the filesystem execution world." },
          offset: { type: "integer", required: true },
          lines: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                number: { type: "integer", required: true },
                text: { type: "string", required: true }
              }
            }
          },
          totalLines: { type: "integer", required: true }
        }
      },
      render: (args, value) => {
        const input = parseReadArgs(args, caps.limit);
        const endLine = value.lines.at(-1)?.number ?? Math.max(0, value.offset - 1);
        const truncatedByBytes = value.lines.length < input.limit && endLine < value.totalLines;
        return [{
          type: "text",
          text: formatReadOutput(value.path, {
            offset: value.offset,
            lines: value.lines,
            totalLines: value.totalLines,
            ...truncatedByBytes ? { truncatedByBytes: true } : {}
          })
        }];
      },
      presentationMeta: (_args, value) => {
        const lang = readLangHintForPath(value.path);
        return {
          path: value.path,
          offset: value.offset,
          lines: value.lines.map(({ number, text }) => ({ number, text })),
          totalLines: value.totalLines,
          ...lang === undefined ? {} : { lang }
        };
      }
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const memory = args.memory;
      if (memory?.kind !== "register") {
        throw new ToolArgsError(['memory is required; pass { kind: "register", symbol?: "<name>" }']);
      }
      const input = parseReadArgs(args, caps.limit);
      const { target, info } = await resolveRegularReadTarget(ctx, exec, input.filePath);
      const chunks = info.size === undefined || info.size >= caps.streamMinSize ? await ctx.fs.streamText(target, exec.signal) : [await ctx.fs.readText(target, exec.signal)];
      const window = await buildWindow(chunks, { offset: input.offset, limit: input.limit, maxLineLength: caps.maxLineLength, maxBytes: caps.maxBytes }, target.displayPath);
      const outcome = {
        path: ctx.fs.processPath(target),
        offset: input.offset,
        lines: window.lines,
        totalLines: window.totalLines
      };
      ctx.emit("fs/observed", target, { kind: "present", version: info.version }, exec);
      const totem = ctx.get("totem");
      if (totem?.recordRead !== undefined) {
        await totem.recordRead({
          agent: exec.agent,
          path: outcome.path,
          tool: "read",
          action: "read",
          symbol: memory.symbol,
          signal: exec.signal
        });
      }
      return outcome;
    },
    presentResult(_args, result) {
      if (result.isError)
        return;
      const meta = readMetaFromMeta(result.meta);
      if (meta === undefined)
        return;
      const only = result.content.length === 1 ? result.content[0] : undefined;
      const text = only?.type === "text" ? only.text : undefined;
      if (text === undefined)
        return;
      const body = /^<path>[^\n]*<\/path>\n<type>file<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u.exec(text)?.[1];
      if (body === undefined)
        return;
      return {
        card: "read",
        path: meta.path,
        offset: meta.offset,
        lines: meta.lines,
        totalLines: meta.totalLines,
        ...meta.lang === undefined ? {} : { lang: meta.lang },
        content: [{ type: "text", text: body }]
      };
    },
    presentCall(args) {
      const { offset, limit } = args;
      const window = limit !== undefined && limit > 0 ? ` (${offset ?? 1} - ${(offset ?? 1) + limit - 1})` : offset !== undefined ? ` (from line ${offset})` : "";
      return {
        card: "generic",
        title: `Read ${args.file_path}${window}`,
        kind: "read",
        locations: [{ path: args.file_path, line: offset ?? 1 }]
      };
    }
  }));
}

// src/tool-fs/write.ts
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";
// node_modules/diff/libesm/diff/base.js
class Diff {
  diff(oldStr, newStr, options = {}) {
    let callback;
    if (typeof options === "function") {
      callback = options;
      options = {};
    } else if ("callback" in options) {
      callback = options.callback;
    }
    const oldString = this.castInput(oldStr, options);
    const newString = this.castInput(newStr, options);
    const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
    const newTokens = this.removeEmpty(this.tokenize(newString, options));
    return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
  }
  diffWithOptionsObj(oldTokens, newTokens, options, callback) {
    var _a;
    const done = (value) => {
      value = this.postProcess(value, options);
      if (callback) {
        setTimeout(function() {
          callback(value);
        }, 0);
        return;
      } else {
        return value;
      }
    };
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let editLength = 1;
    let maxEditLength = newLen + oldLen;
    if (options.maxEditLength != null) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }
    const maxExecutionTime = (_a = options.timeout) !== null && _a !== undefined ? _a : Infinity;
    const abortAfterTimestamp = Date.now() + maxExecutionTime;
    const bestPath = [{ oldPos: -1, lastComponent: undefined }];
    let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
    }
    let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
    const execEditLength = () => {
      for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength);diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        let basePath;
        const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
        if (removePath) {
          bestPath[diagonalPath - 1] = undefined;
        }
        let canAdd = false;
        if (addPath) {
          const addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }
        const canRemove = removePath && removePath.oldPos + 1 < oldLen;
        if (!canAdd && !canRemove) {
          bestPath[diagonalPath] = undefined;
          continue;
        }
        if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) {
          basePath = this.addToPath(addPath, true, false, 0, options);
        } else {
          basePath = this.addToPath(removePath, false, true, 1, options);
        }
        newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
        } else {
          bestPath[diagonalPath] = basePath;
          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }
          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }
      editLength++;
    };
    if (callback) {
      (function exec() {
        setTimeout(function() {
          if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
            return callback(undefined);
          }
          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
        const ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  }
  addToPath(path, added, removed, oldPosInc, options) {
    const last = path.lastComponent;
    if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: last.count + 1, added, removed, previousComponent: last.previousComponent }
      };
    } else {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: 1, added, removed, previousComponent: last }
      };
    }
  }
  extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
      newPos++;
      oldPos++;
      commonCount++;
      if (options.oneChangePerToken) {
        basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
      }
    }
    if (commonCount && !options.oneChangePerToken) {
      basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
    }
    basePath.oldPos = oldPos;
    return newPos;
  }
  equals(left, right, options) {
    if (options.comparator) {
      return options.comparator(left, right);
    } else {
      return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  }
  removeEmpty(array) {
    const ret = [];
    for (let i = 0;i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  }
  castInput(value, options) {
    return value;
  }
  tokenize(value, options) {
    return Array.from(value);
  }
  join(chars) {
    return chars.join("");
  }
  postProcess(changeObjects, options) {
    return changeObjects;
  }
  get useLongestToken() {
    return false;
  }
  buildValues(lastComponent, newTokens, oldTokens) {
    const components = [];
    let nextComponent;
    while (lastComponent) {
      components.push(lastComponent);
      nextComponent = lastComponent.previousComponent;
      delete lastComponent.previousComponent;
      lastComponent = nextComponent;
    }
    components.reverse();
    const componentLen = components.length;
    let componentPos = 0, newPos = 0, oldPos = 0;
    for (;componentPos < componentLen; componentPos++) {
      const component = components[componentPos];
      if (!component.removed) {
        if (!component.added && this.useLongestToken) {
          let value = newTokens.slice(newPos, newPos + component.count);
          value = value.map(function(value, i) {
            const oldValue = oldTokens[oldPos + i];
            return oldValue.length > value.length ? oldValue : value;
          });
          component.value = this.join(value);
        } else {
          component.value = this.join(newTokens.slice(newPos, newPos + component.count));
        }
        newPos += component.count;
        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
        oldPos += component.count;
      }
    }
    return components;
  }
}

// node_modules/diff/libesm/diff/line.js
class LineDiff extends Diff {
  constructor() {
    super(...arguments);
    this.tokenize = tokenize;
  }
  equals(left, right, options) {
    if (options.ignoreWhitespace) {
      if (!options.newlineIsToken || !left.includes(`
`)) {
        left = left.trim();
      }
      if (!options.newlineIsToken || !right.includes(`
`)) {
        right = right.trim();
      }
    } else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
      if (left.endsWith(`
`)) {
        left = left.slice(0, -1);
      }
      if (right.endsWith(`
`)) {
        right = right.slice(0, -1);
      }
    }
    return super.equals(left, right, options);
  }
}
var lineDiff = new LineDiff;
function diffLines(oldStr, newStr, options) {
  return lineDiff.diff(oldStr, newStr, options);
}
function tokenize(value, options) {
  if (options.stripTrailingCr) {
    value = value.replace(/\r\n/g, `
`);
  }
  const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }
  for (let i = 0;i < linesAndNewlines.length; i++) {
    const line = linesAndNewlines[i];
    if (i % 2 && !options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      retLines.push(line);
    }
  }
  return retLines;
}

// node_modules/diff/libesm/patch/create.js
function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  let optionsObj;
  if (!options) {
    optionsObj = {};
  } else if (typeof options === "function") {
    optionsObj = { callback: options };
  } else {
    optionsObj = options;
  }
  if (typeof optionsObj.context === "undefined") {
    optionsObj.context = 4;
  }
  const context = optionsObj.context;
  if (optionsObj.newlineIsToken) {
    throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
  }
  if (!optionsObj.callback) {
    return diffLinesResultToPatch(diffLines(oldStr, newStr, optionsObj));
  } else {
    const { callback } = optionsObj;
    diffLines(oldStr, newStr, Object.assign(Object.assign({}, optionsObj), { callback: (diff) => {
      const patch = diffLinesResultToPatch(diff);
      callback(patch);
    } }));
  }
  function diffLinesResultToPatch(diff) {
    if (!diff) {
      return;
    }
    diff.push({ value: "", lines: [] });
    function contextLines(lines) {
      return lines.map(function(entry) {
        return " " + entry;
      });
    }
    const hunks = [];
    let oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
    for (let i = 0;i < diff.length; i++) {
      const current = diff[i], lines = current.lines || splitLines(current.value);
      current.lines = lines;
      if (current.added || current.removed) {
        if (!oldRangeStart) {
          const prev = diff[i - 1];
          oldRangeStart = oldLine;
          newRangeStart = newLine;
          if (prev) {
            curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
            oldRangeStart -= curRange.length;
            newRangeStart -= curRange.length;
          }
        }
        for (const line of lines) {
          curRange.push((current.added ? "+" : "-") + line);
        }
        if (current.added) {
          newLine += lines.length;
        } else {
          oldLine += lines.length;
        }
      } else {
        if (oldRangeStart) {
          if (lines.length <= context * 2 && i < diff.length - 2) {
            for (const line of contextLines(lines)) {
              curRange.push(line);
            }
          } else {
            const contextSize = Math.min(lines.length, context);
            for (const line of contextLines(lines.slice(0, contextSize))) {
              curRange.push(line);
            }
            const hunk = {
              oldStart: oldRangeStart,
              oldLines: oldLine - oldRangeStart + contextSize,
              newStart: newRangeStart,
              newLines: newLine - newRangeStart + contextSize,
              lines: curRange
            };
            hunks.push(hunk);
            oldRangeStart = 0;
            newRangeStart = 0;
            curRange = [];
          }
        }
        oldLine += lines.length;
        newLine += lines.length;
      }
    }
    for (const hunk of hunks) {
      for (let i = 0;i < hunk.lines.length; i++) {
        if (hunk.lines[i].endsWith(`
`)) {
          hunk.lines[i] = hunk.lines[i].slice(0, -1);
        } else {
          hunk.lines.splice(i + 1, 0, "\\ No newline at end of file");
          i++;
        }
      }
    }
    return {
      oldFileName,
      newFileName,
      oldHeader,
      newHeader,
      hunks
    };
  }
}
function splitLines(text) {
  const hasTrailingNl = text.endsWith(`
`);
  const result = text.split(`
`).map((line) => line + `
`);
  if (hasTrailingNl) {
    result.pop();
  } else {
    result.push(result.pop().slice(0, -1));
  }
  return result;
}
// src/tool-fs/diff.ts
var DIFF_CONTEXT = 3;
function computeHunkDiffs(path, before, after) {
  const patch = structuredPatch("", "", before, after, undefined, undefined, { context: DIFF_CONTEXT });
  const diffs = [];
  for (const hunk of patch.hunks) {
    const oldLines = [];
    const newLines = [];
    for (const line of hunk.lines) {
      if (line.startsWith("\\"))
        continue;
      const text = line.slice(1);
      if (line.startsWith("-")) {
        oldLines.push(text);
      } else if (line.startsWith("+")) {
        newLines.push(text);
      } else {
        oldLines.push(text);
        newLines.push(text);
      }
    }
    diffs.push({ path, oldText: oldLines.length > 0 ? oldLines.join(`
`) : null, newText: newLines.join(`
`) });
  }
  return diffs;
}
function isFileDiff(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const { path, oldText, newText } = value;
  return typeof path === "string" && (oldText === null || typeof oldText === "string") && typeof newText === "string";
}
function diffsFromMeta(meta) {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta))
    return;
  const diffs = meta.diffs;
  if (!Array.isArray(diffs) || diffs.length === 0 || !diffs.every(isFileDiff))
    return;
  return diffs;
}
function stoppedFromMeta(meta) {
  return typeof meta === "object" && meta !== null && !Array.isArray(meta) && meta.stopped === true;
}
function pathFromMeta(meta) {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta))
    return;
  const path = meta.path;
  return typeof path === "string" && path.length > 0 ? path : undefined;
}

// src/tool-fs/error.ts
import { FsError as FsError3 } from "@deepseek-ai/dsh-fs";
function remediateFsError(error, displayPath) {
  if (!(error instanceof FsError3))
    return error;
  if (error.code === "FS_NOT_OBSERVED") {
    return new FsError3(`cannot modify "${displayPath}": file has not been read — read the file, then retry`, error.code, { cause: error });
  }
  if (error.code === "FS_STALE_VERSION") {
    return new FsError3(`${error.message} — re-read the file, then retry`, error.code, { cause: error });
  }
  return error;
}

// src/tool-fs/mutation-result.ts
function mutationResult(ctx, target, outcome, exec) {
  const { version, ...result } = outcome;
  ctx.emit("fs/observed", target, { kind: "present", version }, exec);
  return { path: ctx.fs.processPath(target), ...result };
}

// src/tool-fs/write.ts
function parseWriteArgs(args) {
  if (args.file_path.trim().length === 0)
    throw new Error("file_path must be a non-empty string");
  return { filePath: args.file_path, content: args.content };
}
function formatWriteOutput(displayPath, outcome) {
  const verb = outcome.operation === "create" ? "Created" : "Updated";
  return `<path>${displayPath}</path>
<type>file</type>
<content>
${verb} file
</content>`;
}
function applyWriteTool(ctx, sandbox) {
  ctx.systemPrompt.section({
    name: "tool:write",
    order: ctx.systemPrompt.getSectionOrder("TOOL_WRITE"),
    text: ({ scope }) => ctx.tools.get("write", scope) === undefined ? "" : "Read an existing file before overwriting it with write" + (ctx.tools.get("edit", scope) === undefined ? "" : " and prefer edit for targeted changes") + "."
  });
  ctx.tools.register(defineTool2({
    name: "write",
    description: "Create or fully replace a UTF-8 text file.",
    parameters: {
      file_path: {
        type: "string",
        required: true,
        description: "Path to write, resolved by the filesystem backend. " + "Provide `file_path` before `content` in the arguments."
      },
      content: { type: "string", required: true, description: "Full UTF-8 text content to write." },
      memory: {
        type: "object",
        additionalProperties: false,
        required: true,
        description: "REQUIRED. Mark this write for Totem memory registration; the secondary memory model writes the durable text.",
        properties: {
          kind: { type: "string", required: true, enum: ["register"], description: 'Use "register".' },
          symbol: { type: "string", description: "Optional symbol this write is about." }
        }
      },
      ...sandbox.escalationModes.length > 0 ? sandbox.schemaFields() : {}
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", required: true, description: "Canonical absolute path in the filesystem execution world." },
          operation: { type: "string", required: true, enum: ["create", "update"] },
          before: {
            required: true,
            oneOf: [
              { type: "string" },
              { type: "null" }
            ]
          },
          after: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatWriteOutput(value.path, value) }],
      presentationMeta: (_args, value) => ({
        operation: value.operation,
        path: value.path,
        diffs: value.before === null ? [] : computeHunkDiffs(value.path, value.before, value.after).map(({ path, oldText, newText }) => ({ path, oldText, newText }))
      })
    },
    async execute(args, exec) {
      if (args.memory?.kind !== "register") {
        throw new ToolArgsError(['memory is required; pass { kind: "register", symbol?: "<name>" }']);
      }
      const input = parseWriteArgs(args);
      const sandboxPolicy = await sandbox.resolvePolicy("write", args, exec);
      const target = await ctx.fs.resolve(input.filePath, await sessionResolveOptions(ctx, exec));
      const intent = await ctx.waterfall("fs/write-intent", target, exec, () => {
        return;
      });
      let outcome;
      try {
        outcome = await ctx.fs.writeText(target, input.content, intent, exec.signal, sandboxPolicy);
      } catch (error) {
        throw remediateFsError(sandbox.mapError(error, sandboxPolicy), target.displayPath);
      }
      const result = mutationResult(ctx, target, outcome, exec);
      const totem = ctx.get("totem");
      if (totem?.recordWrite !== undefined) {
        await totem.recordWrite({
          agent: exec.agent,
          path: result.path,
          tool: "write",
          action: "write",
          before: result.before,
          after: result.after,
          symbol: args.memory.symbol,
          signal: exec.signal
        });
      }
      return result;
    },
    presentCall(args) {
      return {
        card: "diff",
        title: `Write ${args.file_path}`,
        diffs: [{ path: args.file_path, oldText: null, newText: args.content }],
        locations: [{ path: args.file_path }]
      };
    },
    presentResult(args, result) {
      if (result.isError)
        return;
      const diffs = diffsFromMeta(result.meta) ?? [{ path: pathFromMeta(result.meta) ?? args.file_path, oldText: null, newText: args.content }];
      return { card: "diff", title: `Write ${args.file_path}`, diffs };
    }
  }));
}

// src/tool-fs/apply-patch.ts
import { ToolArgsError as ToolArgsError2, defineTool as defineTool3 } from "@deepseek-ai/dsh-tools";

// src/tool-fs/patch/index.ts
import { PatchParseError } from "@deepseek-ai/dsh-fs-patch";

// src/tool-fs/patch/execute.ts
import { FsError as FsError5 } from "@deepseek-ai/dsh-fs";
import { assertNever as assertNever2 } from "@deepseek-ai/dsh-util-values";

// src/tool-fs/patch/plan.ts
import { FsError as FsError4 } from "@deepseek-ai/dsh-fs";
import { parsePatch as parsePatch2 } from "@deepseek-ai/dsh-fs-patch";
import { assertNever } from "@deepseek-ai/dsh-util-values";
async function planPatch(ctx, sandbox, exec, request) {
  const parsed = parsePatch2(request.patch);
  const targets = new Map;
  const resolve = async (path) => {
    const target = await ctx.fs.resolve(path, await sessionResolveOptions(ctx, exec));
    const prior = targets.get(target.targetKey);
    if (prior)
      return prior;
    targets.set(target.targetKey, target);
    return target;
  };
  const result = { operations: [], refusals: [] };
  for (const [index, operation] of parsed.entries()) {
    const moveTo = operation.kind === "update" ? operation.moveTo : undefined;
    const record = {
      index,
      kind: moveTo === undefined ? operation.kind : "move",
      path: operation.path,
      patchLine: operation.lineNumber,
      ...moveTo === undefined ? {} : { destination: moveTo }
    };
    let failurePath = operation.path;
    try {
      const target = await resolve(operation.path);
      record.path = target.displayPath;
      const base = { target, rawPath: operation.path, record };
      switch (operation.kind) {
        case "add":
          result.operations.push({ ...base, kind: "add", content: operation.content });
          break;
        case "delete":
          result.operations.push({ ...base, kind: "delete" });
          break;
        case "update": {
          if (operation.moveTo === undefined)
            result.operations.push({ ...base, kind: "update", hunks: operation.hunks });
          else {
            failurePath = operation.moveTo;
            const destination = await resolve(operation.moveTo);
            record.destination = destination.displayPath;
            result.operations.push({ ...base, kind: "move", destination, hunks: operation.hunks });
          }
          break;
        }
        default:
          assertNever(operation);
      }
    } catch (error) {
      if (!(error instanceof FsError4))
        throw error;
      result.refusals.push({ operation: record, failure: patchFailure(sandbox, request.sandboxPolicy, error, failurePath) });
    }
  }
  return result;
}
function sourceIntent(ctx, exec, target, kind) {
  return kind === "delete" ? ctx.waterfall("fs/delete-intent", target, exec, () => {
    return;
  }) : ctx.waterfall("fs/edit-intent", target, exec, () => {
    return;
  });
}
function destinationIntent(ctx, exec, target) {
  return ctx.waterfall("fs/write-intent", target, exec, () => {
    return;
  });
}
function patchFailure(sandbox, policy, error, path) {
  const mapped = remediateFsError(sandbox.mapError(error, policy), path);
  return { code: mapped.code, message: mapped.message };
}
function mutationTargets(operation) {
  return operation.kind === "move" ? [operation.destination, operation.target] : [operation.target];
}

// src/tool-fs/patch/execute.ts
async function unchanged(ctx, before) {
  try {
    for (const entry of before) {
      const after = await ctx.fs.stat(entry.target);
      if (after?.version !== entry.info?.version)
        return false;
    }
    return true;
  } catch (error) {
    if (!(error instanceof FsError5))
      throw error;
    return false;
  }
}
async function commitPatch(ctx, sandbox, exec, policy, operations) {
  const outcomes = operations.map((operation) => ({ status: "skipped", operation: operation.record }));
  let cancelled = false;
  for (const [index, operation] of operations.entries()) {
    if (exec.signal.aborted) {
      cancelled = true;
      break;
    }
    let started = false;
    let before = [];
    let failurePath = operation.target.displayPath;
    const target = operation.target;
    const record = operation.record;
    let outcome;
    try {
      before = await Promise.all(mutationTargets(operation).map(async (target) => ({ target, info: await ctx.fs.stat(target, exec.signal) })));
      switch (operation.kind) {
        case "add": {
          const intent = await destinationIntent(ctx, exec, target);
          started = true;
          const result = await ctx.fs.writeText(target, operation.content, intent, exec.signal, policy);
          ctx.emit("fs/observed", target, { kind: "present", version: result.version }, exec);
          outcome = { status: "completed", operation: record, changes: [{ path: ctx.fs.processPath(target), before: result.before, after: result.after }] };
          break;
        }
        case "update": {
          const intent = await sourceIntent(ctx, exec, target, "edit");
          started = true;
          const result = await ctx.fs.patchText(target, operation.hunks, intent, exec.signal, policy);
          ctx.emit("fs/observed", target, { kind: "present", version: result.version }, exec);
          outcome = { status: "completed", operation: record, changes: [{ path: ctx.fs.processPath(target), before: result.before, after: result.after }] };
          break;
        }
        case "delete": {
          const intent = await sourceIntent(ctx, exec, target, "delete");
          started = true;
          const result = await ctx.fs.deleteFile(target, intent, exec.signal, policy);
          ctx.emit("fs/observed", target, { kind: "absent" }, exec);
          outcome = { status: "completed", operation: record, changes: [{ path: ctx.fs.processPath(target), before: result.before, after: null }] };
          break;
        }
        case "move": {
          const expectedSource = await sourceIntent(ctx, exec, target, "edit");
          failurePath = operation.destination.displayPath;
          const expectedDestination = await destinationIntent(ctx, exec, operation.destination);
          started = true;
          const result = await ctx.fs.moveFile(target, operation.destination, {
            hunks: operation.hunks,
            ...expectedSource === undefined ? {} : { expectedSource },
            ...expectedDestination === undefined ? {} : { expectedDestination }
          }, exec.signal, policy);
          const changes = [{
            path: ctx.fs.processPath(operation.destination),
            before: result.destination.before,
            after: result.destination.after
          }];
          ctx.emit("fs/observed", operation.destination, { kind: "present", version: result.destination.version }, exec);
          if (result.sourceDeleted) {
            ctx.emit("fs/observed", target, { kind: "absent" }, exec);
            outcome = { status: "completed", operation: record, changes: [...changes, { path: ctx.fs.processPath(target), before: result.sourceBefore, after: null }] };
          } else {
            const error = new FsError5(result.sourceFailure.message, result.sourceFailure.code);
            outcome = { status: "failed", operation: record, failure: patchFailure(sandbox, policy, error, target.displayPath), changes };
          }
          break;
        }
        default:
          assertNever2(operation);
      }
    } catch (error) {
      if (!(error instanceof FsError5))
        throw error;
      const failure = patchFailure(sandbox, policy, error, failurePath);
      const uncertain = started && (error.code === "FS_ABORTED" || error.code === "FS_IO_ERROR" && !await unchanged(ctx, before));
      outcome = uncertain ? { status: "unknown", operation: record, failure: { ...failure, message: `${failure.message} — re-read the affected files before retrying` } } : { status: "failed", operation: record, failure, changes: [] };
    }
    outcomes[index] = outcome;
    if (outcome.status !== "completed") {
      cancelled = exec.signal.aborted;
      break;
    }
  }
  const affectedPaths = [...new Set(outcomes.flatMap((outcome) => ("changes" in outcome) ? outcome.changes.map((change) => change.path) : []))];
  return { phase: "commit", outcomes, affectedPaths, cancelled };
}

// src/tool-fs/patch/preflight.ts
import { FsError as FsError6 } from "@deepseek-ai/dsh-fs";
import { applyHunks } from "@deepseek-ai/dsh-fs-patch";
import { assertNever as assertNever3 } from "@deepseek-ai/dsh-util-values";
class Preflight {
  ctx;
  sandbox;
  exec;
  policy;
  failurePath = "";
  states = new Map;
  constructor(ctx, sandbox, exec, policy) {
    this.ctx = ctx;
    this.sandbox = sandbox;
    this.exec = exec;
    this.policy = policy;
  }
  async state(target) {
    const known = this.states.get(target.targetKey);
    if (known)
      return known;
    const info = await this.ctx.fs.stat(target, this.exec.signal);
    const state = { exists: info !== undefined, info, touched: false };
    this.states.set(target.targetKey, state);
    return state;
  }
  regular(state, target) {
    if (state.info !== undefined && state.info.type !== "file") {
      throw new FsError6(`cannot modify "${target.displayPath}": not a regular file`, "FS_NOT_REGULAR_FILE");
    }
  }
  async source(state, target, kind) {
    const intent = state.touched ? undefined : await sourceIntent(this.ctx, this.exec, target, kind === "delete" ? "delete" : "edit");
    if (!state.exists)
      throw new FsError6(`cannot ${kind} "${target.displayPath}": not found`, "FS_NOT_FOUND");
    this.regular(state, target);
    if (intent !== undefined && intent.version !== state.info?.version) {
      throw new FsError6(`cannot ${kind} "${target.displayPath}": file changed since it was read`, "FS_STALE_VERSION");
    }
  }
  async destination(state, target) {
    const intent = state.touched ? undefined : await destinationIntent(this.ctx, this.exec, target);
    this.regular(state, target);
    if (intent?.kind === "createIfAbsent" && state.exists) {
      throw new FsError6(`cannot overwrite existing "${target.displayPath}" without reading it first`, "FS_NOT_OBSERVED");
    }
    if (intent?.kind === "replaceIfVersion" && (!state.exists || state.info?.version !== intent.version)) {
      throw new FsError6(`cannot write "${target.displayPath}": file changed since it was read`, "FS_STALE_VERSION");
    }
  }
  async content(state, target) {
    if (state.content === undefined) {
      const text = await this.ctx.fs.readText(target, this.exec.signal);
      if (text.includes("\x00"))
        throw new FsError6(`cannot patch "${target.displayPath}": binary file`, "FS_NOT_TEXT");
      state.content = text.replace(/\r\n/g, `
`);
    }
    return state.content;
  }
  publish(target, content) {
    this.states.set(target.targetKey, {
      exists: content !== undefined,
      info: undefined,
      touched: true,
      ...content === undefined ? {} : { content }
    });
  }
  async check(operation) {
    this.failurePath = operation.target.displayPath;
    try {
      return await this.simulate(operation);
    } catch (error) {
      if (!(error instanceof FsError6))
        throw error;
      return patchFailure(this.sandbox, this.policy, error, this.failurePath);
    }
  }
  async simulate(operation) {
    if (operation.kind === "move" && operation.target.targetKey === operation.destination.targetKey) {
      throw new FsError6(`cannot move "${operation.target.displayPath}" to itself`, "FS_SAME_TARGET");
    }
    if (operation.kind === "delete" || operation.kind === "move") {
      const info = await this.ctx.fs.lstat(operation.rawPath, await sessionResolveOptions(this.ctx, this.exec));
      if (info?.type === "symlink")
        return {
          code: "PATCH_SYMLINK_SOURCE",
          message: `cannot ${operation.kind} "${operation.target.displayPath}": path is a symbolic link — operate on its target path instead`
        };
    }
    const state = await this.state(operation.target);
    switch (operation.kind) {
      case "add":
        await this.destination(state, operation.target);
        this.publish(operation.target, operation.content);
        return;
      case "delete":
        await this.source(state, operation.target, "delete");
        this.publish(operation.target);
        return;
      case "update":
      case "move": {
        await this.source(state, operation.target, operation.kind === "move" ? "move" : "edit");
        if (operation.kind === "move") {
          this.failurePath = operation.destination.displayPath;
          await this.destination(await this.state(operation.destination), operation.destination);
          this.failurePath = operation.target.displayPath;
        }
        const result = applyHunks(await this.content(state, operation.target), operation.hunks);
        if (!result.ok) {
          const first = result.failure.pattern.slice(0, 1).join("");
          const characters = Array.from(first);
          const preview = characters.length > 80 ? `${characters.slice(0, 80).join("")}…` : first;
          return {
            code: "FS_PATCH_MISMATCH",
            hunkLine: result.failure.hunkLineNumber,
            message: `cannot patch "${operation.target.displayPath}": hunk at patch line ${result.failure.hunkLineNumber} (${result.failure.stage}) does not match — ${preview}`
          };
        }
        if (operation.kind === "move") {
          this.publish(operation.destination, result.after);
          this.publish(operation.target);
        } else
          this.publish(operation.target, result.after);
        return;
      }
      default:
        return assertNever3(operation);
    }
  }
}
async function preflightPatch(ctx, sandbox, exec, policy, operations) {
  const preflight = new Preflight(ctx, sandbox, exec, policy);
  const refusals = [];
  for (const operation of operations) {
    const failure = await preflight.check(operation);
    if (failure !== undefined)
      refusals.push({ operation: operation.record, failure });
  }
  return refusals;
}

// src/tool-fs/patch/index.ts
async function executePatch(ctx, sandbox, exec, request) {
  let plan;
  try {
    plan = await planPatch(ctx, sandbox, exec, request);
  } catch (error) {
    if (!(error instanceof PatchParseError))
      throw error;
    return { phase: "syntax", failure: { code: "PATCH_SYNTAX", message: error.message } };
  }
  const [first, ...rest] = [
    ...plan.refusals,
    ...await preflightPatch(ctx, sandbox, exec, request.sandboxPolicy, plan.operations)
  ].sort((left, right) => left.operation.index - right.operation.index);
  if (first !== undefined)
    return { phase: "preflight", refusals: [first, ...rest] };
  return commitPatch(ctx, sandbox, exec, request.sandboxPolicy, plan.operations);
}

// src/tool-fs/apply-patch-output.ts
import { FsError as FsError7 } from "@deepseek-ai/dsh-fs";
import { HarnessError } from "@deepseek-ai/dsh-llm";
var patchOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    phase: { type: "string", const: "commit", required: true },
    cancelled: { type: "boolean", required: true },
    operations: { type: "array", required: true, items: {
      type: "object",
      additionalProperties: false,
      properties: {
        index: { type: "integer", required: true },
        kind: { type: "string", enum: ["add", "update", "delete", "move"], required: true },
        path: { type: "string", required: true },
        destination: { type: "string" },
        patchLine: { type: "integer", required: true },
        status: { type: "string", enum: ["completed", "failed", "unknown", "skipped"], required: true },
        code: { type: "string" },
        message: { type: "string" },
        hunkLine: { type: "integer" },
        changes: { type: "array", items: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: { type: "string", required: true },
            before: { required: true, oneOf: [{ type: "string" }, { type: "null" }] },
            after: { required: true, oneOf: [{ type: "string" }, { type: "null" }] }
          }
        } }
      }
    } },
    affectedPaths: { type: "array", items: { type: "string" }, required: true }
  }
};

class PatchToolError extends HarnessError {
}
function rejection(code, message) {
  return code === "PATCH_SYNTAX" || code === "PATCH_SYMLINK_SOURCE" ? new PatchToolError(message, code) : new FsError7(message, code);
}
function refusalError(first, ...rest) {
  const refusals = [first, ...rest];
  const lines = refusals.map(({ operation, failure }) => `- operation ${operation.index + 1} (${operation.kind} ${operation.path}, patch line ${operation.patchLine}): ${failure.message}`);
  return rejection(first.failure.code, `Patch rejected before any change (${refusals.length} problems):
${lines.join(`
`)}`);
}
function patchToolValue(report) {
  if (report.phase === "syntax") {
    throw rejection(report.failure.code, report.failure.message);
  }
  if (report.phase === "preflight")
    throw refusalError(...report.refusals);
  const [first, ...rest] = report.outcomes;
  if (first?.status === "failed" && first.changes.length === 0 && rest.every((outcome) => outcome.status === "skipped")) {
    throw refusalError(first);
  }
  return {
    phase: "commit",
    cancelled: report.cancelled,
    affectedPaths: report.affectedPaths,
    operations: report.outcomes.map((outcome) => ({
      ...outcome.operation,
      status: outcome.status,
      ..."failure" in outcome ? outcome.failure : {},
      ..."changes" in outcome ? { changes: outcome.changes } : {}
    }))
  };
}
function patchStopped(value) {
  return value.cancelled || value.operations.some((operation) => operation.status !== "completed");
}
function completedLines(operations) {
  return ["add", "update", "delete"].flatMap((kind) => operations.filter((operation) => operation.status === "completed" && (operation.kind === "move" ? "update" : operation.kind) === kind).map((operation) => `${kind === "add" ? "A" : kind === "delete" ? "D" : "M"} ${operation.destination ?? operation.path}`));
}
function renderPatch(value) {
  if (!patchStopped(value)) {
    return value.operations.length === 0 ? "Success. No operations in patch." : ["Success. Updated the following files:", ...completedLines(value.operations)].join(`
`);
  }
  const completed = value.operations.filter((operation) => operation.status === "completed").length;
  const lines = [`Patch stopped after ${completed} of ${value.operations.length} operations.`];
  if (completed > 0)
    lines.push("Completed:", ...completedLines(value.operations));
  for (const [status, title] of [["failed", "Failed:"], ["unknown", "Outcome unknown:"], ["skipped", "Not executed:"]]) {
    const operations = value.operations.filter((operation) => operation.status === status);
    if (operations.length === 0)
      continue;
    lines.push(title);
    for (const operation of operations) {
      const label = `- operation ${operation.index + 1} (${operation.kind} ${operation.path}`;
      if (status === "skipped") {
        lines.push(`${label})`);
        continue;
      }
      const destination = operation.destination === undefined ? "" : ` -> ${operation.destination}`;
      lines.push(`${label}${destination}, patch line ${operation.patchLine}): ${operation.message}`);
      if (status === "failed" && operation.kind === "move" && operation.changes?.length) {
        lines.push(`  destination ${operation.destination} was written; source ${operation.path} remains`);
      }
    }
  }
  return lines.join(`
`);
}
function patchPresentationMeta(value) {
  const diffs = value.operations.flatMap((operation) => {
    if (operation.status !== "completed" && operation.status !== "failed")
      return [];
    return (operation.changes ?? []).flatMap(({ path, before, after }) => {
      if (before === null)
        return [];
      if (after === null)
        return [{ path, oldText: before, newText: "" }];
      return computeHunkDiffs(path, before, after);
    });
  });
  return { diffs: diffs.map(({ path, oldText, newText }) => ({ path, oldText, newText })), stopped: patchStopped(value) };
}

// src/tool-fs/apply-patch-presentation.ts
import { parsePatch as parsePatch3, PatchParseError as PatchParseError2 } from "@deepseek-ai/dsh-fs-patch";
import { assertNever as assertNever4 } from "@deepseek-ai/dsh-util-values";
function presentPatchCall(patch) {
  let operations;
  try {
    operations = parsePatch3(patch);
  } catch (error) {
    if (!(error instanceof PatchParseError2))
      throw error;
    return;
  }
  const diffs = operations.flatMap((operation) => {
    const path = operation.path;
    switch (operation.kind) {
      case "add":
        return [{ path, oldText: null, newText: operation.content }];
      case "delete":
        return [];
      case "update":
        return [{
          path,
          oldText: operation.hunks.flatMap((hunk) => hunk.oldLines).join(`
`) || null,
          newText: operation.hunks.flatMap((hunk) => hunk.newLines).join(`
`)
        }];
      default:
        return assertNever4(operation);
    }
  });
  const paths = new Set(operations.flatMap((operation) => operation.kind === "update" && operation.moveTo !== undefined ? [operation.path, operation.moveTo] : [operation.path]));
  return {
    card: "diff",
    title: `Apply patch (${paths.size} ${paths.size === 1 ? "file" : "files"})`,
    diffs,
    locations: [...paths].map((path) => ({ path }))
  };
}
function presentPatchResult(result) {
  if (result.isError)
    return;
  const diffs = diffsFromMeta(result.meta);
  if (diffs === undefined)
    return;
  return { card: "diff", title: stoppedFromMeta(result.meta) ? "Apply patch (stopped)" : "Apply patch", diffs };
}

// src/tool-fs/apply-patch.ts
function applyApplyPatchTool(ctx, sandbox) {
  ctx.systemPrompt.section({
    name: "tool:apply_patch",
    order: ctx.systemPrompt.getSectionOrder("TOOL_APPLY_PATCH"),
    text: ({ scope }) => ctx.tools.get("apply_patch", scope) === undefined ? "" : "Prefer apply_patch over separate edit calls for changes across files or separated regions. " + "Give every hunk enough surrounding context lines to match one place in the current file. " + "The whole patch is checked first (syntax, hunk matching, missing files) and a rejected patch changes nothing; " + "once applying starts, operations run in order, stop at the first failure, and are not rolled back, so re-read affected files before retrying when needed."
  });
  ctx.tools.register(defineTool3({
    name: "apply_patch",
    description: "Create, update, delete, or move UTF-8 text files with one Codex-style patch; " + "prefer it over multiple edit calls when a change spans several files or separated regions.",
    parameters: {
      input: {
        type: "string",
        required: true,
        description: "Codex patch text: start with *** Begin Patch and end with *** End Patch. " + "Use *** Add File: path with + lines; *** Update File: path, optionally followed by *** Move to: path, " + "with @@ or @@ context and space-prefixed context, + added, or - removed lines; " + "*** End of File anchors the last hunk to the file end. Use *** Delete File: path to delete. " + "Paths are relative to the Session working directory."
      },
      memory: {
        type: "object",
        additionalProperties: false,
        required: true,
        description: "REQUIRED. Mark this patch for Totem memory registration; the secondary memory model writes the durable text.",
        properties: {
          kind: { type: "string", required: true, enum: ["register"], description: 'Use "register".' },
          symbol: { type: "string", description: "Optional symbol this patch is about." }
        }
      },
      ...sandbox.escalationModes.length > 0 ? sandbox.schemaFields() : {}
    },
    output: {
      schema: patchOutputSchema,
      render: (_args, value) => [{ type: "text", text: renderPatch(value) }],
      presentationMeta: (_args, value) => patchPresentationMeta(value)
    },
    async execute(args, exec) {
      if (args.memory?.kind !== "register") {
        throw new ToolArgsError2(['memory is required; pass { kind: "register", symbol?: "<name>" }']);
      }
      const sandboxPolicy = await sandbox.resolvePolicy("apply_patch", args, exec);
      const value = patchToolValue(await executePatch(ctx, sandbox, exec, { patch: args.input, sandboxPolicy }));
      const totem = ctx.get("totem");
      if (totem?.recordWrite !== undefined) {
        for (const operation of value.operations) {
          if (operation.status !== "completed")
            continue;
          const path = operation.destination ?? operation.path;
          const change = operation.changes?.find((entry) => entry.path === path) ?? operation.changes?.[0];
          await totem.recordWrite({
            agent: exec.agent,
            path,
            tool: "apply_patch",
            action: "patch",
            before: change?.before ?? null,
            after: change?.after ?? null,
            symbol: args.memory.symbol,
            signal: exec.signal
          });
        }
      }
      return value;
    },
    presentCall: (args) => presentPatchCall(args.input),
    presentResult: (_args, result) => presentPatchResult(result)
  }));
}

// src/tool-fs/edit.ts
import { defineTool as defineTool4 } from "@deepseek-ai/dsh-tools";
function parseEditArgs(args) {
  if (args.file_path.trim().length === 0)
    throw new Error("file_path must be a non-empty string");
  if (args.old_string.length === 0)
    throw new Error("old_string must be a non-empty string");
  if (args.old_string === args.new_string)
    throw new Error("old_string and new_string must differ");
  return {
    filePath: args.file_path,
    oldString: args.old_string,
    newString: args.new_string,
    replaceAll: args.replace_all ?? false
  };
}
function formatEditOutput(displayPath, replaceAll) {
  return replaceAll ? `The file ${displayPath} has been updated. All occurrences were successfully replaced.` : `The file ${displayPath} has been updated successfully.`;
}
function applyEditTool(ctx, sandbox) {
  ctx.systemPrompt.section({
    name: "tool:edit",
    order: ctx.systemPrompt.getSectionOrder("TOOL_EDIT"),
    text: ({ scope }) => ctx.tools.get("edit", scope) === undefined ? "" : "Read a file before editing it unless you just created or edited it in this session."
  });
  ctx.tools.register(defineTool4({
    name: "edit",
    description: "Edit an existing UTF-8 text file by replacing literal text.",
    parameters: {
      file_path: {
        type: "string",
        required: true,
        description: "Path to edit, resolved by the filesystem backend. " + "Provide `file_path` before `old_string` and `new_string` in the arguments."
      },
      old_string: { type: "string", required: true, description: "Literal text to replace." },
      new_string: { type: "string", required: true, description: "Literal replacement text. Use an empty string to delete the match." },
      replace_all: { type: "boolean", description: "Replace all matches. Defaults to false; when false, old_string must appear exactly once." },
      memory: {
        type: "object",
        additionalProperties: false,
        required: true,
        description: "REQUIRED. Mark this edit for Totem memory registration; the secondary memory model writes the durable text.",
        properties: {
          kind: { type: "string", required: true, enum: ["register"], description: 'Use "register".' },
          symbol: { type: "string", description: "Optional symbol this edit is about." }
        }
      },
      ...sandbox.escalationModes.length > 0 ? sandbox.schemaFields() : {}
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", required: true, description: "Canonical absolute path in the filesystem execution world." },
          before: { type: "string", required: true },
          after: { type: "string", required: true }
        }
      },
      render: (args, value) => [{
        type: "text",
        text: formatEditOutput(value.path, args.replace_all ?? false)
      }],
      presentationMeta: (_args, value) => ({
        path: value.path,
        diffs: computeHunkDiffs(value.path, value.before, value.after).map(({ path, oldText, newText }) => ({ path, oldText, newText }))
      })
    },
    async execute(args, exec) {
      if (args.memory?.kind !== "register") {
        throw new ToolArgsError(['memory is required; pass { kind: "register", symbol?: "<name>" }']);
      }
      const input = parseEditArgs(args);
      const sandboxPolicy = await sandbox.resolvePolicy("edit", args, exec);
      const target = await ctx.fs.resolve(input.filePath, await sessionResolveOptions(ctx, exec));
      let outcome;
      try {
        const intent = await ctx.waterfall("fs/edit-intent", target, exec, () => {
          return;
        });
        outcome = await ctx.fs.editText(target, { oldString: input.oldString, newString: input.newString, replaceAll: input.replaceAll }, intent, exec.signal, sandboxPolicy);
      } catch (error) {
        throw remediateFsError(sandbox.mapError(error, sandboxPolicy), target.displayPath);
      }
      const result = mutationResult(ctx, target, outcome, exec);
      const totem = ctx.get("totem");
      if (totem?.recordWrite !== undefined) {
        await totem.recordWrite({
          agent: exec.agent,
          path: result.path,
          tool: "edit",
          action: "edit",
          before: result.before,
          after: result.after,
          symbol: args.memory.symbol,
          signal: exec.signal
        });
      }
      return result;
    },
    presentCall(args) {
      return {
        card: "diff",
        title: `Edit ${args.file_path}`,
        diffs: [{ path: args.file_path, oldText: args.old_string || null, newText: args.new_string }],
        locations: [{ path: args.file_path }]
      };
    },
    presentResult(args, result) {
      if (result.isError)
        return;
      const diffs = diffsFromMeta(result.meta);
      if (diffs === undefined)
        return;
      return { card: "diff", title: `Edit ${args.file_path}`, diffs };
    }
  }));
}

// src/tool-fs/read-image.ts
import { basename, extname } from "node:path";
import { AttachmentError, AttachmentId } from "@deepseek-ai/dsh-attachment";
import { defineTool as defineTool5 } from "@deepseek-ai/dsh-tools";
var IMAGE_EXTENSIONS = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};
var PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
var JPEG_SIGNATURE = [255, 216, 255];
function matchesBytes(data, offset, expected) {
  if (data.byteLength < offset + expected.length)
    return false;
  return expected.every((byte, index) => data[offset + index] === byte);
}
function matchesAscii(data, offset, value) {
  if (data.byteLength < offset + value.length)
    return false;
  for (let index = 0;index < value.length; index += 1) {
    if (data[offset + index] !== value.charCodeAt(index))
      return false;
  }
  return true;
}
function sniffImageMediaType(data) {
  if (matchesBytes(data, 0, PNG_SIGNATURE))
    return "image/png";
  if (matchesBytes(data, 0, JPEG_SIGNATURE))
    return "image/jpeg";
  if (matchesAscii(data, 0, "GIF87a") || matchesAscii(data, 0, "GIF89a"))
    return "image/gif";
  if (matchesAscii(data, 0, "RIFF") && matchesAscii(data, 8, "WEBP"))
    return "image/webp";
  return;
}
var IMAGE_VALUE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: true,
  properties: {
    attachmentId: { type: "string", required: true },
    mediaType: { type: "string", enum: ["image/png", "image/jpeg", "image/webp", "image/gif"], required: true },
    bytes: { type: "integer", required: true },
    width: { type: "integer", required: true },
    height: { type: "integer", required: true },
    name: { type: "string" },
    originalDimensions: {
      type: "object",
      additionalProperties: false,
      properties: {
        width: { type: "integer", required: true },
        height: { type: "integer", required: true }
      }
    }
  }
};
function imageMediaTypeForPath(filePath) {
  return IMAGE_EXTENSIONS[extname(filePath).toLowerCase()];
}
async function assertImageCapableRoute(ctx, exec, requestedPath) {
  const routed = exec.agent?.session.requestHeader()?.config;
  const provider = routed?.provider ?? exec.agent?.options.provider;
  const model = routed?.model ?? exec.agent?.options.model;
  const llm = ctx.get("llm");
  if (provider === undefined || model === undefined || llm === undefined) {
    throw new Error(`cannot read "${requestedPath}" as an image: the current model route could not be resolved`);
  }
  const active = await llm.resolveModelInfo(provider, model, exec.signal);
  if (active.inputModalities === undefined || !active.inputModalities.includes("image")) {
    throw new Error(`cannot read "${requestedPath}" as an image: model "${model}" does not declare image input; switch to an image-capable model to read images`);
  }
}
function assertDeploymentAccepts(attachments, mediaType, displayPath) {
  if (!attachments.imageLimits.mediaTypes.includes(mediaType)) {
    throw new Error(`cannot read "${displayPath}": ${mediaType} images are not accepted by this deployment`);
  }
}
function imageRefFromValue(image) {
  return {
    attachmentId: AttachmentId(image.attachmentId),
    mediaType: image.mediaType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    ...image.name === undefined ? {} : { name: image.name },
    ...image.originalDimensions === undefined ? {} : {
      originalDimensions: { ...image.originalDimensions }
    }
  };
}
function formatImageReadOutput(displayPath, image) {
  let scaled = "";
  if (image.originalDimensions !== undefined) {
    const x = (image.originalDimensions.width / image.width).toFixed(2);
    const y = (image.originalDimensions.height / image.height).toFixed(2);
    const advice = x === y ? `multiply coordinates by ${x}` : `multiply x coordinates by ${x} and y coordinates by ${y}`;
    scaled = ` (downscaled from ${image.originalDimensions.width}x${image.originalDimensions.height} px; ${advice} to locate features in the original file)`;
  }
  return `<path>${displayPath}</path>
<type>image</type>
<content>
${image.mediaType} image, ${image.width}x${image.height} px, ${image.bytes} bytes${scaled}
</content>`;
}
function imageReadContent(value) {
  return [
    { type: "text", text: formatImageReadOutput(value.path, value.image) },
    { type: "image", attachment: imageRefFromValue(value.image) }
  ];
}
function applyReadImageTool(ctx) {
  ctx.tools.register(defineTool5({
    name: "read_image",
    description: "Read a PNG/JPEG/WebP/GIF file and return the image itself. " + "Large images are downscaled automatically; do not install image libraries or create thumbnails to inspect an image.",
    parameters: {
      file_path: { type: "string", required: true, description: "Path to the image file, resolved by the filesystem backend." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", required: true, description: "Canonical absolute path in the filesystem execution world." },
          image: IMAGE_VALUE_SCHEMA
        }
      },
      render: (_args, value) => imageReadContent(value),
      presentationMeta: (_args, value) => ({ path: value.path })
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (args.file_path.trim().length === 0)
        throw new Error("file_path must be a non-empty string");
      const extension = extname(args.file_path).toLowerCase();
      const declared = imageMediaTypeForPath(args.file_path);
      if (declared === undefined && extension !== "") {
        throw new Error(`cannot read "${args.file_path}": the ${extension} extension does not declare a supported image format; read_image accepts PNG/JPEG/WebP/GIF files, including extension-less files in those formats`);
      }
      const attachments = ctx.get("attachments");
      if (attachments === undefined) {
        throw new Error(`cannot read "${args.file_path}" as an image: no attachment service is mounted`);
      }
      if (declared !== undefined)
        assertDeploymentAccepts(attachments, declared, args.file_path);
      await assertImageCapableRoute(ctx, exec, args.file_path);
      const { target, info } = await resolveRegularReadTarget(ctx, exec, args.file_path);
      const byteCap = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes);
      const data = await ctx.fs.readBytes(target, exec.signal, byteCap);
      const mediaType = declared ?? sniffImageMediaType(data);
      if (mediaType === undefined) {
        throw new Error(`cannot read "${target.displayPath}": the file content is not a supported image format; read_image accepts PNG/JPEG/WebP/GIF`);
      }
      if (declared === undefined)
        assertDeploymentAccepts(attachments, mediaType, target.displayPath);
      let ref;
      try {
        ref = await attachments.saveImage({ data, mediaType, name: basename(target.displayPath) });
      } catch (error) {
        if (!(error instanceof AttachmentError))
          throw error;
        if (error.code === "IMAGE_DIMENSION_TOO_LARGE") {
          throw new Error(`cannot read "${target.displayPath}": at least one image side exceeds the ${attachments.imageLimits.maxImageDimension}px limit; downscale the image and read the smaller copy`, { cause: error });
        }
        if (error.code === "IMAGE_TOO_MANY_PIXELS") {
          throw new Error(`cannot read "${target.displayPath}": the image exceeds the ${attachments.imageLimits.maxImagePixels}-pixel decoded-size limit; downscale the image and read the smaller copy`, { cause: error });
        }
        if (error.code === "IMAGE_TOO_LARGE") {
          throw new Error(`cannot read "${target.displayPath}": the image cannot be stored within the deployment's byte limits; downscale the image and read the smaller copy`, { cause: error });
        }
        if (error.code === "ATTACHMENT_WRITE_FAILED" && /16-bit PNG/iu.test(error.message)) {
          throw new Error(`cannot read "${target.displayPath}": the 16-bit PNG could not be converted to the normalized 8-bit sRGB form; convert it to an 8-bit PNG/JPEG/WebP and retry`, { cause: error });
        }
        if (error.code === "INVALID_IMAGE" && declared === undefined) {
          throw new Error(`cannot read "${target.displayPath}": the bytes do not decode as a supported PNG/JPEG/WebP/GIF image; the file may be truncated or corrupt`, { cause: error });
        }
        if (error.code !== "IMAGE_TYPE_MISMATCH")
          throw error;
        if (declared === undefined) {
          throw new Error(`cannot read "${target.displayPath}": the file signature claims ${mediaType}, but the bytes decode as a different image format; the file may be corrupt`, { cause: error });
        }
        throw new Error(`cannot read "${target.displayPath}": the ${extension} extension declares ${mediaType}, but the bytes use a different image format; rename the file to match its actual format if it is PNG/JPEG/WebP/GIF, or convert it to one of those formats`, { cause: error });
      }
      ctx.emit("fs/observed", target, { kind: "present", version: info.version }, exec);
      const value = {
        path: ctx.fs.processPath(target),
        image: {
          attachmentId: ref.attachmentId,
          mediaType: ref.mediaType,
          bytes: ref.bytes,
          width: ref.width,
          height: ref.height,
          ...ref.name === undefined ? {} : { name: ref.name },
          ...ref.originalDimensions === undefined ? {} : {
            originalDimensions: { ...ref.originalDimensions }
          }
        }
      };
      return value;
    },
    presentCall(args) {
      return {
        card: "generic",
        title: `Read image ${args.file_path}`,
        kind: "read",
        locations: [{ path: args.file_path }]
      };
    }
  }));
}

// src/tool-fs/sandbox.ts
import { ESCALATION_TARGETS, approveEscalation, escalationHintMarker, sandboxDenialMarker, sandboxPermissionsDescription, validateEscalationArgs } from "@deepseek-ai/dsh-sandbox";
import { FsError as FsError8 } from "@deepseek-ai/dsh-fs";

class FsSandboxController {
  ctx;
  escalationModes;
  policy;
  constructor(ctx) {
    this.ctx = ctx;
    const defaultMode = ctx.fs.sandboxMode;
    this.escalationModes = defaultMode === undefined ? [] : ESCALATION_TARGETS;
    this.policy = defaultMode === undefined ? undefined : ctx.get("sandboxPolicy");
    if (defaultMode !== undefined && this.policy === undefined) {
      throw new Error("tool-fs: the mounted filesystem confines but ctx.sandboxPolicy is missing");
    }
  }
  schemaFields() {
    return {
      sandbox_permissions: {
        type: "string",
        enum: [...this.escalationModes],
        description: sandboxPermissionsDescription("operation")
      },
      justification: {
        type: "string",
        description: "Required with sandbox_permissions: one sentence for the user explaining " + "why this exact file operation needs the wider access. Use the language of the user’s current request."
      }
    };
  }
  async resolvePolicy(toolName, args, exec) {
    const standingPolicy = this.policy?.resolve({ ...exec.agent ? { session: exec.agent.session } : {} });
    if (args.sandbox_permissions !== undefined && args.sandbox_permissions === standingPolicy?.mode)
      return standingPolicy;
    const justification = args.sandbox_permissions === undefined && args.justification?.trim() === "" ? undefined : args.justification;
    validateEscalationArgs(args.sandbox_permissions, justification);
    if (args.sandbox_permissions === undefined || args.justification === undefined) {
      return standingPolicy;
    }
    if (this.escalationModes.length === 0) {
      throw new Error("sandbox_permissions is not available in this composition (no sandboxing filesystem to escalate)");
    }
    const policy = standingPolicy;
    const approvedMode = await approveEscalation({ requestedMode: args.sandbox_permissions, justification: args.justification, effectiveMode: policy.mode, subject: "operation" }, {
      approver: this.ctx.get("approval"),
      agent: exec.agent,
      callId: exec.callId,
      toolName,
      signal: exec.signal
    });
    return { ...policy, mode: approvedMode };
  }
  mapError(error, policy) {
    if (!(error instanceof FsError8) || error.code !== "FS_SANDBOX_DENIED")
      return error;
    const mode = policy.mode;
    return new FsError8(`${sandboxDenialMarker(mode)}
${escalationHintMarker("operation")}`, "FS_SANDBOX_DENIED", { cause: error });
  }
}

// src/tool-fs/index.ts
var name = "tool-fs";
var inject = ["tools", "fs", "systemPrompt", "workingDirectory", "totem"];
var Config = z.object({
  read: z.boolean().default(true),
  readImage: z.boolean().default(true),
  write: z.boolean().default(true),
  edit: z.boolean().default(true),
  applyPatch: z.boolean().default(false),
  readLimit: z.number().default(READ_LIMIT),
  readMaxLineLength: z.number().default(READ_MAX_LINE_LENGTH),
  readMaxBytes: z.number().default(READ_MAX_BYTES),
  readStreamMinSize: z.number().default(STREAM_MIN_SIZE)
});
function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`tool-fs: ${name} must be a positive integer`);
  }
}
function apply(ctx, config) {
  const resolved = config;
  assertPositiveInteger("readLimit", resolved.readLimit);
  assertPositiveInteger("readMaxLineLength", resolved.readMaxLineLength);
  assertPositiveInteger("readMaxBytes", resolved.readMaxBytes);
  assertPositiveInteger("readStreamMinSize", resolved.readStreamMinSize);
  if (resolved.read) {
    applyReadTool(ctx, {
      limit: resolved.readLimit,
      maxLineLength: resolved.readMaxLineLength,
      maxBytes: resolved.readMaxBytes,
      streamMinSize: resolved.readStreamMinSize
    });
  }
  if (resolved.readImage) {
    ctx.inject(["attachments"], (imageCtx) => {
      applyReadImageTool(imageCtx);
    });
  }
  if (resolved.write || resolved.edit || resolved.applyPatch) {
    const sandbox = new FsSandboxController(ctx);
    if (resolved.write)
      applyWriteTool(ctx, sandbox);
    if (resolved.edit)
      applyEditTool(ctx, sandbox);
    if (resolved.applyPatch)
      applyApplyPatchTool(ctx, sandbox);
  }
}
export {
  Config,
  apply,
  inject,
  name
};

//# debugId=501074335C0FD5CB64756E2164756E21
//# sourceMappingURL=index.js.map
