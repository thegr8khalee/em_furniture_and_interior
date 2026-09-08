/**
 * Rows to CSV, for handing figures to somebody else's software.
 *
 * An accountant works in a spreadsheet, and a report that can only be looked at
 * on a screen has to be retyped to be used. Retyping is where the errors come
 * from.
 */

/**
 * Quotes a value for CSV.
 *
 * A field containing a comma, a quote or a newline has to be quoted, and a quote
 * inside it doubled — otherwise one product called `Sofa, 3-seat` shifts every
 * column after it on that row and the file silently describes something else.
 */
const escape = (value) => {
  if (value === null || value === undefined) return '';

  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;

  return `"${text.split('"').join('""')}"`;
};

export const toCsv = (columns, rows) => {
  const header = columns.map((column) => escape(column.label ?? column.key)).join(',');

  const body = rows.map((row) =>
    columns.map((column) => escape(column.value ? column.value(row) : row[column.key])).join(',')
  );

  // A trailing newline: some tools drop the last row without one.
  return [header, ...body].join('\r\n') + '\r\n';
};

/** Sends a CSV as a download. */
export const sendCsv = (res, filename, csv) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // A BOM, so Excel opens it as UTF-8 rather than mangling the naira sign.
  res.send('\uFEFF' + csv);
};
