window.__ModuleLoader__.load({
  id: "dsh-totem",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// src/client/index.tsx
var exports_client = {};
__export(exports_client, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(exports_client);

// src/client/TotemMemoryCard.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/controller.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function routeKey(provider, model) {
  return `${provider}\x00${model}`;
}
function parseRouteKey(key) {
  if (key === "")
    return { provider: "", model: "" };
  const at = key.indexOf("\x00");
  return at < 0 ? { provider: key, model: "" } : { provider: key.slice(0, at), model: key.slice(at + 1) };
}
function storedRoute(value) {
  if (value === undefined)
    return "";
  const provider = typeof value.provider === "string" ? value.provider.trim() : "";
  const model = typeof value.model === "string" ? value.model.trim() : "";
  return provider.length > 0 && model.length > 0 ? routeKey(provider, model) : "";
}

class TotemMemoryCardController {
  scope;
  ctx;
  groups = [];
  failures = [];
  catalogStatus = "idle";
  draft;
  draftRevision;
  saving = false;
  failed = false;
  conflicted = false;
  disposed = false;
  saveGeneration = 0;
  catalogGeneration = 0;
  store;
  unsubscribe;
  constructor(scope, ctx) {
    this.scope = scope;
    this.ctx = ctx;
    this.store = import_dsh_client_store.createSnapshotStore(this.projection());
    this.unsubscribe = scope.subscribe(() => {
      const snapshot = this.scope.getSnapshot();
      if (!this.saving && this.draft !== undefined && snapshot.revision !== this.draftRevision) {
        if (storedRoute(snapshot.value) === this.draft)
          this.clearDraft();
        else
          this.conflicted = true;
      }
      this.publish();
    });
    this.loadCatalog();
  }
  dispose() {
    this.disposed = true;
    this.saveGeneration += 1;
    this.catalogGeneration += 1;
    this.unsubscribe();
  }
  inject() {
    return {
      hooks: { totemMemoryCard: this.store },
      select: (key) => {
        this.select(key);
      },
      save: () => {
        this.save();
      },
      discard: () => {
        this.discard();
      },
      retryCatalog: () => {
        this.loadCatalog();
      }
    };
  }
  refreshCatalog() {
    if (this.disposed)
      return;
    this.catalogGeneration += 1;
    this.catalogStatus = "idle";
    this.loadCatalog();
  }
  current() {
    return storedRoute(this.scope.getSnapshot().value);
  }
  requested() {
    return this.draft ?? this.current();
  }
  select(key) {
    const snapshot = this.scope.getSnapshot();
    if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving)
      return;
    if (this.draft === undefined)
      this.draftRevision = snapshot.revision;
    this.draft = key;
    this.failed = false;
    this.conflicted = false;
    this.publish();
  }
  discard() {
    if (this.saving)
      return;
    this.clearDraft();
    this.publish();
  }
  clearDraft() {
    this.draft = undefined;
    this.draftRevision = undefined;
    this.failed = false;
    this.conflicted = false;
  }
  async save() {
    const snapshot = this.scope.getSnapshot();
    const desired = this.requested();
    if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving || desired === this.current())
      return;
    if (this.draft !== undefined && snapshot.revision !== this.draftRevision) {
      this.conflicted = true;
      this.publish();
      return;
    }
    const route = parseRouteKey(desired);
    const generation = this.saveGeneration;
    this.saving = true;
    this.failed = false;
    this.conflicted = false;
    this.publish();
    await this.scope.mutate([
      { op: "set", path: ["provider"], value: route.provider },
      { op: "set", path: ["model"], value: route.model }
    ], this.draftRevision);
    if (generation !== this.saveGeneration)
      return;
    const landed = this.current() === desired;
    this.saving = false;
    this.failed = !landed;
    if (landed)
      this.clearDraft();
    this.publish();
  }
  async loadCatalog() {
    if (this.disposed || this.catalogStatus === "loading")
      return;
    const generation = this.catalogGeneration;
    this.catalogStatus = "loading";
    this.publish();
    const response = await this.ctx.remote.session.modelCatalog();
    if (generation !== this.catalogGeneration)
      return;
    if (response.ok) {
      this.groups = response.value.groups;
      this.failures = response.value.failures;
      this.catalogStatus = "ready";
    } else {
      this.catalogStatus = "error";
    }
    this.publish();
  }
  projection() {
    const snapshot = this.scope.getSnapshot();
    const current = this.current();
    const requested = this.requested();
    return {
      available: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: current !== requested,
      invalid: requested !== "" && requested !== current && !this.known(requested),
      saving: this.saving,
      failed: this.failed,
      current,
      requested,
      groups: this.groups,
      failures: this.failures,
      catalogStatus: this.catalogStatus,
      catalogPartial: this.failures.length > 0,
      conflicted: this.conflicted
    };
  }
  known(key) {
    const route = parseRouteKey(key);
    return this.groups.some((group) => group.id === route.provider && group.models.some((model) => model.id === route.model));
  }
  publish() {
    this.store.set(this.projection());
  }
}

