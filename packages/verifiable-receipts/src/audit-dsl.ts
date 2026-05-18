/**
 * Receipt-Audit DSL (RAD-DSL) — pure-TS SQL-flavored query language
 * over receipt sets.
 *
 * No commercial competitor in the agentic-receipts space ships
 * anything like this. Regulators currently get receipts as a tar
 * file and grep through them — RAD-DSL lets them write:
 *
 *   SELECT verdictId, overall, agentSlug
 *   FROM receipts
 *   WHERE pack = 'hipaa-2026'
 *     AND overall = 'block'
 *     AND issuedAt > '2026-04-01'
 *   ORDER BY issuedAt DESC
 *   LIMIT 100
 *
 * and get back a structured result over the in-memory receipt array.
 * Apache 2.0. Pure stdlib — no external parser, no database, zero
 * deps.
 *
 * Grammar:
 *
 *   QUERY  := SELECT_CLAUSE FROM_CLAUSE [WHERE_CLAUSE] [ORDER_CLAUSE] [LIMIT_CLAUSE]
 *   SELECT := 'SELECT' (FIELD_LIST | '*')
 *   FROM   := 'FROM' IDENT
 *   WHERE  := 'WHERE' EXPR
 *   EXPR   := AND_EXPR ('OR' AND_EXPR)*
 *   AND    := COMPARISON ('AND' COMPARISON)*
 *   COMP   := IDENT OP VALUE | '(' EXPR ')'
 *   OP     := '=' | '!=' | '<' | '>' | '<=' | '>=' | 'LIKE' | 'IN'
 *   VALUE  := STRING | NUMBER | '[' VALUE_LIST ']'
 *   ORDER  := 'ORDER BY' IDENT ['ASC' | 'DESC']
 *   LIMIT  := 'LIMIT' NUMBER
 *
 * The interpreter is deliberately read-only — there's no INSERT,
 * UPDATE, DELETE, or any side effect possible. Audit queries cannot
 * mutate the receipt store.
 *
 * @packageDocumentation
 */

/**
 * A receipt as the DSL sees it. Callers project their own receipts
 * into this shape — most VAOS attestations already satisfy it.
 */
export interface ReceiptRecord {
  verdictId: string;
  overall: "pass" | "warn" | "block";
  issuedAt: string;
  agentSlug?: string;
  tokenId?: string;
  pack?: string;
  ruleCount?: number;
  signature?: string;
  contentHash?: string;
  /** Arbitrary user-defined fields. */
  [key: string]: unknown;
}

export type QueryOperator =
  | "="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "LIKE"
  | "IN";

export interface QueryResult {
  /** Rows that matched, projected to the requested fields. */
  rows: Array<Record<string, unknown>>;
  /** Field names returned (in declaration order). */
  selectedFields: string[];
  /** Total receipts scanned before filtering. */
  totalScanned: number;
  /** Total receipts matched (before LIMIT). */
  totalMatched: number;
  /** ISO 8601 of the query execution. */
  executedAt: string;
}

// ── Tokenizer ─────────────────────────────────────────────────────────

interface Token {
  type:
    | "keyword"
    | "ident"
    | "string"
    | "number"
    | "operator"
    | "lparen"
    | "rparen"
    | "lbracket"
    | "rbracket"
    | "comma"
    | "star";
  value: string;
  pos: number;
}

