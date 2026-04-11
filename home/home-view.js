(function () {
  const STYLE_ID = "equity-home-module-style";
  let titleAnimationTimer = null;

  const tiles = [
    {
      type: "industry",
      key: "TMT",
      icon: "fa-microchip",
      iconTone: "tone-blue",
      title: "TMT",
      subtitle: "Technology, Media, Telecom"
    },
    {
      type: "placeholder",
      icon: "fa-bolt",
      iconTone: "tone-green",
      title: "Energy",
      subtitle: "Renewables, Grid, Storage"
    },
    {
      type: "placeholder",
      icon: "fa-building-columns",
      iconTone: "tone-sky",
      title: "Finance",
      subtitle: "FinTech, Banking, Insurance"
    },
    {
      type: "placeholder",
      icon: "fa-industry",
      iconTone: "tone-indigo",
      title: "Industry",
      subtitle: "Automotive, Aerospace, Robotics"
    },
    {
      type: "placeholder",
      icon: "fa-microscope",
      iconTone: "tone-rose",
      title: "Healthcare",
      subtitle: "BioTech, Pharma, MedTech"
    },
    {
      type: "placeholder-featured",
      icon: "fa-chevron-right",
      iconTone: "tone-neutral",
      title: "All Sectors",
      subtitle: "24+ Global Chains"
    }
  ];

  function escapeHtmlText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      #homeView {
        padding: 0;
        background:
          linear-gradient(90deg, rgba(10, 13, 20, 0.94) 0%, rgba(9, 14, 22, 0.86) 45%, rgba(8, 16, 24, 0.88) 100%),
          radial-gradient(120% 120% at 0% 100%, rgba(27, 54, 102, 0.22), transparent 55%),
          radial-gradient(120% 120% at 100% 100%, rgba(12, 83, 69, 0.20), transparent 48%);
      }

      .es-home-shell {
        min-height: calc(100vh - 60px);
        padding: 32px 28px 44px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .es-home-main {
        width: min(100%, 920px);
        margin-top: 0;
        transform: translateY(-28px);
      }

      .es-home-headline {
        text-align: center;
        margin-bottom: 28px;
      }

      .es-home-title {
        font-size: clamp(42px, 6.6vw, 78px);
        line-height: 0.96;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        min-height: 1em;
      }

      .es-home-title-equity {
        font-weight: 800;
        color: #ffffff;
      }

      .es-home-title-scan {
        font-weight: 500;
        color: #8b95a8;
      }

      .es-home-title-typing {
        position: relative;
        display: inline-block;
      }

      .es-home-title-ghost,
      .es-home-title-live {
        display: inline-flex;
        align-items: baseline;
      }

      .es-home-title-ghost {
        visibility: hidden;
        pointer-events: none;
      }

      .es-home-title-live {
        position: absolute;
        inset: 0 auto auto 0;
      }

      .es-home-title-static-e {
        display: inline-block;
        font-weight: 800;
        color: #ffffff;
        flex: 0 0 auto;
      }

      .es-home-title-caret {
        display: inline-block;
        width: 2px;
        height: 0.92em;
        margin-left: 6px;
        background: rgba(228, 232, 240, 0.92);
        animation: es-home-caret-blink 0.9s steps(1) infinite;
        vertical-align: middle;
        opacity: 1;
      }

      .es-home-title-caret.hidden {
        opacity: 0;
      }

      @keyframes es-home-caret-blink {
        0%, 48% { opacity: 1; }
        49%, 100% { opacity: 0; }
      }

      .es-home-search-row {
        display: flex;
        justify-content: center;
        margin: 22px auto 28px;
      }

      .es-home-search-box {
        position: relative;
        width: min(100%, 520px);
      }

      .es-home-search-box i {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: #64748b;
        font-size: 12px;
      }

      .es-home-search-input {
        width: 100%;
        background: rgba(20, 24, 34, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        padding: 13px 16px 13px 40px;
        font-size: 13px;
        outline: none;
        border-radius: 2px;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .es-home-search-input:focus {
        border-color: rgba(91, 140, 255, 0.55);
        box-shadow: 0 0 0 1px rgba(91, 140, 255, 0.22);
      }

      .es-home-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .es-home-card {
        min-height: 120px;
        background: rgba(22, 25, 34, 0.86);
        border: 1px solid rgba(255, 255, 255, 0.06);
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        text-align: left;
      }

      .es-home-card.clickable {
        cursor: pointer;
        transition: border-color 0.22s ease, background-color 0.22s ease, transform 0.22s ease;
      }

      .es-home-card.clickable:hover {
        transform: translateY(-2px);
        border-color: rgba(95, 133, 215, 0.65);
        background: rgba(27, 34, 52, 0.92);
      }

      .es-home-card.placeholder {
        opacity: 0.84;
      }

      .es-home-card.featured {
        background: rgba(64, 69, 78, 0.78);
        border-color: rgba(255, 255, 255, 0.12);
      }

      .es-home-icon {
        font-size: 18px;
      }

      .tone-blue { color: #9cb6ff; }
      .tone-green { color: #4ade80; }
      .tone-sky { color: #b6d7f2; }
      .tone-indigo { color: #a7bdfb; }
      .tone-rose { color: #f2b5b5; }
      .tone-neutral { color: #e5e7eb; }

      .es-home-card-title {
        margin-top: 10px;
        font-size: clamp(16px, 1.1vw, 21px);
        line-height: 1.15;
        color: #f8fafc;
        font-weight: 700;
      }

      .es-home-card-subtitle {
        margin-top: 6px;
        color: #c2cad8;
        font-size: clamp(10px, 0.75vw, 12px);
        line-height: 1.35;
      }

      .es-home-card.placeholder .es-home-card-title {
        font-size: clamp(14px, 0.95vw, 18px);
      }

      .es-home-card.placeholder .es-home-card-subtitle {
        font-size: clamp(9px, 0.7vw, 11px);
        color: #aeb8ca;
      }

      .es-home-card-feature-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      @media (max-width: 1100px) {
        .es-home-shell {
          padding: 26px 18px 32px;
        }

        .es-home-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .es-home-main {
          margin-top: 0;
          transform: translateY(-18px);
        }

        .es-home-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  function renderTile(tile, canOpen, idx) {
    const isInteractive = tile.type === "industry" && canOpen;
    const className = [
      "es-home-card",
      isInteractive ? "clickable" : "placeholder",
      tile.type === "placeholder-featured" ? "featured" : ""
    ]
      .filter(Boolean)
      .join(" ");

    const dataAttr = isInteractive ? ` data-industry="${escapeHtmlText(tile.key)}"` : "";
    const tabAttr = isInteractive ? ` tabindex="0" role="button"` : "";
    const idAttr = ` data-idx="${idx}"`;

    const bodyHtml =
      tile.type === "placeholder-featured"
        ? `
          <div class="es-home-card-feature-row">
            <div>
              <div class="es-home-card-title">${escapeHtmlText(tile.title)}</div>
              <div class="es-home-card-subtitle">${escapeHtmlText(tile.subtitle)}</div>
            </div>
            <i class="fa-solid ${escapeHtmlText(tile.icon)} es-home-icon ${escapeHtmlText(tile.iconTone)}"></i>
          </div>
        `
        : `
          <div>
            <i class="fa-solid ${escapeHtmlText(tile.icon)} es-home-icon ${escapeHtmlText(tile.iconTone)}"></i>
            <div class="es-home-card-title">${escapeHtmlText(tile.title)}</div>
            <div class="es-home-card-subtitle">${escapeHtmlText(tile.subtitle)}</div>
          </div>
        `;

    return `<div class="${className}"${dataAttr}${tabAttr}${idAttr}>${bodyHtml}</div>`;
  }

  function runTitleTypingAnimation(host) {
    if (!host) return;
    if (titleAnimationTimer) {
      window.clearTimeout(titleAnimationTimer);
      titleAnimationTimer = null;
    }

    const fixedEquity = "E";
    const quity = "QUITY";
    const scan = "SCAN";
    let quityCount = 0;
    let scanCount = 0;
    let phase = "type-initial";

    const renderFrame = () => {
      const showCaret = phase !== "loop-pause-full";

      host.innerHTML = `
        <span class="es-home-title-typing">
          <span class="es-home-title-ghost">
            <span class="es-home-title-static-e">${fixedEquity}</span><span class="es-home-title-equity">${quity}</span><span class="es-home-title-scan">${scan}</span>
          </span>
          <span class="es-home-title-live">
            <span class="es-home-title-static-e">${fixedEquity}</span><span class="es-home-title-equity">${escapeHtmlText(quity.slice(0, quityCount))}</span><span class="es-home-title-scan">${escapeHtmlText(scan.slice(0, scanCount))}</span><span class="es-home-title-caret${showCaret ? '' : ' hidden'}"></span>
          </span>
        </span>
      `;

      if (phase === "type-initial") {
        if (quityCount < quity.length) {
          quityCount += 1;
          titleAnimationTimer = window.setTimeout(renderFrame, quityCount === 1 ? 170 : 82);
          return;
        }

        if (scanCount < scan.length) {
          scanCount += 1;
          titleAnimationTimer = window.setTimeout(renderFrame, scanCount === 1 ? 120 : 82);
          return;
        }

        phase = "loop-pause-full";
        titleAnimationTimer = window.setTimeout(renderFrame, 1050);
        return;
      }

      if (phase === "loop-pause-full") {
        phase = "erase-scan";
        titleAnimationTimer = window.setTimeout(renderFrame, 80);
        return;
      }

      if (phase === "erase-scan") {
        if (scanCount > 0) {
          scanCount -= 1;
          titleAnimationTimer = window.setTimeout(renderFrame, 72);
          return;
        }

        phase = "loop-pause-empty";
        titleAnimationTimer = window.setTimeout(renderFrame, 240);
        return;
      }

      if (phase === "loop-pause-empty") {
        phase = "type-scan";
        titleAnimationTimer = window.setTimeout(renderFrame, 110);
        return;
      }

      if (phase === "type-scan") {
        if (scanCount < scan.length) {
          scanCount += 1;
          titleAnimationTimer = window.setTimeout(renderFrame, 82);
          return;
        }

        phase = "loop-pause-full";
        titleAnimationTimer = window.setTimeout(renderFrame, 980);
      }
    };

    renderFrame();
  }

  function renderHomeView(opts) {
    ensureStyles();
    const host = document.getElementById(opts?.containerId || "homeViewContent");
    if (!host) return;

    const entries = Array.isArray(opts?.industryEntries) ? opts.industryEntries : [];
    const hasTMT = entries.some((entry) => entry && String(entry.key).toUpperCase() === "TMT");
    const tileHtml = tiles.map((tile, idx) => renderTile(tile, hasTMT, idx)).join("");

    host.innerHTML = `
      <div class="es-home-shell">
        <div class="es-home-main">
          <div class="es-home-headline">
            <div class="es-home-title" id="homeTitleTyping"></div>
          </div>
          <div class="es-home-search-row">
            <div class="es-home-search-box">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input id="homeTickerSearch" class="es-home-search-input" type="text" placeholder="Search ticker or company...">
            </div>
          </div>
          <div class="es-home-grid">${tileHtml}</div>
        </div>
      </div>
    `;

    host.querySelectorAll("[data-industry]").forEach((tileEl) => {
      const industryKey = tileEl.getAttribute("data-industry");
      tileEl.addEventListener("click", () => {
        if (typeof opts?.onSelectIndustry === "function") opts.onSelectIndustry(industryKey);
      });
      tileEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (typeof opts?.onSelectIndustry === "function") opts.onSelectIndustry(industryKey);
        }
      });
    });

    const searchInput = host.querySelector("#homeTickerSearch");
    if (searchInput) {
      searchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const value = String(searchInput.value || "").trim();
        if (!value) return;
        if (typeof opts?.onSearchTicker === "function") {
          opts.onSearchTicker(value);
        }
      });
    }

    runTitleTypingAnimation(host.querySelector("#homeTitleTyping"));
  }

  window.HomePageModule = { renderHomeView };
})();