// src/client/TotemMemoryCard.tsx
var jsx_runtime = require("react/jsx-runtime");
var LABELS = {
  unavailable: "This deployment does not serve the Totem settings row.",
  readOnly: "This deployment stores settings read-only.",
  saveFailed: "The deployment did not accept this model; the previous choice is still active.",
  save: "Save",
  saving: "Saving…"
};
var SELECT_STYLE = {
  width: "100%",
  maxWidth: 460,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border, #3a3a3a)",
  background: "var(--dsw-alias-bg-secondary, transparent)",
  color: "inherit",
  fontSize: 13
};
var HELP_STYLE = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-text-secondary, #9a9a9a)"
};
function TotemMemoryCard(props) {
  const state = props.useTotemMemoryCard((snapshot) => snapshot);
  if (props.view === "summary")
    return /* @__PURE__ */ jsx_runtime.jsx("span", {
      children: "Choose the model that writes Totem memories."
    });
  const requested = parseRouteKey(state.requested);
  const storedUnavailable = state.requested !== "" && !state.dirty && !state.groups.some((group) => group.id === requested.provider && group.models.some((model) => model.id === requested.model));
  return /* @__PURE__ */ jsx_runtime.jsx(import_dsh_client_ui_primitives.SettingsForm, {
    labels: LABELS,
    state,
    onSave: props.save,
    onDiscard: props.discard,
    children: /* @__PURE__ */ jsx_runtime.jsxs("div", {
      style: { display: "flex", flexDirection: "column", gap: 8 },
      children: [
        /* @__PURE__ */ jsx_runtime.jsx("label", {
          htmlFor: "dsh-totem-memory-model",
          style: { fontSize: 13, fontWeight: 600 },
          children: "Memory model"
        }),
        /* @__PURE__ */ jsx_runtime.jsxs("select", {
          id: "dsh-totem-memory-model",
          style: SELECT_STYLE,
          value: state.requested,
          disabled: !state.writable || state.saving || state.catalogStatus === "loading",
          onChange: (event) => {
            props.select(event.target.value);
          },
          children: [
            /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: "",
              children: "Deployment default"
            }),
            state.groups.map((group) => /* @__PURE__ */ jsx_runtime.jsx("optgroup", {
              label: group.name.length > 0 ? group.name : group.id,
              children: group.models.map((model) => /* @__PURE__ */ jsx_runtime.jsx("option", {
                value: routeKey(group.id, model.id),
                children: model.name.length > 0 ? model.name : model.id
              }, routeKey(group.id, model.id)))
            }, group.id)),
            storedUnavailable ? /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: state.requested,
              children: `${requested.provider} / ${requested.model} (unavailable)`
            }) : null
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx("p", {
          style: HELP_STYLE,
          children: "The model that writes Totem memories after file reads and edits. Leave the deployment default to reuse your main agent model, or pick any model from any configured provider."
        }),
        state.catalogStatus === "error" ? /* @__PURE__ */ jsx_runtime.jsxs("p", {
          style: HELP_STYLE,
          role: "status",
          children: [
            "The model catalog is unavailable.",
            " ",
            /* @__PURE__ */ jsx_runtime.jsx("button", {
              type: "button",
              onClick: props.retryCatalog,
              children: "Retry"
            })
          ]
        }) : null,
        state.catalogPartial ? /* @__PURE__ */ jsx_runtime.jsx("p", {
          style: HELP_STYLE,
          role: "status",
          children: "Some providers could not be listed; their saved routes remain selectable."
        }) : null,
        state.conflicted ? /* @__PURE__ */ jsx_runtime.jsx("p", {
          style: HELP_STYLE,
          role: "status",
          children: "Settings changed elsewhere; reopen this page before saving."
        }) : null
      ]
    })
  });
}