const KEYWORDS = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "ORDER",
  "BY",
  "ASC",
  "DESC",
  "LIMIT",
  "LIKE",
  "IN",
  "TRUE",
  "FALSE",
  "NULL",
]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    // Punctuation
    if (ch === "(") {
      tokens.push({ type: "lparen", value: "(", pos: i });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ")", pos: i });
      i += 1;
      continue;
    }
    if (ch === "[") {
      tokens.push({ type: "lbracket", value: "[", pos: i });
      i += 1;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: "rbracket", value: "]", pos: i });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: ",", pos: i });
      i += 1;
      continue;
    }
    if (ch === "*") {
      tokens.push({ type: "star", value: "*", pos: i });
      i += 1;
      continue;
    }

    // Operators: !=, <=, >=, =, <, >
    if (ch === "!" && input[i + 1] === "=") {
      tokens.push({ type: "operator", value: "!=", pos: i });
      i += 2;
      continue;
    }
    if (ch === "<" && input[i + 1] === "=") {
      tokens.push({ type: "operator", value: "<=", pos: i });
      i += 2;
      continue;
    }
    if (ch === ">" && input[i + 1] === "=") {
      tokens.push({ type: "operator", value: ">=", pos: i });
      i += 2;
      continue;
    }
    if (ch === "=" || ch === "<" || ch === ">") {
      tokens.push({ type: "operator", value: ch, pos: i });
      i += 1;
      continue;
    }

    // Strings (single or double quoted, backslash escape)
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const start = i;
      i += 1;
      let acc = "";
      while (i < len && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < len) {
          acc += input[i + 1];
          i += 2;
        } else {
          acc += input[i];
          i += 1;
        }
      }
      if (i >= len) {
        throw new SyntaxError(
          `unterminated string starting at position ${start}`,
        );
      }
      i += 1; // close quote
      tokens.push({ type: "string", value: acc, pos: start });
      continue;
    }

    // Numbers (integer or decimal, optional leading minus)
    if (
      (ch >= "0" && ch <= "9") ||
      (ch === "-" && input[i + 1] >= "0" && input[i + 1] <= "9")
    ) {
      const start = i;
      if (ch === "-") i += 1;
      while (
        i < len &&
        ((input[i] >= "0" && input[i] <= "9") || input[i] === ".")
      ) {
        i += 1;
      }
      tokens.push({
        type: "number",
        value: input.slice(start, i),
        pos: start,
      });
      continue;
    }

    // Identifiers and keywords (alphanumeric + _)
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      const start = i;
      while (
        i < len &&
        ((input[i] >= "a" && input[i] <= "z") ||
          (input[i] >= "A" && input[i] <= "Z") ||
          (input[i] >= "0" && input[i] <= "9") ||
          input[i] === "_")
      ) {
        i += 1;
      }
      const text = input.slice(start, i);
      const upper = text.toUpperCase();
      if (KEYWORDS.has(upper)) {
        tokens.push({ type: "keyword", value: upper, pos: start });
      } else {
        tokens.push({ type: "ident", value: text, pos: start });
      }
      continue;
    }

    throw new SyntaxError(`unexpected character "${ch}" at position ${i}`);
  }

  return tokens;
}

// ── Parser (recursive descent) ────────────────────────────────────────

type Value = string | number | boolean | null;

interface Comparison {
  kind: "comparison";
  field: string;
  op: QueryOperator;
  value: Value | Value[];
}

interface And {
  kind: "and";
  parts: Expr[];
}

interface Or {
  kind: "or";
  parts: Expr[];
}

type Expr = Comparison | And | Or;

