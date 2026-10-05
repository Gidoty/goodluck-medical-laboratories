import { Scale } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Collapsible } from "@/components/ui/collapsible";
import { Formula } from "@/components/ui/formula";
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
          </div>
        </Collapsible>

        <Collapsible title="Calculation formulas" summary="Every number on the results page, step by step." defaultOpen>
          <div className="space-y-2">
            <p>
              Diesel is the baseline. Each alternative is compared with it year by year. A positive net present value means the alternative has an
              economic advantage over diesel under the assumptions you entered. It does not mean it is better for the environment or that it will work
              in your operation.
            </p>
            <p>
              <strong>Timeline.</strong> Year 0 is the purchase date. Years 1 to T are operating years, with T the analysis period. Year 0 is not
              discounted. Costs are positive numbers; incentives and residual value are subtracted.
            </p>

            <h3 className="pt-3 text-base font-semibold text-navy-950">Distance</h3>
            <Formula meaning="Or the annual distance you entered directly.">annual distance = daily distance × operating days per year</Formula>
            <Formula>fleet annual distance = annual distance × number of vehicles</Formula>
            <Formula meaning="Utilisation is the same in every year.">fleet distance over the period = Σ<sub>t=1..T</sub> fleet annual distance</Formula>

            <h3 className="pt-3 text-base font-semibold text-navy-950">Fuel and energy</h3>
            <Formula meaning="Used when you enter km per litre. Entering litres per 100 km gives the same answer.">litres per 100 km = 100 ÷ (km per litre)</Formula>
            <Formula>annual fuel = fleet annual distance × (litres per 100 km) ÷ 100</Formula>
            <Formula meaning="Escalation applies only if you entered it. A blank is held constant and shown as a missing assumption.">
              price<sub>t</sub> = price<sub>1</sub> × (1 + g)<sup>t−1</sup>
              <br />
              fuel cost<sub>t</sub> = annual fuel × price<sub>t</sub>
            </Formula>
            <Formula meaning="Electric vehicles. kWh per 100 km is divided by 100 to give kWh per km.">vehicle energy = fleet annual distance × (kWh per km)</Formula>
            <Formula meaning="L is the share of grid energy lost in charging, as a decimal. With a 10% loss you divide by 0.90. You do not multiply by 1.10.">
              grid energy = vehicle energy ÷ (1 − L)
              <br />
              electricity cost<sub>t</sub> = grid energy × tariff<sub>t</sub>
            </Formula>
            <Formula meaning="Biofuel uses the same steps in its own fuel unit (litre, kg or m³). It is never forced into litres.">biofuel cost<sub>t</sub> = fleet distance × (fuel per km) × price<sub>t</sub></Formula>

            <h3 className="pt-3 text-base font-semibold text-navy-950">Running costs (each year)</h3>
            <Formula meaning="Each part is kept separate in the results.">
              operating cost<sub>t</sub> = energy + maintenance + insurance + licensing + other fixed + other variable + infrastructure running cost
            </Formula>
            <Formula meaning="Per-vehicle amounts are multiplied by the number of vehicles. Cost per km is multiplied by fleet distance only, so the fleet size is never applied twice.">
              maintenance, insurance, licensing, other fixed = amount per vehicle × vehicles
              <br />
              other variable = cost per km × fleet annual distance
            </Formula>

            <h3 className="pt-3 text-base font-semibold text-navy-950">Capital costs, incentives and infrastructure</h3>
            <Formula>Year 0 vehicles = price per vehicle × vehicles (for a conversion: conversion cost × vehicles)</Formula>
            <Formula meaning="Only incentives you entered. A percentage subsidy applies to the vehicle purchase cost, not to infrastructure. A tax credit or other incentive with no defined timing is excluded and reported, not assumed to arrive in Year 0.">
              grant = amount per vehicle × vehicles (never more than the purchase cost)
              <br />
              subsidy = percentage × vehicle purchase cost
            </Formula>
            <Formula meaning="Charger costs are totals for the whole installation, not per charger. Your fleet is charged only its share. Charger utilisation is a different idea and is not used to share cost.">
              share = min(1, vehicles assessed ÷ total vehicles using the chargers)
              <br />
              infrastructure capital = (equipment + installation + electrical upgrade) × share
            </Formula>
            <Formula meaning="Infrastructure is paid for once, in Year 0. Its replacement and any remaining value at the end are not modelled.">infrastructure running cost<sub>t</sub> = (maintenance + other annual cost) × share</Formula>

            <h3 className="pt-3 text-base font-semibold text-navy-950">Replacements and residual value</h3>
            <Formula meaning="A replacement vehicle is bought at Year k × life whenever that is before the end of the period, so none is bought at exactly Year T. A non-integer life falls in the year it expires. The replacement costs the same as the first vehicle.">
              replacement years = { `{ k × useful life : k = 1, 2, … and k × useful life < T }` }
            </Formula>
            <Formula meaning="Only an answer of “Yes” adds the cost. “Unknown” is not turned into zero: it is left out and flagged.">
              battery replacement<sub>t</sub> = cost per vehicle × vehicles, in the replacement year (and again in each later vehicle cycle)
            </Formula>
            <Formula meaning="Subtracted in the final year. An amount is per vehicle; a percentage applies to the acquisition price. If none is entered, nothing is credited and this is flagged.">
              residual value = amount per vehicle × vehicles, or percentage × acquisition price × vehicles
            </Formula>

            <h3 className="pt-3 text-base font-semibold text-navy-950">Total cost of ownership</h3>
            <Formula meaning="Net cash cost in a year is capital + operating + replacements, minus incentives and residual value.">
              TCO = Σ<sub>t=0..T</sub> net cash cost<sub>t</sub>
            </Formula>
            <Formula meaning="r is the discount rate as a decimal. Year 0 is divided by 1.">
              present cost = Σ<sub>t=0..T</sub> net cash cost<sub>t</sub> ÷ (1 + r)<sup>t</sup>
            </Formula>
            <Formula meaning="Both use the same distance, so a discounted cost is never divided by a different horizon.">
              TCO per km = TCO ÷ fleet distance over the period
              <br />
              present cost per km = present cost ÷ fleet distance over the period
            </Formula>

            <h3 className="pt-3 text-base font-semibold text-navy-950">Alternative versus diesel</h3>
            <Formula meaning="Positive means the alternative is cheaper in that year. Year 0 is minus the extra investment. The final year includes the difference in residual values.">
              incremental cash flow<sub>t</sub> = diesel net cash cost<sub>t</sub> − alternative net cash cost<sub>t</sub>
            </Formula>
            <Formula meaning="Greater than zero: economic advantage over diesel. About zero: economically indifferent. Less than zero: economic disadvantage. This is a statement about cost only.">
              NPV = Σ<sub>t=0..T</sub> incremental cash flow<sub>t</sub> ÷ (1 + r)<sup>t</sup>
            </Formula>
            <Formula meaning="Found on the running total of incremental cash flow. If it crosses zero between two years, the point is interpolated inside that year. If it never reaches zero within the period, the result is “Not achieved within analysis horizon”, never 0 and never the period length. If the alternative is cheaper at Year 0, there is nothing to recover and payback is immediate.">
              simple payback = (t − 1) + shortfall at the start of year t ÷ cash flow in year t
            </Formula>
            <Formula meaning="The same method on discounted cash flows.">discounted payback: same, using incremental cash flow<sub>t</sub> ÷ (1 + r)<sup>t</sup></Formula>
            <Formula meaning="Replacements and price escalation make the path uneven, so it is read from the year-by-year path rather than from a single formula.">
              break-even distance = fleet distance driven by the time of simple payback
            </Formula>
            <Formula meaning="Excludes capital and replacement costs. A negative figure is shown as additional operating cost, not as savings.">
              operating savings<sub>t</sub> = diesel operating cost<sub>t</sub> − alternative operating cost<sub>t</sub>
            </Formula>

            <h3 className="pt-3 text-base font-semibold text-navy-950">What these results leave out</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Financing. Loans, interest and the debt/equity split are stored but not used, so the comparison does not depend on how the vehicles are paid for and acquisition is never counted twice.</li>
              <li>Tax, depreciation allowances and VAT.</li>
              <li>Revenue. Both options are assumed to do the same transport work, so this is a cost comparison and no internal rate of return is calculated.</li>
              <li>Inflation in general. Only the escalation rates you enter are applied, to the prices you apply them to. Maintenance is held constant. Results are a scenario, not a full inflation model.</li>
              <li>Whether a battery-electric vehicle can do the daily route, or whether biofuel is reliably available. Those are warned about, not priced.</li>
              <li>Emissions, which are reported separately in a later stage.</li>
            </ul>
          </div>
        </Collapsible>

        <Collapsible title="Economic assumptions" summary="Prices, escalation, vehicle lifetime and residual value.">
          <div className="space-y-3">
            <p>Fuel and electricity prices, their expected change over time, vehicle lifetime and resale value are all inputs that you set. None are fixed in the software.</p>
            <p>Volatile figures such as diesel prices and electricity tariffs are never hard-coded as facts. Where an illustrative value is shown, it is labelled as such.</p>
          </div>
        </Collapsible>

        <Collapsible title="Financial assumptions" summary="Financing, discounting and infrastructure cost.">
          <div className="space-y-3">
            <p>Financing terms (share financed, interest rate, loan term), the discount rate and infrastructure costs are entered by you. A cost of zero is treated as a real value; a blank is treated as missing, and &ldquo;not applicable&rdquo; is recorded as its own state.</p>
            <p>Every financial input carries a currency and unit. Changing the currency relabels units but does not convert amounts.</p>
          </div>
        </Collapsible>

        <Collapsible title="Operational assumptions" summary="Distance, utilisation, payload, range and charging or blending limits.">
          <div className="space-y-3">
            <p>Daily distance, operating days, load factor and analysis horizon describe how the vehicles are used. Operating limits, such as battery range for electric vehicles or the approved blend share for biofuel engines, are checked against these inputs.</p>
          </div>
        </Collapsible>

        <Collapsible title="Environmental assumptions" summary="Emission factors and how emissions are reported.">
          <div className="space-y-3">
            <p>Emission estimates depend on emission factors that you supply or confirm. The software does not assume a fuel or grid factor is correct for your context.</p>
            <p>Emissions are reported next to, but separately from, commercial results.</p>
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
