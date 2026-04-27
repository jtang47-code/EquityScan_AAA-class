(function () {
  window.IndustryModules = window.IndustryModules || {};
  const moduleRef = window.IndustryModules.TMT || { key: "TMT", label: "TMT" };
  window.IndustryModules.TMT = moduleRef;

  const STYLE_ID = "tmt-company-directory-style";
  const WATCHLIST_KEY = "equityscan.watchlist.tmt";
  function getApiBaseUrl() {
    const appBase = String(window.APP_CONFIG?.getApiBaseUrl?.() || window.APP_CONFIG?.apiBaseUrl || "").trim();
    if (appBase) return appBase.replace(/\/+$/, "");
    return window.location.protocol === "file:" ? "http://localhost:8000" : "";
  }
  const PAD = 8;
  const DEFAULT_RIGHT = 28;
  const DEFAULT_BOTTOM = 24;
  const state = {
    selectedId: null,
    lastQuery: "",
    dropdownOpen: false,
    chatOpen: false,
    chatBusy: false,
    chatMessages: [],
    lastResolvedCompanyId: "",
    lastResolvedQuery: "",
    pendingDashboardTicker: "",
    chatDrag: { pointerId: null, startX: 0, startY: 0, originLeft: 0, originTop: 0, didMove: false, skipLauncherClick: false }
  };

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function normalize(value) { return String(value ?? "").trim().toUpperCase(); }
  function getEntries() { return Array.isArray(window.TMTCompanyDirectoryData) ? window.TMTCompanyDirectoryData.slice() : []; }
  function enrichEntry(entry) {
    if (!entry) return null;
    return { ...entry, searchBlob: [entry.company, entry.parent, entry.ticker, entry.usTickerRaw, entry.subsegment, entry.summary].join(" ").toUpperCase() };
  }
  function getEntryById(entryId) { return enrichEntry(getEntries().find((entry) => entry.id === entryId)); }
  function getSelectedCompany() { return getEntryById(state.selectedId); }
  function getLastResolvedCompany() { return getEntryById(state.lastResolvedCompanyId); }
  function findCompanyByTicker(ticker) {
    const found = getEntries().find((entry) => normalize(entry.ticker) === normalize(ticker));
    return enrichEntry(found);
  }
  function searchEntries(query) {
    const normalized = normalize(query);
    const all = getEntries().map(enrichEntry);
    if (!normalized) return all.slice(0, 24);
    const exactTicker = [], startsWithTicker = [], exactCompany = [], companyStarts = [], general = [];
    all.forEach((entry) => {
      if (!entry.searchBlob.includes(normalized)) return;
      if (normalize(entry.ticker) === normalized) exactTicker.push(entry);
      else if (normalize(entry.ticker).startsWith(normalized)) startsWithTicker.push(entry);
      else if (normalize(entry.company) === normalized) exactCompany.push(entry);
      else if (normalize(entry.company).startsWith(normalized)) companyStarts.push(entry);
      else general.push(entry);
    });
    return [...exactTicker, ...startsWithTicker, ...exactCompany, ...companyStarts, ...general].slice(0, 40);
  }
  function findCompanyCandidates(query, limit = 8) { return searchEntries(query).slice(0, limit); }
  function findBestCompanyMatch(query) { return findCompanyCandidates(query, 1)[0] || null; }
  function extractTickerToken(value) {
    const match = String(value || "").toUpperCase().match(/\b[A-Z][A-Z.\-]{0,5}\b/);
    return match ? match[0] : "";
  }
  function loadWatchlistIds() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
    } catch (_) { return []; }
  }
  function saveWatchlistIds(ids) { window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(ids)); }
  function getWatchlistEntries() { return loadWatchlistIds().map(getEntryById).filter(Boolean); }
  function addToWatchlist(entryId) {
    const ids = loadWatchlistIds();
    if (!ids.includes(entryId)) {
      ids.push(entryId);
      saveWatchlistIds(ids);
    }
  }
  function removeFromWatchlist(entryId) { saveWatchlistIds(loadWatchlistIds().filter((id) => id !== entryId)); }
  function getIndustryContext(industryKey) {
    const mod = window.IndustryModules?.[industryKey] || {};
    const chain = window.TMTIndustryChainData || {};
    const chainNodes = Array.isArray(chain.nodes) ? chain.nodes : [];
    const chainFlows = Array.isArray(chain.flows) ? chain.flows : [];
    const chainSummary = chainNodes.length
      ? `Industry chain nodes include: ${chainNodes.slice(0, 10).map((node) => `N${node["Node ID"]} ${node["Node Name"]}`).join("; ")}. Total nodes: ${chainNodes.length}. Total flows: ${chainFlows.length}.`
      : "";
    return {
      key: String(industryKey || moduleRef.key || "TMT"),
      label: String(mod.label || moduleRef.label || industryKey || "Industry"),
      sidebarTitle: String(mod.sidebar?.title || ""),
      glossaryContext: String(mod.glossary?.llmContext || ""),
      companyContext: `${String(mod.label || moduleRef.label || industryKey || "Industry")} company directory with parent groups, subsegments, summaries, US ticker availability, and watchlist context.`,
      chainContext: chainSummary
    };
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      .company-shell{padding:28px 28px 34px;position:relative}
      .company-grid{display:grid;grid-template-columns:minmax(320px,430px) minmax(0,1fr);gap:18px;align-items:start}
      .company-panel{border:1px solid var(--panel-border);background:rgba(255,255,255,.015)}
      .company-panel-head{padding:14px 16px;border-bottom:1px solid var(--panel-border);background:rgba(255,255,255,.02)}
      .company-kicker{color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
      .company-title{color:#f8fafc;font-size:24px;font-weight:800;margin-top:8px;line-height:1.1}
      .company-body{padding:16px}
      .company-search-box{position:relative;margin-bottom:10px}
      .company-search-box i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#64748b;font-size:12px}
      .company-search-input{width:100%;background:#0f131b;border:1px solid var(--panel-border);color:#f8fafc;padding:13px 14px 13px 38px;font-size:13px;outline:none;border-radius:2px}
      .company-search-input:focus{border-color:rgba(91,140,255,.55);box-shadow:0 0 0 1px rgba(91,140,255,.25)}
      .company-search-dropdown{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:20;border:1px solid var(--panel-border);background:#121720;box-shadow:0 12px 32px rgba(0,0,0,.28);max-height:320px;overflow-y:auto}
      .company-search-dropdown-list,.company-watchlist-list{display:flex;flex-direction:column;gap:8px;padding:8px}
      .company-item{width:100%;border:1px solid var(--panel-border);background:rgba(255,255,255,.015);padding:12px 14px;cursor:pointer;text-align:left;font:inherit}
      .company-item:hover{border-color:rgba(91,140,255,.38);background:rgba(255,255,255,.03)}
      .company-item.active{border-color:rgba(91,140,255,.58);background:rgba(91,140,255,.08)}
      .company-item-top{display:flex;justify-content:space-between;gap:12px;align-items:start}
      .company-item-title{color:#f8fafc;font-size:14px;font-weight:700;line-height:1.3}
      .company-item-meta{color:#94a3b8;font-size:11px;line-height:1.5;margin-top:6px}
      .company-pill{border:1px solid rgba(91,140,255,.25);background:rgba(91,140,255,.08);color:#b7c9ff;padding:5px 7px;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
      .company-pill.muted{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#94a3b8}
      .company-section-title{color:#cbd5e1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;margin-bottom:10px}
      .company-watchlist-head{display:flex;justify-content:space-between;align-items:center;margin:0 0 10px}
      .company-empty{border:1px dashed var(--panel-border);color:#64748b;padding:28px 16px;text-align:center;font-size:12px;line-height:1.7}
      .company-detail-card{border:1px solid var(--panel-border);background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015));padding:18px}
      .company-detail-top{display:flex;justify-content:space-between;gap:16px;align-items:start;margin-bottom:12px}
      .company-detail-title{color:#fff;font-size:28px;font-weight:800;line-height:1}
      .company-detail-subtitle{color:#9fb0d4;font-size:13px;font-weight:600;margin-top:8px}
      .company-detail-summary{color:#cbd5e1;font-size:13px;line-height:1.75;margin-top:12px}
      .company-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}
      .company-detail-metric{border:1px solid rgba(255,255,255,.06);background:rgba(15,19,27,.66);padding:12px}
      .company-detail-label{color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;margin-bottom:7px}
      .company-detail-value{color:#f8fafc;font-size:13px;line-height:1.55}
      .company-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
      .company-btn{border:1px solid var(--panel-border);background:rgba(255,255,255,.02);color:#cbd5e1;padding:11px 13px;font-size:11px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;border-radius:2px;cursor:pointer}
      .company-btn.primary{border-color:rgba(91,140,255,.3);color:#dbe6ff;background:rgba(91,140,255,.08)}
      .company-btn.danger{color:#f8b4b4;border-color:rgba(239,68,68,.22);background:rgba(239,68,68,.06)}
      .company-chat-launcher{position:fixed;right:28px;bottom:24px;width:58px;height:58px;border-radius:999px;border:1px solid rgba(56,189,248,.38);background:radial-gradient(circle at 30% 30%,rgba(56,189,248,.2),rgba(15,19,27,.98));color:#eefcff;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 18px 42px rgba(0,0,0,.42),0 0 0 1px rgba(56,189,248,.12);z-index:39;transition:opacity .22s ease,transform .22s ease;cursor:grab}
      .company-chat-launcher.hidden{opacity:0;pointer-events:none;transform:translateY(10px) scale(.9)}
      .company-chatbox{position:fixed;right:28px;bottom:24px;width:min(440px,calc(100vw - 24px));max-height:min(76vh,700px);border:1px solid rgba(56,189,248,.22);background:rgba(12,16,24,.98);box-shadow:0 26px 80px rgba(0,0,0,.52),0 0 0 1px rgba(56,189,248,.08);display:flex;flex-direction:column;overflow:hidden;z-index:40;transform-origin:bottom right;transition:opacity .22s ease,transform .22s ease}
      .company-chatbox.collapsed{opacity:0;pointer-events:none;transform:translateY(16px) scale(.96);box-shadow:0 12px 28px rgba(0,0,0,.24)}
      .company-chat-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06);background:linear-gradient(180deg,rgba(56,189,248,.08),rgba(255,255,255,.01));cursor:grab;user-select:none}
      .company-chat-header.dragging{cursor:grabbing}
      .company-chat-title{color:#f8fafc;font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
      .company-chat-subtitle{color:#8ba5b3;font-size:11px;margin-top:4px;line-height:1.5}
      .company-chat-toggle{width:34px;height:34px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#cbd5e1;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;cursor:pointer}
      .company-chat-messages{padding:14px 14px 8px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;min-height:180px;max-height:min(52vh,520px)}
      .company-chat-message{display:flex}
      .company-chat-message.user{justify-content:flex-end}
      .company-chat-bubble{max-width:100%;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:#e5ecf5;padding:12px 14px;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
      .company-chat-message.user .company-chat-bubble{background:rgba(56,189,248,.12);border-color:rgba(56,189,248,.3)}
      .company-chat-working{display:inline-flex;align-items:center;gap:10px;color:#dbeafe}
      .company-chat-working-spinner{width:13px;height:13px;border-radius:999px;border:2px solid rgba(255,255,255,.2);border-top-color:rgba(56,189,248,.95);animation:company-spin .9s linear infinite}
      .company-chat-working-dots{display:inline-flex;gap:4px}
      .company-chat-working-dots span{width:4px;height:4px;border-radius:999px;background:rgba(56,189,248,.85);animation:company-dot-pulse 1.15s ease-in-out infinite}
      .company-chat-working-dots span:nth-child(2){animation-delay:.15s}
      .company-chat-working-dots span:nth-child(3){animation-delay:.3s}
      .company-chat-company-card{margin-top:12px;border:1px solid rgba(56,189,248,.18);background:rgba(56,189,248,.06);padding:12px}
      .company-chat-company-top{display:flex;justify-content:space-between;gap:10px;align-items:start}
      .company-chat-company-name{color:#f8fafc;font-size:17px;font-weight:800;line-height:1.25}
      .company-chat-company-meta{color:#b4c8d2;font-size:11px;line-height:1.6;margin-top:6px}
      .company-chat-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .company-chat-action-btn{border:1px solid rgba(56,189,248,.24);background:rgba(56,189,248,.1);color:#e0f2fe;padding:9px 12px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
      .company-chat-input-row{padding:12px 14px 14px;border-top:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.01)}
      .company-chat-input-wrap{display:flex;gap:10px;align-items:end}
      .company-chat-input{flex:1 1 auto;min-height:42px;max-height:132px;resize:none;border:1px solid rgba(255,255,255,.08);background:rgba(15,19,27,.92);color:#f8fafc;padding:11px 12px;font-size:13px;line-height:1.5;outline:none;font-family:inherit}
      .company-chat-send{border:1px solid rgba(56,189,248,.24);background:rgba(56,189,248,.1);color:#e0f2fe;height:42px;padding:0 14px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;flex:0 0 auto}
      .dashboard-company-context{margin-bottom:22px}.dashboard-company-card{border:1px solid var(--panel-border);background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015));padding:16px 18px}.dashboard-company-title{color:#f8fafc;font-size:15px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.dashboard-company-copy{color:#cbd5e1;font-size:12px;line-height:1.7;margin-top:12px}.dashboard-company-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}.dashboard-company-meta{border:1px solid rgba(255,255,255,.06);background:rgba(15,19,27,.68);padding:12px}.dashboard-company-meta-label{color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;margin-bottom:6px}.dashboard-company-meta-value{color:#f8fafc;font-size:12px;line-height:1.6}
      @keyframes company-spin{to{transform:rotate(360deg)}}@keyframes company-dot-pulse{0%,80%,100%{opacity:.28;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}@media (max-width:1180px){.company-grid,.dashboard-company-grid{grid-template-columns:1fr}}@media (max-width:720px){.company-shell{padding:20px}.company-detail-grid{grid-template-columns:1fr}.company-detail-top{flex-direction:column}.company-chatbox{right:12px;bottom:12px;width:calc(100vw - 24px)}.company-chat-launcher{right:12px;bottom:12px}}
    `;
    document.head.appendChild(styleEl);
  }

  function renderResultItem(entry, isActive) {
    const pill = entry.isUsListed ? `<span class="company-pill">${escapeHtml(entry.ticker)}</span>` : `<span class="company-pill muted">Private / Non-US</span>`;
    return `<button class="company-item ${isActive ? "active" : ""}" type="button" data-company-select="${escapeHtml(entry.id)}"><div class="company-item-top"><div><div class="company-item-title">${escapeHtml(entry.company)}</div><div class="company-item-meta">${escapeHtml(entry.subsegment)}<br>${escapeHtml(entry.parent)}</div></div>${pill}</div></button>`;
  }

  function renderDetail(entry) {
    if (!entry) return `<div class="company-empty">Select any company to view details.</div>`;
    const watchlistIds = loadWatchlistIds();
    const isSaved = watchlistIds.includes(entry.id);
    const dashboardButton = entry.isUsListed ? `<button type="button" class="company-btn primary" data-open-dashboard="${escapeHtml(entry.ticker)}">Open ${escapeHtml(entry.ticker)} In Dashboard</button>` : "";
    return `<article class="company-detail-card"><div class="company-detail-top"><div><div class="company-detail-title">${escapeHtml(entry.company)}</div><div class="company-detail-subtitle">${escapeHtml(entry.parent)}</div></div>${entry.isUsListed ? `<span class="company-pill">${escapeHtml(entry.ticker)}</span>` : `<span class="company-pill muted">${escapeHtml(entry.usTickerRaw || "Not listed in the US")}</span>`}</div><div class="company-detail-summary">${escapeHtml(entry.summary || "No summary available.")}</div><div class="company-detail-grid"><div class="company-detail-metric"><div class="company-detail-label">Subsegment</div><div class="company-detail-value">${escapeHtml(entry.subsegment || "-")}</div></div><div class="company-detail-metric"><div class="company-detail-label">Parent</div><div class="company-detail-value">${escapeHtml(entry.parent || "-")}</div></div><div class="company-detail-metric"><div class="company-detail-label">US Ticker</div><div class="company-detail-value">${escapeHtml(entry.ticker || entry.usTickerRaw || "-")}</div></div><div class="company-detail-metric"><div class="company-detail-label">Listing Status</div><div class="company-detail-value">${entry.isUsListed ? "US-listed equity" : "Not listed in the US"}</div></div></div><div class="company-actions"><button type="button" class="company-btn ${isSaved ? "danger" : ""}" data-watchlist-toggle="${escapeHtml(entry.id)}">${isSaved ? "Remove From Watchlist" : "Add To Watchlist"}</button>${dashboardButton}<button type="button" class="company-btn" data-clear-selection="true">Clear Selection</button></div></article>`;
  }

  function renderWatchlist(entries) {
    if (!entries.length) return `<div class="company-empty">Your watchlist is stored locally in this browser. Add companies from the search results to keep a personal list.</div>`;
    return `<div class="company-watchlist-list">${entries.map((entry) => renderResultItem(entry, state.selectedId === entry.id)).join("")}</div>`;
  }

  function renderAgentWidgetMarkup() {
    return `<button id="companyDirectoryChatLauncher" class="company-chat-launcher ${state.chatOpen ? "hidden" : ""}" type="button" aria-label="Open Agent C"><i class="fa-solid fa-building-circle-check"></i></button><aside id="companyDirectoryChatbox" class="company-chatbox ${state.chatOpen ? "" : "collapsed"}"><div class="company-chat-header"><div><div class="company-chat-title">Agent C</div><div class="company-chat-subtitle">Company context, dashboard actions, and web research.</div></div><button id="companyDirectoryChatToggle" class="company-chat-toggle" type="button" aria-label="Minimize Agent C"><i class="fa-solid fa-minus"></i></button></div><div id="companyDirectoryChatMessages" class="company-chat-messages"></div><div class="company-chat-input-row"><div class="company-chat-input-wrap"><textarea id="companyDirectoryChatInput" class="company-chat-input" rows="1" placeholder='Ask "what does Rubin mean for Nvidia?" or "open NVDA in dashboard"'></textarea><button id="companyDirectoryChatSend" class="company-chat-send" type="button">Send</button></div></div></aside>`;
  }

  function formatCompanyCardHtml(entry) {
    const badge = entry.isUsListed ? `<span class="company-pill">${escapeHtml(entry.ticker)}</span>` : `<span class="company-pill muted">Private / Non-US</span>`;
    const openButton = entry.isUsListed ? `<button class="company-chat-action-btn" type="button" data-chat-open-dashboard="${escapeHtml(entry.ticker)}">Open ${escapeHtml(entry.ticker)} In Dashboard</button>` : "";
    const watchButton = loadWatchlistIds().includes(entry.id) ? "" : `<button class="company-chat-action-btn" type="button" data-chat-watch-company="${escapeHtml(entry.id)}">Add To Watchlist</button>`;
    return `<div class="company-chat-company-card"><div class="company-chat-company-top"><div><div class="company-chat-company-name">${escapeHtml(entry.company)}</div><div class="company-chat-company-meta">${escapeHtml(entry.subsegment)}<br>${escapeHtml(entry.parent)}</div></div>${badge}</div><div class="company-item-meta" style="margin-top:10px;">${escapeHtml(entry.summary || "No summary available.")}</div><div class="company-chat-actions"><button class="company-chat-action-btn" type="button" data-chat-focus-company="${escapeHtml(entry.id)}">Show In Detail</button>${openButton}${watchButton}</div></div>`;
  }

  function pushChatMessage(role, html) {
    const plain = String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    state.chatMessages.push({ role, html, text: plain });
  }

  function pushWorkingMessage() {
    state.chatMessages.push({ role: "assistant", html: '<div class="company-chat-working"><span class="company-chat-working-spinner"></span><span>Agent C is digging through the chain</span><span class="company-chat-working-dots"><span></span><span></span><span></span></span></div>', text: "Agent C is digging through the chain", working: true });
  }

  function removeWorkingMessage() {
    const index = state.chatMessages.findIndex((message) => message.working);
    if (index >= 0) state.chatMessages.splice(index, 1);
  }

  function renderChatMessages(host) {
    host.innerHTML = state.chatMessages.map((message) => `<div class="company-chat-message ${message.role === "user" ? "user" : "assistant"}"><div class="company-chat-bubble">${message.html}</div></div>`).join("");
    host.scrollTop = host.scrollHeight;
    requestAnimationFrame(() => { if (typeof window.__tmtCompanyClampChatPosition === "function") window.__tmtCompanyClampChatPosition(); });
  }

  async function fetchCompanyWebResearch(query, industryKey, selectedCompany) {
    const ctx = getIndustryContext(industryKey);
    const response = await fetch(`${getApiBaseUrl()}/api/websearch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: String(query || "").trim(),
        context: [ctx.label, ctx.sidebarTitle, ctx.glossaryContext, ctx.companyContext, ctx.chainContext, selectedCompany ? `${selectedCompany.company} ${selectedCompany.parent} ${selectedCompany.subsegment}` : ""].filter(Boolean).join(" "),
        numResults: 5
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.detail || `HTTP ${response.status}`));
    return Array.isArray(data?.results) ? data.results : [];
  }

  function resolveDashboardTicker(query, selectedCompany, lastResolvedCompany) {
    const directTicker = extractTickerToken(query);
    if (directTicker) {
      const byTicker = findCompanyByTicker(directTicker);
      if (byTicker?.isUsListed) return { ticker: byTicker.ticker, entry: byTicker };
      return { ticker: directTicker, entry: byTicker || null };
    }
    const best = query ? findBestCompanyMatch(query) : null;
    if (best?.isUsListed) return { ticker: best.ticker, entry: best };
    if (selectedCompany?.isUsListed) return { ticker: selectedCompany.ticker, entry: selectedCompany };
    if (lastResolvedCompany?.isUsListed) return { ticker: lastResolvedCompany.ticker, entry: lastResolvedCompany };
    return { ticker: "", entry: best || selectedCompany || lastResolvedCompany || null };
  }

  function findChainMatches(query) {
    const normalized = normalize(query);
    if (!normalized) return [];
    const source = window.TMTIndustryChainData || {};
    const nodes = Array.isArray(source.nodes) ? source.nodes : [];
    const flows = Array.isArray(source.flows) ? source.flows : [];
    const nodeMatches = nodes
      .filter((node) => {
        const blob = [
          node["Node Name"],
          node["Tier"],
          node["What this node provides"],
          node["Key products / activities"],
          node["Representative competitors / players"],
          node["Notes"]
        ].join(" ").toUpperCase();
        return blob.includes(normalized);
      })
      .slice(0, 4)
      .map((node) => `Node N${node["Node ID"]} ${node["Node Name"]} (${node["Tier"]}): ${node["What this node provides"] || node["Notes"] || ""}`);
    const flowMatches = flows
      .filter((flow) => {
        const blob = [
          flow["From Node Name"],
          flow["To Node Name"],
          flow["What flows downstream"],
          flow["Why the link exists"]
        ].join(" ").toUpperCase();
        return blob.includes(normalized);
      })
      .slice(0, 3)
      .map((flow) => `Flow ${flow["From Node Name"]} -> ${flow["To Node Name"]}: ${flow["What flows downstream"] || ""}. ${flow["Why the link exists"] || ""}`);
    return [...nodeMatches, ...flowMatches];
  }

  async function fetchAgentCResponse(userMessage, industryKey) {
    const history = state.chatMessages.map((message) => ({ role: message.role, content: String(message.text || "").trim() })).filter((item) => item.content);
    const selectedCompany = getSelectedCompany();
    const lastResolvedCompany = getLastResolvedCompany();
    const ctx = getIndustryContext(industryKey);
    if (!window.LLMShell?.planCompanyAgentTurn || !window.LLMShell?.answerCompanyAgentTurn) {
      return { ok: false, error: "Agent C shell is not loaded." };
    }
    const planner = await window.LLMShell.planCompanyAgentTurn({
      agentName: "Agent C",
      userMessage,
      industryKey,
      industryLabel: ctx.label,
      industryContext: [ctx.glossaryContext, ctx.companyContext, ctx.chainContext].filter(Boolean).join(" "),
      conversationHistory: history,
      selectedCompany,
      lastResolvedCompany,
      currentDashboard: window.__equityscanDashboardSnapshot || null,
      watchlistEntries: getWatchlistEntries()
    });
    if (!planner.ok) return planner;
    if (planner.mode === "reply" && !planner.lookupQuery) return { ok: true, mode: "reply", assistantResponse: planner.assistantResponse };

    const lookupQuery = String(planner.lookupQuery || selectedCompany?.company || lastResolvedCompany?.company || "").trim();
    const candidates = lookupQuery ? findCompanyCandidates(lookupQuery, 8) : [];
    const selectedCandidate = candidates.find((entry) => entry.id === state.selectedId) || candidates[0] || selectedCompany || lastResolvedCompany || null;
    if (planner.mode === "open_dashboard") {
      const resolved = resolveDashboardTicker(lookupQuery, selectedCandidate, lastResolvedCompany);
      return {
        ok: true,
        mode: "open_dashboard",
        assistantResponse: planner.assistantResponse || (resolved.ticker ? `Opening ${resolved.ticker} in the dashboard.` : "I couldn't find a US-listed ticker to open in the dashboard yet."),
        openDashboardTicker: resolved.ticker,
        selectedCompanyId: resolved.entry?.id || "",
        selectedCompany: resolved.entry || null
      };
    }

    const webResults = planner.useWebResearch
      ? await fetchCompanyWebResearch(planner.searchQuery || [lookupQuery, userMessage].filter(Boolean).join(" "), industryKey, selectedCandidate).catch(() => [])
      : [];
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
      candidateCompanies: candidates,
      chainMatches: findChainMatches([lookupQuery, userMessage].filter(Boolean).join(" ")),
      webResults
    });
    if (!answer.ok) return answer;
    const chosenEntry = getEntryById(answer.selectedCompanyId) || candidates.find((entry) => entry.id === answer.selectedCompanyId) || selectedCandidate;
    return {
      ok: true,
      mode: "resolve_company",
      assistantResponse: answer.assistantResponse,
      selectedCompanyId: chosenEntry?.id || "",
      selectedCompany: chosenEntry || null,
      openDashboardTicker: answer.openDashboardTicker || "",
      offerOpenDashboard: Boolean(answer.offerOpenDashboard && answer.openDashboardTicker)
    };
  }

  function attachChatActionHandlers(host, opts) {
    host.querySelectorAll("[data-chat-open-dashboard]").forEach((el) => {
      el.addEventListener("click", () => {
        const ticker = el.getAttribute("data-chat-open-dashboard");
        if (ticker) opts.onOpenTicker?.(ticker, opts.industryKey || moduleRef.key || "TMT");
      });
    });
    host.querySelectorAll("[data-chat-focus-company]").forEach((el) => {
      el.addEventListener("click", () => {
        const entryId = el.getAttribute("data-chat-focus-company");
        if (!entryId) return;
        state.selectedId = entryId;
        state.lastResolvedCompanyId = entryId;
        renderDirectory(host, opts);
      });
    });
    host.querySelectorAll("[data-chat-watch-company]").forEach((el) => {
      el.addEventListener("click", () => {
        const entryId = el.getAttribute("data-chat-watch-company");
        if (!entryId) return;
        addToWatchlist(entryId);
        renderDirectory(host, opts);
      });
    });
  }

  function bindInteractions(host, opts) {
    host.querySelectorAll("[data-company-select]").forEach((el) => {
      el.addEventListener("click", () => {
        state.selectedId = el.getAttribute("data-company-select");
        state.lastResolvedCompanyId = state.selectedId;
        state.dropdownOpen = false;
        renderDirectory(host, opts);
      });
    });
    host.querySelectorAll("[data-watchlist-toggle]").forEach((el) => {
      el.addEventListener("click", () => {
        const entryId = el.getAttribute("data-watchlist-toggle");
        const ids = loadWatchlistIds();
        if (ids.includes(entryId)) removeFromWatchlist(entryId); else addToWatchlist(entryId);
        renderDirectory(host, opts);
      });
    });
    host.querySelectorAll("[data-open-dashboard]").forEach((el) => {
      el.addEventListener("click", () => {
        opts.onOpenTicker?.(el.getAttribute("data-open-dashboard"), opts.industryKey || moduleRef.key || "TMT");
      });
    });
    host.querySelectorAll("[data-clear-selection]").forEach((el) => {
      el.addEventListener("click", () => {
        state.selectedId = null;
        renderDirectory(host, opts);
      });
    });

    const inputEl = host.querySelector("#companyDirectorySearch");
    if (inputEl) {
      inputEl.addEventListener("click", () => {
        if (state.dropdownOpen) return;
        state.dropdownOpen = Boolean(searchEntries(inputEl.value).length);
        if (!state.dropdownOpen) return;
        renderDirectory(host, opts, { preserveFocus: true, selectionStart: inputEl.selectionStart ?? inputEl.value.length, selectionEnd: inputEl.selectionEnd ?? inputEl.value.length });
      });
      inputEl.addEventListener("input", () => {
        const start = inputEl.selectionStart ?? inputEl.value.length;
        const end = inputEl.selectionEnd ?? inputEl.value.length;
        state.lastQuery = inputEl.value;
        state.dropdownOpen = Boolean(inputEl.value.trim());
        renderDirectory(host, opts, { preserveFocus: true, selectionStart: start, selectionEnd: end });
      });
    }

    const chatboxEl = host.querySelector("#companyDirectoryChatbox");
    const launcherEl = host.querySelector("#companyDirectoryChatLauncher");
    const messagesEl = host.querySelector("#companyDirectoryChatMessages");
    const chatInputEl = host.querySelector("#companyDirectoryChatInput");
    const chatSendEl = host.querySelector("#companyDirectoryChatSend");
    const toggleEl = host.querySelector("#companyDirectoryChatToggle");
    const headerEl = chatboxEl?.querySelector(".company-chat-header");
    if (!chatboxEl || !launcherEl || !messagesEl || !chatInputEl || !chatSendEl || !toggleEl || !headerEl) return;

    function setChatOpen(open) {
      state.chatOpen = !!open;
      clampChatPosition();
      chatboxEl.classList.toggle("collapsed", !state.chatOpen);
      launcherEl.classList.toggle("hidden", state.chatOpen);
      toggleEl.innerHTML = state.chatOpen ? '<i class="fa-solid fa-minus"></i>' : '<i class="fa-solid fa-up-right-and-down-left-from-center"></i>';
      if (!state.chatOpen) headerEl.classList.remove("dragging");
    }
    function getChatPosition() {
      const left = Number.parseFloat(chatboxEl.style.left);
      const top = Number.parseFloat(chatboxEl.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) return { left, top };
      const width = chatboxEl.offsetWidth || 440;
      const height = chatboxEl.offsetHeight || 560;
      return { left: Math.max(PAD, window.innerWidth - width - DEFAULT_RIGHT), top: Math.max(PAD, window.innerHeight - height - DEFAULT_BOTTOM) };
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
      const width = chatboxEl.offsetWidth || 440;
      const height = chatboxEl.offsetHeight || 560;
      const position = getChatPosition();
      const maxLeft = Math.max(PAD, window.innerWidth - width - PAD);
      const maxTop = Math.max(PAD, window.innerHeight - height - PAD);
      applyChatPosition(Math.max(PAD, Math.min(maxLeft, position.left)), Math.max(PAD, Math.min(maxTop, position.top)));
    }
    window.__tmtCompanyClampChatPosition = clampChatPosition;
    function resizeChatInput() {
      chatInputEl.style.height = "auto";
      chatInputEl.style.height = `${Math.max(42, Math.min(chatInputEl.scrollHeight, 132))}px`;
      requestAnimationFrame(clampChatPosition);
    }
    function initializeChatPosition() {
      const width = chatboxEl.offsetWidth || 440;
      const height = chatboxEl.offsetHeight || 560;
      applyChatPosition(Math.max(PAD, window.innerWidth - width - DEFAULT_RIGHT), Math.max(PAD, window.innerHeight - height - DEFAULT_BOTTOM));
    }
    function handleDragMove(event) {
      if (!state.chatDrag.pointerId) return;
      if (Math.abs(event.clientX - state.chatDrag.startX) > 2 || Math.abs(event.clientY - state.chatDrag.startY) > 2) state.chatDrag.didMove = true;
      const maxLeft = Math.max(PAD, window.innerWidth - chatboxEl.offsetWidth - PAD);
      const maxTop = Math.max(PAD, window.innerHeight - chatboxEl.offsetHeight - PAD);
      applyChatPosition(Math.max(PAD, Math.min(maxLeft, state.chatDrag.originLeft + (event.clientX - state.chatDrag.startX))), Math.max(PAD, Math.min(maxTop, state.chatDrag.originTop + (event.clientY - state.chatDrag.startY))));
    }
    function endDrag() {
      if (state.chatDrag.didMove) state.chatDrag.skipLauncherClick = true;
      state.chatDrag.pointerId = null;
      state.chatDrag.source = "";
      state.chatDrag.didMove = false;
      headerEl.classList.remove("dragging");
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", endDrag);
    }
    function beginDrag(event, source = "box") {
      if (source === "box" && event.target.closest("button")) return;
      event.preventDefault();
      clampChatPosition();
      const position = getChatPosition();
      state.chatDrag.pointerId = "mouse";
      state.chatDrag.source = source;
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
      let rerenderNeeded = false;
      pushChatMessage("user", escapeHtml(rawMessage));
      renderChatMessages(messagesEl);
      chatInputEl.value = "";
      resizeChatInput();
      state.chatBusy = true;
      pushWorkingMessage();
      renderChatMessages(messagesEl);
      try {
        const response = await fetchAgentCResponse(rawMessage, opts.industryKey || moduleRef.key || "TMT");
        removeWorkingMessage();
        if (!response.ok) {
          pushChatMessage("assistant", `Agent C hit a wall.<br>${escapeHtml(response.error || "Unknown error.")}`);
        } else if (response.mode === "open_dashboard") {
          if (response.selectedCompanyId) {
            state.selectedId = response.selectedCompanyId;
            state.lastResolvedCompanyId = response.selectedCompanyId;
            rerenderNeeded = true;
          }
          if (response.openDashboardTicker) {
            state.pendingDashboardTicker = response.openDashboardTicker;
            pushChatMessage("assistant", `${escapeHtml(response.assistantResponse)}<div class="company-chat-actions"><button class="company-chat-action-btn" type="button" data-chat-open-dashboard="${escapeHtml(response.openDashboardTicker)}">Open ${escapeHtml(response.openDashboardTicker)} In Dashboard</button></div>`);
          } else {
            pushChatMessage("assistant", escapeHtml(response.assistantResponse));
          }
        } else {
          const selectedEntry = response.selectedCompany || null;
          if (selectedEntry?.id) {
            state.selectedId = selectedEntry.id;
            state.lastResolvedCompanyId = selectedEntry.id;
            state.lastResolvedQuery = selectedEntry.company;
            rerenderNeeded = true;
          }
          const selectedHtml = selectedEntry ? formatCompanyCardHtml(selectedEntry) : "";
          const dashboardHtml = response.offerOpenDashboard && response.openDashboardTicker ? `<div class="company-chat-actions"><button class="company-chat-action-btn" type="button" data-chat-open-dashboard="${escapeHtml(response.openDashboardTicker)}">Open ${escapeHtml(response.openDashboardTicker)} In Dashboard</button></div>` : "";
          pushChatMessage("assistant", `${escapeHtml(response.assistantResponse)}${selectedHtml}${dashboardHtml}`);
        }
      } catch (err) {
        removeWorkingMessage();
        pushChatMessage("assistant", `Agent C hit a wall.<br>${escapeHtml(String(err && err.message ? err.message : err))}`);
      }
      if (rerenderNeeded) {
        renderDirectory(host, opts);
        state.chatBusy = false;
        return;
      }
      renderChatMessages(messagesEl);
      attachChatActionHandlers(host, opts);
      state.chatBusy = false;
    }

    headerEl.addEventListener("mousedown", (event) => beginDrag(event, "box"));
    toggleEl.addEventListener("click", () => setChatOpen(false));
    launcherEl.addEventListener("mousedown", (event) => beginDrag(event, "launcher"));
    launcherEl.addEventListener("click", () => {
      if (state.chatDrag.skipLauncherClick) {
        state.chatDrag.skipLauncherClick = false;
        return;
      }
      setChatOpen(true);
    });
    window.addEventListener("resize", clampChatPosition);
    chatSendEl.addEventListener("click", () => void handleChatQuery());
    chatInputEl.addEventListener("input", resizeChatInput);
    chatInputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      void handleChatQuery();
    });
    initializeChatPosition();
    resizeChatInput();
    if (!state.chatMessages.length) pushChatMessage("assistant", "I’m Agent C. Ask me about any TMT company, ticker, parent, segment, current news, target prices, or tell me to open a company in the dashboard.");
    renderChatMessages(messagesEl);
    attachChatActionHandlers(host, opts);
    setChatOpen(state.chatOpen);
  }

  function renderDirectory(host, opts, renderState = {}) {
    const query = state.lastQuery || "";
    const matches = searchEntries(query);
    const selectedEntry = getEntryById(state.selectedId);
    const watchlistEntries = getWatchlistEntries();
    const showDropdown = state.dropdownOpen && Boolean(query.trim()) && matches.length > 0;
    host.innerHTML = `<section class="company-shell"><div class="company-panel mb-5"><div class="company-panel-head"><div class="company-kicker">${escapeHtml(opts.industryKey || "TMT")} Company Directory</div><div class="company-title">Search The Chain Participants</div></div><div class="company-body"><div class="company-search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="companyDirectorySearch" class="company-search-input" type="text" value="${escapeHtml(query)}" placeholder="Search company names, parents, subsegments, or tickers like NVDA / AVGO / TSM">${showDropdown ? `<div class="company-search-dropdown"><div class="company-search-dropdown-list">${matches.map((entry) => renderResultItem(entry, state.selectedId === entry.id)).join("")}</div></div>` : ""}</div></div></div><div class="company-grid"><div class="company-panel"><div class="company-panel-head"><div class="company-watchlist-head"><div class="company-section-title">Watchlist</div><div class="company-kicker">${watchlistEntries.length} saved</div></div></div><div class="company-body">${renderWatchlist(watchlistEntries)}</div></div><div class="company-panel"><div class="company-panel-head"><div class="company-section-title">Company Detail</div></div><div class="company-body">${renderDetail(selectedEntry)}</div></div></div>${renderAgentWidgetMarkup()}</section>`;
    bindInteractions(host, opts);
    if (renderState.preserveFocus) {
      const inputEl = host.querySelector("#companyDirectorySearch");
      if (inputEl) {
        inputEl.focus();
        inputEl.setSelectionRange(renderState.selectionStart ?? query.length, renderState.selectionEnd ?? query.length);
      }
    }
  }

  function renderDashboardCompanyContext(opts) {
    ensureStyles();
    const host = document.getElementById(opts.containerId);
    if (!host) return;
    const entry = findCompanyByTicker(opts.ticker);
    if (!entry) {
      host.innerHTML = "";
      host.classList.add("hidden");
      return;
    }
    host.classList.remove("hidden");
    host.innerHTML = `<div class="dashboard-company-card"><div class="company-kicker">Directory Match</div><div class="dashboard-company-title">${escapeHtml(entry.company)} In TMT Directory</div><div class="dashboard-company-copy">${escapeHtml(entry.summary || "No summary available.")}</div><div class="dashboard-company-grid"><div class="dashboard-company-meta"><div class="dashboard-company-meta-label">Subsegment</div><div class="dashboard-company-meta-value">${escapeHtml(entry.subsegment || "-")}</div></div><div class="dashboard-company-meta"><div class="dashboard-company-meta-label">Parent</div><div class="dashboard-company-meta-value">${escapeHtml(entry.parent || "-")}</div></div><div class="dashboard-company-meta"><div class="dashboard-company-meta-label">US Ticker</div><div class="dashboard-company-meta-value">${escapeHtml(entry.ticker || entry.usTickerRaw || "-")}</div></div></div></div>`;
  }

  moduleRef.findCompanyByTicker = findCompanyByTicker;
  moduleRef.getCompanyById = getEntryById;
  moduleRef.selectCompanyDirectoryEntry = function selectCompanyDirectoryEntry(entryId, query = "") {
    state.selectedId = entryId || null;
    state.lastResolvedCompanyId = entryId || state.lastResolvedCompanyId;
    state.lastQuery = query || "";
  };
  moduleRef.renderCompanyDirectoryView = function renderCompanyDirectoryView(opts) {
    ensureStyles();
    const host = document.getElementById(opts.containerId);
    if (!host) return;
    renderDirectory(host, opts);
  };
  moduleRef.renderCompanyAgentWidget = function renderCompanyAgentWidget(opts) {
    ensureStyles();
    const host = document.getElementById(opts.containerId);
    if (!host) return;
    host.innerHTML = renderAgentWidgetMarkup();
    bindInteractions(host, opts);
  };
  moduleRef.renderDashboardCompanyContext = renderDashboardCompanyContext;
})();
