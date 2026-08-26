/**
 * Receipt-Audit DSL tests.
 *
 * Public proof corpus that auditors can `npm test` to validate the
 * parser + evaluator semantics. Covers:
 *   - SELECT * + SELECT field-list + invalid field names
 *   - WHERE: =, !=, <, >, <=, >=, LIKE (with % and _), IN
 *   - AND / OR / parenthesized precedence
 *   - ORDER BY ASC / DESC across strings + numbers + ISO dates
 *   - LIMIT (zero, normal, larger than match count)
 *   - String escaping in literals (single + double quotes)
 *   - Read-only safety (no INSERT/UPDATE/DELETE keywords accepted)
 *   - Malformed input rejected with SyntaxError
 */
import { describe, it, expect } from "vitest";
import {
  queryReceipts,
  parseQuery,
  type ReceiptRecord,
} from "../src/audit-dsl.js";

const FIXTURES: ReceiptRecord[] = [
  {
    verdictId: "v_001",
    overall: "pass",
    issuedAt: "2026-04-15T10:00:00Z",
    agentSlug: "loan-underwriter",
    pack: "hipaa-2026",
    ruleCount: 4,
  },
  {
    verdictId: "v_002",
    overall: "block",
    issuedAt: "2026-04-20T11:30:00Z",
    agentSlug: "hiring-screen",
    pack: "nyc-aedt-2026",
    ruleCount: 3,
  },
  {
    verdictId: "v_003",
    overall: "warn",
    issuedAt: "2026-05-01T09:15:00Z",
    agentSlug: "loan-underwriter",
    pack: "cfpb-2026",
    ruleCount: 5,
  },
  {
    verdictId: "v_004",
    overall: "block",
    issuedAt: "2026-05-10T14:00:00Z",
    agentSlug: "biometric-match",
    pack: "us-texas-ai-2025",
    ruleCount: 3,
  },
  {
    verdictId: "v_005",
    overall: "pass",
    issuedAt: "2026-05-18T08:00:00Z",
    agentSlug: "clinical-scribe",
    pack: "ambient-clinical-scribe-2026",
    ruleCount: 3,
  },
];

describe("parseQuery — syntactic validation", () => {
  it("parses SELECT * FROM receipts", () => {
    const ast = parseQuery("SELECT * FROM receipts");
    expect(ast.fields).toBe("*");
    expect(ast.from).toBe("receipts");
    expect(ast.where).toBeNull();
  });

  it("parses SELECT field-list FROM receipts", () => {
    const ast = parseQuery(
      "SELECT verdictId, agentSlug, overall FROM receipts",
    );
    expect(ast.fields).toEqual(["verdictId", "agentSlug", "overall"]);
  });

  it("parses single WHERE clause", () => {
    const ast = parseQuery("SELECT * FROM receipts WHERE overall = 'block'");
    expect(ast.where).toMatchObject({
      kind: "comparison",
      field: "overall",
      op: "=",
      value: "block",
    });
  });

  it("parses AND chain", () => {
    const ast = parseQuery(
      "SELECT * FROM receipts WHERE overall = 'block' AND ruleCount > 2",
    );
    expect((ast.where as { kind: string }).kind).toBe("and");
  });

  it("parses OR chain", () => {
    const ast = parseQuery(
      "SELECT * FROM receipts WHERE overall = 'block' OR overall = 'warn'",
    );
    expect((ast.where as { kind: string }).kind).toBe("or");
  });

  it("parses parenthesized expressions", () => {
    const ast = parseQuery(
      "SELECT * FROM receipts WHERE (overall = 'block' OR overall = 'warn') AND ruleCount > 2",
    );
    expect((ast.where as { kind: string }).kind).toBe("and");
  });

  it("parses ORDER BY + LIMIT", () => {
    const ast = parseQuery(
      "SELECT * FROM receipts ORDER BY issuedAt DESC LIMIT 10",
    );
    expect(ast.order).toEqual({ field: "issuedAt", dir: "DESC" });
    expect(ast.limit).toBe(10);
  });

  it("parses IN with literal list", () => {
    const ast = parseQuery(
      "SELECT * FROM receipts WHERE pack IN ['hipaa-2026', 'cfpb-2026']",
    );
    expect((ast.where as { value: unknown[] }).value).toEqual([
      "hipaa-2026",
      "cfpb-2026",
    ]);
  });

  it("parses LIKE pattern", () => {
    const ast = parseQuery(
      "SELECT * FROM receipts WHERE agentSlug LIKE 'loan%'",
    );
    expect((ast.where as { op: string }).op).toBe("LIKE");
  });

  it("rejects missing SELECT", () => {
    expect(() => parseQuery("FROM receipts")).toThrow(SyntaxError);
  });

  it("rejects missing FROM", () => {
    expect(() => parseQuery("SELECT *")).toThrow(SyntaxError);
  });

  it("rejects unterminated string literal", () => {
    expect(() =>
      parseQuery("SELECT * FROM receipts WHERE overall = 'block"),
    ).toThrow(SyntaxError);
  });

  it("rejects trailing garbage after LIMIT", () => {
    expect(() => parseQuery("SELECT * FROM receipts LIMIT 10 garbage")).toThrow(
      SyntaxError,
    );
  });

  it("rejects negative LIMIT", () => {
    expect(() => parseQuery("SELECT * FROM receipts LIMIT -1")).toThrow(
      SyntaxError,
    );
  });

  it("rejects unknown FROM target (read-only safety)", () => {
    // Even if parsed, executor refuses any FROM other than 'receipts'.
    expect(() => queryReceipts([], "SELECT * FROM secrets")).toThrow(
      /FROM must be/,
    );
  });

  it("rejects unknown character in input", () => {
    expect(() => parseQuery("SELECT @ FROM receipts")).toThrow(SyntaxError);
  });
});

