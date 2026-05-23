export const GST_SLABS = [0, 5, 12, 18, 28] as const;
export type GstSlab = typeof GST_SLABS[number];

/** Common HSN codes for Indian industrial procurement mapped to their GST rate. */
const HSN_RATES: Record<string, number> = {
  // Fasteners & hardware
  "7318": 18, "73181": 18, "73182": 18,
  // Pipes and fittings
  "7307": 18, "7308": 18, "7312": 18,
  // Industrial machinery
  "8413": 18, "8414": 18, "8419": 18, "8421": 18, "8428": 18,
  // Valves, taps, fittings
  "8481": 18,
  // Bearings, transmission
  "8482": 18, "8483": 18,
  // Gaskets, seals
  "8484": 18, "4016": 18,
  // Electric motors
  "8501": 18, "8502": 18,
  // Batteries
  "8507": 18,
  // Switchgear, relays, circuit breakers
  "8535": 18, "8536": 18, "8537": 18,
  // Cables, wires
  "8544": 18,
  // Engines (diesel/petrol)
  "8407": 28, "8408": 28,
  // Computers and peripherals
  "8471": 18, "8473": 18,
  // Communication equipment
  "8517": 18,
  // Safety helmets, hard hats
  "6506": 12,
  // Safety clothing, vests, gloves
  "6210": 12, "6217": 12, "6116": 12,
  // Respirators, breathing apparatus
  "9020": 12,
  // Safety footwear
  "6401": 18, "6402": 18,
  // Lubricants, hydraulic oils
  "2710": 18,
  // Chemicals, solvents
  "2814": 18, "2815": 18, "2902": 18, "3402": 18,
  // Plastics — pipes, fittings, packaging
  "3917": 18, "3919": 18, "3923": 18, "3926": 18,
  // Rubber products
  "4009": 18, "4010": 18,
  // Industrial abrasives, grinding wheels
  "6804": 18, "6805": 18,
  // Instruments
  "9026": 18, "9027": 18, "9031": 18,
  // Raw steel / iron
  "7201": 18, "7206": 18, "7207": 18, "7208": 18, "7209": 18, "7210": 18,
  // Aluminium
  "7601": 18, "7604": 18, "7610": 18,
  // Copper
  "7401": 18, "7404": 18, "7408": 18,
  // Basic food items — exempt
  "1006": 0, "1001": 0, "0701": 0, "0702": 0,
  // Processed food
  "2106": 18, "0901": 5,
};

export function gstRateForHsn(hsnCode: string): number | null {
  const code = hsnCode.replace(/\s/g, "");
  // Try progressively shorter prefixes (8-digit → 6 → 4)
  for (const len of [8, 6, 4]) {
    const prefix = code.slice(0, len);
    if (HSN_RATES[prefix] !== undefined) return HSN_RATES[prefix];
  }
  return null;
}

export function gstBreakdown(amount: number, gstRate: number): { cgst: number; sgst: number; igst: number; total: number } {
  const gst = Math.round(amount * gstRate) / 100;
  const half = Math.round(gst * 50) / 100;
  return { cgst: half, sgst: half, igst: gst, total: amount + gst };
}
