// The slice of oxlint's plugin API the API tester's rules use (oxlint ships no importable plugin types).

export type Node = {
  type: string;
  start: number;
  end: number;
  parent?: Node | null;
};

export type Identifier = Node & {
  name?: string;
};

export type Literal = Node & {
  value?: unknown;
};

export type Member = Node & {
  object: Identifier;
  property: Identifier;
  computed?: boolean;
};

export type Call = Node & {
  callee: Identifier | Member;
  arguments: Node[];
};

export type Assertion = Node & {
  typeAnnotation: Node;
};

export type Binary = Node & {
  operator: string;
  left: Node;
  right: Node;
};

export type ImportNode = Node & {
  source: { value: string };
  specifiers: Array<{ type: string; imported?: Identifier & Literal }>;
};

export type Comment = {
  type: string;
  value: string;
  start: number;
  end: number;
};

export type Context = {
  filename: string;
  sourceCode: {
    getText: (node?: Node) => string;
    getAllComments: () => Comment[];
    getCommentsBefore: (node: Node) => Comment[];
    getCommentsAfter: (node: Node) => Comment[];
  };
  report: (diagnostic: { message: string; node: Node | Comment }) => void;
};

export type Visitors = Record<string, ((node: never) => void) | undefined>;

export type Rule = {
  create: (context: Context) => Visitors;
};
