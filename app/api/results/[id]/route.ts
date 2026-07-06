import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const data: { status?: "PENDING" | "READY"; notes?: string } = {};
  if (body.status === "PENDING" || body.status === "READY") data.status = body.status;
  if (typeof body.notes === "string") data.notes = body.notes;

  const result = await prisma.testResult.update({ where: { id }, data });
  return NextResponse.json({ result });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.testResult.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
