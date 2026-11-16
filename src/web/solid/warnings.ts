// What a run said on `console.warn` and `console.error`, recorded while the console still prints
// it, so a test can assert on warnings without hiding them from the person reading the output.

/** What `run` returned, and each warning or error it logged, as one line. */
export type Recorded<T> = {
  result: T;
  warnings: string[];
};

// An element reads as its opening tag; anything else as `String` gives it.
function line(args: readonly unknown[]): string {
  return args
    .map((arg) => {
      const html = typeof arg === "object" && arg !== null && "outerHTML" in arg ? arg.outerHTML : undefined;

      return typeof html === "string" ? html.slice(0, html.indexOf(">") + 1) : String(arg);
    })
    .join(" ");
}

// Wraps both methods to record and call through; the returned function puts them back.
function listen(warnings: string[]): () => void {
  const { error, warn } = console;
  Object.assign(console, {
    error: (...args: unknown[]) => {
      warnings.push(line(args));
      error.apply(console, args);
    },
    warn: (...args: unknown[]) => {
      warnings.push(line(args));
      warn.apply(console, args);
    },
  });

  return () => {
    Object.assign(console, { error, warn });
  };
}

const isPromise = (value: unknown): value is Promise<unknown> => value instanceof Promise;

/** Runs `run` and records its warnings; a run that returns a promise is recorded until it settles. */
export function recordWarnings<T>(run: () => Promise<T>): Promise<Recorded<T>>;
export function recordWarnings<T>(run: () => T): Recorded<T>;
export function recordWarnings<T>(run: () => T): Recorded<T> | Promise<Recorded<Awaited<T>>> {
  const warnings: string[] = [];
  const stop = listen(warnings);
  let result: T;

  try {
    result = run();
  } catch (error) {
    stop();
    throw error;
  }

  if (!isPromise(result)) {
    stop();

    return { result, warnings };
  }

  return (result as Promise<Awaited<T>>).then((settled) => ({ result: settled, warnings })).finally(stop);
}
