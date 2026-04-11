(function () {
  window.IndustryModules = window.IndustryModules || {};
  const moduleRef = window.IndustryModules.TMT || { key: "TMT", label: "TMT" };
  window.IndustryModules.TMT = moduleRef;

  const STYLE_ID = "tmt-master-style";
  const STORAGE_KEY = "equityscan.master.tmt.sessions";
  const REPORT_STORAGE_KEY = "equityscan.master.tmt.reports";
  const API_BASE_URL = window.APP_CONFIG?.apiBaseUrl || (window.location.protocol === "file:" ? "http://localhost:8000" : "");
  const state = { activeChatId: "", historyOpen: false, mode: "chat" };

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

  function sanitizeReportHtml(value) {
    const template = document.createElement("template");
    template.innerHTML = String(value || "");
    template.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());
    template.content.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const val = String(attr.value || "");
        if (name.startsWith("on") || name === "style") node.removeAttribute(attr.name);
        if ((name === "href" || name === "src") && /^\s*javascript:/i.test(val)) node.removeAttribute(attr.name);
      });
    });
    return template.innerHTML;
  }

  function normalize(value) {
    return String(value ?? "").trim().toUpperCase();
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      .master-shell{display:flex;flex-direction:column;min-height:calc(100vh - 70px);background:linear-gradient(180deg,#0a0f16,#0c1118)}
      .master-toolbar{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:20px 24px 0}
      .master-toolbar-left{position:relative;display:flex;align-items:flex-start}
      .master-history-toggle{border:1px solid rgba(91,140,255,.24);background:rgba(91,140,255,.09);color:#e5eeff;padding:11px 14px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:10px;transition:background .18s ease,border-color .18s ease}
      .master-history-toggle:hover{background:rgba(91,140,255,.13);border-color:rgba(91,140,255,.34)}
      .master-history-toggle i{transition:transform .18s ease}
      .master-history-toggle.open i{transform:rotate(180deg)}
      .master-history-pop{position:absolute;top:52px;left:0;width:340px;max-height:0;border:1px solid rgba(255,255,255,.08);background:#0f1520;box-shadow:0 20px 44px rgba(0,0,0,.38);padding:0 12px;display:flex;flex-direction:column;gap:10px;z-index:8;opacity:0;overflow:hidden;transform:translateY(-8px) scaleY(.98);transform-origin:top left;pointer-events:none;transition:opacity .2s ease,transform .22s ease,max-height .22s ease,padding .22s ease}
      .master-history-pop.open{max-height:620px;opacity:1;transform:translateY(0) scaleY(1);padding:12px;pointer-events:auto}
      .master-head-block{text-align:left;min-width:0}
      .master-toolbar-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .master-mode-toggle{display:inline-flex;align-items:center;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);padding:3px}
      .master-mode-btn{border:none;background:transparent;color:#91a1b8;padding:8px 12px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:background .18s ease,color .18s ease}
      .master-mode-btn.active{background:rgba(91,140,255,.16);color:#f8fbff}
      .master-side-kicker{color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
      .master-side-title{color:#f8fafc;font-size:20px;font-weight:800;line-height:1.1}
      .master-new-btn{border:1px solid rgba(91,140,255,.24);background:rgba(91,140,255,.09);color:#e5eeff;padding:12px 14px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;gap:10px;justify-content:center;transition:padding .18s ease,gap .18s ease}
      .master-history{display:flex;flex-direction:column;gap:8px;overflow-y:auto;padding-right:2px;max-height:min(48vh,480px)}
      .master-history-item{width:100%;border:1px solid var(--panel-border);background:rgba(255,255,255,.015);padding:12px;cursor:pointer;text-align:left;transition:background .18s ease,border-color .18s ease,padding .18s ease}
      .master-history-item.active{border-color:rgba(91,140,255,.52);background:rgba(91,140,255,.08)}
      .master-history-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
      .master-history-copy{min-width:0;flex:1 1 auto;background:transparent;border:none;padding:0;text-align:left;cursor:pointer}
      .master-history-actions{display:flex;gap:6px;flex:0 0 auto}
      .master-history-btn{width:28px;height:28px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:#94a3b8;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .18s ease,border-color .18s ease,color .18s ease}
      .master-history-btn:hover{background:rgba(91,140,255,.08);border-color:rgba(91,140,255,.24);color:#dbe6ff}
      .master-history-title{color:#f8fafc;font-size:12px;font-weight:700;line-height:1.5}
      .master-chat{flex:1;display:flex;flex-direction:column;min-height:0}
      .master-messages{flex:1;overflow-y:auto;padding:20px 28px 0;display:flex;flex-direction:column;gap:14px}
      .master-empty{flex:1;display:flex;align-items:center;justify-content:center;padding:20px 28px 18px}
      .master-empty-inner{max-width:760px;text-align:center}
      .master-empty-title{color:#f8fafc;font-size:20px;font-weight:800;line-height:1.08}
      .master-empty-copy{color:#8fa2b8;font-size:16px;line-height:1.8;margin-top:14px}
      .master-message{display:flex}
      .master-message.user{justify-content:flex-end}
      .master-bubble{max-width:min(900px,100%);border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:#e5ecf5;padding:14px 16px;font-size:14px;line-height:1.8;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
      .master-message.user .master-bubble{background:rgba(91,140,255,.12);border-color:rgba(91,140,255,.3)}
      .master-thinking{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);padding:14px 16px;transition:padding .2s ease,background .2s ease,border-color .2s ease}
      .master-thinking.collapsed{padding:10px 14px;background:rgba(255,255,255,.018)}
      .master-thinking-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .master-thinking-toggle{border:none;background:transparent;color:#cbd5e1;display:inline-flex;align-items:center;gap:8px;padding:0;cursor:pointer}
      .master-thinking-kicker{color:#cbd5e1;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
      .master-thinking-caret{font-size:11px;transition:transform .18s ease}
      .master-thinking.collapsed .master-thinking-caret{transform:rotate(-90deg)}
      .master-thinking-list{display:flex;flex-direction:column;gap:7px;margin-top:10px;max-height:320px;opacity:1;overflow:hidden;transition:max-height .22s ease,opacity .18s ease,margin .18s ease}
      .master-thinking.collapsed .master-thinking-list{max-height:0;opacity:0;margin-top:0}
      .master-thinking-item{color:#9fb0c5;font-size:13px;line-height:1.5;transition:color .18s ease,transform .18s ease,opacity .18s ease}
      .master-thinking-item.done{color:#b9c8db}
      .master-thinking-item.active{color:#dcfce7;animation:masterThinkingPulse 1.1s ease-in-out infinite}
      .master-thinking-summary{display:none;color:#9fb0c5;font-size:12px;line-height:1.5;margin-top:8px}
      .master-thinking.collapsed .master-thinking-summary{display:block}
      @keyframes masterThinkingPulse{0%{opacity:.7;transform:translateX(0)}50%{opacity:1;transform:translateX(4px)}100%{opacity:.7;transform:translateX(0)}}
      .master-card{margin-top:12px;border:1px solid rgba(91,140,255,.18);background:rgba(91,140,255,.05);padding:12px}
      .master-card-title{color:#fff;font-size:16px;font-weight:800;line-height:1.3}
      .master-card-meta{color:#b8c7e0;font-size:11px;line-height:1.6;margin-top:6px}
      .master-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .master-action-btn{border:1px solid rgba(91,140,255,.22);background:rgba(91,140,255,.1);color:#e8efff;padding:9px 12px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
      .master-report{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);padding:18px;color:#dfe8f5}
      .master-report h2{color:#fff;font-size:20px;line-height:1.25;margin:0 0 14px}
      .master-report h3{color:#f8fafc;font-size:14px;line-height:1.35;margin:18px 0 8px;letter-spacing:.04em;text-transform:uppercase}
      .master-report p{margin:8px 0;color:#d9e2ef}
      .master-report ul{margin:8px 0 8px 18px;padding:0}
      .master-report li{margin:5px 0}
      .master-report table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
      .master-report th,.master-report td{border:1px solid rgba(255,255,255,.08);padding:8px;text-align:left;vertical-align:top}
      .master-report th{color:#fff;background:rgba(91,140,255,.08)}
      .master-report a{color:#a8c7ff}
      .master-input-shell{padding:18px 28px 24px}
      .master-input-wrap{border:1px solid var(--panel-border);background:rgba(255,255,255,.02);padding:12px;display:flex;gap:12px;align-items:center}
      .master-input-mode{display:inline-flex;align-items:center;align-self:center;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);padding:3px;flex:0 0 auto}
      .master-input-mode-btn{border:none;background:transparent;color:#91a1b8;padding:9px 11px;font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;cursor:pointer;transition:background .18s ease,color .18s ease}
      .master-input-mode-btn.active{background:rgba(91,140,255,.16);color:#f8fbff}
      .master-input{flex:1 1 auto;min-height:56px;max-height:180px;resize:none;border:none;background:transparent;color:#f8fafc;font-size:14px;line-height:1.7;outline:none;font-family:inherit;padding:10px 0}
      .master-send{border:1px solid rgba(91,140,255,.24);background:rgba(91,140,255,.1);color:#e6eeff;height:44px;padding:0 16px;font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;cursor:pointer;flex:0 0 auto}
      @media (max-width:1080px){.master-toolbar{align-items:stretch}.master-head-block{text-align:left}.master-history-pop{width:min(100%,340px)}}
    `;
    document.head.appendChild(styleEl);
  }

  function getIndustryContext(industryKey) {
    const mod = window.IndustryModules?.[industryKey] || moduleRef || {};
    const chain = window.TMTIndustryChainData || {};
    const nodes = Array.isArray(chain.nodes) ? chain.nodes : [];
    const flows = Array.isArray(chain.flows) ? chain.flows : [];
    return {
      key: String(industryKey || moduleRef.key || "TMT"),
      label: String(mod.label || moduleRef.label || industryKey || "Industry"),
      sidebarTitle: String(mod.sidebar?.title || ""),
      glossaryContext: String(mod.glossary?.llmContext || ""),
      companyContext: "TMT company directory contains parents, subsegments, summaries, and US tickers.",
      chainContext: nodes.length ? `TMT chain contains ${nodes.length} nodes and ${flows.length} flows. Nodes include ${nodes.slice(0, 10).map((n) => `N${n["Node ID"]} ${n["Node Name"]}`).join("; ")}.` : ""
    };
  }

  function createSession() {
    const id = `master-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      title: "New Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      memory: {
        glossary: { pendingEntry: null, lastLookupTerm: "", lastResolvedAssistantResponse: "" },
        company: { lastResolvedCompanyId: "" },
        industry: { lastResolvedNodeId: null, lastResolvedCompanyId: "" }
      },
      messages: []
    };
  }

  function loadSessions() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveSessions(sessions) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  function loadReports() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(REPORT_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveReportSnapshot(reportId, report) {
    const reports = loadReports();
    reports[reportId] = report;
    window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
  }

  function downloadReportDoc(reportId) {
    const report = loadReports()[reportId];
    if (!report) return;
    const title = String(report.title || "Company Analysis Report").replace(/[\\/:*?"<>|]/g, " ").trim();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#111;line-height:1.45}h1{font-size:22px}h2{font-size:18px;margin-top:20px}h3{font-size:14px;margin-top:16px;text-transform:uppercase}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}th{background:#eee}</style></head><body><h1>${escapeHtml(title)}</h1>${report.html || ""}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title || "company-analysis-report"}.doc`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function ensureSessions() {
    const sessions = loadSessions();
    if (sessions.length) return sessions;
    const seed = [createSession()];
    saveSessions(seed);
    return seed;
  }

  function getActiveSession() {
    const sessions = ensureSessions();
    if (!state.activeChatId || !sessions.some((item) => item.id === state.activeChatId)) {
      state.activeChatId = sessions[0].id;
    }
    return sessions.find((item) => item.id === state.activeChatId) || sessions[0];
  }

  function defaultGreeting() {
    return { role: "assistant", text: "What can I help you with today?", html: "What can I help you with today?" };
  }

  function getGlossaryEntries(industryKey) {
    const cfg = window.IndustryModules?.[industryKey]?.glossary || { dataVarName: `${industryKey}GlossaryData` };
    return Array.isArray(window[cfg.dataVarName]) ? window[cfg.dataVarName].slice() : [];
  }

  function setGlossaryEntries(industryKey, entries) {
    const cfg = window.IndustryModules?.[industryKey]?.glossary || { dataVarName: `${industryKey}GlossaryData` };
    window[cfg.dataVarName] = entries;
  }

  function groupGlossaryEntries(entries) {
    const groups = new Map();
    entries.forEach((entry) => {
      const key = `${entry.acronym}__${entry.meaning}`;
      if (!groups.has(key)) groups.set(key, { acronym: entry.acronym, meaning: entry.meaning, explanations: [] });
      const group = groups.get(key);
      if (!group.explanations.includes(entry.practicalExplanation)) group.explanations.push(entry.practicalExplanation);
    });
    return [...groups.values()];
  }

  function findGlossaryMatches(industryKey, query) {
    const normalized = normalize(query);
    const grouped = groupGlossaryEntries(getGlossaryEntries(industryKey));
    return {
      exact: grouped.filter((entry) => normalize(entry.acronym) === normalized),
      partial: grouped.filter((entry) => {
        if (!normalized) return false;
        if (normalize(entry.acronym) === normalized) return false;
        return `${entry.acronym} ${entry.meaning} ${entry.explanations.join(" ")}`.toUpperCase().includes(normalized);
      })
    };
  }

  function getCompanyEntries() {
    return Array.isArray(window.TMTCompanyDirectoryData) ? window.TMTCompanyDirectoryData.slice() : [];
  }

  function enrichCompanyEntry(entry) {
    if (!entry) return null;
    return { ...entry, searchBlob: [entry.company, entry.parent, entry.ticker, entry.usTickerRaw, entry.subsegment, entry.summary].join(" ").toUpperCase() };
  }

  function getCompanyById(entryId) {
    return enrichCompanyEntry(getCompanyEntries().find((entry) => entry.id === entryId));
  }

  function getCompanyByNameOrTicker(query) {
    const normalized = normalize(query);
    return enrichCompanyEntry(getCompanyEntries().find((entry) => normalize(entry.ticker) === normalized || normalize(entry.company) === normalized || normalize(entry.parent) === normalized));
  }

  function findCompanyByTicker(ticker) {
    return enrichCompanyEntry(getCompanyEntries().find((entry) => normalize(entry.ticker) === normalize(ticker)));
  }

  function findCompanyCandidates(query, limit = 8) {
    const normalized = normalize(query);
    if (!normalized) return [];
    const ranked = [];
    getCompanyEntries().map(enrichCompanyEntry).forEach((entry) => {
      if (!entry.searchBlob.includes(normalized)) return;
      let score = 0;
      if (normalize(entry.ticker) === normalized) score += 120;
      if (normalize(entry.company) === normalized) score += 100;
      if (normalize(entry.ticker).startsWith(normalized)) score += 80;
      if (normalize(entry.company).startsWith(normalized)) score += 70;
      ranked.push({ score, entry });
    });
    return ranked.sort((a, b) => b.score - a.score || a.entry.company.localeCompare(b.entry.company)).slice(0, limit).map((item) => item.entry);
  }

  function getChainSource() {
    return window.TMTIndustryChainData || {};
  }

  function getChainNodeById(nodeId) {
    const source = getChainSource();
    const rows = Array.isArray(source.nodes) ? source.nodes : [];
    const row = rows.find((item) => Number(item["Node ID"]) === Number(nodeId));
    if (!row) return null;
    return {
      id: Number(row["Node ID"]),
      name: row["Node Name"] || "",
      tier: row["Tier"] || "",
      provides: row["What this node provides"] || "",
      players: row["Representative competitors / players"] || "",
      notes: row["Notes"] || ""
    };
  }

  function extractNodeIdToken(value) {
    const match = String(value || "").toUpperCase().match(/\bN\s*([0-9]{1,2})\b|\bNODE\s*([0-9]{1,2})\b/);
    if (!match) return null;
    const raw = match[1] || match[2] || "";
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  }

  function findNodeCandidates(query, limit = 6) {
    const normalized = normalize(query);
    if (!normalized) return [];
    const source = getChainSource();
    const rows = Array.isArray(source.nodes) ? source.nodes : [];
    const ranked = [];
    rows.forEach((row) => {
      const node = {
        id: Number(row["Node ID"]),
        name: row["Node Name"] || "",
        tier: row["Tier"] || "",
        provides: row["What this node provides"] || "",
        players: row["Representative competitors / players"] || "",
        notes: row["Notes"] || ""
      };
      const blob = [node.name, node.tier, node.provides, row["Key products / activities"], node.players, node.notes].join(" ").toUpperCase();
      if (!blob.includes(normalized)) return;
      let score = 0;
      if (normalize(node.name) === normalized) score += 120;
      if (normalize(`N${node.id}`) === normalized || String(node.id) === normalized) score += 110;
      if (normalize(node.name).startsWith(normalized)) score += 80;
      ranked.push({ score, node });
    });
    return ranked.sort((a, b) => b.score - a.score || a.node.id - b.node.id).slice(0, limit).map((item) => item.node);
  }

  function findChainMatches(query) {
    const normalized = normalize(query);
    if (!normalized) return [];
    const source = getChainSource();
    const nodes = Array.isArray(source.nodes) ? source.nodes : [];
    const flows = Array.isArray(source.flows) ? source.flows : [];
    const nodeMatches = nodes
      .filter((node) => [node["Node Name"], node["Tier"], node["What this node provides"], node["Key products / activities"], node["Representative competitors / players"], node["Notes"]].join(" ").toUpperCase().includes(normalized))
      .slice(0, 5)
      .map((node) => `Node N${node["Node ID"]} ${node["Node Name"]} (${node["Tier"]}): ${node["What this node provides"] || node["Notes"] || ""}`);
    const flowMatches = flows
      .filter((flow) => [flow["From Node Name"], flow["To Node Name"], flow["What flows downstream"], flow["Why this link exists"]].join(" ").toUpperCase().includes(normalized))
      .slice(0, 5)
      .map((flow) => `Flow ${flow["From Node Name"]} -> ${flow["To Node Name"]}: ${flow["What flows downstream"] || ""}. ${flow["Why this link exists"] || ""}`);
    return [...nodeMatches, ...flowMatches];
  }

  async function fetchWebResearch(query, context, numResults = 5) {
    const response = await fetch(`${API_BASE_URL}/api/websearch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: String(query || "").trim(), context: String(context || "").trim(), numResults })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.detail || `HTTP ${response.status}`));
    return Array.isArray(data?.results) ? data.results : [];
  }

  async function fetchDashboardSnapshot(ticker) {
    const cleanTicker = String(ticker || "").trim().toUpperCase();
    if (!cleanTicker) return null;
    const current = window.__equityscanDashboardSnapshot;
    if (current?.info && normalize(current.info.symbol) === cleanTicker) return current;
    const response = await fetch(`${API_BASE_URL}/api/stock?ticker=${encodeURIComponent(cleanTicker)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return null;
    return data;
  }

  async function saveGlossaryEntry(industryKey, entry) {
    const cfg = window.IndustryModules?.[industryKey]?.glossary || { fileName: `${String(industryKey || "industry").toLowerCase()}-glossary-data.js`, dataVarName: `${industryKey}GlossaryData` };
    const currentEntries = getGlossaryEntries(industryKey);
    const response = await fetch(`${API_BASE_URL}/api/glossary/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industryKey, fileName: cfg.fileName, dataVarName: cfg.dataVarName, entry })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.detail || `HTTP ${response.status}`));
    if (!data?.saved) return { saved: false, reason: String(data?.reason || "No changes written.") };
    setGlossaryEntries(industryKey, [...currentEntries, entry].sort((a, b) => a.acronym.localeCompare(b.acronym)));
    return { saved: true };
  }

  function buildThinkingHtml(steps, activeIndex, collapsed = false, isComplete = false) {
    const totalCount = Array.isArray(steps) ? steps.length : 0;
    const effectiveActiveIndex = collapsed ? -1 : activeIndex;
    const visibleSteps = collapsed ? steps : steps.slice(0, Math.max(0, activeIndex) + 1);
    const summaryText = isComplete ? `${totalCount} steps completed` : `Step ${Math.min(totalCount, Math.max(1, activeIndex + 1))} of ${totalCount}`;
    return `<div class="master-thinking ${collapsed ? "collapsed" : ""}"><div class="master-thinking-head"><button class="master-thinking-toggle" type="button" data-master-thinking-toggle="1" aria-label="Toggle thinking details"><span class="master-thinking-kicker">Thinking</span><i class="fa-solid fa-chevron-down master-thinking-caret"></i></button></div><div class="master-thinking-list">${visibleSteps.map((step, idx) => `<div class="master-thinking-item ${idx < effectiveActiveIndex ? "done" : ""} ${idx === effectiveActiveIndex ? "active" : ""}">${escapeHtml(step)}</div>`).join("")}</div><div class="master-thinking-summary">${summaryText}</div></div>`;
  }

  function renderNodeCard(node) {
    return `<div class="master-card"><div class="master-card-title">N${escapeHtml(node.id)} ${escapeHtml(node.name)}</div><div class="master-card-meta">${escapeHtml(node.tier || "-")}<br>${escapeHtml(node.players || "No representative players listed.")}</div><div class="master-actions"><button class="master-action-btn" type="button" data-master-focus-node="${escapeHtml(node.id)}">Focus Node</button></div></div>`;
  }

  function renderCompanyCard(entry) {
    return `<div class="master-card"><div class="master-card-title">${escapeHtml(entry.company)}</div><div class="master-card-meta">${escapeHtml(entry.subsegment || "-")}<br>${escapeHtml(entry.parent || "-")}</div><div class="master-actions">${entry.isUsListed ? `<button class="master-action-btn" type="button" data-master-open-dashboard="${escapeHtml(entry.ticker)}">Open ${escapeHtml(entry.ticker)} In Dashboard</button>` : ""}</div></div>`;
  }

  function dedupeSources(results) {
    const seen = new Set();
    return (Array.isArray(results) ? results : [])
      .filter((item) => item && (item.url || item.title || item.snippet))
      .filter((item) => {
        const key = String(item.url || item.title || "").trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 14)
      .map((item) => ({
        title: String(item.title || "Source").trim(),
        url: String(item.url || "").trim(),
        snippet: String(item.snippet || "").trim()
      }));
  }

  function renderReportResult(report) {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeTitle = escapeHtml(report.reportTitle || "Company Analysis Report");
    const sources = dedupeSources(report.sources || []);
    const safeHtml = sanitizeReportHtml(report.reportHtml || "");
    const sourceHtml = sources.length
      ? `<h3>Collected Sources</h3><ul>${sources.map((source, idx) => `<li>[S${idx + 1}] ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || source.url)}</a>` : escapeHtml(source.title || "Source")} ${source.snippet ? `- ${escapeHtml(source.snippet)}` : ""}</li>`).join("")}</ul>`
      : "";
    const fullHtml = `${safeHtml}${sourceHtml}`;
    saveReportSnapshot(reportId, { title: report.reportTitle || "Company Analysis Report", html: fullHtml, sources });
    return `<div class="master-report"><h2>${safeTitle}</h2>${fullHtml}</div><div class="master-actions"><button class="master-action-btn" type="button" data-master-download-report="${escapeHtml(reportId)}">Download Word Report</button></div>`;
  }

  async function buildGlossaryCandidate(industryKey, lookupTerm, assistantResponse) {
    if (!lookupTerm || !window.LLMShell?.synthesizeGlossaryCandidate) return null;
    const result = await window.LLMShell.synthesizeGlossaryCandidate({
      agentName: "Agent G",
      industryKey,
      industryLabel: getIndustryContext(industryKey).label,
      industryContext: getIndustryContext(industryKey).glossaryContext,
      lookupTerm,
      assistantResponse,
      existingEntries: getGlossaryEntries(industryKey).slice(0, 100)
    });
    return result.ok ? result.entry : null;
  }

  async function runAgentG(session, userMessage, industryKey) {
    const ctx = getIndustryContext(industryKey);
    const history = session.messages.map((item) => ({ role: item.role, content: item.text || "" })).filter((item) => item.content);
    const planner = await window.LLMShell.planGlossaryAgentTurn({
      agentName: "Agent G",
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: ctx.glossaryContext,
      sidebarTitle: ctx.sidebarTitle,
      conversationHistory: history,
      lastResolvedTerm: session.memory.glossary.lastLookupTerm,
      pendingCandidateEntry: session.memory.glossary.pendingEntry
    });
    if (!planner.ok) return planner;
    if (planner.mode === "save_pending") {
      let entry = session.memory.glossary.pendingEntry;
      if (!entry && session.memory.glossary.lastLookupTerm) entry = await buildGlossaryCandidate(industryKey, session.memory.glossary.lastLookupTerm, session.memory.glossary.lastResolvedAssistantResponse);
      if (!entry) return { ok: true, text: planner.assistantResponse || "There is no pending glossary definition to save right now." };
      const result = await saveGlossaryEntry(industryKey, entry);
      if (result.saved) session.memory.glossary.pendingEntry = null;
      return { ok: true, text: result.saved ? `Saved ${entry.acronym} into the TMT glossary.` : result.reason };
    }
    if (planner.mode === "reply" && !planner.lookupTerm) return { ok: true, text: planner.assistantResponse || "" };
    const lookupTerm = String(planner.lookupTerm || session.memory.glossary.lastLookupTerm || "").trim();
    const matches = findGlossaryMatches(industryKey, lookupTerm);
    const webResults = planner.useWebResearch ? await fetchWebResearch(planner.searchQuery || `${lookupTerm} acronym`, [ctx.label, ctx.sidebarTitle, ctx.glossaryContext].filter(Boolean).join(" "), 5).catch(() => []) : [];
    const answer = await window.LLMShell.answerGlossaryAgentTurn({
      agentName: "Agent G",
      userMessage,
      lookupTerm,
      industryKey,
      industryLabel: ctx.label,
      industryContext: ctx.glossaryContext,
      sidebarTitle: ctx.sidebarTitle,
      conversationHistory: history,
      lastResolvedTerm: session.memory.glossary.lastLookupTerm,
      datasetExactMatches: matches.exact.map((entry) => ({ acronym: entry.acronym, meaning: entry.meaning, practicalExplanation: entry.explanations.join(" ") })),
      datasetPartialMatches: matches.partial.map((entry) => ({ acronym: entry.acronym, meaning: entry.meaning, practicalExplanation: entry.explanations.join(" ") })),
      webResults
    });
    if (!answer.ok) return answer;
    session.memory.glossary.lastLookupTerm = answer.suggestedLookupTerm || lookupTerm;
    session.memory.glossary.lastResolvedAssistantResponse = answer.assistantResponse || "";
    session.memory.glossary.pendingEntry = answer.candidateEntry || null;
    return { ok: true, text: `${answer.assistantResponse}${answer.candidateEntry ? `<div class="master-card"><div class="master-card-title">${escapeHtml(answer.candidateEntry.acronym)}</div><div class="master-card-meta">${escapeHtml(answer.candidateEntry.meaning)}<br>${escapeHtml(answer.candidateEntry.practicalExplanation)}</div><div class="master-actions"><button class="master-action-btn" type="button" data-master-save-glossary="1">Save This Definition</button></div></div>` : ""}` };
  }

  async function runAgentC(session, userMessage, industryKey) {
    const ctx = getIndustryContext(industryKey);
    const history = session.messages.map((item) => ({ role: item.role, content: item.text || "" })).filter((item) => item.content);
    const lastResolvedCompany = getCompanyById(session.memory.company.lastResolvedCompanyId);
    const planner = await window.LLMShell.planCompanyAgentTurn({
      agentName: "Agent C",
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.glossaryContext, ctx.companyContext, ctx.chainContext].filter(Boolean).join(" "),
      conversationHistory: history,
      selectedCompany: null,
      lastResolvedCompany,
      currentDashboard: window.__equityscanDashboardSnapshot || null,
      watchlistEntries: []
    });
    if (!planner.ok) return planner;
    if (planner.mode === "reply" && !planner.lookupQuery) return { ok: true, text: planner.assistantResponse || "" };
    const lookupQuery = String(planner.lookupQuery || lastResolvedCompany?.company || "").trim();
    const companyCandidates = findCompanyCandidates(lookupQuery, 8);
    const selectedCompany = companyCandidates[0] || lastResolvedCompany || null;
    if (planner.mode === "open_dashboard") {
      const tickerMatch = normalize(lookupQuery).match(/\b[A-Z][A-Z.\-]{0,5}\b/);
      const ticker = selectedCompany?.isUsListed ? selectedCompany.ticker : (tickerMatch ? tickerMatch[0] : "");
      if (selectedCompany?.id) session.memory.company.lastResolvedCompanyId = selectedCompany.id;
      return { ok: true, text: ticker ? `Opening ${ticker} in the dashboard.` : "I couldn't find a US-listed ticker to open.", openDashboardTicker: ticker };
    }
    const webResults = planner.useWebResearch ? await fetchWebResearch(planner.searchQuery || [lookupQuery, userMessage].filter(Boolean).join(" "), [ctx.label, ctx.companyContext, ctx.chainContext, selectedCompany ? `${selectedCompany.company} ${selectedCompany.parent} ${selectedCompany.subsegment}` : ""].filter(Boolean).join(" "), 5).catch(() => []) : [];
    const answer = await window.LLMShell.answerCompanyAgentTurn({
      agentName: "Agent C",
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.glossaryContext, ctx.companyContext, ctx.chainContext].filter(Boolean).join(" "),
      lookupQuery,
      conversationHistory: history,
      selectedCompany,
      currentDashboard: window.__equityscanDashboardSnapshot || null,
      candidateCompanies: companyCandidates,
      chainMatches: findChainMatches([lookupQuery, userMessage].join(" ")),
      webResults
    });
    if (!answer.ok) return answer;
    const chosenCompany = getCompanyById(answer.selectedCompanyId) || companyCandidates.find((entry) => entry.id === answer.selectedCompanyId) || selectedCompany || null;
    if (chosenCompany?.id) session.memory.company.lastResolvedCompanyId = chosenCompany.id;
    return { ok: true, text: `${answer.assistantResponse}${chosenCompany ? renderCompanyCard(chosenCompany) : ""}`, openDashboardTicker: answer.offerOpenDashboard ? answer.openDashboardTicker : "" };
  }

  async function planMasterTask(session, userMessage, industryKey) {
    const ctx = getIndustryContext(industryKey);
    const history = session.messages.map((item) => ({ role: item.role, content: item.text || "" })).filter((item) => item.content);
    if (!window.LLMShell?.planMasterTaskTurn) {
      return { ok: false, error: "Master task planner is not loaded." };
    }
    return window.LLMShell.planMasterTaskTurn({
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.glossaryContext, ctx.companyContext, ctx.chainContext].filter(Boolean).join(" "),
      conversationHistory: history,
      currentDashboard: window.__equityscanDashboardSnapshot || null
    });
  }

  async function runCompanyAnalysisReportTask(session, userMessage, industryKey, planner, onProgress) {
    const ctx = getIndustryContext(industryKey);
    onProgress?.(1);
    const companyQuery = String(planner.companyQuery || "").trim();
    const candidates = findCompanyCandidates(companyQuery, 8);
    const tickerCandidate = normalize(companyQuery).match(/\b[A-Z][A-Z.\-]{0,5}\b/)?.[0] || "";
    const selectedCompany = candidates[0] || getCompanyByNameOrTicker(companyQuery) || (tickerCandidate ? {
      id: `ticker-${tickerCandidate}`,
      company: tickerCandidate,
      parent: "",
      subsegment: "",
      ticker: tickerCandidate,
      usTickerRaw: tickerCandidate,
      isUsListed: true,
      summary: "Ticker resolved from the user request."
    } : null);
    if (!selectedCompany) {
      return { ok: true, route: "task", text: "I could not resolve the company. Please provide a ticker or a more specific company name." };
    }
    const ticker = selectedCompany.isUsListed ? String(selectedCompany.ticker || selectedCompany.usTickerRaw || "").trim().toUpperCase() : tickerCandidate;
    onProgress?.(2);
    const dashboard = ticker ? await fetchDashboardSnapshot(ticker).catch(() => null) : null;
    const companyName = selectedCompany.company || selectedCompany.parent || ticker || companyQuery;
    const defaultQueries = [
      `${companyName} latest news earnings AI data center`,
      `${companyName} ${ticker || ""} analyst price target average target consensus valuation`,
      `${companyName} ${ticker || ""} average analyst price target upside`,
      `${companyName} ${ticker || ""} target price marketbeat tipranks yahoo finance analysts`,
      `${companyName} ${ticker || ""} catalysts risks valuation`,
      `${companyName} ${selectedCompany.subsegment || "TMT"} industry outlook supply chain`
    ];
    const sourceQueries = [...(Array.isArray(planner.sourceSearchQueries) ? planner.sourceSearchQueries : []), ...defaultQueries]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 7);
    onProgress?.(3);
    const sourceGroups = await Promise.all(sourceQueries.map((query) => fetchWebResearch(query, [ctx.label, ctx.companyContext, ctx.chainContext, selectedCompany.summary || "", selectedCompany.subsegment || ""].filter(Boolean).join(" "), 4).catch(() => [])));
    const sources = dedupeSources(sourceGroups.flat());
    const history = session.messages.map((item) => ({ role: item.role, content: item.text || "" })).filter((item) => item.content);
    const companyPrompt = [
      "Prepare the Agent C workstream for a concise, client-facing company analysis report.",
      "Own the company analysis, financial analysis, and valuation analysis.",
      "Focus on business quality, current operating position, valuation, analyst target-price range, catalysts, and risks.",
      "If current sources contain analyst target-price figures, ranges, or consensus commentary, extract them and synthesize a sensible current range or consensus view in prose.",
      "Do not default to saying target-price evidence is unavailable unless none of the supplied sources contains any usable target-price or valuation signal.",
      "Write in polished client-facing language and do not mention internal systems, dashboards, datasets, source systems, or implementation details.",
      `Company/ticker: ${companyName} ${ticker ? `(${ticker})` : ""}.`,
      `Task brief: ${planner.taskBrief || userMessage}`
    ].join(" ");
    onProgress?.(4);
    const companyWork = await window.LLMShell.answerCompanyAgentTurn({
      agentName: "Agent C",
      userMessage: companyPrompt,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.glossaryContext, ctx.companyContext, ctx.chainContext].filter(Boolean).join(" "),
      lookupQuery: companyQuery || companyName,
      conversationHistory: history,
      selectedCompany,
      currentDashboard: dashboard,
      candidateCompanies: candidates,
      chainMatches: findChainMatches([companyQuery, selectedCompany.subsegment, selectedCompany.summary].join(" ")),
      webResults: sources
    });
    const industryPrompt = [
      "Prepare the Agent I workstream for a concise, client-facing industry analysis for a company report.",
      "Own the industry's chain position, segment outlook, adjacent segment interactions, bottlenecks, supply-chain implications, and how changes in relevant segments affect the company's future performance.",
      "Do not refer to node numbers such as N5 or N8. Refer to segments and chain stages by name only.",
      "Make this analysis detailed rather than a simple chain summary.",
      "Discuss the outlook for the core segment, the condition of adjacent and enabling segments, the major demand drivers, supply constraints, pricing or capacity trends where relevant, and how changes across those adjacent segments could affect the company's revenue, margins, growth profile, or strategic position.",
      "Do not mention internal datasets, nodes, tools, or implementation details.",
      `Company/ticker: ${companyName} ${ticker ? `(${ticker})` : ""}.`,
      `Subsegment: ${selectedCompany.subsegment || "not specified"}.`,
      `Task brief: ${planner.taskBrief || userMessage}`
    ].join(" ");
    onProgress?.(5);
    const industryWork = await window.LLMShell.answerIndustryAgentTurn({
      agentName: "Agent I",
      userMessage: industryPrompt,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.chainContext, ctx.companyContext, ctx.glossaryContext].filter(Boolean).join(" "),
      lookupQuery: [companyQuery, selectedCompany.subsegment, selectedCompany.summary].filter(Boolean).join(" "),
      conversationHistory: history,
      selectedNode: null,
      explicitNode: null,
      currentDashboard: dashboard,
      candidateNodes: findNodeCandidates([selectedCompany.subsegment, selectedCompany.summary, companyName].join(" "), 8),
      candidateCompanies: candidates,
      chainMatches: findChainMatches([companyQuery, selectedCompany.subsegment, selectedCompany.summary].join(" ")),
      webResults: sources
    });
    if (!window.LLMShell?.composeCompanyAnalysisReport) {
      return { ok: false, error: "Company report composer is not loaded." };
    }
    onProgress?.(6);
    const report = await window.LLMShell.composeCompanyAnalysisReport({
      industryKey,
      industryLabel: ctx.label,
      taskBrief: planner.taskBrief || userMessage,
      company: selectedCompany,
      dashboard,
      companyAnalysis: companyWork.ok ? companyWork.assistantResponse : `Agent C unavailable: ${companyWork.error || "unknown error"}`,
      industryAnalysis: industryWork.ok ? industryWork.assistantResponse : `Agent I unavailable: ${industryWork.error || "unknown error"}`,
      sources
    });
    if (!report.ok) return report;
    const html = renderReportResult(report);
    if (selectedCompany?.id) session.memory.company.lastResolvedCompanyId = selectedCompany.id;
    return { ok: true, route: "task", text: html, openDashboardTicker: "" };
  }

  async function executeMasterTask(session, userMessage, industryKey, planner, onProgress) {
    if (!planner.ok) return planner;
    if (planner.mode === "reply") return { ok: true, route: "task", text: escapeHtml(planner.assistantResponse || "What company should I analyze?") };
    if (planner.mode === "company_analysis_report") return runCompanyAnalysisReportTask(session, userMessage, industryKey, planner, onProgress);
    return { ok: true, route: "task", text: "I can currently run the Company Analysis Report workflow. Tell me the company or ticker to analyze." };
  }

  async function runAgentI(session, userMessage, industryKey) {
    const ctx = getIndustryContext(industryKey);
    const history = session.messages.map((item) => ({ role: item.role, content: item.text || "" })).filter((item) => item.content);
    const lastResolvedNode = getChainNodeById(session.memory.industry.lastResolvedNodeId);
    const lastResolvedCompany = getCompanyById(session.memory.industry.lastResolvedCompanyId);
    const planner = await window.LLMShell.planIndustryAgentTurn({
      agentName: "Agent I",
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.chainContext, ctx.companyContext, ctx.glossaryContext].filter(Boolean).join(" "),
      conversationHistory: history,
      selectedNode: null,
      lastResolvedNode,
      currentDashboard: window.__equityscanDashboardSnapshot || null
    });
    if (!planner.ok) return planner;
    if (planner.mode === "reply" && !planner.lookupQuery) return { ok: true, text: planner.assistantResponse || "" };
    const lookupQuery = String(planner.lookupQuery || lastResolvedNode?.name || "").trim();
    const explicitNodeId = extractNodeIdToken(lookupQuery) || extractNodeIdToken(userMessage);
    const explicitNode = explicitNodeId !== null ? getChainNodeById(explicitNodeId) : null;
    const nodeCandidates = findNodeCandidates(lookupQuery, 8);
    const companyCandidates = findCompanyCandidates([lookupQuery, userMessage].join(" "), 8);
    const selectedCompany = companyCandidates[0] || lastResolvedCompany || null;
    if (planner.mode === "open_dashboard") {
      const tickerMatch = normalize(lookupQuery).match(/\b[A-Z][A-Z.\-]{0,5}\b/);
      const ticker = selectedCompany?.isUsListed ? selectedCompany.ticker : (tickerMatch ? tickerMatch[0] : "");
      if (selectedCompany?.id) session.memory.industry.lastResolvedCompanyId = selectedCompany.id;
      return { ok: true, text: ticker ? `Opening ${ticker} in the dashboard.` : "I couldn't find a US-listed ticker to open.", openDashboardTicker: ticker };
    }
    const webResults = planner.useWebResearch ? await fetchWebResearch(planner.searchQuery || [lookupQuery, userMessage].filter(Boolean).join(" "), [ctx.label, ctx.chainContext, ctx.companyContext, explicitNode ? `${explicitNode.name} ${explicitNode.players}` : "", selectedCompany ? `${selectedCompany.company} ${selectedCompany.parent}` : ""].filter(Boolean).join(" "), 5).catch(() => []) : [];
    const answer = await window.LLMShell.answerIndustryAgentTurn({
      agentName: "Agent I",
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.chainContext, ctx.companyContext, ctx.glossaryContext].filter(Boolean).join(" "),
      lookupQuery,
      conversationHistory: history,
      selectedNode: null,
      explicitNode,
      currentDashboard: window.__equityscanDashboardSnapshot || null,
      candidateNodes: nodeCandidates,
      candidateCompanies: companyCandidates,
      chainMatches: findChainMatches([lookupQuery, userMessage].join(" ")),
      webResults
    });
    if (!answer.ok) return answer;
    const chosenNode = explicitNode || getChainNodeById(answer.selectedNodeId) || nodeCandidates[0] || lastResolvedNode || null;
    const chosenCompany = getCompanyById(answer.selectedCompanyId) || companyCandidates.find((entry) => entry.id === answer.selectedCompanyId) || selectedCompany || null;
    if (chosenNode?.id) session.memory.industry.lastResolvedNodeId = chosenNode.id;
    if (chosenCompany?.id) session.memory.industry.lastResolvedCompanyId = chosenCompany.id;
    return { ok: true, text: `${answer.assistantResponse}${chosenNode ? renderNodeCard(chosenNode) : ""}${chosenCompany ? renderCompanyCard(chosenCompany) : ""}`, openDashboardTicker: answer.offerOpenDashboard ? answer.openDashboardTicker : "" };
  }

  async function planMasterTurn(session, userMessage, industryKey) {
    const ctx = getIndustryContext(industryKey);
    const history = session.messages.map((item) => ({ role: item.role, content: item.text || "" })).filter((item) => item.content);
    return window.LLMShell.planMasterTMTTurn({
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.glossaryContext, ctx.companyContext, ctx.chainContext].filter(Boolean).join(" "),
      conversationHistory: history,
      currentDashboard: window.__equityscanDashboardSnapshot || null
    });
  }

  async function executeMasterTurn(session, userMessage, industryKey, planner) {
    if (!planner.ok) return planner;
    if (planner.mode === "reply") return { ok: true, route: "reply", text: planner.assistantResponse || "How can I help?", routeReason: planner.routeReason || "Responding directly." };
    if (planner.targetAgent === "G") return { ...(await runAgentG(session, userMessage, industryKey)), route: "G", routeReason: planner.routeReason || "Consulting Agent G." };
    if (planner.targetAgent === "C") return { ...(await runAgentC(session, userMessage, industryKey)), route: "C", routeReason: planner.routeReason || "Consulting Agent C." };
    return { ...(await runAgentI(session, userMessage, industryKey)), route: "I", routeReason: planner.routeReason || "Consulting Agent I." };
  }

  function renderMessageHtml(message) {
    return `<div class="master-message ${message.role === "user" ? "user" : "assistant"}"><div class="master-bubble">${message.html}</div></div>`;
  }

  function buildDetailedThinkingSteps(route) {
    const routeLabel = route === "G" ? "Consulting Agent G..." : route === "C" ? "Consulting Agent C..." : route === "I" ? "Consulting Agent I..." : "Reasoning directly...";
    return [
      "Consolidating the request...",
      "Reviewing the current conversation context...",
      routeLabel,
      "Composing the final response..."
    ];
  }

  function buildTaskThinkingSteps(taskMode = "company_analysis_report") {
    if (taskMode === "company_analysis_report") {
      return [
        "Understanding the report request...",
        "Resolving company identity...",
        "Pulling market and valuation context...",
        "Searching current news, analyst targets, and catalysts...",
        "Consulting Agent C for company and valuation analysis...",
        "Consulting Agent I for segment and chain analysis...",
        "Consolidating a client-facing report..."
      ];
    }
    return [
      "Understanding the task request...",
      "Gathering required context...",
      "Running the selected workflow...",
      "Formatting the final output..."
    ];
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (_) {
      return "";
    }
  }

  function deleteSessionById(sessionId) {
    let sessions = ensureSessions().filter((item) => item.id !== sessionId);
    if (!sessions.length) sessions = [createSession()];
    saveSessions(sessions);
    if (!sessions.some((item) => item.id === state.activeChatId)) {
      state.activeChatId = sessions[0].id;
    }
  }

  function renderMaster(host, opts) {
    const sessions = ensureSessions().sort((a, b) => b.updatedAt - a.updatedAt);
    const session = getActiveSession();
    const messages = Array.isArray(session.messages) ? session.messages : [];
    host.innerHTML = `
      <section class="master-shell">
        <div class="master-toolbar">
          <div class="master-head-block"><div class="master-side-kicker">${escapeHtml(opts.industryKey || "TMT")} Workspace</div><div class="master-side-title">Master TMT</div></div>
          <div class="master-toolbar-left">
            <button id="masterHistoryToggle" class="master-history-toggle ${state.historyOpen ? "open" : ""}" type="button" aria-label="Toggle chats"><i class="fa-solid fa-chevron-down"></i><span>Chats</span></button>
            <div class="master-history-pop ${state.historyOpen ? "open" : ""}">
              <button id="masterNewChatBtn" class="master-new-btn" type="button"><i class="fa-solid fa-plus"></i><span>New Chat</span></button>
              <div class="master-history">
                ${sessions.map((item) => `<div class="master-history-item ${item.id === session.id ? "active" : ""}" data-master-chat-id="${escapeHtml(item.id)}"><div class="master-history-row"><button class="master-history-copy" type="button" data-master-chat-open="${escapeHtml(item.id)}"><div class="master-history-title">${escapeHtml(item.title || "New Chat")}</div></button><div class="master-history-actions"><button class="master-history-btn" type="button" data-master-chat-rename="${escapeHtml(item.id)}" aria-label="Rename chat"><i class="fa-solid fa-pen"></i></button><button class="master-history-btn" type="button" data-master-chat-delete="${escapeHtml(item.id)}" aria-label="Delete chat"><i class="fa-solid fa-trash"></i></button></div></div></div>`).join("")}
              </div>
            </div>
          </div>
        </div>
        <div class="master-chat">
          ${messages.length ? `<div id="masterMessages" class="master-messages">${messages.map(renderMessageHtml).join("")}</div>` : `<div class="master-empty"><div class="master-empty-inner"><div class="master-empty-title">What can I help you with today?</div><div class="master-empty-copy">Ask about acronyms, company positioning, node bottlenecks, dashboard implications, or current developments across the TMT chain.</div></div></div>`}
          <div class="master-input-shell"><div class="master-input-wrap"><div class="master-input-mode"><button class="master-input-mode-btn ${state.mode === "chat" ? "active" : ""}" type="button" data-master-mode="chat">Chat</button><button class="master-input-mode-btn ${state.mode === "tasks" ? "active" : ""}" type="button" data-master-mode="tasks">Tasks</button></div><textarea id="masterInput" class="master-input" rows="1" placeholder="${state.mode === "tasks" ? "Ask for a task, e.g. write a company analysis report on NVDA..." : "Ask about the TMT chain, companies, acronyms, or current developments..."}"></textarea><button id="masterSend" class="master-send" type="button">Send</button></div></div>
        </div>
      </section>
    `;

    const inputEl = host.querySelector("#masterInput");
    const sendEl = host.querySelector("#masterSend");

    function resizeInput() {
      inputEl.style.height = "auto";
      inputEl.style.height = `${Math.max(56, Math.min(inputEl.scrollHeight, 180))}px`;
    }

    async function handleSend() {
      const rawMessage = String(inputEl.value || "").trim();
      if (!rawMessage) return;
      const sessionsNow = ensureSessions();
      const current = sessionsNow.find((item) => item.id === state.activeChatId);
      if (!current) return;
      if (!current.messages.length) current.messages.push(defaultGreeting());
      current.messages.push({ role: "user", text: rawMessage, html: escapeHtml(rawMessage) });
      if (current.title === "New Chat") current.title = rawMessage.slice(0, 48);
      current.updatedAt = Date.now();
      saveSessions(sessionsNow);
      inputEl.value = "";
      renderMaster(host, opts);

      const isTaskMode = state.mode === "tasks";
      const initialSteps = isTaskMode
        ? ["Understanding the task request...", "Checking whether enough information is available...", "Preparing the workflow..."]
        : [
            "Consolidating the request...",
            "Reviewing the current conversation context...",
            "Choosing the best path...",
            "Preparing the response..."
          ];
      const working = { role: "assistant", text: "Thinking", html: buildThinkingHtml(initialSteps, 0), working: true };
      current.messages.push(working);
      saveSessions(sessionsNow);
      renderMaster(host, opts);

      const updateWorking = (steps, activeIndex) => {
        working.html = buildThinkingHtml(steps, activeIndex);
        saveSessions(sessionsNow);
        renderMaster(host, opts);
      };

      try {
        updateWorking(initialSteps, 1);
        if (isTaskMode) {
          const taskPlanner = await planMasterTask(current, rawMessage, opts.industryKey || moduleRef.key || "TMT");
          if (!taskPlanner.ok) {
            current.messages.pop();
            current.messages.push({ role: "assistant", text: taskPlanner.error || "Unknown error.", html: escapeHtml(taskPlanner.error || "Unknown error.") });
            current.updatedAt = Date.now();
            saveSessions(sessionsNow);
            renderMaster(host, opts);
            return;
          }
          const taskSteps = buildTaskThinkingSteps(taskPlanner.mode);
          updateWorking(taskSteps, taskPlanner.mode === "company_analysis_report" ? 0 : 2);
          const result = await executeMasterTask(current, rawMessage, opts.industryKey || moduleRef.key || "TMT", taskPlanner, (activeIndex) => updateWorking(taskSteps, activeIndex));
          current.messages.pop();
          if (!result.ok) {
            current.messages.push({ role: "assistant", text: result.error || "Unknown error.", html: escapeHtml(result.error || "Unknown error.") });
          } else {
            let html = `${buildThinkingHtml(taskSteps, taskSteps.length - 1, true, true)}<div style="margin-top:12px">${result.text || ""}</div>`;
            current.messages.push({ role: "assistant", text: result.text || "", html });
          }
          current.updatedAt = Date.now();
          saveSessions(sessionsNow);
          renderMaster(host, opts);
          return;
        }
        const planner = await planMasterTurn(current, rawMessage, opts.industryKey || moduleRef.key || "TMT");
        if (!planner.ok) {
          current.messages.pop();
          current.messages.push({ role: "assistant", text: planner.error || "Unknown error.", html: escapeHtml(planner.error || "Unknown error.") });
          current.updatedAt = Date.now();
          saveSessions(sessionsNow);
          renderMaster(host, opts);
          return;
        }
        const plannedRoute = planner.mode === "reply" ? "reply" : (planner.targetAgent || "reply");
        const plannedSteps = buildDetailedThinkingSteps(plannedRoute);
        updateWorking(plannedSteps, 2);
        const result = await executeMasterTurn(current, rawMessage, opts.industryKey || moduleRef.key || "TMT", planner);
        current.messages.pop();
        if (!result.ok) {
          current.messages.push({ role: "assistant", text: result.error || "Unknown error.", html: escapeHtml(result.error || "Unknown error.") });
        } else {
          const finalSteps = buildDetailedThinkingSteps(result.route);
          let html = `${buildThinkingHtml(finalSteps, finalSteps.length - 1, true, true)}<div style="margin-top:12px">${result.text || ""}</div>`;
          if (result.openDashboardTicker && !String(result.text || "").includes("data-master-open-dashboard")) html += `<div class="master-actions"><button class="master-action-btn" type="button" data-master-open-dashboard="${escapeHtml(result.openDashboardTicker)}">Open ${escapeHtml(result.openDashboardTicker)} In Dashboard</button></div>`;
          current.messages.push({ role: "assistant", text: result.text || "", html });
        }
        current.updatedAt = Date.now();
        saveSessions(sessionsNow);
        renderMaster(host, opts);
      } catch (err) {
        current.messages.pop();
        current.messages.push({ role: "assistant", text: String(err?.message || err), html: escapeHtml(String(err?.message || err)) });
        current.updatedAt = Date.now();
        saveSessions(sessionsNow);
        renderMaster(host, opts);
      }
    }

    host.querySelector("#masterHistoryToggle")?.addEventListener("click", () => {
      state.historyOpen = !state.historyOpen;
      renderMaster(host, opts);
    });
    host.querySelectorAll("[data-master-mode]").forEach((el) => {
      el.addEventListener("click", () => {
        state.mode = el.getAttribute("data-master-mode") === "tasks" ? "tasks" : "chat";
        renderMaster(host, opts);
      });
    });
    host.querySelectorAll("[data-master-chat-open]").forEach((el) => {
      el.addEventListener("click", () => {
        state.activeChatId = el.getAttribute("data-master-chat-open");
        state.historyOpen = false;
        renderMaster(host, opts);
      });
    });
    host.querySelectorAll("[data-master-chat-rename]").forEach((el) => {
      el.addEventListener("click", () => {
        const chatId = el.getAttribute("data-master-chat-rename");
        const sessionsNow = ensureSessions();
        const current = sessionsNow.find((item) => item.id === chatId);
        if (!current) return;
        const nextTitle = window.prompt("Rename chat", current.title || "New Chat");
        if (nextTitle == null) return;
        current.title = String(nextTitle || "").trim() || "New Chat";
        current.updatedAt = Date.now();
        saveSessions(sessionsNow);
        renderMaster(host, opts);
      });
    });
    host.querySelectorAll("[data-master-chat-delete]").forEach((el) => {
      el.addEventListener("click", () => {
        const chatId = el.getAttribute("data-master-chat-delete");
        deleteSessionById(chatId);
        renderMaster(host, opts);
      });
    });
    host.querySelector("#masterNewChatBtn")?.addEventListener("click", () => {
      const sessionsNext = ensureSessions();
      const next = createSession();
      sessionsNext.unshift(next);
      saveSessions(sessionsNext);
      state.activeChatId = next.id;
      state.historyOpen = false;
      renderMaster(host, opts);
    });
    host.querySelectorAll("[data-master-open-dashboard]").forEach((el) => {
      el.addEventListener("click", () => {
        const ticker = el.getAttribute("data-master-open-dashboard");
        if (ticker) opts.onOpenTicker?.(ticker, opts.industryKey || moduleRef.key || "TMT");
      });
    });
    host.querySelectorAll("[data-master-download-report]").forEach((el) => {
      el.addEventListener("click", () => {
        downloadReportDoc(el.getAttribute("data-master-download-report"));
      });
    });
    host.querySelectorAll("[data-master-focus-node]").forEach((el) => {
      el.addEventListener("click", () => {
        const nodeId = Number(el.getAttribute("data-master-focus-node"));
        if (!Number.isFinite(nodeId)) return;
        window.IndustryModules?.[opts.industryKey || "TMT"]?.selectIndustryNode?.(nodeId);
        opts.onSwitchTab?.("industry", document.getElementById("navIndustry"));
      });
    });
    host.querySelectorAll("[data-master-save-glossary]").forEach((el) => {
      el.addEventListener("click", async () => {
        const sessionsNow = ensureSessions();
        const current = sessionsNow.find((item) => item.id === state.activeChatId);
        if (!current) return;
        const entry = current.memory?.glossary?.pendingEntry;
        if (!entry) return;
        const result = await saveGlossaryEntry(opts.industryKey || moduleRef.key || "TMT", entry).catch((err) => ({ saved: false, reason: String(err?.message || err) }));
        current.messages.push({ role: "assistant", text: result.saved ? `Saved ${entry.acronym} into the TMT glossary.` : String(result.reason || "No changes written."), html: escapeHtml(result.saved ? `Saved ${entry.acronym} into the TMT glossary.` : String(result.reason || "No changes written.")) });
        if (result.saved) current.memory.glossary.pendingEntry = null;
        current.updatedAt = Date.now();
        saveSessions(sessionsNow);
        renderMaster(host, opts);
      });
    });
    host.querySelectorAll("[data-master-thinking-toggle]").forEach((el) => {
      el.addEventListener("click", () => {
        const card = el.closest(".master-thinking");
        if (!card) return;
        card.classList.toggle("collapsed");
      });
    });

    sendEl?.addEventListener("click", handleSend);
    inputEl?.addEventListener("input", resizeInput);
    inputEl?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    });
    resizeInput();
    host.querySelector("#masterMessages")?.scrollTo({ top: host.querySelector("#masterMessages").scrollHeight });
  }

  moduleRef.renderMasterView = function renderMasterView(opts) {
    ensureStyles();
    const host = document.getElementById(opts.containerId);
    if (!host) return;
    ensureSessions();
    renderMaster(host, opts);
  };
})();
