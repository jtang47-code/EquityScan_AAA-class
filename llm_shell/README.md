# LLM Shell

Reusable browser-side workflow layer that sends LLM requests through the backend proxy.

What it includes:
- `client.js`: frontend client that calls the backend `/api/llm` proxy
- `workflows.js`: reusable JSON workflow builder plus a glossary workflow example

How it is intended to be used:
1. Load `llm_shell/client.js`
2. Load `llm_shell/workflows.js`
3. Call a workflow from the UI

Typical usage:

```html
<script src="llm_shell/client.js"></script>
<script src="llm_shell/workflows.js"></script>
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
- The frontend no longer stores provider API keys.
- The backend must expose `/api/llm`.
- Provider secrets and model defaults should be configured on the backend via environment variables.