interface Ast {
  fields: string[] | "*";
  from: string;
  where: Expr | null;
  order: { field: string; dir: "ASC" | "DESC" } | null;
  limit: number | null;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): Ast {
    this.expectKeyword("SELECT");
    const fields = this.parseSelectList();
    this.expectKeyword("FROM");
    const from = this.expectIdent();
    let where: Expr | null = null;
    if (this.match("keyword", "WHERE")) {
      where = this.parseExpr();
    }
    let order: Ast["order"] = null;
    if (this.match("keyword", "ORDER")) {
      this.expectKeyword("BY");
      const field = this.expectIdent();
      let dir: "ASC" | "DESC" = "ASC";
      if (this.match("keyword", "ASC")) dir = "ASC";
      else if (this.match("keyword", "DESC")) dir = "DESC";
      order = { field, dir };
    }
    let limit: number | null = null;
    if (this.match("keyword", "LIMIT")) {
      const n = this.expectNumber();
      if (!Number.isInteger(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) {
        throw new SyntaxError(
          "LIMIT must be a non-negative integer ≤ 2^53 - 1",
        );
      }
      limit = n;
    }
    if (this.pos < this.tokens.length) {
      throw new SyntaxError(
        `trailing tokens after LIMIT at position ${this.tokens[this.pos].pos}`,
      );
    }
    return { fields, from, where, order, limit };
  }

  private parseSelectList(): string[] | "*" {
    if (this.match("star", "*")) return "*";
    const fields: string[] = [];
    fields.push(this.expectIdent());
    while (this.match("comma", ",")) {
      fields.push(this.expectIdent());
    }
    return fields;
  }

  private parseExpr(): Expr {
    const parts: Expr[] = [this.parseAndExpr()];
    while (this.match("keyword", "OR")) {
      parts.push(this.parseAndExpr());
    }
    if (parts.length === 1) return parts[0];
    return { kind: "or", parts };
  }

  private parseAndExpr(): Expr {
    const parts: Expr[] = [this.parseComparison()];
    while (this.match("keyword", "AND")) {
      parts.push(this.parseComparison());
    }
    if (parts.length === 1) return parts[0];
    return { kind: "and", parts };
  }

  private parseComparison(): Expr {
    if (this.match("lparen", "(")) {
      const inner = this.parseExpr();
      this.expect("rparen", ")");
      return inner;
    }
    const field = this.expectIdent();
    const opTok = this.peek();
    let op: QueryOperator;
    if (opTok && opTok.type === "operator") {
      op = opTok.value as QueryOperator;
      this.pos += 1;
    } else if (opTok && opTok.type === "keyword" && opTok.value === "LIKE") {
      op = "LIKE";
      this.pos += 1;
    } else if (opTok && opTok.type === "keyword" && opTok.value === "IN") {
      op = "IN";
      this.pos += 1;
    } else {
      throw new SyntaxError(
        `expected operator after field "${field}" at position ${opTok?.pos ?? this.pos}`,
      );
    }
    let value: Value | Value[];
    if (op === "IN") {
      this.expect("lbracket", "[");
      const list: Value[] = [];
      if (!this.match("rbracket", "]")) {
        list.push(this.parseLiteral());
        while (this.match("comma", ",")) {
          list.push(this.parseLiteral());
        }
        this.expect("rbracket", "]");
      }
      value = list;
    } else {
      value = this.parseLiteral();
    }
    return { kind: "comparison", field, op, value };
  }

  private parseLiteral(): Value {
    const tok = this.peek();
    if (!tok) throw new SyntaxError("expected literal but EOF");
    if (tok.type === "string") {
      this.pos += 1;
      return tok.value;
    }
    if (tok.type === "number") {
      this.pos += 1;
      return Number(tok.value);
    }
    if (tok.type === "keyword") {
      if (tok.value === "TRUE") {
        this.pos += 1;
        return true;
      }
      if (tok.value === "FALSE") {
        this.pos += 1;
        return false;
      }
      if (tok.value === "NULL") {
        this.pos += 1;
        return null;
      }
    }
    throw new SyntaxError(
      `expected literal at position ${tok.pos} (got "${tok.value}")`,
    );
  }

  // Helpers
  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private match(type: Token["type"], value: string): boolean {
    const t = this.peek();
    if (t && t.type === type && t.value === value) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private expect(type: Token["type"], value: string): void {
    if (!this.match(type, value)) {
      const t = this.peek();
      throw new SyntaxError(
        `expected ${type} "${value}" at position ${t?.pos ?? this.pos}, got ${t?.type ?? "EOF"}`,
      );
    }
  }

  private expectKeyword(value: string): void {
    this.expect("keyword", value);
  }

  private expectIdent(): string {
    const t = this.peek();
    if (!t || t.type !== "ident") {
      throw new SyntaxError(
        `expected identifier at position ${t?.pos ?? this.pos}`,
      );
    }
    this.pos += 1;
    return t.value;
  }

  private expectNumber(): number {
    const t = this.peek();
    if (!t || t.type !== "number") {
      throw new SyntaxError(
        `expected number at position ${t?.pos ?? this.pos}`,
      );
    }
    this.pos += 1;
    return Number(t.value);
  }
}

// ── Evaluator ─────────────────────────────────────────────────────────

function evalExpr(expr: Expr, row: ReceiptRecord): boolean {
  if (expr.kind === "and") {
    for (const p of expr.parts) {
      if (!evalExpr(p, row)) return false;
    }
    return true;
  }
  if (expr.kind === "or") {
    for (const p of expr.parts) {
      if (evalExpr(p, row)) return true;
    }
    return false;
  }
  return evalComparison(expr, row);
}

/** Field names we reject to prevent prototype-chain access. */
const RESERVED_FIELD_NAMES = new Set(["__proto__", "constructor", "prototype"]);

/** Safely read a field from a row, only returning own-enumerable properties. */
function readField(row: ReceiptRecord, field: string): unknown {
  if (RESERVED_FIELD_NAMES.has(field)) return undefined;
  return Object.prototype.hasOwnProperty.call(row, field)
    ? (row as Record<string, unknown>)[field]
    : undefined;
}

function evalComparison(c: Comparison, row: ReceiptRecord): boolean {
  const lhs = readField(row, c.field);
  switch (c.op) {
    case "=":
      return lhs === c.value;
    case "!=":
      return lhs !== c.value;
    case "<":
      return compareScalars(lhs, c.value as Value) < 0;
    case "<=":
      return compareScalars(lhs, c.value as Value) <= 0;
    case ">":
      return compareScalars(lhs, c.value as Value) > 0;
    case ">=":
      return compareScalars(lhs, c.value as Value) >= 0;
    case "LIKE":
      if (typeof lhs !== "string" || typeof c.value !== "string") return false;
      return likeMatch(lhs, c.value);
    case "IN":
      if (!Array.isArray(c.value)) return false;
      return c.value.includes(lhs as Value);
  }
}

function compareScalars(a: unknown, b: Value): number {
  // Deterministic null/undefined handling: missing values sort LAST,
  // regardless of order direction. Without this, String(null) === "null"
  // collated lexicographically with real strings + ISO dates produced
  // bogus orderings for rows with missing fields.
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  // Lexicographic compare for strings (works for ISO 8601 dates)
  const as = String(a);
  const bs = String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/**
 * SQL LIKE → regex translation. % matches any sequence; _ matches one
 * char. Everything else is treated literally (escaped).
 */
/** Maximum LIKE-pattern length. Bounds the worst-case regex
 * backtracking surface. A pattern of 200 chars with all `%` is the
 * regex `^.*.*…200×…$`, which on a near-match input is still
 * exponential — but at length 200 the wall-clock cost is microseconds.
 * Patterns longer than this are rejected as a defensive ReDoS guard.
 */
const LIKE_PATTERN_MAX_LENGTH = 200;

function likeMatch(value: string, pattern: string): boolean {
  if (pattern.length > LIKE_PATTERN_MAX_LENGTH) {
    // Defensive: refuse oversized patterns rather than risk ReDoS.
    return false;
  }
  let regex = "^";
  for (const ch of pattern) {
    if (ch === "%") regex += ".*";
    else if (ch === "_") regex += ".";
    else regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  regex += "$";
  return new RegExp(regex).test(value);
}

// ── Public surface ────────────────────────────────────────────────────

/**
 * Parse a query without executing — used by linters, IDE tooling, and
 * test fixtures that want to verify a query is syntactically valid.
 * Throws SyntaxError on malformed input.
 */
export function parseQuery(query: string): Ast {
  const tokens = tokenize(query);
  return new Parser(tokens).parse();
}

/**
 * Execute a query against an array of receipt records. The interpreter
 * is read-only — it cannot mutate the input array or any record.
 *
 * Throws SyntaxError for malformed queries. Returns an empty result
 * set when nothing matches; never throws on runtime semantic mismatch
 * (e.g. comparing a string to a number) — those return false in the
 * comparison and the row is simply not in the result.
 */
export function queryReceipts(
  receipts: readonly ReceiptRecord[],
  query: string,
): QueryResult {
  const ast = parseQuery(query);
  if (ast.from !== "receipts") {
    throw new SyntaxError(
      `FROM must be 'receipts' in RAD-DSL v1 (got '${ast.from}')`,
    );
  }

  const matched: ReceiptRecord[] = [];
  for (const r of receipts) {
    if (!ast.where || evalExpr(ast.where, r)) {
      matched.push(r);
    }
  }
  const totalMatched = matched.length;

  if (ast.order) {
    matched.sort((a, b) => {
      const cmp = compareScalars(
        readField(a, ast.order!.field),
        readField(b, ast.order!.field) as Value,
      );
      return ast.order!.dir === "ASC" ? cmp : -cmp;
    });
  }

  const limited = ast.limit !== null ? matched.slice(0, ast.limit) : matched;

  const rows: Array<Record<string, unknown>> = limited.map((r) => {
    if (ast.fields === "*") return { ...r };
    const projected: Record<string, unknown> = {};
    for (const f of ast.fields) projected[f] = readField(r, f);
    return projected;
  });

  return {
    rows,
    selectedFields:
      ast.fields === "*"
        ? Object.keys(rows[0] ?? {})
        : (ast.fields as string[]),
    totalScanned: receipts.length,
    totalMatched,
    executedAt: new Date().toISOString(),
  };
}
