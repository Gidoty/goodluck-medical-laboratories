import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { appointmentSchema } from "@/lib/validations";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const session = await auth();
  const data = parsed.data;

  const appointment = await prisma.appointment.create({
    data: {
      patientName: data.patientName,
      patientEmail: data.patientEmail,
      patientPhone: data.patientPhone,
      serviceId: data.serviceId,
      preferredDate: new Date(data.preferredDate),
      preferredTime: data.preferredTime,
      notes: data.notes,
      userId: session?.user?.role === "PATIENT" ? session.user.id : undefined,
    },
  });

  return NextResponse.json({ appointment }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appointments = await prisma.appointment.findMany({
    include: { service: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ appointments });
}
