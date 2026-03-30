(function () {
  window.IndustryModules = window.IndustryModules || {};
  const moduleRef = window.IndustryModules.TMT || { key: "TMT", label: "TMT" };
  window.IndustryModules.TMT = moduleRef;

  let initialized = false;
  const state = {
    nodesById: new Map(),
    flows: [],
    subsegments: [],
    flowByNode: [],
    resizeObserver: null,
    resizeFrame: 0,
    selectedNodeId: null
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
    renderNodeDetail(defaultNodeId, detailEl);
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
})();