describe("queryReceipts — SELECT semantics", () => {
  it("SELECT * returns all rows", () => {
    const r = queryReceipts(FIXTURES, "SELECT * FROM receipts");
    expect(r.totalScanned).toBe(5);
    expect(r.totalMatched).toBe(5);
    expect(r.rows.length).toBe(5);
  });

  it("SELECT field projects only those fields", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT verdictId, overall FROM receipts",
    );
    expect(r.selectedFields).toEqual(["verdictId", "overall"]);
    expect(Object.keys(r.rows[0]).sort()).toEqual(["overall", "verdictId"]);
  });

  it("totalScanned is always input length, regardless of filter", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE overall = 'block'",
    );
    expect(r.totalScanned).toBe(5);
    expect(r.totalMatched).toBe(2);
  });

  it("executedAt is set on every query", () => {
    const r = queryReceipts(FIXTURES, "SELECT * FROM receipts");
    expect(r.executedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    );
  });
});

describe("queryReceipts — WHERE operators", () => {
  it("= matches exactly one value", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE overall = 'block'",
    );
    expect(r.rows.length).toBe(2);
  });

  it("!= excludes matching rows", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE overall != 'pass'",
    );
    expect(r.rows.length).toBe(3); // 2 block + 1 warn
  });

  it("< and > on numeric fields", () => {
    const lt = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE ruleCount < 4",
    );
    expect(lt.rows.length).toBe(3);
    const gt = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE ruleCount > 3",
    );
    expect(gt.rows.length).toBe(2);
  });

  it("<= and >= on ISO date strings (lexicographic compare)", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE issuedAt >= '2026-05-01T00:00:00Z'",
    );
    expect(r.rows.length).toBe(3);
  });

  it("LIKE with % matches any sequence", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE agentSlug LIKE 'loan%'",
    );
    expect(r.rows.length).toBe(2);
  });

  it("LIKE with _ matches exactly one character", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE overall LIKE 'p_ss'",
    );
    expect(r.rows.length).toBe(2);
  });

  it("LIKE escapes regex metacharacters", () => {
    const r = queryReceipts(
      [{ verdictId: "x", overall: "pass", issuedAt: "z", agentSlug: "a.b" }],
      "SELECT * FROM receipts WHERE agentSlug LIKE 'a.b'",
    );
    expect(r.rows.length).toBe(1);
    const r2 = queryReceipts(
      [{ verdictId: "x", overall: "pass", issuedAt: "z", agentSlug: "axb" }],
      "SELECT * FROM receipts WHERE agentSlug LIKE 'a.b'",
    );
    expect(r2.rows.length).toBe(0); // '.' must be literal, not match any char
  });

  it("LIKE terminates on a pattern that used to hang the process", () => {
    // The matcher compiled LIKE to a regex where every % became `.*`,
    // which backtracks exponentially on a near-match. Measured against
    // this exact 41-char value, inside the 200-char cap:
    //   "%a" x 6  (12 chars) ->      51 ms
    //   "%a" x 8  (16 chars) ->   1,247 ms
    //   "%a" x 10 (20 chars) ->  16,937 ms
    // Roughly 13x per four characters. The trust page invites auditors
    // to paste queries, so that was a hang anyone could trigger.
    const rows = [
      {
        verdictId: "x",
        overall: "pass",
        issuedAt: "z",
        agentSlug: "a".repeat(40) + "!",
      },
    ];
    for (const repeats of [10, 50, 100]) {
      const pattern = "%a".repeat(repeats).slice(0, 200);
      const started = Date.now();
      const r = queryReceipts(
        rows,
        `SELECT * FROM receipts WHERE agentSlug LIKE '${pattern}'`,
      );
      const elapsed = Date.now() - started;
      expect(r.rows.length).toBe(0);
      // Generous by three orders of magnitude versus the old 16.9 s, and
      // still fails loudly if the regex matcher ever comes back.
      expect(elapsed, `${pattern.length}-char pattern took ${elapsed}ms`).toBeLessThan(250);
    }
  });

  it("LIKE spans newlines, as SQL specifies", () => {
    // The regex version used `.`, which does not match a newline in
    // JavaScript, so _ and % silently failed on multi-line values. The
    // scan compares characters directly and matches them.
    const rows = [
      { verdictId: "x", overall: "pass", issuedAt: "z", agentSlug: "a\nb" },
    ];
    expect(
      queryReceipts(rows, "SELECT * FROM receipts WHERE agentSlug LIKE 'a_b'").rows.length,
    ).toBe(1);
    expect(
      queryReceipts(rows, "SELECT * FROM receipts WHERE agentSlug LIKE 'a%b'").rows.length,
    ).toBe(1);
  });

  it("LIKE handles the wildcard edge cases", () => {
    const one = (slug: string, pattern: string) =>
      queryReceipts(
        [{ verdictId: "x", overall: "pass", issuedAt: "z", agentSlug: slug }],
        `SELECT * FROM receipts WHERE agentSlug LIKE '${pattern}'`,
      ).rows.length;

    expect(one("abc", "%"), "% matches everything").toBe(1);
    expect(one("abc", "%%%"), "repeated % collapses").toBe(1);
    expect(one("abc", "%a%b%c%"), "interleaved wildcards").toBe(1);
    expect(one("aaa", "%a"), "trailing literal after greedy %").toBe(1);
    expect(one("abc", "abc%"), "trailing % matches empty").toBe(1);
    expect(one("abc", "____"), "too many _ must not match").toBe(0);
    expect(one("abc", "ab"), "a prefix is not a match without %").toBe(0);
  });

  it("IN matches against a list", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE pack IN ['hipaa-2026', 'cfpb-2026']",
    );
    expect(r.rows.length).toBe(2);
  });

  it("IN with empty list matches nothing", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE overall IN []",
    );
    expect(r.rows.length).toBe(0);
  });
});

