import { describe, expect, it } from "vitest"
import {
	isProbePrincipal,
	isRecordHolder,
	probeOwner,
	probePrincipal,
	recordHolder,
	withoutProbes,
} from "./probe-principal.ts"

describe("probe principals", () => {
	it("are named for their owner, and name it back", () => {
		const probe = probePrincipal("alpha", 2)
		expect(probe).toBe("alpha#probe-2")
		expect([probeOwner(probe), isProbePrincipal(probe)]).toEqual(["alpha", true])
	})

	it("are named by their owner in any text a report carries", () => {
		expect(withoutProbes('login for "ann#probe-12" failed; ann#probe-3 too')).toBe('login for "ann" failed; ann too')
	})

	it("leave any other principal its own, a # in its id included", () => {
		for (const id of ["alpha", "a#b", "alpha#probe-x"])
			expect([probeOwner(id), isProbePrincipal(id)]).toEqual([id, false])
	})
})

describe("record holders", () => {
	it("are named for their owner, name it back, and are no probe", () => {
		const holder = recordHolder("alpha", 3)
		expect(holder).toBe("alpha#record-3")
		expect([probeOwner(holder), isRecordHolder(holder), isProbePrincipal(holder)]).toEqual(["alpha", true, false])
		expect([isRecordHolder("alpha"), isRecordHolder("alpha#probe-1"), isRecordHolder("alpha#record-x")]).toEqual([
			false,
			false,
			false,
		])
	})

	it("are named by their owner in any text a report carries", () => {
		expect(withoutProbes("refresh for alpha#record-2/bearer failed; ann#probe-1 too")).toBe(
			"refresh for alpha/bearer failed; ann too",
		)
	})
})
