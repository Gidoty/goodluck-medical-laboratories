import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { SERVICES_DATA } from "../lib/services-data";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@goodluckmedicallabs.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const patientEmail = process.env.SEED_PATIENT_EMAIL ?? "patient@example.com";
  const patientPassword = process.env.SEED_PATIENT_PASSWORD ?? "Patient123!";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Lab Administrator",
      email: adminEmail,
      phone: "08105736971",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });

  const patient = await prisma.user.upsert({
    where: { email: patientEmail },
    update: {},
    create: {
      name: "Demo Patient",
      email: patientEmail,
      phone: "08012345678",
      passwordHash: await bcrypt.hash(patientPassword, 10),
      role: "PATIENT",
    },
  });

  for (const svc of SERVICES_DATA) {
    await prisma.service.upsert({
      where: { slug: svc.slug },
      update: { ...svc },
      create: { ...svc },
    });
  }

  const haematology = await prisma.service.findUnique({
    where: { slug: "haematology-blood-serology" },
  });
  const ultrasound = await prisma.service.findUnique({
    where: { slug: "ultrasound-scanning" },
  });

  await prisma.testResult.upsert({
    where: { id: "seed-result-1" },
    update: {},
    create: {
      id: "seed-result-1",
      patientId: patient.id,
      serviceId: haematology?.id,
      testName: "Full Blood Count",
      status: "READY",
      notes: "All parameters within normal reference range.",
      uploadedById: admin.id,
    },
  });

  await prisma.testResult.upsert({
    where: { id: "seed-result-2" },
    update: {},
    create: {
      id: "seed-result-2",
      patientId: patient.id,
      serviceId: ultrasound?.id,
      testName: "Abdominal Ultrasound Scan",
      status: "PENDING",
      uploadedById: admin.id,
    },
  });

  await prisma.appointment.upsert({
    where: { id: "seed-appt-1" },
    update: {},
    create: {
      id: "seed-appt-1",
      patientName: "Demo Patient",
      patientEmail: patient.email,
      patientPhone: "08012345678",
      serviceId: haematology?.id,
      preferredDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      preferredTime: "10:00 AM",
      notes: "First time patient, referred by Dr. Adeyemi.",
      status: "CONFIRMED",
      userId: patient.id,
    },
  });

  await prisma.inquiry.upsert({
    where: { id: "seed-inquiry-1" },
    update: {},
    create: {
      id: "seed-inquiry-1",
      name: "Funke Alabi",
      email: "funke.alabi@example.com",
      phone: "08099887766",
      subject: "Equipment supply enquiry",
      message:
        "Good day, we run a small clinic in Akure and would like a quote for a haematology analyzer.",
      status: "NEW",
    },
  });

  console.log("Seed complete:");
  console.log(`  Admin login:   ${adminEmail} / ${adminPassword}`);
  console.log(`  Patient login: ${patientEmail} / ${patientPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
