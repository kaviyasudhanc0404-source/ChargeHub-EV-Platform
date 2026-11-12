// The small Markdown subset the assistant writes: paragraphs, "###" headings, "-" and "1." lists, **bold**, *italic*
// and `code`. Parsed into blocks rendered as React elements (never raw HTML).
export type Block = { type: "p" | "h"; text: string } | { type: "ul" | "ol"; items: string[] };

const HEADING = /^#{1,6}\s+(.*)$/;
const ITEM = /^(?:([-*•])|\d+[.)])\s+(.*)$/;

export const parseBlocks = (markdown: string): Block[] => {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const heading = line.match(HEADING);
    const item = line.match(ITEM);
    const last = blocks[blocks.length - 1];
    if (!line) flush();
    else if (heading) {
      flush();
      blocks.push({ type: "h", text: heading[1] });
    } else if (item) {
      flush();
      const type = item[1] ? "ul" : "ol";
      if (last?.type === type) last.items.push(item[2]);
      else blocks.push({ type, items: [item[2]] });
    } else if (!paragraph.length && /^\s/.test(raw) && (last?.type === "ul" || last?.type === "ol")) {
      last.items[last.items.length - 1] += ` ${line}`; // wrapped list item
    } else paragraph.push(line);
  }
  flush();
  return blocks;
};

// Inline pieces of one line; stray markers left by the model are dropped
export type Inline = { kind: "text" | "bold" | "italic" | "code"; text: string };
const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/g;

export const parseInline = (text: string): Inline[] =>
  text.split(INLINE).filter(Boolean).map((part) => {
    if (/^(\*\*|__).*\1$/.test(part)) return { kind: "bold", text: part.slice(2, -2) };
    if (/^`.*`$/.test(part)) return { kind: "code", text: part.slice(1, -1) };
    if (/^\*.*\*$/.test(part) && part.length > 2) return { kind: "italic", text: part.slice(1, -1) };
    return { kind: "text", text: part.replace(/\*\*|__/g, "") };
  });

// Plain text for reading aloud
export const toPlainText = (markdown: string) =>
  parseBlocks(markdown)
    .flatMap((block) => ("items" in block ? block.items : [block.text]))
    .map((line) => parseInline(line).map((piece) => piece.text).join("").replace(/[*_`#]/g, ""))
    .map((line) => (/[.!?:।]$/.test(line) ? line : `${line}.`))
    .join(" ");
