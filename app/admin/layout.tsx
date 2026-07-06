import Link from "next/link";
import {
  LayoutDashboard,
  CalendarClock,
  MessageSquare,
  Users,
  FlaskConical,
  ListTree,
} from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/admin/inquiries", label: "Inquiries", icon: MessageSquare },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/results", label: "Test Results", icon: FlaskConical },
  { href: "/admin/services", label: "Services", icon: ListTree },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page grid grid-cols-1 gap-8 py-10 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <nav className="scrollbar-thin flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-blue-light hover:text-blue"
            >
              <link.icon className="h-4 w-4" /> {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
