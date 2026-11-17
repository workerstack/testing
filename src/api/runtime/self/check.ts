import type { EntityModel, SpecModel } from "../../spec/graph/types.ts";
import type { UnlistedCheck } from "../checks/core/check.ts";
import type { CheckContext, WriteContext } from "../checks/core/context.ts";
import type { Outcome } from "../finding.ts";
import { runSelfIdentity } from "./identity.ts";
import { entityIsSelf, SELF_CHECK_ID, selfOperationIds } from "./operations.ts";

export const selfIdentityCheck: UnlistedCheck<void> = {
  id: SELF_CHECK_ID,
  mutates: true as const,
  needs: "x-entity.identity: self, and a read or an update",
  plan(ctx: CheckContext) {
    const entity = ctx.model.entities.get(ctx.entityName);

    if (entity === undefined || !entityIsSelf(entity))
      return { needs: "x-entity.identity: self, and a read or an update", ok: false as const };

    return { ok: true as const, value: undefined };
  },
  async run(ctx: WriteContext): Promise<Outcome> {
    return runSelfIdentity({
      client: ctx.client,
      entity: ctx.model.entities.get(ctx.entityName) as EntityModel,
      findings: ctx.findings,
      model: ctx.model,
      principal: ctx.actor.id,
      ...(ctx.ownRecords === undefined ? {} : { ownRecords: ctx.ownRecords }),
    });
  },
  subjects: (entity: EntityModel, model?: SpecModel): string[] => selfOperationIds(entity, model),
};