describe("queryReceipts — AND / OR / precedence", () => {
  it("AND requires both conditions", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE overall = 'block' AND ruleCount = 3",
    );
    expect(r.rows.length).toBe(2);
  });

  it("OR matches either condition", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE overall = 'block' OR overall = 'warn'",
    );
    expect(r.rows.length).toBe(3);
  });

  it("parenthesized OR binds correctly inside AND", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE (overall = 'block' OR overall = 'warn') AND agentSlug = 'loan-underwriter'",
    );
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].verdictId).toBe("v_003");
  });

  it("AND has higher precedence than OR (parens not needed)", () => {
    // overall=pass AND agentSlug=clinical-scribe → 1 row (v_005)
    // ...OR overall=block → 2 more rows
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE overall = 'pass' AND agentSlug = 'clinical-scribe' OR overall = 'block'",
    );
    expect(r.rows.length).toBe(3);
  });
});

describe("queryReceipts — ORDER BY + LIMIT", () => {
  it("ORDER BY ASC on ISO date sorts chronologically", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT verdictId FROM receipts ORDER BY issuedAt ASC",
    );
    expect(r.rows.map((row) => row.verdictId)).toEqual([
      "v_001",
      "v_002",
      "v_003",
      "v_004",
      "v_005",
    ]);
  });

  it("ORDER BY DESC reverses", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT verdictId FROM receipts ORDER BY issuedAt DESC",
    );
    expect(r.rows.map((row) => row.verdictId)).toEqual([
      "v_005",
      "v_004",
      "v_003",
      "v_002",
      "v_001",
    ]);
  });

  it("LIMIT caps the result set", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts ORDER BY issuedAt DESC LIMIT 2",
    );
    expect(r.rows.length).toBe(2);
    expect(r.totalMatched).toBe(5); // total before LIMIT
  });

  it("LIMIT 0 returns no rows", () => {
    const r = queryReceipts(FIXTURES, "SELECT * FROM receipts LIMIT 0");
    expect(r.rows.length).toBe(0);
    expect(r.totalMatched).toBe(5);
  });

  it("LIMIT larger than match count returns all matches", () => {
    const r = queryReceipts(FIXTURES, "SELECT * FROM receipts LIMIT 999");
    expect(r.rows.length).toBe(5);
  });
});

