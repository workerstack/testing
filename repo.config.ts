import { defineConfig } from "@workerstack/repo"

export default defineConfig({
	packs: ["agents", "docs"],
	// Each repo links @workerstack/repo from the sibling checkout, so a push must go while it is linked.
	link: { push: "allow" },
	workflow: "worktree",
	agents: { hosts: ["claude", "codex", "antigravity", "grok", "cursor"] },
})
