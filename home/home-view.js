(function () {
  const STYLE_ID = "equity-home-module-style";
  let titleAnimationTimer = null;
  const presentationState = { page: 0, minimized: false };

  const presentationPages = [
    {
      kicker: "Platform Overview",
      title: "EquityScan: research workspace, built to scale",
      intro: "EquityScan is a reusable research workspace for multiple industries. While the current production build is focused on TMT as the first implemented vertical.",
      bullets: [
        "Built for analysts and investors who need to move from a ticker to operating context quickly",
        "Combines company market views with structured sector reference material in one interface",
      ],
      highlights: [
        {
          icon: "fa-chart-line",
          label: "Who it is for",
          text: "Equity research analysts, portfolio managers, investors, and interns working from company questions toward sector-aware conclusions."
        },
        {
          icon: "fa-table-cells-large",
          label: "What users can do",
          text: "Search a company, open a live dashboard, and move across industry chain, company directory, and glossary look-up."
        },
        {
          icon: "fa-chart-column",
          label: "Core dashboard",
          text: "Review forward EPS, forward P/E, PEG, price history, relative return, and multi-year operating trends such as margins, capex, and cash flow."
        },
        {
          icon: "fa-layer-group",
          label: "Sector context layer",
          text: "Overlay structured industry context through chain maps, representative companies by subsegment, and a maintained glossary."
        }
      ],
    },
    {
      kicker: "Agentic Workflow",
      title: "Agentic Workflow: From Master agent to subagents",
      intro: "Master TMT is the top-level coordinator for the current TMT implementation. It identifies the task type, routes work to the right specialist agents, reflects, seeks for more infomation and assembles one final answer from their outputs.",
      flowSteps: [
        { icon: "fa-keyboard", title: "User Request", text: "A company, chain, terminology question, or research task enters the workspace." },
        { icon: "fa-compass-drafting", title: "Master TMT", text: "Classifies the request and decides which specialist workstreams are needed." },
        { icon: "fa-users-gear", title: "Agent Workstreams", text: "Delegates to Agent I, Agent C, and Agent G according to the task." },
        { icon: "fa-file-lines", title: "Final Output", text: "Reflects, returns a direct answer, dashboard handoff, or a combined report." }
      ],
      agents: [
        {
          name: "Agent I",
          role: "Industry-chain support",
          description: "Explains chain position, upstream and downstream links, bottlenecks, beneficiaries, and how segment shifts can affect a company.",
          tools: ["industry chain map", "company mapping", "targeted web research"]
        },
        {
          name: "Agent C",
          role: "Company and valuation support",
          description: "Answers company questions, works with directory matches, connects to the dashboard view and industry chain, analyst-target context.",
          tools: ["company directory", "live dashboard snapshot", "targeted web research"]
        },
        {
          name: "Agent G",
          role: "Glossary and terminology support",
          description: "Handles acronyms, definitions, context refinement, and glossary save actions when terminology needs to be standardized for the workspace.",
          tools: ["TMT glossary", "industry context", "targeted web research"]
        }
      ],
    }
  ];

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
        top: 56%;
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

      .es-home-briefing {
        position: fixed;
        top: 10px;
        right: 8px;
        width: min(1488px, calc(100vw - 16px));
        height: min(936px, calc(100vh - 20px));
        z-index: 35;
        pointer-events: auto;
      }

      .es-home-briefing-window {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        border: 1px solid rgba(154, 168, 191, 0.2);
        background:
          linear-gradient(180deg, rgba(14, 18, 28, 0.97), rgba(12, 17, 26, 0.95)),
          radial-gradient(120% 120% at 100% 0%, rgba(59, 130, 246, 0.18), transparent 48%);
        box-shadow: 0 28px 70px rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(12px);
        overflow: hidden;
      }

      .es-home-briefing-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        padding: 18px 20px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
      }

      .es-home-briefing-kicker {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #9fb8d8;
      }

      .es-home-briefing-title {
        margin-top: 8px;
        font-size: 24px;
        line-height: 1.2;
        font-weight: 800;
        color: #f8fafc;
      }

      .es-home-briefing-meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        color: #90a3bc;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .es-home-briefing-controls {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }

      .es-home-briefing-icon-btn,
      .es-home-briefing-nav-btn,
      .es-home-briefing-restore {
        border: 1px solid rgba(255, 255, 255, 0.09);
        background: rgba(255, 255, 255, 0.04);
        color: #dce5f3;
        cursor: pointer;
        font: inherit;
        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
      }

      .es-home-briefing-icon-btn:hover,
      .es-home-briefing-nav-btn:hover,
      .es-home-briefing-restore:hover {
        background: rgba(74, 111, 170, 0.16);
        border-color: rgba(125, 155, 209, 0.35);
        color: #f8fbff;
      }

      .es-home-briefing-icon-btn {
        width: 40px;
        height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .es-home-briefing-body {
        flex: 1 1 auto;
        min-height: 0;
        padding: 18px 20px 16px;
        overflow: hidden;
      }

      .es-home-briefing-slide {
        display: grid;
        gap: 16px;
        height: 100%;
      }

      .es-home-briefing-slide-overview {
        grid-template-rows: auto auto 1fr auto;
      }

      .es-home-briefing-slide-workflow {
        grid-template-rows: auto auto 1fr auto 1fr;
      }

      .es-home-briefing-slide-workflow.no-summary {
        grid-template-rows: auto auto 1fr;
      }

      .es-home-workflow-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
      }

      .es-home-workflow-panel.fill {
        height: 100%;
      }

      .es-home-briefing-intro {
        margin: 0;
        color: #d5deeb;
        font-size: 24px;
        line-height: 1.7;
      }

      .es-home-briefing-bullets {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 20px;
        padding: 0;
      }

      .es-home-briefing-bullet {
        display: grid;
        grid-template-columns: 16px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        color: #d7e1ee;
        font-size: 15px;
        line-height: 1.62;
      }

      .es-home-briefing-bullet i {
        color: #7ea8ff;
        font-size: 13px;
        margin-top: 4px;
      }

      .es-home-briefing-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-rows: minmax(0, 1fr);
        gap: 12px;
        align-items: stretch;
      }

      .es-home-briefing-point {
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.025);
        padding: 18px;
        min-height: 0;
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .es-home-briefing-point-icon {
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(126, 168, 255, 0.22);
        background: rgba(91, 140, 255, 0.08);
        color: #cfe0ff;
        font-size: 16px;
        margin-bottom: 18px;
      }

      .es-home-briefing-point-label {
        color: #f8fafc;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-top: 2px;
      }

      .es-home-briefing-point-text {
        margin-top: 10px;
        color: #c1cfde;
        font-size: 16px;
        line-height: 1.58;
      }

      .es-home-briefing-footer {
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        color: #90a3bc;
        font-size: 14px;
        line-height: 1.58;
      }

      .es-home-agent-list {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .es-home-agent-card {
        border: 1px solid rgba(91, 140, 255, 0.16);
        background: rgba(91, 140, 255, 0.06);
        padding: 16px;
        min-height: 100%;
      }

      .es-home-agent-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .es-home-agent-name {
        color: #f8fafc;
        font-size: 17px;
        font-weight: 800;
      }

      .es-home-agent-role {
        margin-top: 4px;
        color: #a8b9cf;
        font-size: 13px;
        line-height: 1.46;
      }

      .es-home-agent-desc {
        margin-top: 8px;
        color: #d1dbe8;
        font-size: 14px;
        line-height: 1.56;
      }

      .es-home-agent-tools {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .es-home-agent-tool {
        padding: 6px 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(12, 18, 29, 0.52);
        color: #dce6f3;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .es-home-agent-badge {
        padding: 7px 9px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #9fb8d8;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .es-home-flowchart {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        align-items: stretch;
        flex: 1 1 auto;
      }

      .es-home-flow-step {
        position: relative;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.02));
        padding: 18px;
        min-height: 188px;
        height: 100%;
        width: 80%;
        justify-self: center;
      }

      .es-home-flow-step:not(:last-child)::after {
        content: "→";
        position: absolute;
        top: 56%;
        left: calc(100% + 15%);
        width: 56px;
        transform: translate(-50%, -50%);
        text-align: center;
        line-height: 1;
        color: #8eb1f0;
        font-size: 46px;
        font-weight: 900;
        -webkit-text-stroke: 1px currentColor;
        text-shadow: 0 0 1px currentColor, 0 0 1px currentColor;
      }

      .es-home-flow-step-icon {
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(91, 140, 255, 0.08);
        color: #dce7fb;
        font-size: 16px;
      }

      .es-home-flow-step:not(:last-child)::after {
        content: "\\2192";
      }

      .es-home-flow-step-title {
        margin-top: 8px;
        color: #f8fafc;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .es-home-flow-step-text {
        margin-top: 6px;
        color: #c7d4e4;
        font-size: 15px;
        line-height: 1.56;
      }

      .es-home-briefing-workflow {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 20px;
        padding: 0;
        color: #d7e1ee;
        font-size: 15px;
        line-height: 1.6;
      }

      .es-home-briefing-workflow-bullet {
        display: grid;
        grid-template-columns: 16px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
      }

      .es-home-briefing-workflow-bullet i {
        color: #7ea8ff;
        font-size: 13px;
        margin-top: 4px;
      }

      .es-home-briefing-section-title {
        color: #9fb8d8;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .es-home-briefing-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 20px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.07);
      }

      .es-home-briefing-page {
        color: #93a7c0;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .es-home-briefing-nav {
        display: inline-flex;
        gap: 8px;
      }

      .es-home-briefing-nav-btn {
        height: 40px;
        padding: 0 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .es-home-briefing-nav-btn[disabled] {
        opacity: 0.35;
        cursor: default;
        transform: none;
      }

      .es-home-briefing-restore {
        position: fixed;
        top: 68px;
        right: 18px;
        z-index: 35;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.15em;
        text-transform: uppercase;
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

        .es-home-briefing {
          width: min(1224px, calc(100vw - 20px));
          top: 10px;
          right: 12px;
          height: min(840px, calc(100vh - 20px));
        }

        .es-home-briefing-window {
          height: 100%;
        }

        .es-home-briefing-grid,
        .es-home-agent-list,
        .es-home-flowchart {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .es-home-briefing-bullets,
        .es-home-briefing-workflow {
          grid-template-columns: 1fr;
        }

        .es-home-flow-step:not(:last-child)::after {
          left: calc(100% + 15%);
        }

        .es-home-briefing-restore {
          top: 10px;
          right: 12px;
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

        .es-home-briefing {
          top: auto;
          right: 10px;
          bottom: 10px;
          width: calc(100vw - 20px);
          height: min(90vh, 912px);
        }

        .es-home-briefing-window {
          height: 100%;
        }

        .es-home-briefing-grid,
        .es-home-agent-list,
        .es-home-flowchart {
          grid-template-columns: 1fr;
        }

        .es-home-briefing-bullets,
        .es-home-briefing-workflow {
          grid-template-columns: 1fr;
        }

        .es-home-flow-step:not(:last-child)::after {
          content: "↓";
          top: auto;
          right: auto;
          left: 50%;
          bottom: -16px;
          transform: translateX(-50%);
        }

        .es-home-flow-step:last-child::after {
          content: "";
        }

        .es-home-flow-step::after,
        .es-home-flow-step:nth-child(2)::after {
          content: "\\2193";
        }

        .es-home-flow-step {
          width: 100%;
        }

        .es-home-briefing-foot {
          flex-direction: column;
          align-items: stretch;
        }

        .es-home-briefing-nav {
          width: 100%;
        }

        .es-home-briefing-nav-btn {
          flex: 1 1 0;
        }

        .es-home-briefing-restore {
          top: auto;
          right: 10px;
          bottom: 10px;
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

  function renderOverviewPage(page) {
    const bulletHtml = (page.bullets || [])
      .map(
        (bullet) => `
          <div class="es-home-briefing-bullet">
            <i class="fa-solid fa-circle"></i>
            <span>${escapeHtmlText(bullet)}</span>
          </div>
        `
      )
      .join("");

    const pointsHtml = (page.highlights || [])
      .map(
        (point) => `
          <div class="es-home-briefing-point">
            <div class="es-home-briefing-point-icon">
              <i class="fa-solid ${escapeHtmlText(point.icon || "fa-circle")}"></i>
            </div>
            <div class="es-home-briefing-point-label">${escapeHtmlText(point.label)}</div>
            <div class="es-home-briefing-point-text">${escapeHtmlText(point.text)}</div>
          </div>
        `
      )
      .join("");

    const footerHtml = page.footer ? `<div class="es-home-briefing-footer">${escapeHtmlText(page.footer)}</div>` : "";

    return `
      <div class="es-home-briefing-slide es-home-briefing-slide-overview">
        <p class="es-home-briefing-intro">${escapeHtmlText(page.intro)}</p>
        <div class="es-home-briefing-bullets">${bulletHtml}</div>
        <div class="es-home-briefing-grid">${pointsHtml}</div>
        ${footerHtml}
      </div>
    `;
  }

  function renderWorkflowPage(page) {
    const flowHtml = (page.flowSteps || [])
      .map(
        (step) => `
          <div class="es-home-flow-step">
            <div class="es-home-flow-step-icon">
              <i class="fa-solid ${escapeHtmlText(step.icon || "fa-circle")}"></i>
            </div>
            <div class="es-home-flow-step-title">${escapeHtmlText(step.title)}</div>
            <div class="es-home-flow-step-text">${escapeHtmlText(step.text)}</div>
          </div>
        `
      )
      .join("");

    const agentsHtml = (page.agents || [])
      .map(
        (agent) => `
          <article class="es-home-agent-card">
            <div class="es-home-agent-top">
              <div>
                <div class="es-home-agent-name">${escapeHtmlText(agent.name)}</div>
                <div class="es-home-agent-role">${escapeHtmlText(agent.role)}</div>
              </div>
              <div class="es-home-agent-badge">Specialist</div>
            </div>
            <div class="es-home-agent-desc">${escapeHtmlText(agent.description)}</div>
            <div class="es-home-agent-tools">
              ${agent.tools.map((tool) => `<span class="es-home-agent-tool">${escapeHtmlText(tool)}</span>`).join("")}
            </div>
          </article>
        `
      )
      .join("");

    const structureBullets = Array.isArray(page.structureBullets) ? page.structureBullets : [];
    const structureHtml = structureBullets
      .map(
        (bullet) => `
          <div class="es-home-briefing-workflow-bullet">
            <i class="fa-solid fa-circle"></i>
            <span>${escapeHtmlText(bullet)}</span>
          </div>
        `
      )
      .join("");

    return `
      <div class="es-home-briefing-slide es-home-briefing-slide-workflow${structureBullets.length ? "" : " no-summary"}">
        <p class="es-home-briefing-intro">${escapeHtmlText(page.intro)}</p>
        <div class="es-home-workflow-panel">
          <div class="es-home-briefing-section-title">Agent Blocks</div>
          <div class="es-home-agent-list">${agentsHtml}</div>
        </div>
        <div class="es-home-workflow-panel fill">
          <div class="es-home-briefing-section-title">Task Flow</div>
          <div class="es-home-flowchart">${flowHtml}</div>
        </div>
        ${structureBullets.length ? `<div class="es-home-briefing-workflow">${structureHtml}</div>` : ""}
      </div>
    `;
  }

  function renderPresentationDeck() {
    if (presentationState.minimized) {
      return `
        <button type="button" class="es-home-briefing-restore" data-presentation-action="restore">
          <i class="fa-solid fa-window-restore"></i>
          <span>Open Briefing</span>
        </button>
      `;
    }

    const page = presentationPages[presentationState.page] || presentationPages[0];
    const bodyHtml = presentationState.page === 0 ? renderOverviewPage(page) : renderWorkflowPage(page);

    return `
      <aside class="es-home-briefing" aria-label="Presentation briefing">
        <section class="es-home-briefing-window">
          <div class="es-home-briefing-head">
            <div>
              <div class="es-home-briefing-kicker">${escapeHtmlText(page.kicker)}</div>
              <div class="es-home-briefing-title">${escapeHtmlText(page.title)}</div>
              <div class="es-home-briefing-meta">
                <span>Research Brief</span>
                <span>${escapeHtmlText(`${presentationState.page + 1} / ${presentationPages.length}`)}</span>
              </div>
            </div>
            <div class="es-home-briefing-controls">
              <button type="button" class="es-home-briefing-icon-btn" data-presentation-action="minimize" aria-label="Minimize briefing">
                <i class="fa-solid fa-minus"></i>
              </button>
            </div>
          </div>
          <div class="es-home-briefing-body">${bodyHtml}</div>
          <div class="es-home-briefing-foot">
            <div class="es-home-briefing-page">${escapeHtmlText(`Page ${presentationState.page + 1} of ${presentationPages.length}`)}</div>
            <div class="es-home-briefing-nav">
              <button type="button" class="es-home-briefing-nav-btn" data-presentation-action="prev" ${presentationState.page === 0 ? "disabled" : ""}>
                <i class="fa-solid fa-arrow-left"></i>
                <span>Prev</span>
              </button>
              <button type="button" class="es-home-briefing-nav-btn" data-presentation-action="next" ${presentationState.page === presentationPages.length - 1 ? "disabled" : ""}>
                <span>Next</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </section>
      </aside>
    `;
  }

  function bindPresentationDeck(host) {
    host.querySelectorAll("[data-presentation-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-presentation-action");
        if (action === "minimize") {
          presentationState.minimized = true;
        } else if (action === "restore") {
          presentationState.minimized = false;
        } else if (action === "prev") {
          presentationState.page = Math.max(0, presentationState.page - 1);
        } else if (action === "next") {
          presentationState.page = Math.min(presentationPages.length - 1, presentationState.page + 1);
        }

        renderPresentationDeckOverlay({ containerId: window.HomePageModule?.deckContainerId || "presentationDeckHost" });
      });
    });
  }

  function renderPresentationDeckOverlay(opts = {}) {
    ensureStyles();
    const containerId = opts?.containerId || window.HomePageModule?.deckContainerId || "presentationDeckHost";
    const host = document.getElementById(containerId);
    if (!host) return;
    host.innerHTML = renderPresentationDeck();
    bindPresentationDeck(host);
  }

  function renderHomeView(opts) {
    ensureStyles();
    const host = document.getElementById(opts?.containerId || "homeViewContent");
    if (!host) return;
    window.HomePageModule = window.HomePageModule || {};
    window.HomePageModule.lastRenderOptions = opts || {};

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

    renderPresentationDeckOverlay({ containerId: window.HomePageModule?.deckContainerId || "presentationDeckHost" });
    runTitleTypingAnimation(host.querySelector("#homeTitleTyping"));
  }

  window.HomePageModule = { renderHomeView, renderPresentationDeckOverlay, lastRenderOptions: null, deckContainerId: "presentationDeckHost" };
})();
