import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads", "results");

export async function saveResultFile(file: File) {
  await mkdir(UPLOAD_ROOT, { recursive: true });

  const ext = path.extname(file.name).slice(0, 10);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_ROOT, storedName), buffer);

  return { storedName, originalName: file.name };
}

export function resultFilePath(storedName: string) {
  return path.join(UPLOAD_ROOT, storedName);
}
