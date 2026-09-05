/**
 * A PostgreSQL text array literal.
 *
 * Sequelize's `replacements` expand a JavaScript array into a comma-separated
 * list, which is what `IN (:ids)` wants and exactly wrong for an array column:
 * `tags = :tags` becomes `tags = 'a', 'b'` and fails to parse. This produces
 * the `{"a","b"}` literal the column will accept instead.
 *
 * Quotes and backslashes are escaped, so a tag containing either is stored as
 * written rather than truncating the literal.
 */
export const textArray = (values) => {
  if (!Array.isArray(values)) return '{}';

  const quoted = values
    .filter((value) => value !== null && value !== undefined)
    .map((value) => {
      const escaped = String(value).split('\\').join('\\\\').split('"').join('\\"');
      return `"${escaped}"`;
    });

  return `{${quoted.join(',')}}`;
};
