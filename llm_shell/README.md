# LLM Shell

Reusable browser-side LLM runtime for app-specific agentic workflows.

What it includes:
- `config.js`: app-local browser config for `window.LLM_DIRECT_CONFIG`
- `client.js`: provider-agnostic direct LLM caller that uses `window.LLM_DIRECT_CONFIG`
- `workflows.js`: reusable JSON workflow builder plus a glossary workflow example

How it is intended to be used:
1. Load `llm_shell/client.js`
2. Load `llm_shell/workflows.js`
3. Load `llm_shell/config.js` or define `window.LLM_DIRECT_CONFIG` yourself
4. Call a workflow from the UI

Typical usage:

```html
<script src="llm_shell/client.js"></script>
<script src="llm_shell/workflows.js"></script>
<script src="llm_shell/config.js"></script>
<script>
  window.LLMShell.lookupGlossaryEntry({
    acronym: "OSAT",
    industryKey: "TMT",
    industryLabel: "Technology, Media, Telecom",
    industryContext: "Semiconductors, AI infrastructure, cloud, networking.",
    sidebarTitle: "TMT"
  }).then(console.log);
</script>
```

To add another app workflow:
1. Build a new workflow with `window.LLMShell.buildJsonWorkflow(...)`
2. Provide `systemBuilder(payload)`
3. Provide `userBuilder(payload)`
4. Define the required JSON fields
5. Call `workflow.run(payload)`

Notes:
- This shell is frontend-only and does not depend on Python.
- Because config is browser-side, tokens are exposed to the client.
- This only works when the provider endpoint accepts browser requests from your page.
