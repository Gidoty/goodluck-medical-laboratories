import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const services = await prisma.service.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ services });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, slug, category, description, price, icon, featured, order } = body;
  if (!name || !slug || !category || !description || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const service = await prisma.service.create({
    data: {
      name,
      slug,
      category,
      description,
      price,
      icon: icon || "microscope",
      featured: Boolean(featured),
      order: Number(order) || 0,
    },
  });

  return NextResponse.json({ service }, { status: 201 });
}
