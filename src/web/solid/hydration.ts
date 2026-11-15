import { createComponent, type JSX } from "@solidjs/web"
import { onTestFinished } from "vitest"
import { isMismatch } from "./mismatches.ts"
import { recordWarnings } from "./warnings.ts"

/*
 * A fixture rendered on the server, put in the page, and hydrated by the same fixture compiled for
 * the client, as an SSR app's first load does. What the two renders disagreed on comes back as
 * data, and the page is left as it was found: the root disposed, the container gone, `_$HY` back.
 */

/** What the server rendered for a hydration test. */
export interface ServerRendered {
	html: string
	/** What Solid and the app warned while rendering on the server. */
	warnings: string[]
}

/** A kind of disagreement between the server's render and hydration. */
export type MismatchKind = "serverWarnings" | "warnings" | "replaced" | "added"

/** Each kind of disagreement that happened, with what it hit; a clean hydration is `{}`. */
export type Mismatches = Partial<Record<MismatchKind, string[]>>

/** A fixture hydrated over its server HTML. */
export interface Hydrated {
	container: HTMLElement
	server: ServerRendered
	mismatches: Mismatches
	/** Disposes the root, removes the container and puts `_$HY` back; runs after the test on its own. */
	dispose: () => void
}

type ServerRender = (fixture: string, name: string) => Promise<ServerRendered>

/** What hydrating needs from vitest and Solid; the browser entry passes the real ones. */
export interface HydrationRuntime {
	/** vitest's browser module, whose `commands` the plugin adds `serverRender` to. */
	browser: () => Promise<{ commands: { serverRender?: ServerRender } }>
	/** Solid's `hydrate`: hydrates `code` over `container`, giving the root's disposer. */
	hydrate: (code: () => JSX.Element, container: HTMLElement) => () => void
	flush: () => void
}

const nothing = (): void => undefined

/** A readable element for a failure message: `button[data-slot=button]`. */
function label(element: Element): string {
	const slot = element.getAttribute("data-slot")
	return `${element.tagName.toLowerCase()}${slot === null ? "" : `[data-slot=${slot}]`}`
}

/* Collects the elements added under `container` until the returned function is called. */
function watchAdded(container: HTMLElement): () => Element[] {
	const observer = new MutationObserver(nothing)
	observer.observe(container, { childList: true, subtree: true })
	return () => {
		const added = observer.takeRecords().flatMap((record) => [...record.addedNodes])
		observer.disconnect()
		return added.filter((node): node is Element => node instanceof Element && node.isConnected)
	}
}

/* Gives the page a fresh hydration state; the returned function puts back what was there. */
function freshHydrationState(): () => void {
	const before = Object.getOwnPropertyDescriptor(globalThis, "_$HY")
	const value = { completed: new WeakSet(), done: false, events: [], fe: nothing, r: {} }
	Object.defineProperty(globalThis, "_$HY", { configurable: true, value, writable: true })
	return () => {
		if (before === undefined) Reflect.deleteProperty(globalThis, "_$HY")
		else Object.defineProperty(globalThis, "_$HY", before)
	}
}

/* Runs Solid's hydrate, recording its warnings; a thrown mismatch is one more warning. */
function hydrateRecorded(input: { runtime: HydrationRuntime; code: () => JSX.Element; container: HTMLElement }) {
	const { code, container, runtime } = input
	const thrown: string[] = []
	const { result, warnings } = recordWarnings(() => {
		try {
			const dispose = runtime.hydrate(code, container)
			runtime.flush()
			return dispose
		} catch (error) {
			if (!(error instanceof Error && isMismatch(error.message))) throw error
			thrown.push(error.message)
			return undefined
		}
	})
	return { dispose: result, warnings: [...warnings.filter(isMismatch), ...thrown] }
}

const nonEmpty = (found: Record<MismatchKind, string[]>): Mismatches =>
	Object.fromEntries(Object.entries(found).filter(([, hits]) => hits.length > 0))

async function serverRenderOf(runtime: HydrationRuntime): Promise<ServerRender> {
	const { serverRender } = (await runtime.browser()).commands
	if (typeof serverRender !== "function") {
		throw new Error("hydrate: no serverRender command; add solidHydration() to this project's plugins")
	}
	return serverRender
}

async function serverThenHydrate(
	runtime: HydrationRuntime,
	at: { fixture: URL; name: string; code: () => JSX.Element },
) {
	const server = await (await serverRenderOf(runtime))(at.fixture.pathname, at.name)
	const container = document.createElement("div")
	container.innerHTML = server.html
	document.body.append(container)
	const before = [...container.querySelectorAll("*")]
	const added = watchAdded(container)
	const restore = freshHydrationState()
	let open = true
	const close = (root?: () => void): void => {
		if (!open) return
		open = false
		root?.()
		container.remove()
		restore()
	}
	let hydrated: ReturnType<typeof hydrateRecorded>
	try {
		hydrated = hydrateRecorded({ code: at.code, container, runtime })
	} catch (error) {
		close()
		throw error
	}
	const mismatches = nonEmpty({
		added: added().map(label),
		replaced: before.filter((element) => !element.isConnected).map(label),
		serverWarnings: server.warnings,
		warnings: hydrated.warnings,
	})
	return { container, dispose: () => close(hydrated.dispose), mismatches, server }
}

/* Registers `dispose` to run after the test, or says why it cannot. */
function afterThisTest(dispose: () => void): void {
	try {
		onTestFinished(dispose)
	} catch (cause) {
		throw new Error("hydrate: call it inside a test, so it is disposed after the test", { cause })
	}
}

/** A `hydrate(name)` for one fixture module, given the vitest and Solid calls it runs on. */
export function createHydrator<Name extends string>(
	runtime: HydrationRuntime,
	fixture: URL,
	fixtures: Record<Name, () => JSX.Element>,
): (name: Name) => Promise<Hydrated> {
	return async (name) => {
		let dispose = nothing
		afterThisTest(() => dispose())
		const component = fixtures[name]
		const code = (): JSX.Element => createComponent(component, {})
		const hydrated = await serverThenHydrate(runtime, { code, fixture, name })
		dispose = hydrated.dispose
		return hydrated
	}
}
