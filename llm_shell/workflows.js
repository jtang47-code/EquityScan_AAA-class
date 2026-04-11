(function () {
  const shell = window.LLMShell = window.LLMShell || {};

  function validateParsedPayload(parsed, requiredFields) {
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "LLM response was not valid JSON." };
    }

    for (const field of requiredFields) {
      if (!String(parsed[field] ?? "").trim()) {
        return { ok: false, error: `LLM returned an incomplete payload. Missing ${field}.` };
      }
    }

    return { ok: true };
  }

  function buildJsonWorkflow(options) {
    const requiredFields = Array.isArray(options?.requiredFields) ? options.requiredFields : [];
    const parse = typeof options?.parse === "function"
      ? options.parse
      : shell.extractJsonObjectFromText;
    const validate = typeof options?.validate === "function"
      ? options.validate
      : (parsed) => validateParsedPayload(parsed, requiredFields);
    const maxAttempts = Math.max(1, Number(options?.maxAttempts || 1));

    return {
      async run(payload, overrideConfig = {}) {
        if (!shell.requestText) {
          return { ok: false, error: "LLMShell client is not loaded." };
        }

        const systemPrompt = typeof options?.systemBuilder === "function"
          ? options.systemBuilder(payload)
          : "";
        const userPrompt = typeof options?.userBuilder === "function"
          ? options.userBuilder(payload)
          : "";
        let lastError = "LLM request failed.";
        let firstReply = "";

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const isRetry = attempt > 0;
          const retryReason = lastError;
          const attemptSystemPrompt = isRetry && typeof options?.retrySystemBuilder === "function"
            ? options.retrySystemBuilder(payload, { previousError: retryReason, previousReply: firstReply })
            : systemPrompt;
          const attemptUserPrompt = isRetry && typeof options?.retryUserBuilder === "function"
            ? options.retryUserBuilder(payload, { previousError: retryReason, previousReply: firstReply })
            : userPrompt;

          const result = await shell.requestText(attemptSystemPrompt, attemptUserPrompt, overrideConfig);
          if (!result.ok) {
            lastError = result.error || "LLM request failed.";
            continue;
          }

          if (!firstReply) firstReply = result.reply || "";
          const parsed = parse(result.reply);
          const validation = validate(parsed, payload);
          if (validation.ok) {
            return { ok: true, data: parsed };
          }

          lastError = validation.error;
        }

        return { ok: false, error: lastError };
      }
    };
  }

  function buildGlossaryWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        if (!Array.isArray(parsed.entries) || !parsed.entries.length) {
          return { ok: false, error: "LLM did not return any glossary candidates." };
        }
        const validEntries = parsed.entries.filter((entry) => {
          return entry
            && String(entry.acronym ?? "").trim()
            && String(entry.meaning ?? "").trim()
            && String(entry.practicalExplanation ?? "").trim();
        });
        if (!validEntries.length) {
          return { ok: false, error: "LLM returned glossary candidates, but none were complete." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const industryContext = String(payload?.industryContext || "").trim();
        const sidebarTitle = String(payload?.sidebarTitle || "").trim();
        const webContext = String(payload?.webContext || "").trim();

        return [
          "You generate glossary entries for a professional industry dashboard.",
          `The active industry context is ${industryLabel}.`,
          `Industry key: ${industryKey}.`,
          sidebarTitle ? `Industry title: ${sidebarTitle}.` : "",
          industryContext ? `Interpret acronyms within this context: ${industryContext}` : "",
          webContext ? `Use this web research context to ground the explanation: ${webContext}` : "",
          "Return exactly one JSON object with a key named entries.",
          "entries must be an array with up to 3 candidate meanings ranked from most relevant to least relevant for the active industry context.",
          "Each array item must be an object with keys: acronym, meaning, practicalExplanation.",
          "Keep the format aligned with a glossary database.",
          "Prefer facts supported by the supplied web research context when it is available.",
          "If the acronym is ambiguous, include the top possible meanings in descending relevance instead of collapsing them into one answer.",
          "Do not include markdown, commentary, or code fences."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const acronym = String(payload?.acronym || "").trim().toUpperCase();
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const webResults = Array.isArray(payload?.webResults) ? payload.webResults : [];
        return [
          `Industry key: ${industryKey}`,
          `Industry label: ${industryLabel}`,
          `Acronym to explain: ${acronym}`,
          webResults.length
            ? `Web search results:\n${webResults.map((item, idx) => `${idx + 1}. ${String(item.title || "").trim()} | ${String(item.snippet || "").trim()} | ${String(item.url || "").trim()}`).join("\n")}`
            : "",
          "Return up to 3 ranked candidate meanings in JSON.",
          "Return JSON only."
        ].join("\n");
      },
      retryUserBuilder(payload, context) {
        const acronym = String(payload?.acronym || "").trim().toUpperCase();
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const webResults = Array.isArray(payload?.webResults) ? payload.webResults : [];
        return [
          `Industry key: ${industryKey}`,
          `Industry label: ${industryLabel}`,
          `Acronym to explain: ${acronym}`,
          webResults.length
            ? `Web search results:\n${webResults.map((item, idx) => `${idx + 1}. ${String(item.title || "").trim()} | ${String(item.snippet || "").trim()} | ${String(item.url || "").trim()}`).join("\n")}`
            : "",
          `Your previous answer could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          "Explain the acronym again and include the top 3 possible meanings if relevant.",
          'Return exactly one valid JSON object with key "entries", where entries is an array of up to 3 objects with keys "acronym", "meaning", and "practicalExplanation".',
          "Do not include markdown, code fences, commentary, or any extra text."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const glossaryWorkflow = buildGlossaryWorkflow();

  function buildGlossaryAgentPlannerWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        const mode = String(parsed.mode || "").trim();
        if (!["reply", "resolve_term", "save_pending"].includes(mode)) {
          return { ok: false, error: "LLM did not return a valid planner mode." };
        }
        if (mode === "reply" && !String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM planner did not return a conversational response." };
        }
        if (mode === "resolve_term" && !String(parsed.lookupTerm ?? "").trim()) {
          return { ok: false, error: "LLM planner did not identify a lookup term." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const agentName = String(payload?.agentName || "Agent G").trim();
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const industryContext = String(payload?.industryContext || "").trim();
        const sidebarTitle = String(payload?.sidebarTitle || "").trim();
        return [
          `You are ${agentName}, a natural glossary assistant inside a professional industry dashboard.`,
          `The active industry context is ${industryLabel}.`,
          `Industry key: ${industryKey}.`,
          sidebarTitle ? `Industry title: ${sidebarTitle}.` : "",
          industryContext ? `Interpret terms within this context: ${industryContext}` : "",
          "Use the conversation history and the app state to decide the next step.",
          "Return exactly one JSON object with keys: mode, assistantResponse, lookupTerm, useWebResearch, searchQuery.",
          'mode must be one of "reply", "resolve_term", or "save_pending".',
          'Use "save_pending" only when the user is clearly asking to save the currently pending candidate entry.',
          'Use "resolve_term" when the user is asking about a term or refining the context of the same term.',
          'Use "reply" for meta conversation, acknowledgements, or when no lookup is needed.',
          "assistantResponse should be natural chat text only for reply mode; otherwise it can be empty.",
          "lookupTerm should contain the specific term being resolved when mode is resolve_term.",
          "useWebResearch should be true only when web research would materially help resolve the term.",
          "searchQuery should be a concise targeted query for the term and latest context when useWebResearch is true.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const pending = payload?.pendingCandidateEntry && typeof payload.pendingCandidateEntry === "object"
          ? payload.pendingCandidateEntry
          : null;
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          payload?.lastResolvedTerm ? `Last resolved term from app state: ${String(payload.lastResolvedTerm).trim()}` : "",
          pending
            ? `Pending candidate entry available to save:\n${String(pending.acronym || "").trim()} | ${String(pending.meaning || "").trim()} | ${String(pending.practicalExplanation || "").trim()}`
            : "Pending candidate entry available to save: none",
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          "Decide the next step and return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          payload?.lastResolvedTerm ? `Last resolved term from app state: ${String(payload.lastResolvedTerm).trim()}` : "",
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          'Return exactly one valid JSON object with keys mode, assistantResponse, lookupTerm, useWebResearch, searchQuery.',
          'mode must be one of "reply", "resolve_term", or "save_pending".',
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const glossaryAgentPlannerWorkflow = buildGlossaryAgentPlannerWorkflow();

  function buildGlossaryAgentAnswerWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        if (!String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM did not return an assistant response." };
        }
        const candidate = parsed.candidateEntry;
        if (candidate != null) {
          if (
            !String(candidate.acronym ?? "").trim()
            || !String(candidate.meaning ?? "").trim()
            || !String(candidate.practicalExplanation ?? "").trim()
          ) {
            parsed.candidateEntry = null;
            parsed.offerSave = false;
          }
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const agentName = String(payload?.agentName || "Agent G").trim();
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const industryContext = String(payload?.industryContext || "").trim();
        const sidebarTitle = String(payload?.sidebarTitle || "").trim();
        const lookupTerm = String(payload?.lookupTerm || "").trim();
        return [
          `You are ${agentName}, a natural glossary assistant inside a professional industry dashboard.`,
          `The active industry context is ${industryLabel}.`,
          `Industry key: ${industryKey}.`,
          sidebarTitle ? `Industry title: ${sidebarTitle}.` : "",
          industryContext ? `Interpret terms within this context: ${industryContext}` : "",
          lookupTerm ? `The current term being resolved is: ${lookupTerm}.` : "",
          "Use the provided saved glossary matches and web research as background context, but answer naturally like a helpful chat assistant.",
          "If the saved glossary already contains a strong exact match, acknowledge it naturally instead of acting like a rigid retrieval system.",
          "If the evidence supports one likely new glossary definition worth saving, include candidateEntry and set offerSave to true.",
          "Otherwise set candidateEntry to null and offerSave to false.",
          "Return exactly one JSON object with keys assistantResponse, candidateEntry, offerSave, and suggestedLookupTerm.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const exact = Array.isArray(payload?.datasetExactMatches) ? payload.datasetExactMatches : [];
        const partial = Array.isArray(payload?.datasetPartialMatches) ? payload.datasetPartialMatches : [];
        const webResults = Array.isArray(payload?.webResults) ? payload.webResults : [];
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          payload?.lastResolvedTerm ? `Last resolved term from app state: ${String(payload.lastResolvedTerm).trim()}` : "",
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          exact.length
            ? `Exact saved glossary matches:\n${exact.map((item, idx) => `${idx + 1}. ${item.acronym} | ${item.meaning} | ${item.practicalExplanation}`).join("\n")}`
            : "",
          partial.length
            ? `Related saved glossary entries:\n${partial.slice(0, 8).map((item, idx) => `${idx + 1}. ${item.acronym} | ${item.meaning} | ${item.practicalExplanation}`).join("\n")}`
            : "",
          webResults.length
            ? `Web search results:\n${webResults.map((item, idx) => `${idx + 1}. ${String(item.title || "").trim()} | ${String(item.snippet || "").trim()} | ${String(item.url || "").trim()}`).join("\n")}`
            : "",
          "Return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          `Lookup term: ${String(payload?.lookupTerm || "").trim()}`,
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          "Try again and answer naturally.",
          "Return exactly one valid JSON object with keys assistantResponse, candidateEntry, offerSave, and suggestedLookupTerm.",
          "candidateEntry must be null or a complete object with acronym, meaning, practicalExplanation.",
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const glossaryAgentAnswerWorkflow = buildGlossaryAgentAnswerWorkflow();

  function buildGlossaryAgentWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        if (!String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM did not return an assistant response." };
        }
        const candidate = parsed.candidateEntry;
        if (candidate != null) {
          if (
            !String(candidate.acronym ?? "").trim()
            || !String(candidate.meaning ?? "").trim()
            || !String(candidate.practicalExplanation ?? "").trim()
          ) {
            parsed.candidateEntry = null;
            parsed.offerSave = false;
          }
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const agentName = String(payload?.agentName || "Agent G").trim();
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const industryContext = String(payload?.industryContext || "").trim();
        const sidebarTitle = String(payload?.sidebarTitle || "").trim();
        return [
          `You are ${agentName}, a natural glossary research assistant inside a professional industry dashboard.`,
          `The active industry context is ${industryLabel}.`,
          `Industry key: ${industryKey}.`,
          sidebarTitle ? `Industry title: ${sidebarTitle}.` : "",
          industryContext ? `Interpret acronyms within this context: ${industryContext}` : "",
          "Use the conversation history to keep track of what the user is talking about.",
          "If the app provides a current lookup term, treat it as strong context for the ongoing conversation.",
          "If saved glossary matches or web results are provided, use them as context, but keep the reply natural and concise.",
          "Return exactly one JSON object with keys assistantResponse, candidateEntry, offerSave, and suggestedLookupTerm.",
          "assistantResponse should be natural chat text for the user.",
          "candidateEntry should be null unless you are proposing one concrete definition that could be saved into the glossary dataset.",
          "offerSave should be true only when candidateEntry is not null and it makes sense to ask whether to save it.",
          "suggestedLookupTerm can be the current best guess for the main term being discussed, or an empty string if not needed.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const exact = Array.isArray(payload?.datasetExactMatches) ? payload.datasetExactMatches : [];
        const partial = Array.isArray(payload?.datasetPartialMatches) ? payload.datasetPartialMatches : [];
        const webResults = Array.isArray(payload?.webResults) ? payload.webResults : [];
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          payload?.lookupTerm ? `Current lookup term from app context: ${String(payload.lookupTerm).trim()}` : "",
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          exact.length
            ? `Exact dataset matches:\n${exact.map((item, idx) => `${idx + 1}. ${item.acronym} | ${item.meaning} | ${item.practicalExplanation}`).join("\n")}`
            : "",
          partial.length
            ? `Related dataset matches:\n${partial.slice(0, 5).map((item, idx) => `${idx + 1}. ${item.acronym} | ${item.meaning} | ${item.practicalExplanation}`).join("\n")}`
            : "",
          webResults.length
            ? `Web search results:\n${webResults.map((item, idx) => `${idx + 1}. ${String(item.title || "").trim()} | ${String(item.snippet || "").trim()} | ${String(item.url || "").trim()}`).join("\n")}`
            : "",
          "If there is no exact dataset match but the web results support one likely meaning, propose a single best candidateEntry and ask whether the user wants to save it.",
          "If the user is refining context, continue the conversation naturally instead of restarting the lookup flow.",
          "Return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          "Try again. Return exactly one valid JSON object with keys assistantResponse, candidateEntry, offerSave, and suggestedLookupTerm.",
          "candidateEntry must be null or a complete object with acronym, meaning, practicalExplanation.",
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const glossaryAgentWorkflow = buildGlossaryAgentWorkflow();

  function buildGlossaryDisambiguationWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        if (!String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM did not return an assistant response." };
        }
        const candidate = parsed.candidateEntry;
        if (candidate != null) {
          if (
            !String(candidate.acronym ?? "").trim()
            || !String(candidate.meaning ?? "").trim()
            || !String(candidate.practicalExplanation ?? "").trim()
          ) {
            parsed.candidateEntry = null;
            parsed.offerSave = false;
          }
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const industryLabel = String(payload?.industryLabel || payload?.industryKey || "Industry").trim();
        const industryContext = String(payload?.industryContext || "").trim();
        const lookupTerm = String(payload?.lookupTerm || "").trim();
        return [
          "You are resolving the meaning of one specific glossary term for an industry dashboard.",
          `The fixed term to resolve is: ${lookupTerm}.`,
          `The active industry context is ${industryLabel}.`,
          industryContext ? `Interpret the term within this context: ${industryContext}` : "",
          "Use the latest user clarification as the strongest signal for which meaning of the fixed term is most likely.",
          "Do not switch to a different term, acronym, or concept.",
          "Do not ask the user what term they mean unless the fixed term is empty.",
          "Return exactly one JSON object with keys assistantResponse, candidateEntry, offerSave, and suggestedLookupTerm.",
          "assistantResponse should directly explain the most likely meaning of the fixed term in the clarified context.",
          "candidateEntry should be null unless you have one concrete glossary definition worth saving.",
          "offerSave should be true only when candidateEntry is present.",
          "suggestedLookupTerm should repeat the fixed term.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const partial = Array.isArray(payload?.datasetPartialMatches) ? payload.datasetPartialMatches : [];
        const webResults = Array.isArray(payload?.webResults) ? payload.webResults : [];
        const lookupTerm = String(payload?.lookupTerm || "").trim();
        return [
          `Fixed lookup term: ${lookupTerm}`,
          `Latest user clarification: ${String(payload?.userMessage || "").trim()}`,
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          partial.length
            ? `Related saved glossary entries:\n${partial.slice(0, 8).map((item, idx) => `${idx + 1}. ${item.acronym} | ${item.meaning} | ${item.practicalExplanation}`).join("\n")}`
            : "",
          webResults.length
            ? `Web search results for the fixed term:\n${webResults.map((item, idx) => `${idx + 1}. ${String(item.title || "").trim()} | ${String(item.snippet || "").trim()} | ${String(item.url || "").trim()}`).join("\n")}`
            : "",
          "Choose the most likely meaning of the fixed lookup term given the latest clarification.",
          "If evidence is weak, say that briefly, but still give the best current interpretation of the fixed term.",
          "Return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Fixed lookup term: ${String(payload?.lookupTerm || "").trim()}`,
          `Latest user clarification: ${String(payload?.userMessage || "").trim()}`,
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          "Try again and resolve the fixed term directly.",
          "Return exactly one valid JSON object with keys assistantResponse, candidateEntry, offerSave, and suggestedLookupTerm.",
          "candidateEntry must be null or a complete object with acronym, meaning, practicalExplanation.",
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const glossaryDisambiguationWorkflow = buildGlossaryDisambiguationWorkflow();

  function buildGlossaryCandidateSynthesisWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        if (!String(parsed.acronym ?? "").trim() || !String(parsed.meaning ?? "").trim() || !String(parsed.practicalExplanation ?? "").trim()) {
          return { ok: false, error: "LLM returned an incomplete glossary candidate." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const industryLabel = String(payload?.industryLabel || payload?.industryKey || "Industry").trim();
        const industryContext = String(payload?.industryContext || "").trim();
        return [
          "You convert an already-explained glossary answer into one saveable glossary entry.",
          `The active industry context is ${industryLabel}.`,
          industryContext ? `Interpret the term within this context: ${industryContext}` : "",
          "The target term is authoritative. Do not switch to a different term or a broader topic label.",
          "Return exactly one JSON object with keys acronym, meaning, practicalExplanation.",
          "Keep the meaning concise and the practicalExplanation aligned to the explanation that was already given.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        return [
          `Target term: ${String(payload?.lookupTerm || "").trim()}`,
          `Answer to convert into a glossary entry:\n${String(payload?.assistantResponse || "").trim()}`,
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          "Return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Target term: ${String(payload?.lookupTerm || "").trim()}`,
          `Answer to convert into a glossary entry:\n${String(payload?.assistantResponse || "").trim()}`,
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          "Try again and return one valid JSON object with acronym, meaning, practicalExplanation.",
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const glossaryCandidateSynthesisWorkflow = buildGlossaryCandidateSynthesisWorkflow();

  function buildCompanyAgentPlannerWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        const mode = String(parsed.mode || "").trim();
        if (!["reply", "resolve_company", "open_dashboard"].includes(mode)) {
          return { ok: false, error: "LLM did not return a valid company planner mode." };
        }
        if (mode === "reply" && !String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM planner did not return a conversational response." };
        }
        if ((mode === "resolve_company" || mode === "open_dashboard") && !String(parsed.lookupQuery ?? "").trim()) {
          return { ok: false, error: "LLM planner did not identify a company or ticker query." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const agentName = String(payload?.agentName || "Agent C").trim();
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const industryContext = String(payload?.industryContext || "").trim();
        return [
          `You are ${agentName}, a natural company intelligence assistant inside a professional industry dashboard.`,
          `The active industry context is ${industryLabel}.`,
          `Industry key: ${industryKey}.`,
          industryContext ? `Interpret questions within this context: ${industryContext}` : "",
          "Use the conversation history and app state to decide the next step.",
          "Return exactly one JSON object with keys: mode, assistantResponse, lookupQuery, useWebResearch, searchQuery.",
          'mode must be one of "reply", "resolve_company", or "open_dashboard".',
          'Use "open_dashboard" only when the user is explicitly asking to navigate or open a ticker/company in the dashboard/stock view.',
          'If the user is asking for analysis, commentary, explanation, comparison, summary, news, target prices, or insights, do not choose "open_dashboard" unless they also explicitly ask to open or switch the view.',
          'Use "resolve_company" when the user is asking about a company, ticker, current news, analyst targets, strategy, segment, parent, or similar company research.',
          'Use "reply" for small talk, acknowledgements, or when no company resolution is needed.',
          "assistantResponse should contain natural chat text only for reply mode; otherwise it can be empty.",
          "lookupQuery should contain the specific company name or ticker the user is asking about.",
          "useWebResearch should be true when current/external information would materially help answer the question.",
          "searchQuery should be a concise targeted search query when useWebResearch is true.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const selectedCompany = payload?.selectedCompany && typeof payload.selectedCompany === "object"
          ? payload.selectedCompany
          : null;
        const lastResolvedCompany = payload?.lastResolvedCompany && typeof payload.lastResolvedCompany === "object"
          ? payload.lastResolvedCompany
          : null;
        const currentDashboard = payload?.currentDashboard && typeof payload.currentDashboard === "object"
          ? payload.currentDashboard
          : null;
        const watchlist = Array.isArray(payload?.watchlistEntries) ? payload.watchlistEntries : [];
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          selectedCompany
            ? `Currently selected company:\n${selectedCompany.company} | ${selectedCompany.parent} | ${selectedCompany.subsegment} | ${selectedCompany.ticker || selectedCompany.usTickerRaw || "No US ticker"} | ${selectedCompany.summary || ""}`
            : "Currently selected company: none",
          lastResolvedCompany
            ? `Last resolved company:\n${lastResolvedCompany.company} | ${lastResolvedCompany.parent} | ${lastResolvedCompany.subsegment} | ${lastResolvedCompany.ticker || lastResolvedCompany.usTickerRaw || "No US ticker"} | ${lastResolvedCompany.summary || ""}`
            : "Last resolved company: none",
          currentDashboard
            ? `Current dashboard snapshot:\nTicker: ${String(currentDashboard?.info?.symbol || "").trim()} | Name: ${String(currentDashboard?.info?.name || "").trim()} | Price: ${String(currentDashboard?.info?.price ?? "")} | Forward PE: ${String(currentDashboard?.info?.metrics_1y?.pe ?? "")} | 5Y growth: ${String(currentDashboard?.info?.metrics_5y?.growth ?? "")}`
            : "Current dashboard snapshot: none",
          watchlist.length
            ? `Watchlist snapshot:\n${watchlist.slice(0, 12).map((item) => `${item.company} | ${item.ticker || item.usTickerRaw || "No US ticker"} | ${item.subsegment}`).join("\n")}`
            : "",
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          "Decide the next step and return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          'Return exactly one valid JSON object with keys mode, assistantResponse, lookupQuery, useWebResearch, searchQuery.',
          'mode must be one of "reply", "resolve_company", or "open_dashboard".',
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const companyAgentPlannerWorkflow = buildCompanyAgentPlannerWorkflow();

  function buildCompanyAgentAnswerWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        if (!String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM did not return an assistant response." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const agentName = String(payload?.agentName || "Agent C").trim();
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const industryContext = String(payload?.industryContext || "").trim();
        const lookupQuery = String(payload?.lookupQuery || "").trim();
        return [
          `You are ${agentName}, a natural company intelligence assistant inside a professional industry dashboard.`,
          `The active industry context is ${industryLabel}.`,
          `Industry key: ${industryKey}.`,
          industryContext ? `Interpret companies and questions within this context: ${industryContext}` : "",
          lookupQuery ? `The current company/ticker query is: ${lookupQuery}.` : "",
          "Use the provided company directory matches and optional web search results as background context, but answer naturally like a helpful analyst assistant.",
          "If one directory company is clearly the best match, return its id in selectedCompanyId so the UI can focus it.",
          "If opening the dashboard would be useful or was requested, you may return openDashboardTicker with a US ticker.",
          "Return exactly one JSON object with keys assistantResponse, selectedCompanyId, openDashboardTicker, offerOpenDashboard.",
          "offerOpenDashboard should only be true when openDashboardTicker is present.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const candidates = Array.isArray(payload?.candidateCompanies) ? payload.candidateCompanies : [];
        const selectedCompany = payload?.selectedCompany && typeof payload.selectedCompany === "object"
          ? payload.selectedCompany
          : null;
        const currentDashboard = payload?.currentDashboard && typeof payload.currentDashboard === "object"
          ? payload.currentDashboard
          : null;
        const chainMatches = Array.isArray(payload?.chainMatches) ? payload.chainMatches : [];
        const webResults = Array.isArray(payload?.webResults) ? payload.webResults : [];
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          selectedCompany
            ? `Currently selected company:\n${selectedCompany.id} | ${selectedCompany.company} | ${selectedCompany.parent} | ${selectedCompany.subsegment} | ${selectedCompany.ticker || selectedCompany.usTickerRaw || "No US ticker"} | ${selectedCompany.summary || ""}`
            : "",
          currentDashboard
            ? `Current dashboard data:\n${JSON.stringify({
                symbol: currentDashboard?.info?.symbol,
                name: currentDashboard?.info?.name,
                price: currentDashboard?.info?.price,
                metrics_1y: currentDashboard?.info?.metrics_1y,
                metrics_5y: currentDashboard?.info?.metrics_5y,
                annualFinancials: Array.isArray(currentDashboard?.financials?.annual) ? currentDashboard.financials.annual.slice(0, 4) : [],
                quarterlyFinancials: Array.isArray(currentDashboard?.financials?.quarterly) ? currentDashboard.financials.quarterly.slice(0, 4) : []
              })}`
            : "",
          candidates.length
            ? `Directory candidate companies:\n${candidates.map((item, idx) => `${idx + 1}. ${item.id} | ${item.company} | ${item.parent} | ${item.subsegment} | ${item.ticker || item.usTickerRaw || "No US ticker"} | ${item.summary || ""}`).join("\n")}`
            : "Directory candidate companies: none",
          chainMatches.length
            ? `Relevant industry chain context:\n${chainMatches.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}`
            : "",
          webResults.length
            ? `Web search results:\n${webResults.map((item, idx) => `${idx + 1}. ${String(item.title || "").trim()} | ${String(item.snippet || "").trim()} | ${String(item.url || "").trim()}`).join("\n")}`
            : "",
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          "When current dashboard data is available and relevant, base your analysis primarily on that dashboard data and use directory/web results as supplements.",
          "Return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          `Lookup query: ${String(payload?.lookupQuery || "").trim()}`,
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          "Try again and return one valid JSON object with assistantResponse, selectedCompanyId, openDashboardTicker, offerOpenDashboard.",
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const companyAgentAnswerWorkflow = buildCompanyAgentAnswerWorkflow();

  function buildIndustryAgentPlannerWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        const mode = String(parsed.mode || "").trim();
        if (!["reply", "resolve_chain", "open_dashboard"].includes(mode)) {
          return { ok: false, error: "LLM did not return a valid industry planner mode." };
        }
        if (mode === "reply" && !String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM planner did not return a conversational response." };
        }
        if ((mode === "resolve_chain" || mode === "open_dashboard") && !String(parsed.lookupQuery ?? "").trim()) {
          return { ok: false, error: "LLM planner did not identify a chain/company query." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const agentName = String(payload?.agentName || "Agent I").trim();
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const industryContext = String(payload?.industryContext || "").trim();
        return [
          `You are ${agentName}, a natural industry-chain expert inside a professional dashboard.`,
          `The active industry context is ${industryLabel}.`,
          `Industry key: ${industryKey}.`,
          industryContext ? `Interpret questions within this context: ${industryContext}` : "",
          "Use the conversation history and app state to decide the next step.",
          "Return exactly one JSON object with keys: mode, assistantResponse, lookupQuery, useWebResearch, searchQuery.",
          'mode must be one of "reply", "resolve_chain", or "open_dashboard".',
          'Use "open_dashboard" only when the user is explicitly asking to open or navigate to a ticker/company dashboard view.',
          'If the user is asking for chain analysis, bottlenecks, beneficiaries, major players, node relationships, implications, current news, analyst targets, or strategic commentary, do not choose "open_dashboard" unless they also explicitly ask to open the dashboard.',
          'Use "resolve_chain" when the user is asking about nodes, flows, companies in the chain, bottlenecks, positioning, or implications across the supply chain.',
          'Use "reply" for acknowledgements, small talk, or when no lookup is needed.',
          "assistantResponse should contain natural chat text only for reply mode; otherwise it can be empty.",
          "lookupQuery should contain the specific node, company, ticker, or chain concept the user is asking about.",
          "useWebResearch should be true when current/external information would materially improve the answer.",
          "searchQuery should be a concise targeted search query when useWebResearch is true.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const selectedNode = payload?.selectedNode && typeof payload.selectedNode === "object"
          ? payload.selectedNode
          : null;
        const lastResolvedNode = payload?.lastResolvedNode && typeof payload.lastResolvedNode === "object"
          ? payload.lastResolvedNode
          : null;
        const currentDashboard = payload?.currentDashboard && typeof payload.currentDashboard === "object"
          ? payload.currentDashboard
          : null;
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          selectedNode
            ? `Currently selected node:\nN${selectedNode.id} | ${selectedNode.name} | ${selectedNode.tier || ""} | ${selectedNode.provides || ""} | ${selectedNode.players || ""}`
            : "Currently selected node: none",
          lastResolvedNode
            ? `Last resolved node:\nN${lastResolvedNode.id} | ${lastResolvedNode.name} | ${lastResolvedNode.tier || ""} | ${lastResolvedNode.provides || ""} | ${lastResolvedNode.players || ""}`
            : "Last resolved node: none",
          currentDashboard
            ? `Current dashboard snapshot:\nTicker: ${String(currentDashboard?.info?.symbol || "").trim()} | Name: ${String(currentDashboard?.info?.name || "").trim()} | Price: ${String(currentDashboard?.info?.price ?? "")} | Forward PE: ${String(currentDashboard?.info?.metrics_1y?.pe ?? "")} | 5Y growth: ${String(currentDashboard?.info?.metrics_5y?.growth ?? "")}`
            : "Current dashboard snapshot: none",
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          "Decide the next step and return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          'Return exactly one valid JSON object with keys mode, assistantResponse, lookupQuery, useWebResearch, searchQuery.',
          'mode must be one of "reply", "resolve_chain", or "open_dashboard".',
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const industryAgentPlannerWorkflow = buildIndustryAgentPlannerWorkflow();

  function buildIndustryAgentAnswerWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        if (!String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM did not return an assistant response." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const agentName = String(payload?.agentName || "Agent I").trim();
        const industryKey = String(payload?.industryKey || "Industry").trim();
        const industryLabel = String(payload?.industryLabel || industryKey).trim();
        const industryContext = String(payload?.industryContext || "").trim();
        const lookupQuery = String(payload?.lookupQuery || "").trim();
        return [
          `You are ${agentName}, a natural industry-chain expert inside a professional dashboard.`,
          `The active industry context is ${industryLabel}.`,
          `Industry key: ${industryKey}.`,
          industryContext ? `Interpret the chain and company questions within this context: ${industryContext}` : "",
          lookupQuery ? `The current chain query is: ${lookupQuery}.` : "",
          payload?.explicitNode ? `The app has already detected an explicit target node: N${payload.explicitNode.id} ${payload.explicitNode.name}. Treat that as the primary node unless the user clearly changes it.` : "",
          "Base the analysis primarily on the provided industry-chain structure, flows, node detail, major players, company-directory context, and current dashboard data when relevant.",
          "Use web search results only as supplementary real-time context.",
          "If one node is clearly the main focus, return its id in selectedNodeId so the UI can focus that node.",
          "When the user explicitly asks about a node like N5, return that exact node id in selectedNodeId unless they clearly pivot away.",
          "If one company is clearly the main company focus, return its id in selectedCompanyId so the UI can show it.",
          "If opening the dashboard would be useful or was requested, you may return openDashboardTicker with a US ticker.",
          "Return exactly one JSON object with keys assistantResponse, selectedNodeId, selectedCompanyId, openDashboardTicker, offerOpenDashboard.",
          "offerOpenDashboard should only be true when openDashboardTicker is present.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const selectedNode = payload?.selectedNode && typeof payload.selectedNode === "object"
          ? payload.selectedNode
          : null;
        const explicitNode = payload?.explicitNode && typeof payload.explicitNode === "object"
          ? payload.explicitNode
          : null;
        const currentDashboard = payload?.currentDashboard && typeof payload.currentDashboard === "object"
          ? payload.currentDashboard
          : null;
        const nodeMatches = Array.isArray(payload?.candidateNodes) ? payload.candidateNodes : [];
        const companyMatches = Array.isArray(payload?.candidateCompanies) ? payload.candidateCompanies : [];
        const chainMatches = Array.isArray(payload?.chainMatches) ? payload.chainMatches : [];
        const webResults = Array.isArray(payload?.webResults) ? payload.webResults : [];
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          selectedNode
            ? `Currently selected node:\nN${selectedNode.id} | ${selectedNode.name} | ${selectedNode.tier || ""} | ${selectedNode.provides || ""} | ${selectedNode.players || ""}`
            : "",
          explicitNode
            ? `Explicit node from app parsing:\nN${explicitNode.id} | ${explicitNode.name} | ${explicitNode.tier || ""} | ${explicitNode.provides || ""} | ${explicitNode.players || ""}`
            : "",
          currentDashboard
            ? `Current dashboard data:\n${JSON.stringify({
                symbol: currentDashboard?.info?.symbol,
                name: currentDashboard?.info?.name,
                price: currentDashboard?.info?.price,
                metrics_1y: currentDashboard?.info?.metrics_1y,
                metrics_5y: currentDashboard?.info?.metrics_5y,
                annualFinancials: Array.isArray(currentDashboard?.financials?.annual) ? currentDashboard.financials.annual.slice(0, 4) : [],
                quarterlyFinancials: Array.isArray(currentDashboard?.financials?.quarterly) ? currentDashboard.financials.quarterly.slice(0, 4) : []
              })}`
            : "",
          nodeMatches.length
            ? `Relevant chain nodes:\n${nodeMatches.map((item, idx) => `${idx + 1}. N${item.id} | ${item.name} | ${item.tier || ""} | ${item.provides || ""} | ${item.players || ""}`).join("\n")}`
            : "Relevant chain nodes: none",
          companyMatches.length
            ? `Relevant companies:\n${companyMatches.map((item, idx) => `${idx + 1}. ${item.id} | ${item.company} | ${item.parent} | ${item.subsegment} | ${item.ticker || item.usTickerRaw || "No US ticker"} | ${item.summary || ""}`).join("\n")}`
            : "Relevant companies: none",
          chainMatches.length
            ? `Chain structure context:\n${chainMatches.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}`
            : "",
          webResults.length
            ? `Web search results:\n${webResults.map((item, idx) => `${idx + 1}. ${String(item.title || "").trim()} | ${String(item.snippet || "").trim()} | ${String(item.url || "").trim()}`).join("\n")}`
            : "",
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          "When relevant, connect company positioning back to the chain node and flow structure rather than answering as generic market commentary.",
          "Return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          `Lookup query: ${String(payload?.lookupQuery || "").trim()}`,
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          "Try again and return one valid JSON object with assistantResponse, selectedNodeId, selectedCompanyId, openDashboardTicker, offerOpenDashboard.",
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const industryAgentAnswerWorkflow = buildIndustryAgentAnswerWorkflow();

  function buildMasterTMTPlannerWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        const mode = String(parsed.mode || "").trim();
        if (!["reply", "delegate"].includes(mode)) {
          return { ok: false, error: "LLM did not return a valid master planner mode." };
        }
        if (mode === "reply" && !String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM planner did not return a conversational response." };
        }
        if (mode === "delegate" && !["G", "C", "I"].includes(String(parsed.targetAgent || "").trim())) {
          return { ok: false, error: "LLM planner did not choose a valid specialist agent." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const industryLabel = String(payload?.industryLabel || "Industry").trim();
        const industryContext = String(payload?.industryContext || "").trim();
        return [
          "You are Master TMT, a top-level router for specialized assistants inside a TMT dashboard.",
          `The active industry is ${industryLabel}.`,
          industryContext ? `Industry context: ${industryContext}` : "",
          "You do not answer specialist questions yourself unless the user is making small talk or a simple acknowledgement.",
          "You decide which specialist to consult:",
          "Agent G handles glossary terms, acronym definitions, meanings, context refinement for terminology, and saving glossary definitions.",
          "Agent C handles company questions, company news, analyst targets, parent/segment/company directory context, and company dashboard jumps.",
          "Agent I handles industry-chain questions, nodes, flows, bottlenecks, beneficiaries, positioning in the chain, and chain implications.",
          "Return exactly one JSON object with keys: mode, targetAgent, assistantResponse, routeReason.",
          'mode must be "reply" or "delegate".',
          'If the user is just greeting, acknowledging, or making a non-specialist remark, use "reply".',
          'If the user needs glossary, company, or chain expertise, use "delegate" and pick targetAgent as "G", "C", or "I".',
          "routeReason should be a short internal reason for the UI log, not chain-of-thought.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const currentDashboard = payload?.currentDashboard && typeof payload.currentDashboard === "object"
          ? payload.currentDashboard
          : null;
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          currentDashboard
            ? `Current dashboard snapshot:\nTicker: ${String(currentDashboard?.info?.symbol || "").trim()} | Name: ${String(currentDashboard?.info?.name || "").trim()}`
            : "Current dashboard snapshot: none",
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          "Route the request and return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          'Return exactly one valid JSON object with keys mode, targetAgent, assistantResponse, routeReason.',
          'mode must be "reply" or "delegate".',
          'targetAgent must be "G", "C", or "I" when mode is "delegate".',
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const masterTMTPlannerWorkflow = buildMasterTMTPlannerWorkflow();

  function buildMasterTaskPlannerWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        const mode = String(parsed.mode || "").trim();
        if (!["reply", "company_analysis_report"].includes(mode)) {
          return { ok: false, error: "LLM did not return a valid task mode." };
        }
        if (mode === "reply" && !String(parsed.assistantResponse ?? "").trim()) {
          return { ok: false, error: "LLM task planner did not return a response." };
        }
        if (mode === "company_analysis_report" && !String(parsed.companyQuery ?? "").trim()) {
          return { ok: false, error: "LLM task planner did not identify a company." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const industryLabel = String(payload?.industryLabel || "Industry").trim();
        const industryContext = String(payload?.industryContext || "").trim();
        return [
          "You are Master TMT operating in Tasks mode.",
          "Tasks mode is still chat-based: infer the user's task from the message and conversation.",
          `The active industry is ${industryLabel}.`,
          industryContext ? `Industry context: ${industryContext}` : "",
          "Supported workflow today: company_analysis_report.",
          "Use company_analysis_report when the user asks for a company report, company analysis, investment memo, valuation analysis, client report, or similar structured company work.",
          "If the user has not provided enough company identity to start, use reply and ask one concise clarification.",
          "Return exactly one JSON object with keys: mode, assistantResponse, companyQuery, taskBrief, sourceSearchQueries.",
          'mode must be "reply" or "company_analysis_report".',
          "companyQuery should be the ticker or company name to analyze.",
          "taskBrief should summarize the user's requested angle and constraints.",
          "sourceSearchQueries should be an array of 3-5 web search queries covering current news, valuation/analyst targets, catalysts, and segment context.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].filter(Boolean).join(" ");
      },
      userBuilder(payload) {
        const history = Array.isArray(payload?.conversationHistory) ? payload.conversationHistory : [];
        const currentDashboard = payload?.currentDashboard && typeof payload.currentDashboard === "object" ? payload.currentDashboard : null;
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          currentDashboard
            ? `Current dashboard snapshot: ${String(currentDashboard?.info?.symbol || "").trim()} | ${String(currentDashboard?.info?.name || "").trim()}`
            : "Current dashboard snapshot: none",
          history.length
            ? `Conversation history:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
            : "",
          "Decide whether to start a supported task workflow. Return JSON only."
        ].filter(Boolean).join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Latest user message: ${String(payload?.userMessage || "").trim()}`,
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          'Return exactly one valid JSON object with keys mode, assistantResponse, companyQuery, taskBrief, sourceSearchQueries.',
          'mode must be "reply" or "company_analysis_report".',
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const masterTaskPlannerWorkflow = buildMasterTaskPlannerWorkflow();

  function buildCompanyAnalysisReportWorkflow() {
    return buildJsonWorkflow({
      validate(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "LLM response was not valid JSON." };
        }
        if (!String(parsed.reportTitle ?? "").trim() || !String(parsed.reportHtml ?? "").trim()) {
          return { ok: false, error: "LLM did not return a usable report." };
        }
        return { ok: true };
      },
      systemBuilder(payload) {
        const industryLabel = String(payload?.industryLabel || "TMT").trim();
        return [
          "You are Master TMT producing a client-facing company analysis report.",
          `Industry context: ${industryLabel}.`,
          "Be professional, analytical, direct, and concise, in the tone of a polished client-facing equity or strategy note.",
          "Target roughly 1,900 to 2,200 words total.",
          "Use Agent C output for company, valuation, dashboard, analyst-target, catalyst, and risk analysis.",
          "Use Agent I output for industry-chain, segment, adjacent segment, bottleneck, and supply-chain implications.",
          "Use web sources only as supporting evidence. Cite source numbers like [S1] for web-derived statements.",
          "Do not mention internal implementation details such as dashboards, datasets, agents, tools, source systems, or that information was provided by a source system. State the content itself directly.",
          "Do not use node numbers in the industry analysis. Refer to chain stages and segments by name only.",
          "When web sources contain analyst target prices, target ranges, consensus targets, upside/downside figures, or valuation commentary, synthesize them into a clear valuation view instead of saying target evidence is unavailable.",
          "Do not invent target prices or quoted data if not present in the supplied sources, but if any indicative target-price signal exists in the sources, use it.",
          "The industry analysis must be detailed: discuss the outlook for the company's core segment, relevant adjacent segments, enabling segments, demand drivers, capacity or pricing trends where relevant, and how changes in those segments could affect the company's future revenue, margins, growth, competitive position, or strategic options.",
          "Avoid boilerplate such as saying supplied data is unavailable unless that is genuinely unavoidable after reviewing the provided source set.",
          "Return exactly one JSON object with keys: reportTitle, reportHtml, sources.",
          "reportHtml must be safe HTML using h2/h3/p/ul/li/table tags only. No scripts.",
          "Include these sections: Executive Summary, Company Snapshot, Business and Segment Position, Industry Chain Position, Industry and Adjacent Segment Outlook, Valuation Analysis, Catalysts, Key Risks, Recent Developments, Bottom Line, Sources.",
          "The Company Snapshot section should be presented as a compact table rather than a paragraph list.",
          "The Valuation Analysis section must discuss current valuation metrics, analyst target-price evidence from web sources when available, the implied under/fair/overvaluation view, the reasons behind that valuation view, and the catalysts or risks that could change it.",
          "The Industry and Adjacent Segment Outlook section should be one of the more detailed sections in the report.",
          "sources must be an array of objects with title, url, snippet.",
          "Do not include markdown fences or extra commentary outside the JSON object."
        ].join(" ");
      },
      userBuilder(payload) {
        const sourceList = Array.isArray(payload?.sources) ? payload.sources : [];
        return [
          `Task brief: ${String(payload?.taskBrief || "").trim()}`,
          `Company resolved:\n${JSON.stringify(payload?.company || null)}`,
          `Dashboard data:\n${JSON.stringify(payload?.dashboard || null)}`,
          `Agent C company/valuation workstream:\n${String(payload?.companyAnalysis || "").trim()}`,
          `Agent I industry-chain/segment workstream:\n${String(payload?.industryAnalysis || "").trim()}`,
          sourceList.length
            ? `Web sources:\n${sourceList.map((item, idx) => `[S${idx + 1}] ${String(item.title || "").trim()} | ${String(item.snippet || "").trim()} | ${String(item.url || "").trim()}`).join("\n")}`
            : "Web sources: none",
          "Generate the final report now. Return JSON only."
        ].join("\n\n");
      },
      retryUserBuilder(payload, context) {
        return [
          `Your previous output could not be used because: ${String(context?.previousError || "it was not recognizable").trim()}`,
          "Try again. Return exactly one valid JSON object with reportTitle, reportHtml, sources.",
          "Return JSON only."
        ].join("\n");
      },
      maxAttempts: 2
    });
  }

  const companyAnalysisReportWorkflow = buildCompanyAnalysisReportWorkflow();

  async function lookupGlossaryEntry(payload, overrideConfig = {}) {
    const result = await glossaryWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;

    const acronym = String(payload?.acronym || "").trim().toUpperCase();
    const data = result.data || {};
    const entries = (Array.isArray(data.entries) ? data.entries : [])
      .map((entry) => ({
        acronym: String(entry?.acronym || acronym).trim(),
        meaning: String(entry?.meaning || "").trim(),
        practicalExplanation: String(entry?.practicalExplanation || "").trim()
      }))
      .filter((entry) => entry.acronym && entry.meaning && entry.practicalExplanation)
      .slice(0, 3);

    if (!entries.length) {
      return { ok: false, error: "LLM returned no usable glossary candidates." };
    }

    return { ok: true, entries };
  }

  shell.buildJsonWorkflow = buildJsonWorkflow;
  shell.buildGlossaryWorkflow = buildGlossaryWorkflow;
  shell.lookupGlossaryEntry = lookupGlossaryEntry;
  shell.buildCompanyAgentPlannerWorkflow = buildCompanyAgentPlannerWorkflow;
  shell.buildCompanyAgentAnswerWorkflow = buildCompanyAgentAnswerWorkflow;
  shell.buildIndustryAgentPlannerWorkflow = buildIndustryAgentPlannerWorkflow;
  shell.buildIndustryAgentAnswerWorkflow = buildIndustryAgentAnswerWorkflow;
  shell.buildMasterTMTPlannerWorkflow = buildMasterTMTPlannerWorkflow;
  shell.buildMasterTaskPlannerWorkflow = buildMasterTaskPlannerWorkflow;
  shell.buildCompanyAnalysisReportWorkflow = buildCompanyAnalysisReportWorkflow;
  shell.buildGlossaryAgentPlannerWorkflow = buildGlossaryAgentPlannerWorkflow;
  shell.buildGlossaryAgentAnswerWorkflow = buildGlossaryAgentAnswerWorkflow;
  shell.buildGlossaryCandidateSynthesisWorkflow = buildGlossaryCandidateSynthesisWorkflow;
  shell.planCompanyAgentTurn = async function planCompanyAgentTurn(payload, overrideConfig = {}) {
    const result = await companyAgentPlannerWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    return {
      ok: true,
      mode: String(data.mode || "").trim(),
      assistantResponse: String(data.assistantResponse || "").trim(),
      lookupQuery: String(data.lookupQuery || "").trim(),
      useWebResearch: Boolean(data.useWebResearch),
      searchQuery: String(data.searchQuery || "").trim()
    };
  };
  shell.answerCompanyAgentTurn = async function answerCompanyAgentTurn(payload, overrideConfig = {}) {
    const result = await companyAgentAnswerWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    return {
      ok: true,
      assistantResponse: String(data.assistantResponse || "").trim(),
      selectedCompanyId: String(data.selectedCompanyId || "").trim(),
      openDashboardTicker: String(data.openDashboardTicker || "").trim(),
      offerOpenDashboard: Boolean(data.offerOpenDashboard && String(data.openDashboardTicker || "").trim())
    };
  };
  shell.planIndustryAgentTurn = async function planIndustryAgentTurn(payload, overrideConfig = {}) {
    const result = await industryAgentPlannerWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    return {
      ok: true,
      mode: String(data.mode || "").trim(),
      assistantResponse: String(data.assistantResponse || "").trim(),
      lookupQuery: String(data.lookupQuery || "").trim(),
      useWebResearch: Boolean(data.useWebResearch),
      searchQuery: String(data.searchQuery || "").trim()
    };
  };
  shell.answerIndustryAgentTurn = async function answerIndustryAgentTurn(payload, overrideConfig = {}) {
    const result = await industryAgentAnswerWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    return {
      ok: true,
      assistantResponse: String(data.assistantResponse || "").trim(),
      selectedNodeId: String(data.selectedNodeId || "").trim(),
      selectedCompanyId: String(data.selectedCompanyId || "").trim(),
      openDashboardTicker: String(data.openDashboardTicker || "").trim(),
      offerOpenDashboard: Boolean(data.offerOpenDashboard && String(data.openDashboardTicker || "").trim())
    };
  };
  shell.planMasterTMTTurn = async function planMasterTMTTurn(payload, overrideConfig = {}) {
    const result = await masterTMTPlannerWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    return {
      ok: true,
      mode: String(data.mode || "").trim(),
      targetAgent: String(data.targetAgent || "").trim(),
      assistantResponse: String(data.assistantResponse || "").trim(),
      routeReason: String(data.routeReason || "").trim()
    };
  };
  shell.planMasterTaskTurn = async function planMasterTaskTurn(payload, overrideConfig = {}) {
    const result = await masterTaskPlannerWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    return {
      ok: true,
      mode: String(data.mode || "").trim(),
      assistantResponse: String(data.assistantResponse || "").trim(),
      companyQuery: String(data.companyQuery || "").trim(),
      taskBrief: String(data.taskBrief || "").trim(),
      sourceSearchQueries: Array.isArray(data.sourceSearchQueries) ? data.sourceSearchQueries.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5) : []
    };
  };
  shell.composeCompanyAnalysisReport = async function composeCompanyAnalysisReport(payload, overrideConfig = {}) {
    const result = await companyAnalysisReportWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    return {
      ok: true,
      reportTitle: String(data.reportTitle || "").trim(),
      reportHtml: String(data.reportHtml || "").trim(),
      sources: Array.isArray(data.sources) ? data.sources : []
    };
  };
  shell.planGlossaryAgentTurn = async function planGlossaryAgentTurn(payload, overrideConfig = {}) {
    const result = await glossaryAgentPlannerWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    return {
      ok: true,
      mode: String(data.mode || "").trim(),
      assistantResponse: String(data.assistantResponse || "").trim(),
      lookupTerm: String(data.lookupTerm || payload?.lastResolvedTerm || "").trim(),
      useWebResearch: Boolean(data.useWebResearch),
      searchQuery: String(data.searchQuery || "").trim()
    };
  };
  shell.answerGlossaryAgentTurn = async function answerGlossaryAgentTurn(payload, overrideConfig = {}) {
    const result = await glossaryAgentAnswerWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    const candidate = data.candidateEntry && typeof data.candidateEntry === "object"
      ? {
          acronym: String(data.candidateEntry.acronym || payload?.lookupTerm || "").trim(),
          meaning: String(data.candidateEntry.meaning || "").trim(),
          practicalExplanation: String(data.candidateEntry.practicalExplanation || "").trim()
        }
      : null;
    return {
      ok: true,
      assistantResponse: String(data.assistantResponse || "").trim(),
      candidateEntry: candidate && candidate.acronym && candidate.meaning && candidate.practicalExplanation ? candidate : null,
      offerSave: Boolean(data.offerSave && candidate),
      suggestedLookupTerm: String(data.suggestedLookupTerm || payload?.lookupTerm || "").trim()
    };
  };
  shell.synthesizeGlossaryCandidate = async function synthesizeGlossaryCandidate(payload, overrideConfig = {}) {
    const result = await glossaryCandidateSynthesisWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    return {
      ok: true,
      entry: {
        acronym: String(data.acronym || payload?.lookupTerm || "").trim(),
        meaning: String(data.meaning || "").trim(),
        practicalExplanation: String(data.practicalExplanation || "").trim()
      }
    };
  };
  shell.buildGlossaryAgentWorkflow = buildGlossaryAgentWorkflow;
  shell.buildGlossaryDisambiguationWorkflow = buildGlossaryDisambiguationWorkflow;
  shell.chatWithGlossaryAgent = async function chatWithGlossaryAgent(payload, overrideConfig = {}) {
    const result = await glossaryAgentWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    const candidate = data.candidateEntry && typeof data.candidateEntry === "object"
      ? {
          acronym: String(data.candidateEntry.acronym || payload?.lookupTerm || "").trim(),
          meaning: String(data.candidateEntry.meaning || "").trim(),
          practicalExplanation: String(data.candidateEntry.practicalExplanation || "").trim()
        }
      : null;
    return {
      ok: true,
      assistantResponse: String(data.assistantResponse || "").trim(),
      candidateEntry: candidate && candidate.acronym && candidate.meaning && candidate.practicalExplanation ? candidate : null,
      offerSave: Boolean(data.offerSave && candidate),
      suggestedLookupTerm: String(data.suggestedLookupTerm || payload?.lookupTerm || "").trim()
    };
  };
  shell.disambiguateGlossaryTerm = async function disambiguateGlossaryTerm(payload, overrideConfig = {}) {
    const result = await glossaryDisambiguationWorkflow.run(payload, overrideConfig);
    if (!result.ok) return result;
    const data = result.data || {};
    const candidate = data.candidateEntry && typeof data.candidateEntry === "object"
      ? {
          acronym: String(data.candidateEntry.acronym || payload?.lookupTerm || "").trim(),
          meaning: String(data.candidateEntry.meaning || "").trim(),
          practicalExplanation: String(data.candidateEntry.practicalExplanation || "").trim()
        }
      : null;
    return {
      ok: true,
      assistantResponse: String(data.assistantResponse || "").trim(),
      candidateEntry: candidate && candidate.acronym && candidate.meaning && candidate.practicalExplanation ? candidate : null,
      offerSave: Boolean(data.offerSave && candidate),
      suggestedLookupTerm: String(data.suggestedLookupTerm || payload?.lookupTerm || "").trim()
    };
  };
})();
