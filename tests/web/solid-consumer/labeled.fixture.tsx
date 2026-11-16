import { createUniqueId } from "solid-js";

// What the app's server tests render: an id from Solid's owner, which needs the app's one Solid.

/** A label tied to its input by an id Solid makes. */
export function Labeled() {
  const id = createUniqueId();

  return (
    <label data-slot="label" for={id}>
      Name <input data-slot="name" id={id} />
    </label>
  );
}
