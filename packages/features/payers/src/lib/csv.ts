/**
 * Minimal RFC4180-ish CSV parser/serializer. No external dependency --
 * payer directory data is simple tabular data with no nested structures.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\r') {
      // skip; \n (or end of text) terminates the row
    } else if (char === '\n') {
      pushRow();
    } else {
      field += char;
    }
  }

  // final field/row if the text didn't end with a newline
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

export function parseCsvToRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const [header, ...rest] = rows;

  if (!header) {
    return [];
  }

  return rest.map((row) =>
    Object.fromEntries(header.map((key, i) => [key.trim(), (row[i] ?? '').trim()])),
  );
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [header.map(csvEscape).join(',')];

  for (const row of rows) {
    lines.push(row.map((value) => csvEscape(value === null || value === undefined ? '' : String(value))).join(','));
  }

  return lines.join('\r\n');
}
