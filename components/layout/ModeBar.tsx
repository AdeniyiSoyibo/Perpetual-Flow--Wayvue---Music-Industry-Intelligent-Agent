"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Disc3, Radio, Music2, Users, Film, Store, PlaySquare } from "lucide-react";

const MODES = [
  { href: "/production",   label: "Production",   icon: Disc3,       accent: "sky"     },
  { href: "/streaming",    label: "Streaming",    icon: Radio,       accent: "blue"    },
  { href: "/dj",           label: "DJ Mode",      icon: Music2,      accent: "indigo"  },
  { href: "/video-mixer",  label: "Video Mixer",  icon: PlaySquare,  accent: "red"     },
  { href: "/anr",          label: "A&R",          icon: Users,       accent: "violet"  },
  { href: "/video",        label: "Video",        icon: Film,        accent: "pink"    },
  { href: "/marketplace",  label: "Marketplace",  icon: Store,       accent: "emerald" },
] as const;

type Accent = (typeof MODES)[number]["accent"];

const ACTIVE: Record<Accent, string> = {
  sky:     "bg-sky-500 text-white border-sky-500 shadow-sm",
  blue:    "bg-blue-500 text-white border-blue-500 shadow-sm",
  indigo:  "bg-indigo-500 text-white border-indigo-500 shadow-sm",
  red:     "bg-red-500 text-white border-red-500 shadow-sm",
  violet:  "bg-violet-500 text-white border-violet-500 shadow-sm",
  pink:    "bg-pink-500 text-white border-pink-500 shadow-sm",
  emerald: "bg-emerald-500 text-white border-emerald-500 shadow-sm",
};

const HOVER: Record<Accent, string> = {
  sky:     "hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50",
  blue:    "hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50",
  indigo:  "hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50",
  red:     "hover:border-red-300 hover:text-red-600 hover:bg-red-50",
  violet:  "hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50",
  pink:    "hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50",
  emerald: "hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50",
};

export function ModeBar() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-semibold text-[#7a9abf] uppercase tracking-wider mr-1 whitespace-nowrap">
        Switch Mode
      </span>
      {MODES.map(({ href, label, icon: Icon, accent }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap ${
              isActive
                ? ACTIVE[accent]
                : `bg-white border-[#cdd8e8] text-[#4a6580] ${HOVER[accent]}`
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
