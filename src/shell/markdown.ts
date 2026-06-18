/**
 * Minimal Markdown → HTML renderer for the in-game guide overlay. Covers exactly
 * the constructs used by docs/character-guide.md and docs/item-guide.md —
 * headings, GFM tables, blockquotes, hr, bullet lists, images, **bold**.
 * Input is our own trusted docs (not user input), but text is still escaped.
 *
 * `imgBase` rewrites `img/…` image sources to the bundled location
 * (e.g. `${BASE_URL}guide/`) so the guide pictures resolve under GitHub Pages.
 */
export function renderMarkdown(md: string, opts: { imgBase?: string } = {}): string {
  const imgBase = opts.imgBase ?? '';

  const escape = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inline = (s: string): string =>
    escape(s)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) =>
        `<img alt="${alt}" src="${src.replace(/^img\//, imgBase)}">`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const cells = (row: string): string[] =>
    row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  const renderTable = (rows: string[]): string => {
    const head = cells(rows[0]).map((c) => `<th>${inline(c)}</th>`).join('');
    const body = rows.slice(2)
      .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
      .join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };

  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  const flush = (): void => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };

  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();

    if (t === '') { flush(); i++; continue; }
    if (/^---+$/.test(t)) { flush(); out.push('<hr>'); i++; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

    if (t.startsWith('>')) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    if (t.startsWith('|')) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { tbl.push(lines[i].trim()); i++; }
      out.push(renderTable(tbl));
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    para.push(t);
    i++;
  }
  flush();
  return out.join('\n');
}
