import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, MessageSquare, Users, FlaskConical, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Admin Dashboard | Goodluck Medical Laboratories" };

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [pendingAppointments, newInquiries, patientCount, resultCount] = await Promise.all([
    prisma.appointment.count({ where: { status: "PENDING" } }),
    prisma.inquiry.count({ where: { status: "NEW" } }),
    prisma.user.count({ where: { role: "PATIENT" } }),
    prisma.testResult.count(),
  ]);

  const cards = [
    { label: "Pending Appointments", value: pendingAppointments, icon: CalendarClock, href: "/admin/appointments" },
    { label: "New Inquiries", value: newInquiries, icon: MessageSquare, href: "/admin/inquiries" },
    { label: "Registered Patients", value: patientCount, icon: Users, href: "/admin/patients" },
    { label: "Total Test Results", value: resultCount, icon: FlaskConical, href: "/admin/results" },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-navy">Dashboard Overview</h1>
      <p className="mt-1 text-sm text-muted">A quick snapshot of lab activity</p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card flex flex-col gap-3 p-5 hover:border-blue">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-light text-blue">
              <card.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-3xl font-extrabold text-navy">{card.value}</p>
              <p className="text-sm text-muted">{card.label}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-blue">
              View all <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
