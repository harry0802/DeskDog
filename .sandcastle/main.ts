import { run, claudeCode } from "@ai-hero/sandcastle";
import { podman } from "@ai-hero/sandcastle/sandboxes/podman";

// Simple loop: an agent that picks open issues one by one and closes them.
// Run this with: npx tsx .sandcastle/main.ts
// Or add to package.json scripts: "sandcastle": "npx tsx .sandcastle/main.ts"

await run({
  // A name for this run, shown as a prefix in log output.
  name: "worker",

  // Sandbox provider — runs the agent inside an isolated container.
  // Tests and type-check don't need the Electron binary, so skip its download
  // during pnpm install inside the sandbox.
  sandbox: podman({ env: { ELECTRON_SKIP_BINARY_DOWNLOAD: "1" } }),

  // The agent provider. Pass a model string to claudeCode() — sonnet balances
  // capability and speed for most tasks. Switch to claude-opus-4-8 for harder
  // problems, or claude-haiku-4-5-20251001 for speed.
  agent: claudeCode("claude-opus-4-8"),

  // Path to the prompt file. Shell expressions inside are evaluated inside the
  // sandbox at the start of each iteration, so the agent always sees fresh data.
  promptFile: "./.sandcastle/prompt.md",

  // Maximum number of iterations (agent invocations) to run in a session.
  // Each iteration works on a single issue. Increase this to process more issues
  // per run, or set it to 1 for a single-shot mode.
  maxIterations: 3,

  // Branch strategy — merge-to-head creates a temporary branch for the agent
  // to work on, then merges the result back to HEAD when the run completes.
  branchStrategy: { type: "merge-to-head" },

  // No copyToWorktree for node_modules: the host is Windows, so its pnpm
  // symlinks and native binaries don't work in the Linux container.
  // Install fresh inside the sandbox instead.
  hooks: {
    sandbox: {
      // onSandboxReady runs once after the sandbox is initialised and the repo is
      // synced in, before the agent starts.
      onSandboxReady: [
        { command: "pnpm install --frozen-lockfile", timeoutMs: 600_000 },
      ],
    },
  },
});
