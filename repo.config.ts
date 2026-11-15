import { defineConfig } from "@workerstack/repo"

export default defineConfig({
	packs: ["agents", "docs"],
	link: { push: "allow" },
	workflow: "worktree",
	agents: { hosts: ["claude", "codex", "antigravity", "grok", "cursor"] },
})
