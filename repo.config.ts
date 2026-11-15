import { defineConfig } from "@workerstack/repo"

export default defineConfig({
	packs: ["agents", "docs"],
	workflow: "main",
	agents: { hosts: ["claude", "codex", "antigravity", "grok", "cursor"] },
})
