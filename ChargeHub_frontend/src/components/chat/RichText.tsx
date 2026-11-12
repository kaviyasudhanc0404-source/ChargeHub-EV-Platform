import { Fragment, useMemo } from "react";
import { parseBlocks, parseInline } from "@/lib/markdown";
import { cn } from "@/lib/utils";

const Line = ({ text }: { text: string }) => (
  <>
    {parseInline(text).map((piece, i) =>
      piece.kind === "bold" ? (
        <strong key={i} className="font-semibold text-foreground">{piece.text}</strong>
      ) : piece.kind === "italic" ? (
        <em key={i}>{piece.text}</em>
      ) : piece.kind === "code" ? (
        <code key={i} className="rounded-md bg-ai/10 px-1.5 py-0.5 font-mono text-[0.85em] text-ai">{piece.text}</code>
      ) : (
        <Fragment key={i}>{piece.text}</Fragment>
      )
    )}
  </>
);

// An assistant reply: short paragraphs, headings and lists with aurora bullets
const RichText = ({ text }: { text: string }) => {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="space-y-2.5 text-[0.9rem] leading-relaxed text-foreground/90">
      {blocks.map((block, i) => {
        if (!("items" in block)) {
          return <p key={i} className={cn(block.type === "h" && "pt-1 font-display text-sm font-semibold text-foreground")}><Line text={block.text} /></p>;
        }
        const List = block.type === "ul" ? "ul" : "ol";
        return (
          <List key={i} className="space-y-1.5">
            {block.items.map((item, j) => (
              <li key={j} className="flex gap-2.5">
                {block.type === "ul" ? (
                  <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-ai to-ai-2" />
                ) : (
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-ai/15 text-[11px] font-semibold text-ai">{j + 1}</span>
                )}
                <span className="min-w-0"><Line text={item} /></span>
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
};

export default RichText;
