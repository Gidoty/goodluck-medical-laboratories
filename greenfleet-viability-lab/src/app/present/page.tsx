import type { Metadata } from "next";
import { PresentationView } from "@/components/present/presentation-view";

export const metadata: Metadata = { title: "Presentation Mode" };

export default function PresentPage() {
  return <PresentationView />;
}
