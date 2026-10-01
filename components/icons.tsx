type P = { size?: number; className?: string; strokeWidth?: number };

function Svg({ size = 22, className, strokeWidth = 2, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </Svg>
);
export const UsersIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-4 3-7 7-7s7 3 7 7" />
    <path d="M16 4a4 4 0 0 1 0 8" />
    <path d="M22 21c0-3-2-6-5-7" />
  </Svg>
);
export const LinkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </Svg>
);
export const GiftIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M5 12v9h14v-9" />
    <path d="M12 8v13" />
    <path d="M12 8C10 4 6 4 6 6.5S12 8 12 8s6-1 6-1.5S14 4 12 8" />
  </Svg>
);
export const UserIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
  </Svg>
);
export const LockIcon = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
export const ArrowUpIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </Svg>
);
export const ArrowDownIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="M19 12l-7 7-7-7" />
  </Svg>
);
export const ChatIcon = (p: P) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" />
  </Svg>
);
export const CopyIcon = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Svg>
);
export const ShareIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <path d="M16 6l-4-4-4 4" />
    <path d="M12 2v13" />
  </Svg>
);
export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
export const ChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);
export const ChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12l5 5 9-10" />
  </Svg>
);
export const CameraIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v12H4z" />
    <circle cx="12" cy="13" r="4" />
  </Svg>
);
export const TrophyIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3" />
  </Svg>
);
export const MedalIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="6" />
    <path d="M9 14l-2 7 5-3 5 3-2-7" />
  </Svg>
);
export const BriefcaseIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);
export const ClockIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const EyeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const CrownIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />
  </Svg>
);
export const CloseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
