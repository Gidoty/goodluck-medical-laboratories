import { REPORT_DISCLAIMER } from "@/reporting/identity";
import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "About" };

const CONTEXT: ReadonlyArray<readonly [string, string]> = [
  ["Institution", "University of Port Harcourt"],
  ["Faculty", "Faculty of Social Sciences"],
  ["Centre", "Centre for Logistics and Transport Studies (CELTRAS)"],
  ["Course", "SGS 802: Entrepreneurship in Transport and Supply Chain Management"],
];

export default function AboutPage() {
  return (
    <>
      <PageHeader help="about" eyebrow="About" title="About GreenFleet Viability Lab" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardBody className="space-y-4 leading-relaxed text-navy-800">
            <p>
              GreenFleet Viability Lab is an academic decision-support prototype. It examines the commercial viability of green transport
              innovations for logistics start-ups, with particular relevance to emerging economies.
            </p>
            <p>
              It helps entrepreneurs, small fleet operators, investors, advisers and researchers compare conventional diesel vehicles,
              battery-electric vehicles and biofuel pathways under their own operating and financial conditions.
            </p>
            <p className="text-sm text-slate-600">
              The prototype supports learning and discussion. {REPORT_DISCLAIMER}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-navy-950">Academic context</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {CONTEXT.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k}</dt>
                  <dd className="mt-0.5 font-medium text-navy-950">{v}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
