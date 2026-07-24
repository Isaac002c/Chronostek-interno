import { round2 } from "@/lib/finance-rules";

export type DreFormula =
  | { op: "ref"; row: string }
  | { op: "sum"; rows: string[] }
  | { op: "subtract"; left: DreFormula; right: DreFormula }
  | { op: "divide"; numerator: DreFormula; denominator: DreFormula }
  | { op: "percent"; value: DreFormula; base: DreFormula };

export type DreFormulaRow = {
  code: string;
  formula: DreFormula | null;
};

export class DreFormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DreFormulaError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parser fechado: rejeita qualquer operação/campo fora da AST suportada. */
export function parseDreFormula(value: unknown, depth = 0): DreFormula {
  if (depth > 20 || !isRecord(value) || typeof value.op !== "string") {
    throw new DreFormulaError("Fórmula inválida.");
  }

  switch (value.op) {
    case "ref":
      if (typeof value.row !== "string" || !value.row.trim()) {
        throw new DreFormulaError("Referência de linha inválida.");
      }
      return { op: "ref", row: value.row.trim() };
    case "sum":
      if (
        !Array.isArray(value.rows) ||
        value.rows.length === 0 ||
        value.rows.some((row) => typeof row !== "string" || !row.trim())
      ) {
        throw new DreFormulaError("A soma precisa referenciar linhas válidas.");
      }
      return { op: "sum", rows: value.rows.map((row) => String(row).trim()) };
    case "subtract":
      return {
        op: "subtract",
        left: parseDreFormula(value.left, depth + 1),
        right: parseDreFormula(value.right, depth + 1),
      };
    case "divide":
      return {
        op: "divide",
        numerator: parseDreFormula(value.numerator, depth + 1),
        denominator: parseDreFormula(value.denominator, depth + 1),
      };
    case "percent":
      return {
        op: "percent",
        value: parseDreFormula(value.value, depth + 1),
        base: parseDreFormula(value.base, depth + 1),
      };
    default:
      throw new DreFormulaError(`Operação não permitida: ${value.op}.`);
  }
}

export function formulaReferences(formula: DreFormula): string[] {
  switch (formula.op) {
    case "ref":
      return [formula.row];
    case "sum":
      return [...formula.rows];
    case "subtract":
      return [
        ...formulaReferences(formula.left),
        ...formulaReferences(formula.right),
      ];
    case "divide":
      return [
        ...formulaReferences(formula.numerator),
        ...formulaReferences(formula.denominator),
      ];
    case "percent":
      return [
        ...formulaReferences(formula.value),
        ...formulaReferences(formula.base),
      ];
  }
}

/** Valida referências e ciclos antes de publicar uma versão da DRE. */
export function validateDreFormulaRows(rows: DreFormulaRow[]): void {
  const byCode = new Map(rows.map((row) => [row.code, row]));
  if (byCode.size !== rows.length) {
    throw new DreFormulaError("Existem códigos de linha duplicados.");
  }

  for (const row of rows) {
    for (const ref of row.formula ? formulaReferences(row.formula) : []) {
      if (!byCode.has(ref)) {
        throw new DreFormulaError(
          `A linha ${row.code} referencia ${ref}, que não existe.`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (code: string) => {
    if (visiting.has(code)) {
      throw new DreFormulaError(`Ciclo detectado na linha ${code}.`);
    }
    if (visited.has(code)) return;
    visiting.add(code);
    const row = byCode.get(code);
    for (const ref of row?.formula ? formulaReferences(row.formula) : []) {
      if (byCode.get(ref)?.formula) visit(ref);
    }
    visiting.delete(code);
    visited.add(code);
  };
  for (const row of rows) visit(row.code);
}

export function evaluateDreFormulas(
  rows: DreFormulaRow[],
  baseValues: Readonly<Record<string, number>>,
): Record<string, number> {
  validateDreFormulaRows(rows);
  const byCode = new Map(rows.map((row) => [row.code, row]));
  const values: Record<string, number> = { ...baseValues };
  const evaluating = new Set<string>();

  const evaluateNode = (formula: DreFormula): number => {
    switch (formula.op) {
      case "ref":
        return evaluateRow(formula.row);
      case "sum":
        return round2(
          formula.rows.reduce((total, code) => total + evaluateRow(code), 0),
        );
      case "subtract":
        return round2(evaluateNode(formula.left) - evaluateNode(formula.right));
      case "divide": {
        const denominator = evaluateNode(formula.denominator);
        if (denominator === 0) {
          throw new DreFormulaError("Divisão por zero na fórmula da DRE.");
        }
        return round2(evaluateNode(formula.numerator) / denominator);
      }
      case "percent": {
        const base = evaluateNode(formula.base);
        if (base === 0) {
          throw new DreFormulaError("Base zero no cálculo percentual da DRE.");
        }
        return round2((evaluateNode(formula.value) / base) * 100);
      }
    }
  };

  const evaluateRow = (code: string): number => {
    const existing = values[code];
    if (existing !== undefined && !byCode.get(code)?.formula) return existing;
    if (evaluating.has(code)) throw new DreFormulaError(`Ciclo detectado em ${code}.`);
    const row = byCode.get(code);
    if (!row) throw new DreFormulaError(`Linha inexistente: ${code}.`);
    if (!row.formula) return existing ?? 0;
    evaluating.add(code);
    const value = evaluateNode(row.formula);
    evaluating.delete(code);
    values[code] = value;
    return value;
  };

  for (const row of rows) evaluateRow(row.code);
  return values;
}
