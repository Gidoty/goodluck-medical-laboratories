import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getStore } from "@netlify/blobs";

const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads", "results");
const STORE_NAME = "test-results";

function onNetlify() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

export async function saveResultFile(file: File) {
  const ext = path.extname(file.name).slice(0, 10);
  const storedName = `${randomUUID()}${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  if (onNetlify()) {
    const store = getStore(STORE_NAME);
    await store.set(storedName, arrayBuffer);
  } else {
    await mkdir(UPLOAD_ROOT, { recursive: true });
    await writeFile(path.join(UPLOAD_ROOT, storedName), Buffer.from(arrayBuffer));
  }

  return { storedName, originalName: file.name };
}

export async function readResultFile(storedName: string): Promise<Buffer> {
  if (onNetlify()) {
    const store = getStore(STORE_NAME);
    const data = await store.get(storedName, { type: "arrayBuffer" });
    if (!data) throw new Error("File not found in blob store");
    return Buffer.from(data);
  }

  return readFile(path.join(UPLOAD_ROOT, storedName));
}
