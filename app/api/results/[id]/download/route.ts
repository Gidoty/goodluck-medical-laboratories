import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { readResultFile } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.testResult.findUnique({ where: { id } });

  if (!result || !result.filePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const isOwner = session.user.role === "PATIENT" && session.user.id === result.patientId;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const buffer = await readResultFile(result.filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${result.fileName ?? "result"}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found on server" }, { status: 404 });
  }
}
