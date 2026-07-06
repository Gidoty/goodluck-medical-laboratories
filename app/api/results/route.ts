import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveResultFile } from "@/lib/storage";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await prisma.testResult.findMany({
    include: { patient: true, service: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ results });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const patientId = form.get("patientId") as string | null;
  const testName = form.get("testName") as string | null;
  const serviceId = (form.get("serviceId") as string | null) || undefined;
  const notes = (form.get("notes") as string | null) || undefined;
  const status = (form.get("status") as string | null) || "READY";
  const file = form.get("file") as File | null;

  if (!patientId || !testName) {
    return NextResponse.json(
      { error: "Patient and test name are required" },
      { status: 400 }
    );
  }

  let fileName: string | undefined;
  let filePath: string | undefined;
  if (file && file.size > 0) {
    const saved = await saveResultFile(file);
    fileName = saved.originalName;
    filePath = saved.storedName;
  }

  const result = await prisma.testResult.create({
    data: {
      patientId,
      serviceId,
      testName,
      notes,
      status: status === "PENDING" ? "PENDING" : "READY",
      fileName,
      filePath,
      uploadedById: session.user.id,
    },
  });

  return NextResponse.json({ result }, { status: 201 });
}
