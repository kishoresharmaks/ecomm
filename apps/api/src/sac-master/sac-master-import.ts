import { createHash } from "node:crypto";

export type SacImportRow = {
  sacCode: string;
  description: string;
};

export type ExistingSacRow = SacImportRow & {
  id: string;
  isActive: boolean;
};

export type SacImportPlan = {
  checksum: string;
  rows: SacImportRow[];
  inserts: SacImportRow[];
  updates: Array<SacImportRow & { id: string; wasActive: boolean }>;
  unchanged: ExistingSacRow[];
  deactivations: ExistingSacRow[];
};

export function parseNormalizedSacCsv(csv: string): SacImportRow[] {
  const [header = [], ...records] = parseCsv(csv);
  const normalizedHeader = header.map((value) => value.trim().toLowerCase());
  const codeIndex = normalizedHeader.findIndex((value) =>
    ["sac_code", "sac", "code"].includes(value),
  );
  const descriptionIndex = normalizedHeader.findIndex((value) =>
    ["description", "service_description", "name"].includes(value),
  );

  if (codeIndex < 0 || descriptionIndex < 0) {
    throw new Error("SAC CSV requires sac_code and description columns.");
  }

  return normalizeSacRows(
    records
      .filter((record) => record.some((value) => value.trim()))
      .map((record) => ({
        sacCode: record[codeIndex] ?? "",
        description: record[descriptionIndex] ?? "",
      })),
  );
}

export function normalizeSacRows(rows: SacImportRow[]): SacImportRow[] {
  const byCode = new Map<string, SacImportRow>();

  for (const raw of rows) {
    const sacCode = String(raw.sacCode ?? "").replace(/\s+/g, "");
    const description = String(raw.description ?? "").replace(/\s+/g, " ").trim();
    if (!/^\d{6}$/.test(sacCode)) {
      throw new Error(`Invalid SAC code "${raw.sacCode}". SAC codes must contain exactly 6 digits.`);
    }
    if (description.length < 3 || description.length > 500) {
      throw new Error(`SAC ${sacCode} requires a description between 3 and 500 characters.`);
    }

    const existing = byCode.get(sacCode);
    if (existing && existing.description !== description) {
      throw new Error(`SAC ${sacCode} appears more than once with different descriptions.`);
    }
    byCode.set(sacCode, { sacCode, description });
  }

  if (!byCode.size) {
    throw new Error("The SAC catalogue file contains no valid rows.");
  }

  return [...byCode.values()].sort((a, b) => a.sacCode.localeCompare(b.sacCode));
}

export function sacImportChecksum(rows: SacImportRow[]) {
  const normalized = normalizeSacRows(rows);
  return createHash("sha256")
    .update(normalized.map((row) => `${row.sacCode}\t${row.description}`).join("\n"))
    .digest("hex");
}

export function planSacImport(
  incomingRows: SacImportRow[],
  existingRows: ExistingSacRow[],
  deactivateMissing: boolean,
): SacImportPlan {
  const rows = normalizeSacRows(incomingRows);
  const incomingByCode = new Map(rows.map((row) => [row.sacCode, row]));
  const existingByCode = new Map(existingRows.map((row) => [row.sacCode, row]));
  const inserts: SacImportPlan["inserts"] = [];
  const updates: SacImportPlan["updates"] = [];
  const unchanged: SacImportPlan["unchanged"] = [];

  for (const row of rows) {
    const existing = existingByCode.get(row.sacCode);
    if (!existing) {
      inserts.push(row);
    } else if (!existing.isActive || existing.description !== row.description) {
      updates.push({ ...row, id: existing.id, wasActive: existing.isActive });
    } else {
      unchanged.push(existing);
    }
  }

  const deactivations = deactivateMissing
    ? existingRows.filter((row) => row.isActive && !incomingByCode.has(row.sacCode))
    : [];

  return {
    checksum: sacImportChecksum(rows),
    rows,
    inserts,
    updates,
    unchanged,
    deactivations,
  };
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) {
    throw new Error("SAC CSV contains an unterminated quoted value.");
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}
