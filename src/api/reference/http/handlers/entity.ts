/** What every entity route works from: the entity, the path's typed scope, and who is asking. */

import type { Collection, Principal } from "../state.ts";

export type EntityCall = Collection & {
  principal: Principal;
};

export type ItemCall = EntityCall & {
  itemId: string | number;
};
