import { FIELDS, GROUP_LABEL, NA, unitLabel, type Currency, type Group, type RawInputs } from "../engine/fields";

const GROUPS = Object.keys(GROUP_LABEL) as Group[];

export function MethodologyPanel({ currency, inputs }: { currency: Currency; inputs: RawInputs }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>Methodology</h2>
        <p>
          GreenFleet Viability Lab is an academic proof of concept. It is not a certified financial, engineering or investment-advisory
          system. All results are produced by deterministic formulas on the inputs you enter. No AI model calculates or alters any figure.
          If an AI advisory feature is added later, it may only describe these results in plain language.
        </p>
        <h3>Timeline and cash flows</h3>
        <ul>
          <li>Year 0 is the purchase date. Years 1 to H are operating years with cash flows at year end. H is the analysis horizon.</li>
          <li>Annual distance K = daily distance × operating days (km/year).</li>
          <li>Price in year t = year-1 price × (1 + escalation)<sup>t-1</sup>. Maintenance and fixed costs escalate at the operating-cost rate.</li>
        </ul>
        <h3>Energy</h3>
        <ul>
          <li>Diesel: litres = K × L/100km ÷ 100. Cost = litres × diesel price.</li>
          <li>BEV: grid kWh = K × kWh/100km ÷ 100 × (1 + charging loss). Cost = kWh × electricity price.</li>
          <li>Biofuel: litres = K × diesel L/100km × (1 + extra fuel use) ÷ 100, split by blend share into diesel litres and biofuel litres, each at its own price.</li>
        </ul>
        <h3>Costs</h3>
        <ul>
          <li>Maintenance and fixed cost in year t = (K × maintenance per km + fixed annual cost) × (1 + opex escalation)<sup>t-1</sup>.</li>
          <li>Infrastructure per vehicle = total infrastructure cost ÷ vehicles sharing it. It is paid at year 0 from equity.</li>
          <li>BEV battery replacement: paid in the entered year, in that year's money, only if a cost and year are given.</li>
          <li>Residual value at the horizon = price × (1 − (1 − residual %) × H ÷ lifetime). Straight-line decline to the residual % at end of lifetime.</li>
        </ul>
        <h3>Financing</h3>
        <ul>
          <li>Loan = financed share × vehicle price (infrastructure is not financed). Equal annual payments over the loan term: P × r ÷ (1 − (1 + r)<sup>-n</sup>), or P ÷ n if r = 0.</li>
          <li>Any balance still owed at the end of the horizon is repaid in the final year.</li>
          <li>Equity paid at year 0 = vehicle price × (1 − financed share) + infrastructure per vehicle.</li>
        </ul>
        <h3>Metrics</h3>
        <ul>
          <li><strong>Total cost of ownership (nominal)</strong> = vehicle price + infrastructure + energy + maintenance and fixed + battery replacement + loan interest − residual value, over H years. It equals the sum of all yearly net cash costs.</li>
          <li><strong>Present-value cost</strong> = Σ net cash cost in year t ÷ (1 + discount rate)<sup>t</sup>, using the equity cash flows above.</li>
          <li><strong>Cost per km</strong> = nominal TCO ÷ (K × H). <strong>Levelised cost per km</strong> = present-value cost ÷ discounted km.</li>
          <li><strong>Cost per tonne-km</strong> = nominal TCO ÷ (K × H × payload × load factor ÷ 1000).</li>
          <li><strong>Savings versus diesel</strong> in year t = diesel net cash cost − alternative net cash cost. Cumulative savings are the running sum, including year 0.</li>
          <li><strong>NPV versus diesel</strong> = Σ savings in year t ÷ (1 + discount rate)<sup>t</sup>. Positive favours the alternative.</li>
          <li><strong>Payback</strong> = first point where cumulative savings reach zero, interpolated within the year. If never reached within H, no payback is reported.</li>
          <li><strong>Break-even</strong> = value of one variable at which NPV versus diesel is zero, found by bisection with all else held constant.</li>
        </ul>
        <h3>Emissions</h3>
        <ul>
          <li>Annual emissions = diesel litres × diesel factor + biofuel litres × biofuel factor + grid kWh × electricity factor.</li>
          <li>Cost per tonne CO2e avoided = (present-value cost of alternative − diesel) ÷ tonnes avoided over H. Reported only when emissions fall.</li>
          <li>Emissions never change the commercial classification.</li>
        </ul>
        <h3>Classification rules</h3>
        <ol>
          <li><strong>Operational feasibility (hard rule).</strong> BEV: usable range ≥ daily distance × (1 + margin), and daily charging time ≤ available window. Biofuel: blend ≤ approved maximum. Failing gives NOT YET VIABLE.</li>
          <li><strong>Economic.</strong> NPV versus diesel &gt; 0.</li>
          <li><strong>Payback.</strong> Payback ≤ the maximum acceptable payback.</li>
          <li><strong>Robustness.</strong> Share of adverse stress tests that keep NPV above zero ≥ the minimum share. Stress tests: diesel price down, electricity or biofuel price up, vehicle cost up, mileage down, maintenance up, infrastructure cost up, utilisation down, interest rate up. Drivers with no effect on the result are excluded.</li>
          <li><strong>VIABLE</strong>: operational, economic, payback and robustness all pass.</li>
          <li><strong>CONDITIONALLY VIABLE</strong>: operational passes and either NPV is positive but payback or robustness fails, or NPV is negative by no more than the near-miss tolerance (share of diesel present-value cost).</li>
          <li><strong>NOT YET VIABLE</strong>: operational fails, or NPV is negative beyond the tolerance.</li>
        </ol>
        <p className="muted">Diesel is the baseline and is not classified. If diesel has the lowest cost under your inputs, the app reports it.</p>
        <h3>Limitations</h3>
        <ul>
          <li>Single vehicle, single route profile, annual time step. No tax, subsidies, carbon pricing, downtime, driver cost differences or revenue effects.</li>
          <li>Prices, tariffs, rates and vehicle costs are your inputs. The defaults are placeholders.</li>
          <li>Emission factors cover combustion and electricity use as entered. They are not a full life-cycle assessment unless you enter life-cycle factors.</li>
          <li>Changing the currency relabels units. It does not convert values.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Assumptions register</h2>
        <p className="muted">Every default is an illustrative assumption. None is supported by a cited source. The right-hand column shows your current value.</p>
        {GROUPS.map((g) => (
          <div key={g}>
            <h3>{GROUP_LABEL[g]}</h3>
            <div className="scroll">
              <table>
                <thead><tr><th>Assumption</th><th>Unit</th><th className="num">Default</th><th className="num">Your value</th><th>Status</th></tr></thead>
                <tbody>
                  {FIELDS.filter((f) => f.group === g).map((f) => {
                    const v = inputs[f.id];
                    return (
                      <tr key={f.id}>
                        <th scope="row">{f.label}{f.help && <div className="help">{f.help}</div>}</th>
                        <td>{unitLabel(f, currency)}</td>
                        <td className="num">{f.default === NA ? "N/A" : f.default}</td>
                        <td className="num">{v === NA ? "N/A" : v === null ? "missing" : v}</td>
                        <td>{f.provenance} default</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
