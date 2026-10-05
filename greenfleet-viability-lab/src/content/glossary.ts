/** Plain-English help for the terms entrepreneurs are most likely to stumble on. Keep each entry short. */
export interface GlossaryEntry {
  term: string;
  text: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  tco: { term: "Total cost of ownership (TCO)", text: "Everything a vehicle costs you over its whole life: purchase, fuel or electricity, maintenance, financing and infrastructure, minus what you can sell it for." },
  discountRate: { term: "Discount rate", text: "The annual rate used to convert future costs and savings into today's value. It represents the return you require or the opportunity cost of the money. Enter 10 for 10%." },
  residualValue: { term: "Residual value", text: "What the vehicle should still be worth when you stop using it or sell it. Enter an amount per vehicle, or a percentage of the purchase price, not both." },
  fuelEfficiency: { term: "Fuel efficiency", text: "How far a vehicle goes on fuel. Enter km per litre or litres per 100 km, whichever you know. They describe the same thing, so enter one. Choose the unit before you type." },
  energyConsumption: { term: "Energy consumption", text: "The electricity an electric vehicle uses to travel, measured at the vehicle. Enter kWh per km or kWh per 100 km, whichever you know. They describe the same thing: 0.25 kWh/km is 25 kWh/100 km." },
  chargingLosses: { term: "Charging losses", text: "The share of the energy drawn from the socket that is lost as heat before it reaches the battery. You pay for it, but it does not move the vehicle. Enter a percentage, for example 10 for 10%. Leave it blank if unknown. Nothing is assumed, and the results say so." },
  utilisation: { term: "Vehicle utilisation", text: "How much each vehicle is actually used: kilometres per day and operating days per year. Enter the distance one vehicle covers, not the whole fleet. Higher use spreads fixed costs further." },
  biofuelBlend: { term: "Biofuel blend", text: "The share of biofuel mixed into diesel by volume. B20 means 20% biofuel. Check what your engine maker allows." },
  payload: { term: "Payload", text: "The weight of goods a vehicle can carry (capacity) and what it usually carries (average)." },
  infraUtilisation: { term: "Infrastructure utilisation", text: "How much of the time a charger or fuel facility is in productive use. Idle equipment still costs money, so low use raises the cost of each charge." },
  escalation: { term: "Price escalation", text: "How much you expect a price to rise (or fall) each year, as a percentage. Enter 5 for 5%. Leave it blank if you have no view. Nothing is assumed for you, and a blank is shown as a missing assumption." },
  analysisHorizon: { term: "Analysis period", text: "The number of years over which the investment is judged, in whole years. Longer periods favour vehicles with lower running costs. Use the period you would really plan for." },
  usableRange: { term: "Usable range", text: "The practical driving distance available from the vehicle under your assumed operating conditions. Enter the range you want GreenFleet to use for route compatibility, allowing for your loads, roads and weather. It is checked against your daily and route distances." },
  emissionFactor: { term: "Emission factor", text: "The kilograms of greenhouse gas, as CO2-equivalent (CO2e), released per litre of fuel or per kWh of electricity. Enter it from a source you can name, with its unit. GreenFleet does not supply one. Without it, emissions show as unavailable, not zero." },
  lifecycleAdjustment: { term: "Lifecycle adjustment", text: "An optional percentage you can record for emissions from producing the fuel or electricity. It is stored but not applied to the results. To count those emissions, use an emission factor that already includes them." },
  incentive: { term: "Incentive", text: "A grant, subsidy or tax benefit that lowers a vehicle's cost. Only enter one you are confident you will receive." },
  provenance: { term: "Source of a number", text: "Optional. Saying where a number came from, such as a supplier quotation or your own records, makes the assessment easier to trust and to check." },
  co2e: { term: "CO2e", text: "Carbon dioxide equivalent. Different greenhouse gases expressed as the amount of CO2 that would have the same warming effect. Emission factors are normally given in kg CO2e." },
  usefulLife: { term: "Useful life", text: "How many years you expect to use the vehicle before replacing it. If it ends before the analysis period, GreenFleet assumes a replacement purchase at the same price. Enter years." },
  batteryReplacement: { term: "Battery replacement", text: "Whether the traction battery will need replacing within the analysis period. Choose Yes and enter the year and cost, No, or Unknown. Unknown is not priced. It is flagged as an uncertainty and can make the commercial result conditional." },
  chargingOpportunity: { term: "Charging opportunity", text: "Where the vehicles can charge during the operating day: only at your depot, or also at public or destination chargers. It decides whether a day longer than the range can still be completed." },
  chargingDowntime: { term: "Charging downtime", text: "Average hours per vehicle per operating day spent charging. It is shown as an operational indicator and is not turned into a cost. Enter 0 if charging happens outside working hours." },
  payloadReduction: { term: "Payload reduction", text: "How much less load the electric vehicle can carry than the diesel one because of battery weight. Enter kilograms or a percentage. GreenFleet compares the reduced capacity with your average payload." },
  infraSharing: { term: "Infrastructure allocation", text: "Chargers or fuel facilities may serve more vehicles than the ones you are assessing. Enter the total number of vehicles using them, including yours. Your fleet is charged only its share of the cost." },
  fuelAvailability: { term: "Fuel availability", text: "How reliably you can buy the fuel where and when you need it: reliable, intermittent, limited or unknown. It affects operational feasibility, not the cost figures." },
  refuelling: { term: "Additional refuelling distance", text: "Extra kilometres a vehicle drives each day to reach fuel, compared with diesel. Enter 0 if there is no extra distance. It is shown as an operational indicator and is not priced." },
  biofuelDowntime: { term: "Fuel-related downtime", text: "Hours per month a vehicle cannot work because of fuel supply or refuelling delays. Shown as an operational indicator and not priced." },
  routeDistance: { term: "Average route distance", text: "The distance of one typical route, before returning to base. Optional. When given, GreenFleet checks whether a single route fits the battery electric range." },
  npv: { term: "Net present value (NPV)", text: "The present-value economic advantage or disadvantage of choosing the alternative instead of diesel, after discounting. Positive means an advantage under your assumptions. Negative means a disadvantage." },
  payback: { term: "Payback", text: "How long cumulative savings take to recover the additional investment. If the alternative costs less to buy, payback is immediate. If savings never recover it within the analysis period, it says not achieved." },
  discountedPayback: { term: "Discounted payback", text: "Payback after recognising the time value of money. It is never shorter than simple payback." },
  presentCost: { term: "Present cost", text: "The value today of all future costs after applying the discount rate." },
};
