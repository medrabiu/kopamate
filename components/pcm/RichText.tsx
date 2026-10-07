import { parseRichText } from "@/lib/pcm-rules";

/** Admin-written text: plain text with **bold** and https links only. React escapes everything else. */
export default function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((p, i) =>
        p.t === "bold" ? (
          <strong key={i} className="font-bold text-ink">
            {p.v}
          </strong>
        ) : p.t === "link" ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-lime-ink underline">
            {p.v}
          </a>
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </>
  );
}
