import { BarChart3, BookOpen, Bookmark, ClipboardList, Info, LayoutDashboard, SlidersHorizontal, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Pathname prefix that marks this item as active. */
  matchPrefix: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard, matchPrefix: "/overview" },
  { label: "New Assessment", href: "/assessment/business", icon: ClipboardList, matchPrefix: "/assessment" },
  { label: "Results", href: "/results", icon: BarChart3, matchPrefix: "/results" },
  { label: "Sensitivity Analysis", href: "/sensitivity", icon: SlidersHorizontal, matchPrefix: "/sensitivity" },
  { label: "Saved Scenarios", href: "/scenarios", icon: Bookmark, matchPrefix: "/scenarios" },
  { label: "Methodology", href: "/methodology", icon: BookOpen, matchPrefix: "/methodology" },
  { label: "About", href: "/about", icon: Info, matchPrefix: "/about" },
];
