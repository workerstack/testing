import { isServer } from "@solidjs/web"
import { createSignal } from "solid-js"

/* Fixtures both renders share: the server half renders them in node, the browser half hydrates them. */

/** A counter whose text the server renders and hydration then updates in place. */
export function Greeting() {
	const [count, setCount] = createSignal(0)
	return (
		<p data-slot="greeting">
			<button type="button" onClick={() => setCount((n) => n + 1)}>
				Clicked {count()}
			</button>
			<span>Hello &amp; welcome</span>
		</p>
	)
}

/** Warns while it renders, as a component that writes a signal on the server does. */
export function Warns() {
	console.warn("rendered with a warning")
	return <p>warned</p>
}

/** Renders one tree on the server and another in the browser, so hydration cannot claim it. */
export function Mismatch() {
	return <div data-slot="mismatch">{isServer ? <b data-slot="server">server</b> : <i>client</i>}</div>
}
