import { isServer } from "@solidjs/web";
import { createSignal } from "solid-js";

/* What the app's hydration tests render: once in node through the plugin, then in the browser. */

/** A counter the server renders and the browser takes over. */
export function Counter() {
  const [count, setCount] = createSignal(0);
  return (
    <button data-slot="counter" type="button" onClick={() => setCount((n) => n + 1)}>
      Count {count()}
    </button>
  );
}

/** One tree on the server and another in the browser. */
export function Drifts() {
  return <p>{isServer ? <b>server</b> : <i>client</i>}</p>;
}
