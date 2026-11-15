import { describe, expect, it } from "vitest";

import { freePort } from "./port.ts";

type Create = NonNullable<Parameters<typeof freePort>[0]>;
type Server = ReturnType<Create>;

/* A server that records where it was asked to bind, and is bound to `port` or fails with `error`. */
function fakeServer({ port, error }: { port?: number | null; error?: Error }): {
  create: Create;
  calls: string[];
  bound: unknown[];
} {
  const calls: string[] = [];
  const bound: unknown[] = [];
  const handlers = new Map<string, (error: Error) => void>();
  const server = {
    address: () => (port === null ? null : { address: "::1", family: "IPv6", port }),
    close: (done: () => void) => {
      calls.push("close");
      done();
    },
    listen: (options: unknown, done: () => void) => {
      bound.push(options);
      calls.push("listen");
      if (error === undefined) done();
      else handlers.get("error")?.(error);
    },
    once: (event: string, handler: (error: Error) => void) => handlers.set(event, handler),
  };
  return { bound, calls, create: () => server as unknown as Server };
}

describe("freePort", () => {
  it("asks the OS for a port on localhost and gives it back once the probe is closed", async () => {
    const fake = fakeServer({ port: 41234 });
    expect(await freePort(fake.create)).toBe(41234);
    expect(fake.bound).toEqual([{ host: "localhost", port: 0 }]);
    expect(fake.calls).toEqual(["listen", "close"]);
  });

  it("fails when the probe cannot listen", async () => {
    const fake = fakeServer({ error: new Error("listen EACCES") });
    await expect(freePort(fake.create)).rejects.toThrow("listen EACCES");
  });

  it("fails when the probe has no address, and closes it", async () => {
    const fake = fakeServer({ port: null });
    await expect(freePort(fake.create)).rejects.toThrow("freePort: the probe on localhost has no port");
    expect(fake.calls).toEqual(["listen", "close"]);
  });
});
