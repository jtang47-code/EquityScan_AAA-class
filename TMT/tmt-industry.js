(function () {
  window.IndustryModules = window.IndustryModules || {};
  const moduleRef = window.IndustryModules.TMT || { key: "TMT", label: "TMT" };
  window.IndustryModules.TMT = moduleRef;

  let initialized = false;
  const API_BASE_URL = window.APP_CONFIG?.apiBaseUrl || (window.location.protocol === "file:" ? "http://localhost:8000" : "");
  const AGENT_PAD = 8;
  const AGENT_DEFAULT_RIGHT = 28;
  const AGENT_DEFAULT_BOTTOM = 24;
  const state = {
    nodesById: new Map(),
    flows: [],
    subsegments: [],
    flowByNode: [],
    resizeObserver: null,
    resizeFrame: 0,
    selectedNodeId: null,
    chatOpen: false,
    chatBusy: false,
    chatMessages: [],
    lastResolvedNodeId: null,
    lastResolvedCompanyId: "",
    pendingDashboardTicker: "",
    chatDrag: { pointerId: null, startX: 0, startY: 0, originLeft: 0, originTop: 0, didMove: false }
  };

  function toNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalize(value) {
    return String(value ?? "").trim().toUpperCase();
  }

  function getCompanyEntries() {
    return Array.isArray(window.TMTCompanyDirectoryData) ? window.TMTCompanyDirectoryData.slice() : [];
  }

  function enrichCompanyEntry(entry) {
    if (!entry) return null;
    return {
      ...entry,
      searchBlob: [
        entry.company,
        entry.parent,
        entry.ticker,
        entry.usTickerRaw,
        entry.subsegment,
        entry.summary
      ].join(" ").toUpperCase()
    };
  }

  function getCompanyById(entryId) {
    return enrichCompanyEntry(getCompanyEntries().find((entry) => entry.id === entryId));
  }

  function getSelectedNode() {
    return state.selectedNodeId ? state.nodesById.get(state.selectedNodeId) || null : null;
  }

  function getLastResolvedNode() {
    return state.lastResolvedNodeId ? state.nodesById.get(state.lastResolvedNodeId) || null : null;
  }

  function getLastResolvedCompany() {
    return getCompanyById(state.lastResolvedCompanyId);
  }

  function findCompanyByTicker(ticker) {
    return enrichCompanyEntry(getCompanyEntries().find((entry) => normalize(entry.ticker) === normalize(ticker)));
  }

  function findCompanyCandidates(query, limit = 8) {
    const normalized = normalize(query);
    if (!normalized) return [];
    const all = getCompanyEntries().map(enrichCompanyEntry);
    const ranked = [];
    all.forEach((entry) => {
      if (!entry.searchBlob.includes(normalized)) return;
      let score = 0;
      if (normalize(entry.ticker) === normalized) score += 120;
      if (normalize(entry.company) === normalized) score += 100;
      if (normalize(entry.ticker).startsWith(normalized)) score += 80;
      if (normalize(entry.company).startsWith(normalized)) score += 70;
      if (entry.searchBlob.includes(normalized)) score += 30;
      ranked.push({ score, entry });
    });
    return ranked
      .sort((a, b) => b.score - a.score || a.entry.company.localeCompare(b.entry.company))
      .slice(0, limit)
      .map((item) => item.entry);
  }

  function extractTickerToken(value) {
    const match = String(value || "").toUpperCase().match(/\b[A-Z][A-Z.\-]{0,5}\b/);
    return match ? match[0] : "";
  }

  function getIndustryContext(industryKey) {
    const mod = window.IndustryModules?.[industryKey] || moduleRef || {};
    const source = window.TMTIndustryChainData || {};
    const nodeRows = Array.isArray(source.nodes) ? source.nodes : [];
    const flowRows = Array.isArray(source.flows) ? source.flows : [];
    return {
      key: String(industryKey || moduleRef.key || "TMT"),
      label: String(mod.label || moduleRef.label || industryKey || "Industry"),
      sidebarTitle: String(mod.sidebar?.title || ""),
      chainContext: nodeRows.length
        ? `Industry chain has ${nodeRows.length} nodes and ${flowRows.length} flows. Nodes include ${nodeRows.slice(0, 8).map((node) => `N${node["Node ID"]} ${node["Node Name"]}`).join("; ")}.`
        : "",
      glossaryContext: String(mod.glossary?.llmContext || ""),
      companyContext: "Representative companies and major players are available from the TMT company directory and the chain node player lists."
    };
  }

  function renderTable(title, headers, rows, emptyText) {
    if (!rows.length) {
      return `
        <div class="industry-section-title">${title}</div>
        <div class="industry-detail-box industry-detail-text text-gray-400">${emptyText}</div>
      `;
    }
    const headHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const bodyHtml = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? "-")}</td>`).join("")}</tr>`)
      .join("");
    return `
      <div class="industry-section-title">${title}</div>
      <div class="industry-detail-box">
        <table class="industry-mini-table">
          <thead><tr>${headHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;
  }

  function renderNodeDetail(nodeId, detailEl) {
    const node = state.nodesById.get(nodeId);
    if (!node) {
      detailEl.innerHTML = `<div class="industry-detail-text text-gray-400">Node detail unavailable.</div>`;
      return;
    }

    const subsegments = state.subsegments.filter((r) => toNumber(r["Node ID"]) === nodeId);
    const outbound = state.flows.filter((f) => f.fromId === nodeId);
    const inbound = state.flows.filter((f) => f.toId === nodeId);
    const flowSummary = state.flowByNode.find((r) => toNumber(r["Node ID"]) === nodeId);

    const overview = `
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div class="industry-detail-box">
          <div class="industry-section-title">Overview</div>
          <div class="industry-detail-text"><strong>Node ${escapeHtml(node.id)}:</strong> ${escapeHtml(node.name)}</div>
          <div class="industry-detail-text mt-2"><strong>Tier:</strong> ${escapeHtml(node.tier || "-")}</div>
          <div class="industry-detail-text mt-2">${escapeHtml(node.provides || "-")}</div>
        </div>
        <div class="industry-detail-box">
          <div class="industry-section-title">Products and Players</div>
          <div class="industry-detail-text"><strong>Key Activities:</strong> ${escapeHtml(node.activities || "-")}</div>
          <div class="industry-detail-text mt-2"><strong>Representative Competitors:</strong> ${escapeHtml(node.players || "-")}</div>
        </div>
      </div>
    `;

    const summaryBox = `
      <div class="industry-section-title">Outflow Summary</div>
      <div class="industry-detail-box industry-detail-text mb-5">
        <div><strong>Outflow To IDs:</strong> ${escapeHtml(flowSummary?.["Outflow To IDs"] || node.outflowIds || "-")}</div>
        <div class="mt-2"><strong>Outflow To Names:</strong> ${escapeHtml(flowSummary?.["Outflow To Names"] || node.outflowNames || "-")}</div>
        <div class="mt-2"><strong>Typical Deliverables:</strong> ${escapeHtml(flowSummary?.["Typical downstream deliverables"] || "-")}</div>
        <div class="mt-2"><strong>Comment:</strong> ${escapeHtml(flowSummary?.["Comment"] || node.notes || "-")}</div>
      </div>
    `;

    const subsegmentRows = subsegments.map((r) => [
      r["Subsegment"],
      r["Main competitors / representative players"],
      r["Why it matters in AI"]
    ]);
    const outboundRows = outbound.map((f) => [f.toName, f.whatFlows, f.whyLink]);
    const inboundRows = inbound.map((f) => [f.fromName, f.whatFlows, f.whyLink]);

    detailEl.innerHTML = `
      ${overview}
      ${summaryBox}
      ${renderTable("Subsegments", ["Subsegment", "Main Players", "Why It Matters"], subsegmentRows, "No subsegments listed for this node.")}
      <div class="h-4"></div>
      ${renderTable("Outbound Flows", ["To Node", "What Flows", "Why This Link Exists"], outboundRows, "No outbound links listed.")}
      <div class="h-4"></div>
      ${renderTable("Inbound Flows", ["From Node", "What Flows", "Why This Link Exists"], inboundRows, "No inbound links listed.")}
    `;
  }

  function wrapText(text, maxChars) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((w) => {
      const next = line ? `${line} ${w}` : w;
      if (next.length <= maxChars) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    });
    if (line) lines.push(line);
    return lines.join("\n");
  }

  function ensureChainStyles() {
    if (document.getElementById("tmt-industry-chain-style")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "tmt-industry-chain-style";
    styleEl.textContent = `
      .industry-chain-host {
        position: relative;
      }

      .industry-chain-svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .industry-chain-links path {
        transition: fill 0.22s ease, opacity 0.22s ease;
        pointer-events: none;
      }

      .industry-chain-link {
        transition: fill 0.22s ease, opacity 0.22s ease;
      }

      .industry-chain-link.is-dim {
        opacity: 0.05 !important;
      }

      .industry-chain-link.is-upstream {
        fill: rgba(126, 148, 185, 0.84) !important;
        opacity: 0.84 !important;
      }

      .industry-chain-link.is-downstream {
        fill: rgba(116, 164, 170, 0.84) !important;
        opacity: 0.84 !important;
      }

      .industry-chain-node {
        cursor: pointer;
        transition: opacity 0.22s ease;
      }

      .industry-chain-node .node-bar {
        transition: fill 0.22s ease, stroke 0.22s ease, opacity 0.22s ease;
      }

      .industry-chain-node .node-label {
        fill: #e5e7eb;
        font-family: Montserrat, sans-serif;
        font-size: 11px;
        font-weight: 700;
        transition: fill 0.22s ease, opacity 0.22s ease;
      }

      .industry-chain-node .node-hit {
        cursor: pointer;
      }

      .industry-chain-node.is-dim {
        opacity: 0.16;
      }

      .industry-chain-node.is-center {
        opacity: 1;
      }

      .industry-chain-node.is-center .node-bar {
        fill: #dbe6ff;
        stroke: #f8fafc;
      }

      .industry-chain-node.is-center .node-label {
        fill: #ffffff;
      }

      .industry-chain-node.is-upstream {
        opacity: 0.95;
      }

      .industry-chain-node.is-upstream .node-bar {
        fill: #7a89a9;
        stroke: #c4d2ea;
      }

      .industry-chain-node.is-upstream .node-label {
        fill: #e8eef9;
      }

      .industry-chain-node.is-downstream {
        opacity: 0.95;
      }

      .industry-chain-node.is-downstream .node-bar {
        fill: #73989d;
        stroke: #c4e1e4;
      }

      .industry-chain-node.is-downstream .node-label {
        fill: #e8f5f6;
      }
    `;
    document.head.appendChild(styleEl);
  }

  function ensureAgentStyles() {
    if (document.getElementById("tmt-industry-agent-style")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "tmt-industry-agent-style";
    styleEl.textContent = `
      .industry-agent-launcher{position:fixed;right:28px;bottom:24px;width:58px;height:58px;border-radius:999px;border:1px solid rgba(94,234,212,.34);background:radial-gradient(circle at 30% 30%,rgba(94,234,212,.18),rgba(15,19,27,.98));color:#eefcfb;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 18px 42px rgba(0,0,0,.42),0 0 0 1px rgba(94,234,212,.1);z-index:39;transition:opacity .22s ease,transform .22s ease;cursor:pointer}
      .industry-agent-launcher.hidden{opacity:0;pointer-events:none;transform:translateY(10px) scale(.9)}
      .industry-agent-chatbox{position:fixed;right:28px;bottom:24px;width:min(460px,calc(100vw - 24px));max-height:min(78vh,720px);border:1px solid rgba(94,234,212,.2);background:rgba(12,16,24,.98);box-shadow:0 26px 80px rgba(0,0,0,.52),0 0 0 1px rgba(94,234,212,.08);display:flex;flex-direction:column;overflow:hidden;z-index:40;transform-origin:bottom right;transition:opacity .22s ease,transform .22s ease}
      .industry-agent-chatbox.collapsed{opacity:0;pointer-events:none;transform:translateY(16px) scale(.96);box-shadow:0 12px 28px rgba(0,0,0,.24)}
      .industry-agent-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06);background:linear-gradient(180deg,rgba(94,234,212,.09),rgba(255,255,255,.01));cursor:grab;user-select:none}
      .industry-agent-header.dragging{cursor:grabbing}
      .industry-agent-title{color:#f8fafc;font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
      .industry-agent-subtitle{color:#9bc6c0;font-size:11px;margin-top:4px;line-height:1.5}
      .industry-agent-toggle{width:34px;height:34px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#cbd5e1;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;cursor:pointer}
      .industry-agent-messages{padding:14px 14px 8px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;min-height:180px;max-height:min(54vh,540px)}
      .industry-agent-message{display:flex}
      .industry-agent-message.user{justify-content:flex-end}
      .industry-agent-bubble{max-width:100%;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:#e5ecf5;padding:12px 14px;font-size:13px;line-height:1.72;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
      .industry-agent-message.user .industry-agent-bubble{background:rgba(94,234,212,.1);border-color:rgba(94,234,212,.28)}
      .industry-agent-working{display:inline-flex;align-items:center;gap:10px;color:#dcfdf7}
      .industry-agent-working-spinner{width:13px;height:13px;border-radius:999px;border:2px solid rgba(255,255,255,.2);border-top-color:rgba(94,234,212,.95);animation:industry-agent-spin .9s linear infinite}
      .industry-agent-working-dots{display:inline-flex;gap:4px}
      .industry-agent-working-dots span{width:4px;height:4px;border-radius:999px;background:rgba(94,234,212,.88);animation:industry-agent-dot-pulse 1.15s ease-in-out infinite}
      .industry-agent-working-dots span:nth-child(2){animation-delay:.15s}
      .industry-agent-working-dots span:nth-child(3){animation-delay:.3s}
      .industry-agent-card{margin-top:12px;border:1px solid rgba(94,234,212,.16);background:rgba(94,234,212,.05);padding:12px}
      .industry-agent-card-top{display:flex;justify-content:space-between;gap:10px;align-items:start}
      .industry-agent-card-title{color:#f8fafc;font-size:16px;font-weight:800;line-height:1.25}
      .industry-agent-card-meta{color:#b6d7d2;font-size:11px;line-height:1.6;margin-top:6px}
      .industry-agent-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .industry-agent-action-btn{border:1px solid rgba(94,234,212,.22);background:rgba(94,234,212,.09);color:#e6fffb;padding:9px 12px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
      .industry-agent-input-row{padding:12px 14px 14px;border-top:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.01)}
      .industry-agent-input-wrap{display:flex;gap:10px;align-items:end}
      .industry-agent-input{flex:1 1 auto;min-height:42px;max-height:132px;resize:none;border:1px solid rgba(255,255,255,.08);background:rgba(15,19,27,.92);color:#f8fafc;padding:11px 12px;font-size:13px;line-height:1.5;outline:none;font-family:inherit}
      .industry-agent-send{border:1px solid rgba(94,234,212,.22);background:rgba(94,234,212,.09);color:#e6fffb;height:42px;padding:0 14px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;flex:0 0 auto}
      @keyframes industry-agent-spin{to{transform:rotate(360deg)}}
      @keyframes industry-agent-dot-pulse{0%,80%,100%{opacity:.28;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
      @media (max-width:720px){.industry-agent-chatbox{right:12px;bottom:12px;width:calc(100vw - 24px)}.industry-agent-launcher{right:12px;bottom:12px}}
    `;
    document.head.appendChild(styleEl);
  }

  function summarizeNode(node) {
    return {
      id: node.id,
      name: node.name,
      tier: node.tier || "",
      provides: node.provides || "",
      players: node.players || "",
      notes: node.notes || ""
    };
  }

  function findNodeCandidates(query, limit = 6) {
    const normalized = normalize(query);
    if (!normalized) return [];
    const ranked = [];
    state.nodesById.forEach((node) => {
      const blob = [node.name, node.tier, node.provides, node.activities, node.players, node.notes].join(" ").toUpperCase();
      if (!blob.includes(normalized)) return;
      let score = 0;
      if (normalize(node.name) === normalized) score += 120;
      if (normalize(`N${node.id}`) === normalized || String(node.id) === normalized) score += 110;
      if (normalize(node.name).startsWith(normalized)) score += 80;
      if (blob.includes(normalized)) score += 30;
      ranked.push({ score, node: summarizeNode(node) });
    });
    return ranked
      .sort((a, b) => b.score - a.score || a.node.id - b.node.id)
      .slice(0, limit)
      .map((item) => item.node);
  }

  function extractNodeIdToken(value) {
    const match = String(value || "").toUpperCase().match(/\bN\s*([0-9]{1,2})\b|\bNODE\s*([0-9]{1,2})\b/);
    if (!match) return null;
    const raw = match[1] || match[2] || "";
    const id = toNumber(raw);
    return id !== null && state.nodesById.has(id) ? id : null;
  }

  function findChainMatches(query) {
    const normalized = normalize(query);
    if (!normalized) return [];
    const nodeMatches = [...state.nodesById.values()]
      .filter((node) => [node.name, node.tier, node.provides, node.activities, node.players, node.notes].join(" ").toUpperCase().includes(normalized))
      .slice(0, 5)
      .map((node) => `Node N${node.id} ${node.name} (${node.tier || "-"}) provides ${node.provides || "-"} Major players: ${node.players || "-"}`);
    const flowMatches = state.flows
      .filter((flow) => [flow.fromName, flow.toName, flow.whatFlows, flow.whyLink].join(" ").toUpperCase().includes(normalized))
      .slice(0, 5)
      .map((flow) => `Flow N${flow.fromId} ${flow.fromName} -> N${flow.toId} ${flow.toName}: ${flow.whatFlows || "-"} Why: ${flow.whyLink || "-"}`);
    return [...nodeMatches, ...flowMatches];
  }

  function resolveDashboardTicker(query, preferredCompany) {
    const directTicker = extractTickerToken(query);
    if (directTicker) {
      const byTicker = findCompanyByTicker(directTicker);
      if (byTicker?.isUsListed) return { ticker: byTicker.ticker, company: byTicker };
      return { ticker: directTicker, company: byTicker || null };
    }
    if (preferredCompany?.isUsListed) return { ticker: preferredCompany.ticker, company: preferredCompany };
    const firstCompany = findCompanyCandidates(query, 1)[0] || null;
    if (firstCompany?.isUsListed) return { ticker: firstCompany.ticker, company: firstCompany };
    const dashTicker = String(window.__equityscanDashboardSnapshot?.info?.symbol || "").trim().toUpperCase();
    if (dashTicker) return { ticker: dashTicker, company: findCompanyByTicker(dashTicker) };
    return { ticker: "", company: firstCompany || preferredCompany || null };
  }

  async function fetchIndustryWebResearch(query, industryKey, selectedNode, selectedCompany) {
    const ctx = getIndustryContext(industryKey);
    const response = await fetch(`${API_BASE_URL}/api/websearch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: String(query || "").trim(),
        context: [
          ctx.label,
          ctx.sidebarTitle,
          ctx.chainContext,
          ctx.companyContext,
          ctx.glossaryContext,
          selectedNode ? `Node ${selectedNode.id} ${selectedNode.name} ${selectedNode.players}` : "",
          selectedCompany ? `${selectedCompany.company} ${selectedCompany.parent} ${selectedCompany.subsegment}` : ""
        ].filter(Boolean).join(" "),
        numResults: 5
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.detail || `HTTP ${response.status}`));
    return Array.isArray(data?.results) ? data.results : [];
  }

  function formatIndustryNodeCardHtml(node) {
    return `<div class="industry-agent-card"><div class="industry-agent-card-top"><div><div class="industry-agent-card-title">N${escapeHtml(node.id)} ${escapeHtml(node.name)}</div><div class="industry-agent-card-meta">${escapeHtml(node.tier || "-")}<br>${escapeHtml(node.players || "No representative players listed.")}</div></div></div><div class="industry-agent-actions"><button class="industry-agent-action-btn" type="button" data-agent-focus-node="${escapeHtml(node.id)}">Focus Node</button></div></div>`;
  }

  function formatIndustryCompanyCardHtml(entry) {
    return `<div class="industry-agent-card"><div class="industry-agent-card-top"><div><div class="industry-agent-card-title">${escapeHtml(entry.company)}</div><div class="industry-agent-card-meta">${escapeHtml(entry.subsegment || "-")}<br>${escapeHtml(entry.parent || "-")}</div></div>${entry.isUsListed ? `<span class="industry-flow-legend-item" style="border:1px solid rgba(94,234,212,.18);padding:5px 8px">${escapeHtml(entry.ticker)}</span>` : ""}</div><div class="industry-agent-actions">${entry.isUsListed ? `<button class="industry-agent-action-btn" type="button" data-agent-open-dashboard="${escapeHtml(entry.ticker)}">Open ${escapeHtml(entry.ticker)} In Dashboard</button>` : ""}</div></div>`;
  }

  function pushAgentMessage(role, html) {
    const plain = String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    state.chatMessages.push({ role, html, text: plain });
  }

  function pushAgentWorkingMessage() {
    state.chatMessages.push({
      role: "assistant",
      html: '<div class="industry-agent-working"><span class="industry-agent-working-spinner"></span><span>Agent I is tracing the chain</span><span class="industry-agent-working-dots"><span></span><span></span><span></span></span></div>',
      text: "Agent I is tracing the chain",
      working: true
    });
  }

  function removeAgentWorkingMessage() {
    const index = state.chatMessages.findIndex((message) => message.working);
    if (index >= 0) state.chatMessages.splice(index, 1);
  }

  function renderAgentMessages(host) {
    host.innerHTML = state.chatMessages.map((message) => `<div class="industry-agent-message ${message.role === "user" ? "user" : "assistant"}"><div class="industry-agent-bubble">${message.html}</div></div>`).join("");
    host.scrollTop = host.scrollHeight;
    requestAnimationFrame(() => {
      if (typeof window.__tmtIndustryClampChatPosition === "function") window.__tmtIndustryClampChatPosition();
    });
  }

  function renderAgentWidgetMarkup() {
    return `<button id="industryAgentLauncher" class="industry-agent-launcher ${state.chatOpen ? "hidden" : ""}" type="button" aria-label="Open Agent I"><i class="fa-solid fa-sitemap"></i></button><aside id="industryAgentChatbox" class="industry-agent-chatbox ${state.chatOpen ? "" : "collapsed"}"><div class="industry-agent-header"><div><div class="industry-agent-title">Agent I</div><div class="industry-agent-subtitle">Industry chain expert, player context, and live web research.</div></div><button id="industryAgentToggle" class="industry-agent-toggle" type="button" aria-label="Minimize Agent I"><i class="fa-solid fa-minus"></i></button></div><div id="industryAgentMessages" class="industry-agent-messages"></div><div class="industry-agent-input-row"><div class="industry-agent-input-wrap"><textarea id="industryAgentInput" class="industry-agent-input" rows="1" placeholder='Ask "where does Nvidia sit in the chain?" or "which node benefits from AI server demand?"'></textarea><button id="industryAgentSend" class="industry-agent-send" type="button">Send</button></div></div></aside>`;
  }

  async function fetchAgentIResponse(userMessage, industryKey) {
    const history = state.chatMessages.map((message) => ({ role: message.role, content: String(message.text || "").trim() })).filter((item) => item.content);
    const selectedNode = getSelectedNode();
    const lastResolvedNode = getLastResolvedNode();
    const lastResolvedCompany = getLastResolvedCompany();
    const ctx = getIndustryContext(industryKey);
    if (!window.LLMShell?.planIndustryAgentTurn || !window.LLMShell?.answerIndustryAgentTurn) {
      return { ok: false, error: "Agent I shell is not loaded." };
    }
    const planner = await window.LLMShell.planIndustryAgentTurn({
      agentName: "Agent I",
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.chainContext, ctx.companyContext, ctx.glossaryContext].filter(Boolean).join(" "),
      conversationHistory: history,
      selectedNode,
      lastResolvedNode,
      currentDashboard: window.__equityscanDashboardSnapshot || null
    });
    if (!planner.ok) return planner;
    if (planner.mode === "reply" && !planner.lookupQuery) {
      return { ok: true, mode: "reply", assistantResponse: planner.assistantResponse };
    }

    const lookupQuery = String(planner.lookupQuery || selectedNode?.name || lastResolvedNode?.name || "").trim();
    const explicitNodeId = extractNodeIdToken(lookupQuery) || extractNodeIdToken(userMessage);
    const explicitNode = explicitNodeId !== null ? summarizeNode(state.nodesById.get(explicitNodeId)) : null;
    const nodeCandidates = lookupQuery ? findNodeCandidates(lookupQuery, 8) : [];
    const companyCandidates = lookupQuery ? findCompanyCandidates([lookupQuery, userMessage].join(" "), 8) : [];
    const selectedCompany = getCompanyById(state.lastResolvedCompanyId) || companyCandidates[0] || lastResolvedCompany || null;

    if (planner.mode === "open_dashboard") {
      const resolved = resolveDashboardTicker(lookupQuery, selectedCompany);
      return {
        ok: true,
        mode: "open_dashboard",
        assistantResponse: planner.assistantResponse || (resolved.ticker ? `Opening ${resolved.ticker} in the dashboard.` : "I couldn't find a US-listed ticker to open yet."),
        openDashboardTicker: resolved.ticker,
        selectedCompany: resolved.company || selectedCompany || null
      };
    }

    const webResults = planner.useWebResearch
      ? await fetchIndustryWebResearch(planner.searchQuery || [lookupQuery, userMessage].filter(Boolean).join(" "), industryKey, selectedNode, selectedCompany).catch(() => [])
      : [];

    const answer = await window.LLMShell.answerIndustryAgentTurn({
      agentName: "Agent I",
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.chainContext, ctx.companyContext, ctx.glossaryContext].filter(Boolean).join(" "),
      lookupQuery,
      conversationHistory: history,
      selectedNode,
      explicitNode,
      currentDashboard: window.__equityscanDashboardSnapshot || null,
      candidateNodes: nodeCandidates,
      candidateCompanies: companyCandidates,
      chainMatches: findChainMatches([lookupQuery, userMessage].filter(Boolean).join(" ")),
      webResults
    });
    if (!answer.ok) return answer;
    const chosenNode =
      (explicitNode?.id ? summarizeNode(state.nodesById.get(explicitNode.id)) : null)
      || state.nodesById.get(Number(answer.selectedNodeId) || 0)
      || nodeCandidates[0]
      || selectedNode
      || null;
    const chosenCompany = getCompanyById(answer.selectedCompanyId) || companyCandidates.find((entry) => entry.id === answer.selectedCompanyId) || selectedCompany || null;
    return {
      ok: true,
      mode: "resolve_chain",
      assistantResponse: answer.assistantResponse,
      selectedNode: chosenNode,
      selectedCompany: chosenCompany,
      openDashboardTicker: answer.openDashboardTicker || "",
      offerOpenDashboard: Boolean(answer.offerOpenDashboard && answer.openDashboardTicker)
    };
  }

  function buildRibbonPath(link, nodeBarWidth) {
    const sx = link.source.x + nodeBarWidth;
    const tx = link.target.x;
    const syTop = link.sourceY - link.thickness / 2;
    const syBottom = link.sourceY + link.thickness / 2;
    const tyTop = link.targetY - link.thickness / 2;
    const tyBottom = link.targetY + link.thickness / 2;
    const dx = tx - sx;
    const dy = link.targetY - link.sourceY;

    const directThreshold = link.isSameStage ? 18 : 52;
    if (dx >= directThreshold) {
      const spread = link.isSameStage
        ? Math.max(18, Math.min(86, dx * 0.78))
        : Math.max(78, Math.min(168, dx * 0.42));
      const settle = link.isSameStage
        ? Math.max(10, Math.min(52, dx * 0.46))
        : Math.max(62, Math.min(150, dx * 0.34));
      const c1x = sx + spread;
      const c2x = tx - settle;
      return [
        `M ${sx} ${syTop}`,
        `C ${c1x} ${syTop}, ${c2x} ${tyTop}, ${tx} ${tyTop}`,
        `L ${tx} ${tyBottom}`,
        `C ${c2x} ${tyBottom}, ${c1x} ${syBottom}, ${sx} ${syBottom}`,
        "Z"
      ].join(" ");
    }

    const loopReach = Math.max(112, Math.min(182, Math.abs(dy) * 0.34 + 96));
    const loopX = Math.max(sx, tx) + loopReach;
    const entryX = sx + Math.max(46, Math.min(90, loopReach * 0.42));
    const settleX = tx + Math.max(18, Math.min(54, loopReach * 0.22));
    const midY = (link.sourceY + link.targetY) / 2;
    const topTurnY = midY - link.thickness / 2;
    const bottomTurnY = midY + link.thickness / 2;
    return [
      `M ${sx} ${syTop}`,
      `C ${entryX} ${syTop}, ${loopX} ${syTop}, ${loopX} ${topTurnY}`,
      `C ${loopX} ${tyTop}, ${settleX} ${tyTop}, ${tx} ${tyTop}`,
      `L ${tx} ${tyBottom}`,
      `C ${settleX} ${tyBottom}, ${loopX} ${tyBottom}, ${loopX} ${bottomTurnY}`,
      `C ${loopX} ${syBottom}, ${entryX} ${syBottom}, ${sx} ${syBottom}`,
      "Z"
    ].join(" ");
  }

  function pairCrossingCost(flowA, flowB, rowByNodeId) {
    const aSrc = rowByNodeId.get(flowA.fromId);
    const aDst = rowByNodeId.get(flowA.toId);
    const bSrc = rowByNodeId.get(flowB.fromId);
    const bDst = rowByNodeId.get(flowB.toId);
    if (aSrc === undefined || aDst === undefined || bSrc === undefined || bDst === undefined) return 0;
    return (aSrc - bSrc) * (aDst - bDst) < 0 ? 1 : 0;
  }

  function optimizeStageOrder(nodes, flows) {
    const stageIds = [...new Set(nodes.map((n) => n.depth))].sort((a, b) => a - b);
    const nodesByStage = new Map(stageIds.map((d) => [d, nodes.filter((n) => n.depth === d).sort((a, b) => a.id - b.id)]));
    const variableStages = stageIds.filter((d) => (nodesByStage.get(d) || []).length === 2);

    if (!variableStages.length) {
      const rowByNodeId = new Map();
      stageIds.forEach((d) => {
        const stageNodes = nodesByStage.get(d) || [];
        stageNodes.forEach((n, idx) => rowByNodeId.set(n.id, idx));
      });
      return rowByNodeId;
    }

    const stageIndex = new Map(variableStages.map((d, i) => [d, i]));
    let bestMask = 0;
    let bestCost = Infinity;
    const combinations = 1 << variableStages.length;

    for (let mask = 0; mask < combinations; mask += 1) {
      const rowByNodeId = new Map();
      stageIds.forEach((d) => {
        const stageNodes = nodesByStage.get(d) || [];
        if (stageNodes.length !== 2) {
          stageNodes.forEach((n, idx) => rowByNodeId.set(n.id, idx));
          return;
        }
        const bit = stageIndex.get(d);
        const flipped = bit !== undefined ? ((mask >> bit) & 1) === 1 : false;
        if (flipped) {
          rowByNodeId.set(stageNodes[0].id, 1);
          rowByNodeId.set(stageNodes[1].id, 0);
        } else {
          rowByNodeId.set(stageNodes[0].id, 0);
          rowByNodeId.set(stageNodes[1].id, 1);
        }
      });

      let cost = 0;
      for (let i = 0; i < flows.length; i += 1) {
        for (let j = i + 1; j < flows.length; j += 1) {
          const a = flows[i];
          const b = flows[j];
          // Compare crossings only for links spanning the same stage pair.
          if (a.fromDepth !== b.fromDepth || a.toDepth !== b.toDepth) continue;
          cost += pairCrossingCost(a, b, rowByNodeId);
        }
      }

      if (cost < bestCost) {
        bestCost = cost;
        bestMask = mask;
      }
    }

    const finalRowByNodeId = new Map();
    stageIds.forEach((d) => {
      const stageNodes = nodesByStage.get(d) || [];
      if (stageNodes.length !== 2) {
        stageNodes.forEach((n, idx) => finalRowByNodeId.set(n.id, idx));
        return;
      }
      const bit = stageIndex.get(d);
      const flipped = bit !== undefined ? ((bestMask >> bit) & 1) === 1 : false;
      if (flipped) {
        finalRowByNodeId.set(stageNodes[0].id, 1);
        finalRowByNodeId.set(stageNodes[1].id, 0);
      } else {
        finalRowByNodeId.set(stageNodes[0].id, 0);
        finalRowByNodeId.set(stageNodes[1].id, 1);
      }
    });

    return finalRowByNodeId;
  }

  function buildState(source) {
    const nodeRows = Array.isArray(source.nodes) ? source.nodes : [];
    const flowRows = Array.isArray(source.flows) ? source.flows : [];

    const nodes = nodeRows
      .map((r) => ({
        id: toNumber(r["Node ID"]),
        tier: r["Tier"] || "",
        name: r["Node Name"] || "",
        provides: r["What this node provides"] || "",
        activities: r["Key products / activities"] || "",
        players: r["Representative competitors / players"] || "",
        outflowIds: r["Outflow To IDs"] || "",
        outflowNames: r["Outflow To Names"] || "",
        notes: r["Notes"] || ""
      }))
      .filter((n) => n.id !== null && n.name);

    const flows = flowRows
      .map((r) => ({
        fromId: toNumber(r["From Node ID"]),
        fromName: r["From Node Name"] || "",
        toId: toNumber(r["To Node ID"]),
        toName: r["To Node Name"] || "",
        whatFlows: r["What flows downstream"] || "",
        whyLink: r["Why this link exists"] || "",
        direction: r["Direction"] || ""
      }))
      .filter((f) => f.fromId !== null && f.toId !== null);

    state.nodesById = new Map(nodes.map((n) => [n.id, n]));
    state.flows = flows;
    state.subsegments = Array.isArray(source.nodeSubsegments) ? source.nodeSubsegments : [];
    state.flowByNode = Array.isArray(source.flowByNode) ? source.flowByNode : [];
    return nodes;
  }

  function createSvgElement(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) el.setAttribute(key, String(value));
    });
    return el;
  }

  function attachIndustryAgentActionHandlers(host, opts) {
    host.querySelectorAll("[data-agent-open-dashboard]").forEach((el) => {
      el.addEventListener("click", () => {
        const ticker = el.getAttribute("data-agent-open-dashboard");
        if (ticker) opts.onOpenTicker?.(ticker, opts.industryKey || moduleRef.key || "TMT");
      });
    });
    host.querySelectorAll("[data-agent-focus-node]").forEach((el) => {
      el.addEventListener("click", () => {
        const nodeId = toNumber(el.getAttribute("data-agent-focus-node"));
        if (nodeId === null) return;
        state.selectedNodeId = nodeId;
        state.lastResolvedNodeId = nodeId;
        const detailEl = document.getElementById(opts.detailId);
        if (detailEl) renderNodeDetail(nodeId, detailEl);
      });
    });
  }

  function bindIndustryAgentWidget(host, opts) {
    const chatboxEl = host.querySelector("#industryAgentChatbox");
    const launcherEl = host.querySelector("#industryAgentLauncher");
    const messagesEl = host.querySelector("#industryAgentMessages");
    const chatInputEl = host.querySelector("#industryAgentInput");
    const chatSendEl = host.querySelector("#industryAgentSend");
    const toggleEl = host.querySelector("#industryAgentToggle");
    const headerEl = chatboxEl?.querySelector(".industry-agent-header");
    if (!chatboxEl || !launcherEl || !messagesEl || !chatInputEl || !chatSendEl || !toggleEl || !headerEl) return;

    function setChatOpen(open) {
      state.chatOpen = !!open;
      clampChatPosition();
      chatboxEl.classList.toggle("collapsed", !state.chatOpen);
      launcherEl.classList.toggle("hidden", state.chatOpen);
      if (!state.chatOpen) headerEl.classList.remove("dragging");
    }

    function getChatPosition() {
      const left = Number.parseFloat(chatboxEl.style.left);
      const top = Number.parseFloat(chatboxEl.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) return { left, top };
      const width = chatboxEl.offsetWidth || 460;
      const height = chatboxEl.offsetHeight || 580;
      return {
        left: Math.max(AGENT_PAD, window.innerWidth - width - AGENT_DEFAULT_RIGHT),
        top: Math.max(AGENT_PAD, window.innerHeight - height - AGENT_DEFAULT_BOTTOM)
      };
    }

    function applyChatPosition(left, top) {
      chatboxEl.style.left = `${left}px`;
      chatboxEl.style.top = `${top}px`;
      chatboxEl.style.right = "auto";
      chatboxEl.style.bottom = "auto";
      launcherEl.style.left = `${left + chatboxEl.offsetWidth - launcherEl.offsetWidth}px`;
      launcherEl.style.top = `${top + chatboxEl.offsetHeight - launcherEl.offsetHeight}px`;
      launcherEl.style.right = "auto";
      launcherEl.style.bottom = "auto";
    }

    function clampChatPosition() {
      const width = chatboxEl.offsetWidth || 460;
      const height = chatboxEl.offsetHeight || 580;
      const position = getChatPosition();
      const maxLeft = Math.max(AGENT_PAD, window.innerWidth - width - AGENT_PAD);
      const maxTop = Math.max(AGENT_PAD, window.innerHeight - height - AGENT_PAD);
      applyChatPosition(
        Math.max(AGENT_PAD, Math.min(maxLeft, position.left)),
        Math.max(AGENT_PAD, Math.min(maxTop, position.top))
      );
    }

    window.__tmtIndustryClampChatPosition = clampChatPosition;

    function resizeChatInput() {
      chatInputEl.style.height = "auto";
      chatInputEl.style.height = `${Math.max(42, Math.min(chatInputEl.scrollHeight, 132))}px`;
      requestAnimationFrame(clampChatPosition);
    }

    function initializeChatPosition() {
      const width = chatboxEl.offsetWidth || 460;
      const height = chatboxEl.offsetHeight || 580;
      applyChatPosition(
        Math.max(AGENT_PAD, window.innerWidth - width - AGENT_DEFAULT_RIGHT),
        Math.max(AGENT_PAD, window.innerHeight - height - AGENT_DEFAULT_BOTTOM)
      );
    }

    function handleDragMove(event) {
      if (!state.chatDrag.pointerId) return;
      state.chatDrag.didMove = true;
      const maxLeft = Math.max(AGENT_PAD, window.innerWidth - chatboxEl.offsetWidth - AGENT_PAD);
      const maxTop = Math.max(AGENT_PAD, window.innerHeight - chatboxEl.offsetHeight - AGENT_PAD);
      applyChatPosition(
        Math.max(AGENT_PAD, Math.min(maxLeft, state.chatDrag.originLeft + (event.clientX - state.chatDrag.startX))),
        Math.max(AGENT_PAD, Math.min(maxTop, state.chatDrag.originTop + (event.clientY - state.chatDrag.startY)))
      );
    }

    function endDrag() {
      state.chatDrag.pointerId = null;
      state.chatDrag.didMove = false;
      headerEl.classList.remove("dragging");
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", endDrag);
    }

    function beginDrag(event) {
      if (event.target.closest("button")) return;
      event.preventDefault();
      clampChatPosition();
      const position = getChatPosition();
      state.chatDrag.pointerId = "mouse";
      state.chatDrag.startX = event.clientX;
      state.chatDrag.startY = event.clientY;
      state.chatDrag.originLeft = position.left;
      state.chatDrag.originTop = position.top;
      state.chatDrag.didMove = false;
      headerEl.classList.add("dragging");
      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", endDrag);
    }

    async function handleChatQuery() {
      const rawMessage = String(chatInputEl.value || "").trim();
      if (!rawMessage || state.chatBusy) return;
      pushAgentMessage("user", escapeHtml(rawMessage));
      renderAgentMessages(messagesEl);
      chatInputEl.value = "";
      resizeChatInput();
      state.chatBusy = true;
      pushAgentWorkingMessage();
      renderAgentMessages(messagesEl);
      try {
        const response = await fetchAgentIResponse(rawMessage, opts.industryKey || moduleRef.key || "TMT");
        removeAgentWorkingMessage();
        if (!response.ok) {
          pushAgentMessage("assistant", `Agent I hit a wall.<br>${escapeHtml(response.error || "Unknown error.")}`);
        } else if (response.mode === "open_dashboard") {
          if (response.selectedCompany?.id) state.lastResolvedCompanyId = response.selectedCompany.id;
          if (response.openDashboardTicker) {
            pushAgentMessage("assistant", `${escapeHtml(response.assistantResponse)}<div class="industry-agent-actions"><button class="industry-agent-action-btn" type="button" data-agent-open-dashboard="${escapeHtml(response.openDashboardTicker)}">Open ${escapeHtml(response.openDashboardTicker)} In Dashboard</button></div>`);
          } else {
            pushAgentMessage("assistant", escapeHtml(response.assistantResponse));
          }
        } else {
          if (response.selectedNode?.id) {
            state.selectedNodeId = response.selectedNode.id;
            state.lastResolvedNodeId = response.selectedNode.id;
            const detailEl = document.getElementById(opts.detailId);
            if (detailEl) renderNodeDetail(response.selectedNode.id, detailEl);
          }
          if (response.selectedCompany?.id) {
            state.lastResolvedCompanyId = response.selectedCompany.id;
          }
          const nodeHtml = response.selectedNode ? formatIndustryNodeCardHtml(response.selectedNode) : "";
          const companyHtml = response.selectedCompany ? formatIndustryCompanyCardHtml(response.selectedCompany) : "";
          const dashHtml = response.offerOpenDashboard && response.openDashboardTicker ? `<div class="industry-agent-actions"><button class="industry-agent-action-btn" type="button" data-agent-open-dashboard="${escapeHtml(response.openDashboardTicker)}">Open ${escapeHtml(response.openDashboardTicker)} In Dashboard</button></div>` : "";
          pushAgentMessage("assistant", `${escapeHtml(response.assistantResponse)}${nodeHtml}${companyHtml}${dashHtml}`);
        }
      } catch (err) {
        removeAgentWorkingMessage();
        pushAgentMessage("assistant", `Agent I hit a wall.<br>${escapeHtml(String(err && err.message ? err.message : err))}`);
      }
      renderAgentMessages(messagesEl);
      attachIndustryAgentActionHandlers(host, opts);
      state.chatBusy = false;
    }

    headerEl.addEventListener("mousedown", beginDrag);
    toggleEl.addEventListener("click", () => setChatOpen(false));
    launcherEl.addEventListener("click", () => setChatOpen(true));
    window.addEventListener("resize", clampChatPosition);
    chatSendEl.addEventListener("click", handleChatQuery);
    chatInputEl.addEventListener("input", resizeChatInput);
    chatInputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleChatQuery();
      }
    });

    if (!state.chatMessages.length) {
      pushAgentMessage("assistant", "I’m Agent I. Ask me about bottlenecks, beneficiaries, where companies sit in the chain, or what current news changes the structure.");
    }
    initializeChatPosition();
    setChatOpen(state.chatOpen);
    resizeChatInput();
    renderAgentMessages(messagesEl);
    attachIndustryAgentActionHandlers(host, opts);
  }

  function buildCenterOutSlots(count) {
    if (count <= 1) return [0];
    const center = Math.floor(count / 2);
    const slots = [center];
    for (let offset = 1; slots.length < count; offset += 1) {
      const upper = center - offset;
      const lower = center + offset;
      if (upper >= 0) slots.push(upper);
      if (lower < count) slots.push(lower);
    }
    return slots;
  }

  moduleRef.renderIndustryChainView = function renderIndustryChainView(opts) {
    const source = window.TMTIndustryChainData || window.IndustryChainData;
    const detailEl = document.getElementById(opts.detailId);
    const chartEl = document.getElementById(opts.chartId);
    const agentHost = opts.agentId ? document.getElementById(opts.agentId) : null;
    if (!source) {
      detailEl.innerHTML = `<div class="industry-detail-text text-red-400">TMT data file is missing.</div>`;
      return;
    }
    if (!chartEl) return;

    const nodes = buildState(source);
    if (!nodes.length) {
      detailEl.innerHTML = `<div class="industry-detail-text text-red-400">No nodes found in TMT data.</div>`;
      return;
    }

    ensureChainStyles();
    ensureAgentStyles();

    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
      state.resizeObserver = null;
    }
    if (state.resizeFrame) {
      cancelAnimationFrame(state.resizeFrame);
      state.resizeFrame = 0;
    }

    if (opts.chartMap[opts.chartId] && typeof opts.chartMap[opts.chartId].dispose === "function") {
      opts.chartMap[opts.chartId].dispose();
    }

    const nodeFill = "#5b8cff";
    const nodeStroke = "#1e293b";
    const linkColor = "rgba(124, 157, 255, 0.36)";
    const sameStageLinkColor = "rgba(124, 157, 255, 0.26)";

    const nodeCatalog = nodes
      .map((n) => ({
        ...n,
        depth: Math.floor((n.id - 1) / 2)
      }))
      .sort((a, b) => a.id - b.id);

    const orderedFlows = state.flows
      .map((f) => ({
        ...f,
        fromDepth: Math.floor((f.fromId - 1) / 2),
        toDepth: Math.floor((f.toId - 1) / 2)
      }))
      .filter((f) => f.fromDepth <= f.toDepth);

    const tierOrder = [];
    nodeCatalog.forEach((node) => {
      const tierKey = node.tier || `Tier ${node.depth}`;
      if (!tierOrder.includes(tierKey)) tierOrder.push(tierKey);
    });
    const nodesByTier = new Map(
      tierOrder.map((tierKey) => [
        tierKey,
        nodeCatalog.filter((node) => (node.tier || `Tier ${node.depth}`) === tierKey)
      ])
    );
    const sameTierInCount = new Map(nodeCatalog.map((node) => [node.id, 0]));
    const sameTierOutCount = new Map(nodeCatalog.map((node) => [node.id, 0]));
    const sameTierRank = new Map(nodeCatalog.map((node) => [node.id, 0]));

    orderedFlows
      .filter((flow) => {
        const fromTier = state.nodesById.get(flow.fromId)?.tier || "";
        const toTier = state.nodesById.get(flow.toId)?.tier || "";
        return fromTier && fromTier === toTier;
      })
      .sort((a, b) => {
        if (a.fromId !== b.fromId) return a.fromId - b.fromId;
        return a.toId - b.toId;
      })
      .forEach((flow) => {
        sameTierOutCount.set(flow.fromId, (sameTierOutCount.get(flow.fromId) || 0) + 1);
        sameTierInCount.set(flow.toId, (sameTierInCount.get(flow.toId) || 0) + 1);
        const nextRank = (sameTierRank.get(flow.fromId) || 0) + 1;
        if (nextRank > (sameTierRank.get(flow.toId) || 0)) {
          sameTierRank.set(flow.toId, nextRank);
        }
      });

    const outgoingByNode = new Map();
    const incomingByNode = new Map();
    const linkCatalog = orderedFlows.map((flow, idx) => ({
      ...flow,
      idx,
      isSameStage: flow.fromDepth === flow.toDepth
    }));

    linkCatalog.forEach((flow) => {
      if (!outgoingByNode.has(flow.fromId)) outgoingByNode.set(flow.fromId, []);
      if (!incomingByNode.has(flow.toId)) incomingByNode.set(flow.toId, []);
      outgoingByNode.get(flow.fromId).push(flow);
      incomingByNode.get(flow.toId).push(flow);
    });

    function collectDirectionalSets(centerNodeId) {
      const upstreamNodes = new Set();
      const downstreamNodes = new Set();
      const upstreamLinks = new Set();
      const downstreamLinks = new Set();

      (incomingByNode.get(centerNodeId) || []).forEach((flow) => {
        upstreamLinks.add(flow.idx);
        upstreamNodes.add(flow.fromId);
      });

      (outgoingByNode.get(centerNodeId) || []).forEach((flow) => {
        downstreamLinks.add(flow.idx);
        downstreamNodes.add(flow.toId);
      });

      return { upstreamNodes, downstreamNodes, upstreamLinks, downstreamLinks };
    }

    function renderSvgChart() {
      const width = Math.max(chartEl.clientWidth || 0, 980);
      const height = Math.max(chartEl.clientHeight || 0, 620);
      const leftPad = 20;
      const rightPad = 120;
      const topPad = 40;
      const bottomPad = 34;
      const labelWidth = 148;
      const tierCount = tierOrder.length;
      const barWidth = 36;
      const horizontalScale = 1.1;
      const usableWidth = Math.max(760, width - leftPad - rightPad - labelWidth - 24);
      const tierStep = tierCount > 1 ? (usableWidth / (tierCount - 1)) * horizontalScale : usableWidth;
      const intraTierStep = Math.max(70, Math.min(106, tierStep * 0.26));
      const maxClusterSize = Math.max(...tierOrder.map((tierKey) => (nodesByTier.get(tierKey) || []).length));
      const innerHeight = height - topPad - bottomPad;
      const baseBarHeight = Math.max(124, Math.min(164, (innerHeight - (maxClusterSize - 1) * 50) / Math.max(1, maxClusterSize)));
      const barHeight = Math.min(222, baseBarHeight * 1.3);
      const clusterGap = Math.max(28, Math.min(56, (innerHeight - maxClusterSize * barHeight) / Math.max(1, maxClusterSize + 1)));
      const nodeXAdjustments = new Map([
        [2, 26],
        [4, -24],
        [6, -20],
        [8, 18],
        [12, 104]
      ]);
      const nodeRightSlack = new Map([
        [12, 136]
      ]);
      const nodePositions = new Map();

      tierOrder.forEach((tierKey, tierIndex) => {
        const tierNodes = [...(nodesByTier.get(tierKey) || [])];
        if (!tierNodes.length) return;

        let orderedTierNodes;
        if (tierNodes.length <= 2) {
          orderedTierNodes = tierNodes.sort((a, b) => {
            const rankDiff = (sameTierRank.get(a.id) || 0) - (sameTierRank.get(b.id) || 0);
            if (rankDiff !== 0) return rankDiff;
            return a.id - b.id;
          });
        } else {
          const priorityNodes = [...tierNodes].sort((a, b) => {
            const aScore = ((sameTierInCount.get(a.id) || 0) * 2) - (sameTierOutCount.get(a.id) || 0);
            const bScore = ((sameTierInCount.get(b.id) || 0) * 2) - (sameTierOutCount.get(b.id) || 0);
            if (bScore !== aScore) return bScore - aScore;
            const aRank = sameTierRank.get(a.id) || 0;
            const bRank = sameTierRank.get(b.id) || 0;
            if (aRank !== bRank) return aRank - bRank;
            return a.id - b.id;
          });
          const slotOrder = buildCenterOutSlots(priorityNodes.length);
          orderedTierNodes = new Array(priorityNodes.length);
          priorityNodes.forEach((node, index) => {
            orderedTierNodes[slotOrder[index]] = node;
          });
        }

        const tierHeight = (orderedTierNodes.length * barHeight) + ((orderedTierNodes.length - 1) * clusterGap);
        const clusterTop = topPad + ((innerHeight - tierHeight) / 2);
        const maxRank = Math.max(...orderedTierNodes.map((node) => sameTierRank.get(node.id) || 0));
        const baseX = Math.min(
          leftPad + (tierIndex * tierStep),
          width - rightPad - labelWidth - barWidth - (maxRank * intraTierStep)
        );

        orderedTierNodes.forEach((node, slotIndex) => {
          const localRank = sameTierRank.get(node.id) || 0;
          const adjustedX = baseX + (localRank * intraTierStep) + (nodeXAdjustments.get(node.id) || 0);
          const maxX = width - rightPad - labelWidth - barWidth + (nodeRightSlack.get(node.id) || 0);
          const x = Math.min(adjustedX, maxX);
          const y = clusterTop + (slotIndex * (barHeight + clusterGap));
          nodePositions.set(node.id, {
            ...node,
            x,
            y,
            row: slotIndex,
            width: barWidth,
            height: barHeight,
            labelLines: [`N${node.id}`, ...wrapText(node.name, 22).split("\n")]
          });
        });
      });

      linkCatalog.forEach((link) => {
        link.source = nodePositions.get(link.fromId);
        link.target = nodePositions.get(link.toId);
        link.thickness = link.isSameStage ? 27 : 36;
      });

      nodeCatalog.forEach((node) => {
        const outgoing = [...(outgoingByNode.get(node.id) || [])].sort((a, b) => {
          const aTarget = nodePositions.get(a.toId);
          const bTarget = nodePositions.get(b.toId);
          const aTargetCenter = aTarget ? aTarget.y + (aTarget.height / 2) : 0;
          const bTargetCenter = bTarget ? bTarget.y + (bTarget.height / 2) : 0;
          if (aTargetCenter !== bTargetCenter) return aTargetCenter - bTargetCenter;
          const aTargetX = aTarget ? aTarget.x : 0;
          const bTargetX = bTarget ? bTarget.x : 0;
          if (aTargetX !== bTargetX) return aTargetX - bTargetX;
          return a.toId - b.toId;
        });
        const incoming = [...(incomingByNode.get(node.id) || [])].sort((a, b) => {
          const aSource = nodePositions.get(a.fromId);
          const bSource = nodePositions.get(b.fromId);
          const aSourceCenter = aSource ? aSource.y + (aSource.height / 2) : 0;
          const bSourceCenter = bSource ? bSource.y + (bSource.height / 2) : 0;
          if (aSourceCenter !== bSourceCenter) return aSourceCenter - bSourceCenter;
          const aSourceX = aSource ? aSource.x : 0;
          const bSourceX = bSource ? bSource.x : 0;
          if (aSourceX !== bSourceX) return aSourceX - bSourceX;
          return a.fromId - b.fromId;
        });
        const nodePos = nodePositions.get(node.id);
        const innerPad = 24;
        const sourceSpan = Math.max(0, nodePos.height - innerPad * 2);
        const targetSpan = sourceSpan;
        const outgoingStep = outgoing.length > 0 ? sourceSpan / (outgoing.length + 1) : 0;
        const incomingStep = incoming.length > 0 ? targetSpan / (incoming.length + 1) : 0;
        outgoing.forEach((flow, idx) => {
          flow.sourceY = nodePos.y + innerPad + (outgoingStep * (idx + 1));
        });
        incoming.forEach((flow, idx) => {
          flow.targetY = nodePos.y + innerPad + (incomingStep * (idx + 1));
        });
      });

      chartEl.innerHTML = "";
      chartEl.classList.add("industry-chain-host");

      const svg = createSvgElement("svg", {
        class: "industry-chain-svg",
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: "xMidYMid meet"
      });

      const barLayer = createSvgElement("g", {});
      const linkLayer = createSvgElement("g", { class: "industry-chain-links" });
      const labelLayer = createSvgElement("g", {});
      const nodeStateMap = new Map();

      const sortedLinks = [...linkCatalog].sort((a, b) => {
        if (a.isSameStage !== b.isSameStage) return a.isSameStage ? 1 : -1;
        if ((a.toDepth - a.fromDepth) !== (b.toDepth - b.fromDepth)) return (b.toDepth - b.fromDepth) - (a.toDepth - a.fromDepth);
        return a.idx - b.idx;
      });

      sortedLinks.forEach((link) => {
        const path = createSvgElement("path", {
          class: "industry-chain-link",
          d: buildRibbonPath(link, barWidth),
          fill: link.isSameStage ? sameStageLinkColor : linkColor,
          opacity: link.isSameStage ? 0.22 : 0.38
        });
        const title = createSvgElement("title", {});
        title.textContent = `N${link.fromId} ${link.fromName} -> N${link.toId} ${link.toName}: ${link.whatFlows || "-"}`;
        path.appendChild(title);
        link.pathEl = path;
        linkLayer.appendChild(path);
      });

      nodeCatalog.forEach((node) => {
        const position = nodePositions.get(node.id);
        const barGroup = createSvgElement("g", { class: "industry-chain-node" });
        const labelGroup = createSvgElement("g", { class: "industry-chain-node" });
        const bar = createSvgElement("rect", {
          class: "node-bar",
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height,
          fill: nodeFill,
          stroke: nodeStroke,
          "stroke-width": 1.2
        });
        const text = createSvgElement("text", {
          class: "node-label",
          x: position.x + position.width + 12,
          y: position.y + position.height / 2,
          "text-anchor": "start"
        });
        const lineHeight = 15;
        const labelTop = position.y + position.height / 2 - ((position.labelLines.length - 1) * lineHeight) / 2;
        position.labelLines.forEach((line, idx) => {
          const tspan = createSvgElement("tspan", {
            x: position.x + position.width + 12,
            y: labelTop + idx * lineHeight
          });
          tspan.textContent = line;
          text.appendChild(tspan);
        });

        const hit = createSvgElement("rect", {
          class: "node-hit",
          x: position.x - 6,
          y: position.y - 6,
          width: position.width + labelWidth + 18,
          height: position.height + 12,
          fill: "transparent"
        });

        const title = createSvgElement("title", {});
        title.textContent = `N${node.id} - ${node.name} (${node.tier || "-"})`;
        bar.appendChild(title);

        barGroup.appendChild(bar);
        labelGroup.appendChild(text);
        labelGroup.appendChild(hit);
        barLayer.appendChild(barGroup);
        labelLayer.appendChild(labelGroup);

        nodeStateMap.set(node.id, { barGroup, labelGroup });

        const handleEnter = () => {
          const { upstreamNodes, downstreamNodes, upstreamLinks, downstreamLinks } = collectDirectionalSets(node.id);
          nodeStateMap.forEach((entry, nodeId) => {
            entry.barGroup.classList.remove("is-center", "is-upstream", "is-downstream", "is-dim");
            entry.labelGroup.classList.remove("is-center", "is-upstream", "is-downstream", "is-dim");
            let nextClass = "is-dim";
            if (nodeId === node.id) nextClass = "is-center";
            else if (upstreamNodes.has(nodeId)) nextClass = "is-upstream";
            else if (downstreamNodes.has(nodeId)) nextClass = "is-downstream";
            entry.barGroup.classList.add(nextClass);
            entry.labelGroup.classList.add(nextClass);
          });

          linkCatalog.forEach((flow) => {
            flow.pathEl.classList.remove("is-upstream", "is-downstream", "is-dim");
            if (upstreamLinks.has(flow.idx)) flow.pathEl.classList.add("is-upstream");
            else if (downstreamLinks.has(flow.idx)) flow.pathEl.classList.add("is-downstream");
            else flow.pathEl.classList.add("is-dim");
          });
        };

        const handleLeave = () => {
          nodeStateMap.forEach((entry) => {
            entry.barGroup.classList.remove("is-center", "is-upstream", "is-downstream", "is-dim");
            entry.labelGroup.classList.remove("is-center", "is-upstream", "is-downstream", "is-dim");
          });
          linkCatalog.forEach((flow) => {
            flow.pathEl.classList.remove("is-upstream", "is-downstream", "is-dim");
          });
        };

        hit.addEventListener("mouseenter", handleEnter);
        hit.addEventListener("mouseleave", handleLeave);
        hit.addEventListener("click", () => {
          state.selectedNodeId = node.id;
          state.lastResolvedNodeId = node.id;
          renderNodeDetail(node.id, detailEl);
        });
      });

      svg.appendChild(barLayer);
      svg.appendChild(linkLayer);
      svg.appendChild(labelLayer);
      chartEl.appendChild(svg);
    }

    const runRender = () => {
      if (state.resizeFrame) cancelAnimationFrame(state.resizeFrame);
      state.resizeFrame = requestAnimationFrame(() => {
        state.resizeFrame = 0;
        renderSvgChart();
      });
    };

    state.resizeObserver = new ResizeObserver(runRender);
    state.resizeObserver.observe(chartEl);

    opts.chartMap[opts.chartId] = {
      resize: runRender,
      dispose: () => {
        if (state.resizeObserver) {
          state.resizeObserver.disconnect();
          state.resizeObserver = null;
        }
        if (state.resizeFrame) {
          cancelAnimationFrame(state.resizeFrame);
          state.resizeFrame = 0;
        }
        chartEl.innerHTML = "";
      }
    };

    runRender();
    const defaultNodeId = state.selectedNodeId && state.nodesById.has(state.selectedNodeId) ? state.selectedNodeId : nodes[0].id;
    state.selectedNodeId = defaultNodeId;
    state.lastResolvedNodeId = defaultNodeId;
    renderNodeDetail(defaultNodeId, detailEl);
    if (agentHost) {
      agentHost.innerHTML = renderAgentWidgetMarkup();
      bindIndustryAgentWidget(agentHost, opts);
    }
    initialized = true;
  };

  moduleRef.resetIndustryView = function resetIndustryView() {
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
      state.resizeObserver = null;
    }
    if (state.resizeFrame) {
      cancelAnimationFrame(state.resizeFrame);
      state.resizeFrame = 0;
    }
    state.selectedNodeId = null;
    initialized = false;
  };

  moduleRef.selectIndustryNode = function selectIndustryNode(nodeId) {
    const numericId = toNumber(nodeId);
    if (numericId === null || !state.nodesById.has(numericId)) return;
    state.selectedNodeId = numericId;
    state.lastResolvedNodeId = numericId;
    const detailEl = document.getElementById("industryNodeDetail");
    if (detailEl) renderNodeDetail(numericId, detailEl);
  };
})();
