import { avatarColor } from "@/lib/util";

type Props = {
  id: string;
  nickname: string;
  photoVersion?: number;
  size?: number;
  ring?: boolean;
  className?: string;
};

/** Photo if the user uploaded one, otherwise a coloured circle with their first letter. */
export default function Avatar({ id, nickname, photoVersion = 0, size = 40, ring, className = "" }: Props) {
  const ringStyle = ring ? { boxShadow: "0 0 0 3px var(--color-bg), 0 0 0 5px var(--color-lime)" } : undefined;
  if (photoVersion > 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${id}?v=${photoVersion}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size, ...ringStyle }}
      />
    );
  }
  const letter = (nickname.trim()[0] || "?").toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-extrabold text-on-accent ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: avatarColor(id), ...ringStyle }}
    >
      {letter}
    </div>
  );
}
