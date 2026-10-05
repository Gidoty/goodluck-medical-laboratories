/** Plain-English help for the terms entrepreneurs are most likely to stumble on. Keep each entry short. */
export interface GlossaryEntry {
  term: string;
  text: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  tco: { term: "Total cost of ownership (TCO)", text: "Everything a vehicle costs you over its whole life: purchase, fuel or electricity, maintenance, financing and infrastructure, minus what you can sell it for." },
  discountRate: { term: "Discount rate", text: "The discount rate represents the required return or opportunity cost used to convert future cash flows into present value." },
  residualValue: { term: "Residual value", text: "What the vehicle should still be worth when you stop using it or sell it. Enter an amount or a percentage of the purchase price, not both." },
  fuelEfficiency: { term: "Fuel efficiency", text: "How far a vehicle goes on fuel. Enter km per litre or litres per 100 km, whichever you know. They describe the same thing." },
  energyConsumption: { term: "Energy consumption", text: "Electricity an electric vehicle uses to travel. Enter kWh per km or kWh per 100 km, whichever you know." },
  chargingLosses: { term: "Charging losses", text: "Energy lost as heat between the socket and the battery. You pay for it, but it does not move the vehicle." },
  utilisation: { term: "Vehicle utilisation", text: "How much each vehicle is actually used: kilometres per day and days per year. Higher use spreads fixed costs further." },
  biofuelBlend: { term: "Biofuel blend", text: "The share of biofuel mixed into diesel by volume. B20 means 20% biofuel. Check what your engine maker allows." },
  payload: { term: "Payload", text: "The weight of goods a vehicle can carry (capacity) and what it usually carries (average)." },
  infraUtilisation: { term: "Infrastructure utilisation", text: "How much of the time a charger or fuel facility is in productive use. Idle equipment still costs money, so low use raises the cost of each charge." },
  escalation: { term: "Price escalation", text: "How much you expect a price to rise (or fall) each year. Leave it blank if you have no view. Nothing is assumed for you." },
  analysisHorizon: { term: "Analysis period", text: "The number of years over which the investment is judged. Longer periods favour vehicles with lower running costs." },
  usableRange: { term: "Usable range", text: "How far the vehicle can really go on one charge with your loads, roads and weather, not the brochure figure." },
  emissionFactor: { term: "Emission factor", text: "Kilograms of greenhouse gas released per unit of fuel or electricity. It must come from a source you can name." },
  lifecycleAdjustment: { term: "Lifecycle adjustment", text: "An optional percentage added to an emission factor to cover emissions from producing the fuel or electricity. Leave blank if your factor already includes them." },
  incentive: { term: "Incentive", text: "A grant, subsidy or tax benefit that lowers a vehicle's cost. Only enter one you are confident you will receive." },
  provenance: { term: "Source of a number", text: "Optional. Saying where a number came from, such as a supplier quotation or your own records, makes the assessment easier to trust and to check." },
};
