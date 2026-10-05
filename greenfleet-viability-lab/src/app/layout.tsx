import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GuidanceProvider } from "@/guidance/GuidanceProvider";
import { AssessmentStoreProvider } from "@/state/StoreProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GreenFleet Viability Lab", template: "%s | GreenFleet Viability Lab" },
  description: "Techno-economic decision support for green logistics entrepreneurs: compare diesel, battery-electric and biofuel fleets.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#19503a" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AssessmentStoreProvider>
          <GuidanceProvider>{children}</GuidanceProvider>
        </AssessmentStoreProvider>
      </body>
    </html>
  );
}
