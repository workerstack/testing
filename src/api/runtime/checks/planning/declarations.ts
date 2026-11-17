import type { Exchange } from "../../exchange.ts";
import { ASSERTED, type Outcome } from "../../finding.ts";
import type { Check } from "../core/check.ts";
import type { Listed } from "../core/context.ts";

/**
 * How a backend answered a request exercising something the document declares. Only 400 and
 * 422 say "this is not supported"; 401, 403, 404 and 429 turn the request away before the
 * capability is ever consulted, and a 5xx is a crash, not a refusal.
 */
export function declarationAnswer(status: number): "accepted" | "refused" | "unknown" {
  if (status > 0 && status < 400) return "accepted";

  return status === 400 || status === 422 ? "refused" : "unknown";
}

const EVIDENCE_LIMIT = 3;

/** A probe of one declared field, with the exchange that answered it. */
export type DeclarationProbe = { field: string; result: { exchange: Exchange } };

/** What a check says about a declaration the backend refused: the noun, the miss and the consequence. */
export type DeclarationWords = {
  id: Check["id"];
  kind: string;
  noProbe: string;
  consequence: string;
  summary: string;
};

/**
 * The verdict on a declared capability from its probes: a refusal is a SPEC_BUG, a probe turned away
 * without a verdict leaves it unresolved, and no probe at all says why none was sent.
 */
export function declarationOutcome(ctx: Listed, probes: readonly DeclarationProbe[], words: DeclarationWords): Outcome {
  const { id } = words;
  const rejected: Array<{ field: string; status: number; exchange: Exchange }> = [];
  const unknown: string[] = [];

  for (const { field, result } of probes) {
    // Only a rejection counts: a declaration accepted and then ignored is another check's finding.
    const answer = declarationAnswer(result.exchange.status);

    if (answer === "refused") rejected.push({ exchange: result.exchange, field, status: result.exchange.status });

    if (answer === "unknown") unknown.push(`${field} (${result.exchange.status})`);
  }

  if (probes.length === 0) return ctx.findings.unresolved(id, ctx.entityName, words.noProbe);

  if (rejected.length === 0 && unknown.length > 0) {
    return ctx.findings.unresolved(
      id,
      ctx.entityName,
      `probes were turned away without a verdict: ${unknown.join(", ")}`,
    );
  }

  if (rejected.length === 0) return ASSERTED;

  return ctx.findings.spec(id, ctx.entityName, {
    detail:
      `x-query lists ${rejected.length} field(s) as ${words.kind} that the backend rejects: ` +
      `${rejected.map((r) => `${r.field} (${r.status})`).join(", ")}. ${words.consequence}`,
    evidence: rejected.slice(0, EVIDENCE_LIMIT).map((item) => item.exchange),
    summary: words.summary,
  });
}
