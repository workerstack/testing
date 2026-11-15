import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";

/* The fixture pages under tests/web/pages, served over HTTP on the host and port asked for. */

const PAGES = join(import.meta.dirname, "..", "pages");
const TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".png": "image/png",
};

/** A running pages server: the port its socket is bound to, and how to stop it. */
export interface PagesServer {
  port: number;
  close: () => Promise<void>;
}

export async function servePages({ host, port }: { host: string; port: number }): Promise<PagesServer> {
  const server = createServer((request, response) => {
    const path = normalize(new URL(request.url ?? "/", "http://site").pathname).replace(/\/$/, "/index.html");
    readFile(join(PAGES, path))
      .then((body) =>
        response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(body),
      )
      .catch(() => response.writeHead(404).end());
  });
  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const close = (): Promise<void> =>
    new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return { close, port: (server.address() as AddressInfo).port };
}
