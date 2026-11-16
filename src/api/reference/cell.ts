/** The values a reference row holds, and how a store reads them back. */

/** A value a row holds: what a JSON body carries, as every engine stores and returns it. */
export type Cell = string | number | boolean | null | Cell[] | Row;

/** A record by field; a field it does not have reads `undefined`. */
export type Row = { [field: string]: Cell | undefined };

/** A JSON column read back: the text a store wrote with `JSON.stringify`. */
export function parseCell(text: string): Cell {
  return JSON.parse(text) /* JSON.parse yields only JSON values, each a Cell */ as Cell;
}

/** A scalar cell as `String` writes it; an object or a list has no text form, so it throws. */
export function cellText(value: Cell | undefined): string {
  // Object(x) returns x itself only when x is already an object: a Row or a list here.
  if (Object(value) === value) throw new TypeError(`${JSON.stringify(value)} is not a scalar, so it has no text form`);

  return String(value);
}
