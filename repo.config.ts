import { defineConfig } from "@workerstack/repo"

export default defineConfig({
	packs: ["agents", "docs"],
	workflow: "worktree",
	agents: { hosts: ["claude", "codex", "antigravity", "grok", "cursor"] },
})
