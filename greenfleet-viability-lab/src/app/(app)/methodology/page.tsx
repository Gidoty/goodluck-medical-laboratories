import { Scale } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Collapsible } from "@/components/ui/collapsible";
import { PageHeader } from "@/components/ui/page-header";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { UNITS, type UnitId } from "@/lib/units";

export const metadata: Metadata = { title: "Methodology & Assumptions" };

const CANONICAL: ReadonlyArray<readonly [string, string]> = [
  ["Money", "Whole units of the assessment currency (default ₦). No scaling to thousands or millions."],
  ["Distance", "Kilometres. Daily and annual distances are km/day and km/year."],
  ["Fuel economy", "Litres per 100 km internally. km/litre is a display conversion."],
  ["Electric economy", "kWh per 100 km internally. kWh/km is a display conversion."],
  ["Mass", "Kilograms. Tonnes is a display conversion."],
  ["Percentages", "Stored as 0 to 100, never as a 0 to 1 fraction."],
  ["Emissions", "kg CO2e. tCO2e/year is a display conversion."],
  ["Time", "Years for lifetimes, horizons and loan terms; days/year for operating days."],
];

const PENDING = <Badge tone="neutral">Formulas published with the calculation engine</Badge>;

export default function MethodologyPage() {
  const unitIds = Object.keys(UNITS) as UnitId[];
  return (
    <>
      <PageHeader
        eyebrow="Transparency"
        title="Methodology & assumptions"
        description="How GreenFleet will reach its answers, and what you can inspect and change."
      />

      <div className="mb-6 flex gap-4 rounded-card border border-forest-200 bg-forest-50 p-5">
        <Scale aria-hidden className="mt-0.5 size-6 shrink-0 text-forest-700" />
        <p className="font-medium leading-relaxed text-forest-950">
          GreenFleet does not assume that a green technology is commercially superior. Results are determined by the user&apos;s operating
          and financial assumptions.
        </p>
      </div>

      <div className="space-y-3">
        <Collapsible title="Commercial methodology" summary="Diesel is the baseline; alternatives are judged against it." defaultOpen>
          <div className="space-y-3">
            <p>Each technology is assessed over the same analysis horizon, on the same route and utilisation. Diesel is the reference case. It is not treated as inferior, and no technology receives a favourable result unless your numbers produce one.</p>
            <p>Commercial viability and environmental performance are separate dimensions. A technology can emit less and still be commercially unattractive, and the application reports both.</p>
            <p>Calculations are deterministic and auditable. Generative AI, if added later, will only describe results in plain language and will never create or change a figure.</p>
            <p>{PENDING}</p>
          </div>
        </Collapsible>

        <Collapsible title="Economic assumptions" summary="Prices, escalation, vehicle lifetime and residual value.">
          <div className="space-y-3">
            <p>Fuel and electricity prices, their expected change over time, vehicle lifetime and resale value are all inputs that you set. None are fixed in the software.</p>
            <p>Volatile figures such as diesel prices and electricity tariffs are never hard-coded as facts. Where an illustrative value is shown, it is labelled as such.</p>
            <p>{PENDING}</p>
          </div>
        </Collapsible>

        <Collapsible title="Financial assumptions" summary="Financing, discounting and infrastructure cost.">
          <div className="space-y-3">
            <p>Financing terms (share financed, interest rate, loan term), the discount rate and infrastructure costs are entered by you. A cost of zero is treated as a real value; a blank is treated as missing, and &ldquo;not applicable&rdquo; is recorded as its own state.</p>
            <p>Every financial input carries a currency and unit. Changing the currency relabels units but does not convert amounts.</p>
            <p>{PENDING}</p>
          </div>
        </Collapsible>

        <Collapsible title="Operational assumptions" summary="Distance, utilisation, payload, range and charging or blending limits.">
          <div className="space-y-3">
            <p>Daily distance, operating days, load factor and analysis horizon describe how the vehicles are used. Operating limits, such as battery range for electric vehicles or the approved blend share for biofuel engines, are checked against these inputs.</p>
            <p>{PENDING}</p>
          </div>
        </Collapsible>

        <Collapsible title="Environmental assumptions" summary="Emission factors and how emissions are reported.">
          <div className="space-y-3">
            <p>Emission estimates depend on emission factors that you supply or confirm. The software does not assume a fuel or grid factor is correct for your context.</p>
            <p>Emissions are reported next to, but separately from, commercial results.</p>
            <p>{PENDING}</p>
          </div>
        </Collapsible>

        <Collapsible title="Units and definitions" summary="Canonical internal units and the units shown beside inputs.">
          <div className="space-y-5">
            <ResponsiveTable caption="Canonical internal units">
              <thead>
                <tr className="border-b border-line bg-navy-50 text-navy-800">
                  <th scope="col" className="px-4 py-3 font-semibold">Quantity</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Internal convention</th>
                </tr>
              </thead>
              <tbody>
                {CANONICAL.map(([q, d]) => (
                  <tr key={q} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium text-navy-900">{q}</th>
                    <td className="px-4 py-3 text-navy-800">{d}</td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
            <div>
              <p className="mb-2 font-semibold text-navy-950">Units recognised by the application</p>
              <ul className="flex flex-wrap gap-2">
                {unitIds.map((id) => (
                  <li key={id}>
                    <Badge tone="navy">{UNITS[id].label.replace("{cur}", "₦")}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Collapsible>

        <Collapsible title="Data sources" summary="Where numbers come from.">
          <div className="space-y-3">
            <p>This release contains no market data. Every figure is either entered by you or is an optional demonstration value labelled &ldquo;Illustrative demo assumption &mdash; not current market data.&rdquo;</p>
            <p>When sourced data is added, each value will be listed here with its citation and the date it was retrieved.</p>
          </div>
        </Collapsible>

        <Collapsible title="Limitations" summary="What this prototype can and cannot tell you.">
          <ul className="list-disc space-y-2 pl-5">
            <li>It is an academic proof of concept, not a certified financial, engineering or investment-advisory system.</li>
            <li>Results are only as good as the assumptions entered. Unsupported inputs produce unsupported outputs.</li>
            <li>It models one vehicle profile at a time and does not capture every real-world factor, such as taxes, subsidies or downtime.</li>
            <li>Your entries are stored in this browser only. Clearing site data removes them.</li>
          </ul>
        </Collapsible>
      </div>
    </>
  );
}
