/**
 * Escapes all special regex metacharacters in a string so it can be
 * safely embedded in a MongoDB $regex query or a JS RegExp constructor.
 *
 * Characters escaped: . * + ? ^ $ { } ( ) | [ ] \
 *
 * Also hard-caps the input to 100 characters to prevent regex-based DoS.
 */
export function escapeRegex(s: string): string {
  const capped = s.slice(0, 100);
  // eslint-disable-next-line no-useless-escape
  return capped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