// src/client/AssistantSection.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var jsx_runtime2 = require("react/jsx-runtime");
var TABS = [
  { id: "memory", label: "Memory" },
  { id: "candidates", label: "Candidates" },
  { id: "reminders", label: "Reminders" },
  { id: "watches", label: "Watches" },
  { id: "notifications", label: "Notifications" },
  { id: "laya", label: "Laya" }
];
var FIELD = {
  width: "100%",
  maxWidth: 520,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border, #3a3a3a)",
  background: "var(--dsw-alias-bg-secondary, transparent)",
  color: "inherit",
  fontSize: 13,
  boxSizing: "border-box"
};
var MUTED = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-text-secondary, #9a9a9a)"
};
var CARD = {
  border: "1px solid var(--dsw-alias-border, #333)",
  borderRadius: 8,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 4
};
var ROW_ACTIONS = { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" };
function AssistantSection(props) {
  const state = props.useAssistant((snapshot) => snapshot);
  const [draft, setDraft] = import_react.useState({
    ntfyUrl: state.config.ntfyUrl ?? "https://ntfy.sh",
    ntfyTopic: state.config.ntfyTopic ?? "",
    ntfyToken: state.config.ntfyToken ?? "",
    telegramBotToken: state.config.telegramBotToken ?? "",
    telegramChatId: state.config.telegramChatId ?? ""
  });
  const [watch, setWatch] = import_react.useState({ kind: "page", url: "", condition: "", interval: "15" });
  const [laya, setLaya] = import_react.useState({
    passThreshold: String(state.config.layaPassThreshold ?? 0.65),
    maxRetries: String(state.config.layaMaxRetries ?? 1),
    timeoutMs: String(state.config.layaTimeoutMs ?? 60000),
    stepChecks: state.config.layaStepChecks ?? "veto",
    stepCadence: state.config.layaStepCadence ?? "turn",
    stepMaxFeedback: String(state.config.layaStepMaxFeedback ?? 2),
    verifyCommand: state.config.layaVerifyCommand ?? "",
    verifyExternal: state.config.layaVerifyExternal ?? "off",
    verifyDisable: (state.config.layaVerifyDisable ?? []).join(", "),
    model: state.config.layaModel ?? "",
    questionsFile: state.config.layaQuestionsFile ?? ""
  });
  const configKey = JSON.stringify(state.config);
  import_react.useEffect(() => {
    setDraft({
      ntfyUrl: state.config.ntfyUrl ?? "https://ntfy.sh",
      ntfyTopic: state.config.ntfyTopic ?? "",
      ntfyToken: state.config.ntfyToken ?? "",
      telegramBotToken: state.config.telegramBotToken ?? "",
      telegramChatId: state.config.telegramChatId ?? ""
    });
    setLaya({
      passThreshold: String(state.config.layaPassThreshold ?? 0.65),
      maxRetries: String(state.config.layaMaxRetries ?? 1),
      timeoutMs: String(state.config.layaTimeoutMs ?? 60000),
      stepChecks: state.config.layaStepChecks ?? "veto",
      stepCadence: state.config.layaStepCadence ?? "turn",
      stepMaxFeedback: String(state.config.layaStepMaxFeedback ?? 2),
      verifyCommand: state.config.layaVerifyCommand ?? "",
      verifyExternal: state.config.layaVerifyExternal ?? "off",
      verifyDisable: (state.config.layaVerifyDisable ?? []).join(", "),
      model: state.config.layaModel ?? "",
      questionsFile: state.config.layaQuestionsFile ?? ""
    });
  }, [configKey]);
  return /* @__PURE__ */ jsx_runtime2.jsxs("div", {
    style: { display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" },
    children: [
      /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", gap: 6, flexWrap: "wrap" },
        children: [
          TABS.map((tab) => /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
            variant: state.tab === tab.id ? "primary" : "ghost",
            onClick: () => {
              props.setTab(tab.id);
            },
            children: tab.label
          }, tab.id)),
          /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
            variant: "ghost",
            onClick: props.refresh,
            disabled: state.status === "loading",
            children: "Refresh"
          })
        ]
      }),
      state.error === null ? null : /* @__PURE__ */ jsx_runtime2.jsx("p", {
        style: { ...MUTED, color: "var(--dsw-alias-text-error, #e5484d)" },
        role: "status",
        children: state.error
      }),
      state.notice === null ? null : /* @__PURE__ */ jsx_runtime2.jsx("p", {
        style: MUTED,
        role: "status",
        children: state.notice
      }),
      state.tab === "memory" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 8, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: { ...FIELD, flex: "1 1 320px" },
                value: state.project,
                placeholder: "Project path (absolute)",
                onChange: (event) => {
                  props.setProject(event.target.value);
                }
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: { ...FIELD, flex: "1 1 220px" },
                value: state.query,
                placeholder: "Search memory…",
                onChange: (event) => {
                  props.setQuery(event.target.value);
                },
                onKeyDown: (event) => {
                  if (event.key === "Enter")
                    props.search();
                }
              }),
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "outline",
                onClick: props.search,
                disabled: state.status === "loading",
                children: "Search"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Searches the selected project's Totem store. Leave the query empty to list recent memories."
          }),
          state.memories.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No memories."
          }) : state.memories.map((item, index) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  item.type === undefined ? "" : `[${item.type}] `,
                  item.title ?? item.id ?? ""
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13 },
                children: item.statement ?? ""
              }),
              item.tags === undefined || item.tags.length === 0 ? null : /* @__PURE__ */ jsx_runtime2.jsx("p", {
                style: MUTED,
                children: item.tags.join(" · ")
              })
            ]
          }, item.id ?? `${index}`))
        ]
      }) : null,
      state.tab === "candidates" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Memories distilled from completed turns, waiting for approval. Approved items are written to the project's Totem store."
          }),
          state.candidates.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No pending candidates."
          }) : state.candidates.map((candidate) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  "[",
                  candidate.type,
                  "] ",
                  candidate.title
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13 },
                children: candidate.statement
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("p", {
                style: MUTED,
                children: [
                  candidate.project,
                  " · ",
                  candidate.tags.join(" · ")
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: ROW_ACTIONS,
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "primary",
                    onClick: () => {
                      props.approve(candidate.id);
                    },
                    disabled: state.writing,
                    children: "Approve"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "ghost",
                    onClick: () => {
                      props.reject(candidate.id);
                    },
                    disabled: state.writing,
                    children: "Reject"
                  })
                ]
              })
            ]
          }, candidate.id))
        ]
      }) : null,
      state.tab === "reminders" ? /* @__PURE__ */ jsx_runtime2.jsx("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: state.reminders.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
          style: MUTED,
          children: state.status === "loading" ? "Loading…" : "No pending reminders. Ask the agent to remind you."
        }) : state.reminders.map((reminder) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
          style: CARD,
          children: [
            /* @__PURE__ */ jsx_runtime2.jsx("div", {
              style: { fontSize: 13, fontWeight: 600 },
              children: reminder.text
            }),
            /* @__PURE__ */ jsx_runtime2.jsxs("p", {
              style: MUTED,
              children: [
                new Date(reminder.nextAt).toLocaleString(),
                " · ",
                reminder.recurrence
              ]
            }),
            /* @__PURE__ */ jsx_runtime2.jsxs("div", {
              style: ROW_ACTIONS,
              children: [
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "outline",
                  onClick: () => {
                    props.snooze(reminder.id, 10);
                  },
                  disabled: state.writing,
                  children: "Snooze 10m"
                }),
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "ghost",
                  onClick: () => {
                    props.doneReminder(reminder.id);
                  },
                  disabled: state.writing,
                  children: "Done"
                }),
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "ghost",
                  onClick: () => {
                    props.cancelReminder(reminder.id);
                  },
                  disabled: state.writing,
                  children: "Cancel"
                })
              ]
            })
          ]
        }, reminder.id))
      }) : null,
      state.tab === "watches" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { ...CARD, gap: 8 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: "Add a watch"
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { display: "flex", gap: 8, flexWrap: "wrap" },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsxs("select", {
                    style: { ...FIELD, width: 160 },
                    value: watch.kind,
                    onChange: (event) => {
                      setWatch({ ...watch, kind: event.target.value });
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "page",
                        children: "Page changes"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "rss",
                        children: "Feed items"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "condition",
                        children: "Condition"
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: { ...FIELD, flex: "1 1 280px" },
                    placeholder: "https://…",
                    value: watch.url,
                    onChange: (event) => {
                      setWatch({ ...watch, url: event.target.value });
                    }
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: { ...FIELD, width: 110 },
                    placeholder: "minutes",
                    value: watch.interval,
                    onChange: (event) => {
                      setWatch({ ...watch, interval: event.target.value });
                    }
                  })
                ]
              }),
              watch.kind === "condition" ? /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                placeholder: "Condition (answered YES/NO)",
                value: watch.condition,
                onChange: (event) => {
                  setWatch({ ...watch, condition: event.target.value });
                }
              }) : null,
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                children: /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "primary",
                  disabled: state.writing || watch.url.trim().length === 0,
                  onClick: () => {
                    props.addWatch(watch);
                    setWatch({ kind: "page", url: "", condition: "", interval: "15" });
                  },
                  children: "Add watch"
                })
              })
            ]
          }),
          state.watches.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No watches."
          }) : state.watches.map((item) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  item.kind,
                  " · ",
                  item.url
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("p", {
                style: MUTED,
                children: [
                  "every ",
                  item.intervalMinutes,
                  "m · ",
                  item.active ? "active" : "stopped",
                  item.lastResult === undefined ? "" : ` · ${item.lastResult}`,
                  item.condition === undefined ? "" : ` · ${item.condition}`
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: ROW_ACTIONS,
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "outline",
                    onClick: () => {
                      props.runWatch(item.id);
                    },
                    disabled: state.writing,
                    children: "Run now"
                  }),
                  item.active ? /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "ghost",
                    onClick: () => {
                      props.cancelWatch(item.id);
                    },
                    disabled: state.writing,
                    children: "Stop"
                  }) : null
                ]
              })
            ]
          }, item.id))
        ]
      }) : null,
      state.tab === "laya" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "The judge runs on finished turns at the configured threshold; the verify lane and step checks run before it. The composer switch starts/stops the server."
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 12, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 160 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Pass threshold"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.passThreshold,
                    onChange: (event) => {
                      setLaya({ ...laya, passThreshold: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 140 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Retries / turn"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.maxRetries,
                    onChange: (event) => {
                      setLaya({ ...laya, maxRetries: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 170 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Request timeout (ms)"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.timeoutMs,
                    onChange: (event) => {
                      setLaya({ ...laya, timeoutMs: event.target.value });
                    }
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 12, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 160 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Step checks"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsxs("select", {
                    style: FIELD,
                    value: laya.stepChecks,
                    onChange: (event) => {
                      setLaya({ ...laya, stepChecks: event.target.value });
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "off",
                        children: "off"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "veto",
                        children: "veto"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "full",
                        children: "full"
                      })
                    ]
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 160 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Step cadence"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsxs("select", {
                    style: FIELD,
                    value: laya.stepCadence,
                    onChange: (event) => {
                      setLaya({ ...laya, stepCadence: event.target.value });
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "turn",
                        children: "turn"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "tool",
                        children: "tool"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "both",
                        children: "both"
                      })
                    ]
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 150 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Step feedback cap"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.stepMaxFeedback,
                    onChange: (event) => {
                      setLaya({ ...laya, stepMaxFeedback: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 150 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "External scanners"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsxs("select", {
                    style: FIELD,
                    value: laya.verifyExternal,
                    onChange: (event) => {
                      setLaya({ ...laya, verifyExternal: event.target.value });
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "off",
                        children: "off"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "auto",
                        children: "auto"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "on",
                        children: "on"
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Verify command (optional)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                placeholder: "pytest -q",
                value: laya.verifyCommand,
                onChange: (event) => {
                  setLaya({ ...laya, verifyCommand: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Disabled rules (comma-separated)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                placeholder: "external-semgrep, test-weakened",
                value: laya.verifyDisable,
                onChange: (event) => {
                  setLaya({ ...laya, verifyDisable: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 12, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, flex: "1 1 280px" },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Model path"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.model,
                    onChange: (event) => {
                      setLaya({ ...laya, model: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, flex: "1 1 280px" },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Questions file (optional)"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.questionsFile,
                    onChange: (event) => {
                      setLaya({ ...laya, questionsFile: event.target.value });
                    }
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsx("div", {
            style: ROW_ACTIONS,
            children: /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
              variant: "primary",
              disabled: state.writing,
              onClick: () => {
                props.saveLaya({
                  layaPassThreshold: Number(laya.passThreshold),
                  layaMaxRetries: Number(laya.maxRetries),
                  layaTimeoutMs: Number(laya.timeoutMs),
                  layaStepChecks: laya.stepChecks,
                  layaStepCadence: laya.stepCadence,
                  layaStepMaxFeedback: Number(laya.stepMaxFeedback),
                  layaVerifyCommand: laya.verifyCommand,
                  layaVerifyExternal: laya.verifyExternal,
                  layaVerifyDisable: laya.verifyDisable.split(",").map((value) => value.trim()).filter(Boolean),
                  layaModel: laya.model,
                  layaQuestionsFile: laya.questionsFile
                });
              },
              children: "Save Laya settings"
            })
          })
        ]
      }) : null,
      state.tab === "notifications" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Reminders and watches deliver through ntfy and/or Telegram. Leave a channel empty to disable it."
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "ntfy URL"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: draft.ntfyUrl,
                onChange: (event) => {
                  setDraft({ ...draft, ntfyUrl: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "ntfy topic"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: draft.ntfyTopic,
                onChange: (event) => {
                  setDraft({ ...draft, ntfyTopic: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "ntfy token (optional)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                type: "password",
                value: draft.ntfyToken,
                onChange: (event) => {
                  setDraft({ ...draft, ntfyToken: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Telegram bot token"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                type: "password",
                value: draft.telegramBotToken,
                onChange: (event) => {
                  setDraft({ ...draft, telegramBotToken: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Telegram chat id"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: draft.telegramChatId,
                onChange: (event) => {
                  setDraft({ ...draft, telegramChatId: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: ROW_ACTIONS,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "primary",
                onClick: () => {
                  props.saveConfig(draft);
                },
                disabled: state.writing,
                children: "Save"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "outline",
                onClick: props.testNotification,
                disabled: state.writing,
                children: "Send test"
              })
            ]
          })
        ]
      }) : null
    ]
  });
}

// src/client/assistant-controller.ts
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");
class AssistantController {
  form;
  ctx;
  store;
  unsubscribe;
  tab = "memory";
  project = "";
  query = "";
  memories = [];
  candidates = [];
  reminders = [];
  watches = [];
  status = "idle";
  error = null;
  notice = null;
  writing = false;
  disposed = false;
  constructor(form, ctx) {
    this.form = form;
    this.ctx = ctx;
    this.store = import_dsh_client_store2.createSnapshotStore(this.projection());
    this.unsubscribe = form.subscribe(() => {
      this.publish();
    });
    this.loadState();
  }
  dispose() {
    this.disposed = true;
    this.unsubscribe();
  }
  inject() {
    return {
      hooks: { assistant: this.store },
      setTab: (tab) => {
        this.setTab(tab);
      },
      setProject: (project) => {
        this.project = project;
        this.publish();
      },
      setQuery: (query) => {
        this.query = query;
        this.publish();
      },
      search: () => {
        this.search();
      },
      refresh: () => {
        this.refresh();
      },
      approve: (id) => {
        this.action(`/candidates/${encodeURIComponent(id)}/approve`, "Memory approved.");
      },
      reject: (id) => {
        this.action(`/candidates/${encodeURIComponent(id)}/reject`, "Candidate rejected.");
      },
      snooze: (id, minutes) => {
        this.action(`/reminders/${encodeURIComponent(id)}/snooze`, "Reminder snoozed.", { minutes });
      },
      doneReminder: (id) => {
        this.action(`/reminders/${encodeURIComponent(id)}/done`, "Reminder done.");
      },
      cancelReminder: (id) => {
        this.action(`/reminders/${encodeURIComponent(id)}/cancel`, "Reminder canceled.");
      },
      runWatch: (id) => {
        this.action(`/watches/${encodeURIComponent(id)}/run`, "Watch checked.");
      },
      cancelWatch: (id) => {
        this.action(`/watches/${encodeURIComponent(id)}/cancel`, "Watch stopped.");
      },
      addWatch: (draft) => {
        this.addWatch(draft);
      },
      saveConfig: (values) => {
        this.saveConfig(values);
      },
      saveLaya: (values) => {
        this.saveLaya(values);
      },
      testNotification: () => {
        this.testNotification();
      }
    };
  }
  config() {
    return this.form.getSnapshot().value ?? {};
  }
  token() {
    return this.config().apiToken?.trim() ?? "";
  }
  projection() {
    return {
      tab: this.tab,
      project: this.project,
      query: this.query,
      memories: this.memories,
      candidates: this.candidates,
      reminders: this.reminders,
      watches: this.watches,
      status: this.status,
      error: this.error,
      notice: this.notice,
      config: this.config(),
      writing: this.writing
    };
  }
  publish() {
    if (this.disposed)
      return;
    this.store.set(this.projection());
  }
  async loadState() {
    try {
      const state = await this.request("/state");
      if (this.project.length === 0)
        this.project = state.lastProject ?? "";
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
      this.publish();
    }
  }
  setTab(tab) {
    this.tab = tab;
    this.notice = null;
    this.error = null;
    this.refresh();
  }
  async request(path, init) {
    const token = this.token();
    if (token.length === 0)
      throw new Error("Set the assistant apiToken in the Totem plugin config first.");
    const response = await fetch(`/totem${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        authorization: `Bearer ${token}`,
        ...init?.body === undefined ? {} : { "content-type": "application/json" }
      }
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error ?? `request failed (${response.status})`);
    }
    return await response.json();
  }
  async refresh() {
    this.status = "loading";
    this.error = null;
    this.publish();
    try {
      if (this.tab === "memory")
        await this.search(false);
      else if (this.tab === "candidates") {
        const data = await this.request("/candidates");
        this.candidates = data.items.filter((item) => item.status === "pending");
      } else if (this.tab === "reminders") {
        const data = await this.request("/reminders");
        this.reminders = data.items.filter((item) => !item.done);
      } else if (this.tab === "watches") {
        const data = await this.request("/watches");
        this.watches = data.items;
      }
      this.status = "ready";
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
    }
    this.publish();
  }
  async search(publishLoading = true) {
    if (publishLoading) {
      this.status = "loading";
      this.publish();
    }
    const params = new URLSearchParams({ project: this.project, limit: "100" });
    if (this.query.trim().length > 0)
      params.set("query", this.query.trim());
    const data = await this.request(`/memories?${params.toString()}`);
    this.memories = data.items;
    this.status = "ready";
    this.publish();
  }
  async action(path, notice, bodyValue) {
    this.writing = true;
    this.error = null;
    this.publish();
    try {
      await this.request(path, {
        method: "POST",
        ...bodyValue === undefined ? {} : { body: JSON.stringify(bodyValue) }
      });
      this.notice = notice;
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
      this.publish();
    } finally {
      this.writing = false;
      this.publish();
    }
  }
  async addWatch(draft) {
    const interval = Number(draft.interval);
    this.writing = true;
    this.error = null;
    this.publish();
    try {
      await this.request("/watches", {
        method: "POST",
        body: JSON.stringify({
          kind: draft.kind,
          url: draft.url,
          condition: draft.condition,
          intervalMinutes: Number.isFinite(interval) && interval > 0 ? interval : 15
        })
      });
      this.notice = "Watch added.";
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
    } finally {
      this.writing = false;
      this.publish();
    }
  }
  async saveConfig(values) {
    const snapshot = this.form.getSnapshot();
    const fields = [
      "ntfyUrl",
      "ntfyTopic",
      "ntfyToken",
      "telegramBotToken",
      "telegramChatId"
    ];
    this.writing = true;
    this.publish();
    const ok = await this.form.mutate(fields.map((field) => ({
      op: "set",
      path: [field],
      value: values[field] ?? ""
    })), snapshot.revision);
    this.writing = false;
    this.notice = ok ? "Notification settings saved." : null;
    this.error = ok ? null : "The Host did not accept the notification settings.";
    this.publish();
  }
  async saveLaya(values) {
    const snapshot = this.form.getSnapshot();
    const fields = [
      "layaPassThreshold",
      "layaMaxRetries",
      "layaTimeoutMs",
      "layaStepChecks",
      "layaStepCadence",
      "layaStepMaxFeedback",
      "layaVerifyCommand",
      "layaVerifyExternal",
      "layaVerifyDisable",
      "layaModel",
      "layaQuestionsFile"
    ];
    this.writing = true;
    this.publish();
    const ok = await this.form.mutate(fields.map((field) => ({
      op: "set",
      path: [field],
      value: values[field]
    })), snapshot.revision);
    this.writing = false;
    this.notice = ok ? "Laya settings saved." : null;
    this.error = ok ? null : "The Host did not accept the Laya settings.";
    this.publish();
  }
  async testNotification() {
    this.writing = true;
    this.publish();
    try {
      const result = await this.request("/notify-test", {
        method: "POST",
        body: JSON.stringify({ title: "dsh-totem", message: "Notifications are configured correctly." })
      });
      this.notice = `Test sent: ${JSON.stringify(result)}`;
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.writing = false;
      this.publish();
    }
  }
}

// src/client/LayaSwitch.tsx
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var jsx_runtime3 = require("react/jsx-runtime");
var ROW = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  paddingInline: 2,
  whiteSpace: "nowrap"
};
var LABEL = {
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 500,
  color: "var(--dsw-alias-text-secondary, #9a9a9a)",
  userSelect: "none"
};
function LayaSwitch(props) {
  const state = props.useLayaSwitch((snapshot) => snapshot);
  const title = state.error !== null ? `Laya: ${state.error}` : state.enabled ? state.loaded ? "Laya decision engine is on" : "Laya decision engine is starting; the model is loading into VRAM…" : "Laya decision engine is off; the model is not loaded";
  return /* @__PURE__ */ jsx_runtime3.jsxs("span", {
    style: ROW,
    title,
    children: [
      /* @__PURE__ */ jsx_runtime3.jsxs("span", {
        style: { ...LABEL, ...state.error === null ? {} : { color: "var(--dsw-alias-text-error, #e5484d)" } },
        children: [
          "Laya",
          state.enabled && !state.loaded ? " · loading" : ""
        ]
      }),
      /* @__PURE__ */ jsx_runtime3.jsx(import_dsh_client_ui_primitives3.Switch, {
        checked: state.enabled,
        onChange: () => {
          props.toggle();
        },
        label: "Laya decision engine",
        disabled: state.busy,
        title
      })
    ]
  });
}

// src/client/laya-switch.ts
var import_dsh_client_store3 = require("@deepseek-ai/dsh-client-store");

class LayaSwitchController {
  form;
  ctx;
  store;
  unsubscribe;
  timer;
  disposed = false;
  constructor(form, ctx) {
    this.form = form;
    this.ctx = ctx;
    this.store = import_dsh_client_store3.createSnapshotStore({ enabled: false, healthy: false, loaded: false, busy: false, error: null });
    this.unsubscribe = form.subscribe(() => {
      this.publish();
    });
    this.timer = setInterval(() => {
      this.refresh();
    }, 5000);
    this.refresh();
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    this.unsubscribe();
  }
  inject() {
    return {
      hooks: { layaSwitch: this.store },
      toggle: () => {
        this.toggle();
      },
      refresh: () => {
        this.refresh();
      }
    };
  }
  token() {
    return this.form.getSnapshot().value?.apiToken?.trim() ?? "";
  }
  publish() {
    if (!this.disposed)
      this.store.set(this.store.getSnapshot());
  }
  update(patch) {
    if (this.disposed)
      return;
    this.store.set({ ...this.store.getSnapshot(), ...patch });
  }
  async request(path, method) {
    const token = this.token();
    if (token.length === 0)
      throw new Error("Set the assistant apiToken in the Totem plugin config first.");
    const response = await fetch(`/totem${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error ?? `request failed (${response.status})`);
    }
    return await response.json();
  }
  async refresh() {
    try {
      const status = await this.request("/laya/status", "GET");
      this.update({ enabled: status.enabled, healthy: status.healthy, loaded: status.loaded, error: null });
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : String(error) });
    }
  }
  async toggle() {
    if (this.store.getSnapshot().busy)
      return;
    const next = !this.store.getSnapshot().enabled;
    this.update({ busy: true, enabled: next, loaded: false, error: null });
    try {
      const status = await this.request(next ? "/laya/enable" : "/laya/disable", "POST");
      this.update({ enabled: status.enabled, healthy: status.healthy, loaded: status.loaded, busy: false });
    } catch (error) {
      this.update({ busy: false, error: error instanceof Error ? error.message : String(error) });
      this.refresh();
    }
  }
}

// src/client/DecisionBadge.tsx
var import_react2 = require("react");
var jsx_runtime4 = require("react/jsx-runtime");
function DecisionBadge(props) {
  const [decision, setDecision] = import_react2.useState(null);
  import_react2.useEffect(() => {
    let active = true;
    let timer;
    let tries = 0;
    const tick = async () => {
      const found = await props.lookup(props.messageId);
      if (!active)
        return;
      if (found !== null) {
        setDecision(found);
        return;
      }
      if (tries++ < 10)
        timer = setTimeout(() => {
          tick();
        }, 1500);
    };
    tick();
    return () => {
      active = false;
      if (timer !== undefined)
        clearTimeout(timer);
    };
  }, [props.messageId]);
  if (decision === null)
    return null;
  const color = decision.verdict === "pass" ? "var(--dsw-alias-text-success, #46a758)" : decision.verdict === "fail" ? "var(--dsw-alias-text-error, #e5484d)" : "var(--dsw-alias-text-warning, #f5a524)";
  const score = decision.composite === null ? "" : ` ${decision.composite.toFixed(2)}`;
  return /* @__PURE__ */ jsx_runtime4.jsxs("span", {
    title: `Laya decision: ${decision.verdict}${score}`,
    style: { fontSize: 11, lineHeight: "16px", color, whiteSpace: "nowrap", userSelect: "none" },
    children: [
      "· Decision ",
      decision.verdict,
      score
    ]
  });
}

// src/client/decision-badge.ts
class DecisionBadgeController {
  form;
  constructor(form) {
    this.form = form;
  }
  lookup = async (messageId) => {
    const token = this.form.getSnapshot().value?.apiToken?.trim() ?? "";
    if (token.length === 0 || messageId.length === 0)
      return null;
    try {
      const response = await fetch(`/totem/decisions?message=${encodeURIComponent(messageId)}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok)
        return null;
      const data = await response.json();
      return data.decision ?? null;
    } catch {
      return null;
    }
  };
}

// src/client/index.tsx
var inject = ["slots", "remote", "remote.session", "configForms"];
function apply(ctx) {
  const card = new TotemMemoryCardController(ctx.configForms.get("totem"), ctx);
  ctx.effect(() => () => {
    card.dispose();
  }, "dsh-totem: model card lifetime");
  const face = card.inject();
  ctx.effect(() => ctx.remote.$on("llm/adapters-updated", () => {
    card.refreshCatalog();
  }), "dsh-totem: adapter invalidations");
  ctx.effect(() => ctx.remote.$on("settings/document-updated", () => {
    card.refreshCatalog();
  }), "dsh-totem: settings invalidations");
  ctx.effect(() => ctx.on("connection/reset", () => {
    card.refreshCatalog();
  }), "dsh-totem: connection resets");
  const layaSwitch = new LayaSwitchController(ctx.configForms.get("totem"), ctx);
  ctx.effect(() => () => {
    layaSwitch.dispose();
  }, "dsh-totem: laya switch lifetime");
  ctx.effect(() => ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
    name: "conversation.input.left",
    id: "laya",
    order: 10,
    inject: () => layaSwitch.inject()
  }, LayaSwitch)), "dsh-totem: laya switch");
  const decisionBadge = new DecisionBadgeController(ctx.configForms.get("totem"));
  ctx.effect(() => ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
    name: "conversation.chat.assistant-actions",
    id: "laya-decision",
    order: 20,
    inject: () => ({ lookup: decisionBadge.lookup })
  }, DecisionBadge)), "dsh-totem: decision badge");
  const assistant = new AssistantController(ctx.configForms.get("totem"), ctx);
  ctx.effect(() => () => {
    assistant.dispose();
  }, "dsh-totem: assistant section lifetime");
  const assistantFace = assistant.inject();
  ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "assistant",
    order: 30,
    label: () => "Assistant",
    inject: () => assistantFace
  }, AssistantSection)), "dsh-totem: assistant section");
  ctx.effect(() => ctx.configForms.whileServed(["totem"], () => ctx.slots.inject("plugins.item", () => ctx.slots.register({
    name: "plugins.item",
    id: "totem",
    order: 60,
    label: () => "Totem memory",
    inject: () => face
  }, TotemMemoryCard))), "dsh-totem: settings page");
}

    return module.exports;
  }
});
