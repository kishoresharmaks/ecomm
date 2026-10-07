/**
 * CSV Sanitization and Serialization Utility
 *
 * Protects exported CSV documents against spreadsheet formula injection (CWE-1236)
 * while ensuring compliance with RFC 4180 delimiter escaping.
 */

/**
 * Sanitizes a single cell value to neutralize spreadsheet formula injection (CWE-1236).
 *
 * If a cell string starts with a formula trigger character (=, +, -, @, \t, \r),
 * a single quote (') is prepended so that spreadsheet viewers (Excel, LibreOffice Calc,
 * Google Sheets) treat the cell content strictly as plain text rather than an executable formula.
 *
 * Pure numeric values (e.g. -100 or 50.25) are preserved as numbers.
 * Internal double quotes are escaped as `""` and the cell is enclosed in double quotes.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return `"${value}"`;
  }

  const str = String(value);
  const escaped = str.replace(/"/g, '""');

  if (/^[=+\-@\t\r]/.test(str)) {
    // Preserve genuine numeric strings (like "-50" or "-100.25") while neutralizing
    // formulas and command execution strings (like "=1+2", "@SUM", "-1+2", "+cmd", etc.)
    if (/^[=@\t\r]/.test(str) || !/^[+-]?\d+(\.\d+)?$/.test(str.trim())) {
      return `"'${escaped}"`;
    }
  }

  return `"${escaped}"`;
}

/**
 * Formats a two-dimensional array of rows into an RFC-4180-compliant, formula-safe CSV string.
 */
export function formatCsvRows(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\n");
}