describe("queryReceipts — string literal escaping", () => {
  it("supports double-quoted strings", () => {
    const r = queryReceipts(
      FIXTURES,
      'SELECT * FROM receipts WHERE overall = "block"',
    );
    expect(r.rows.length).toBe(2);
  });

  it("supports backslash-escaped quote inside string", () => {
    const ast = parseQuery(
      "SELECT * FROM receipts WHERE agentSlug = 'it\\'s-fine'",
    );
    expect((ast.where as { value: unknown }).value).toBe("it's-fine");
  });
});

describe("queryReceipts — read-only safety", () => {
  it("rejects INSERT (not in grammar)", () => {
    expect(() => parseQuery("INSERT INTO receipts VALUES (1)")).toThrow(
      SyntaxError,
    );
  });

  it("rejects UPDATE", () => {
    expect(() => parseQuery("UPDATE receipts SET overall = 'pass'")).toThrow(
      SyntaxError,
    );
  });

  it("rejects DELETE", () => {
    expect(() => parseQuery("DELETE FROM receipts")).toThrow(SyntaxError);
  });

  it("does not mutate the input array", () => {
    const before = JSON.stringify(FIXTURES);
    queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts ORDER BY issuedAt DESC LIMIT 2",
    );
    expect(JSON.stringify(FIXTURES)).toBe(before);
  });
});

describe("queryReceipts — runtime semantic robustness", () => {
  it("missing field on a row evaluates to undefined → never matches", () => {
    const r = queryReceipts(
      [{ verdictId: "x", overall: "pass", issuedAt: "z" }],
      "SELECT * FROM receipts WHERE pack = 'hipaa-2026'",
    );
    expect(r.rows.length).toBe(0);
  });

  it("comparing number field to string returns false (no exception)", () => {
    const r = queryReceipts(
      FIXTURES,
      "SELECT * FROM receipts WHERE ruleCount = 'three'",
    );
    expect(r.rows.length).toBe(0);
  });

  it("empty receipt set returns empty result without error", () => {
    const r = queryReceipts(
      [],
      "SELECT * FROM receipts WHERE overall = 'block'",
    );
    expect(r.rows.length).toBe(0);
    expect(r.totalMatched).toBe(0);
  });
});
