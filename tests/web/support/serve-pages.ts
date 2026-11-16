import { writeFileSync } from "node:fs";

import { servePages } from "./pages.ts";

// The app a consumer config starts with `appServer`: the fixture pages on `localhost`, the host
// `freePort` probes, at `PORT`. It writes its pid to `PAGES_PID_FILE`, so a spec can check the
// run stopped it. `PAGES_MODE=exit` fails at start; `PAGES_MODE=hang` runs but never listens.

const pidFile = process.env["PAGES_PID_FILE"];

if (pidFile !== undefined) writeFileSync(pidFile, String(process.pid));

const mode = process.env["PAGES_MODE"];

if (mode === "exit") {
  console.error("serve-pages: told to fail at start");
  process.exit(1);
}

if (mode === "hang") setInterval(() => {}, 1000);
else await servePages({ host: "localhost", port: Number(process.env["PORT"]) });
