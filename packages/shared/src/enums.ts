export enum VendorCategory {
  RAW_MATERIALS = "RAW_MATERIALS",             // steel, aluminum, copper, iron
  ELECTRICAL_ELECTRONICS = "ELECTRICAL_ELECTRONICS", // cables, panels, components
  MECHANICAL_TOOLS = "MECHANICAL_TOOLS",       // hand tools, machine tools, dies
  FASTENERS_HARDWARE = "FASTENERS_HARDWARE",   // bolts, nuts, screws, anchors
  CHEMICALS_LUBRICANTS = "CHEMICALS_LUBRICANTS", // oils, solvents, adhesives
  SAFETY_PPE = "SAFETY_PPE",                   // helmets, gloves, safety gear
  HYDRAULICS_PNEUMATICS = "HYDRAULICS_PNEUMATICS", // pumps, cylinders, valves
  PLASTICS_RUBBER = "PLASTICS_RUBBER",         // sheets, pipes, gaskets, seals
  PACKAGING_MATERIALS = "PACKAGING_MATERIALS", // boxes, strapping, pallets
  CONSTRUCTION_MATERIALS = "CONSTRUCTION_MATERIALS", // cement, rebar, pipes
  BEARINGS_TRANSMISSION = "BEARINGS_TRANSMISSION",   // bearings, gears, belts
  INSTRUMENTATION = "INSTRUMENTATION",         // gauges, sensors, meters
  GENERAL_INDUSTRIAL = "GENERAL_INDUSTRIAL",
}

export enum ContactStatus {
  CONTACTED = "CONTACTED",
  NOT_CONTACTED = "NOT_CONTACTED",
}

export enum PaymentType {
  QR_CODE = "QR_CODE",
  PHONE_NUMBER = "PHONE_NUMBER",
  BANK_ACCOUNT = "BANK_ACCOUNT",
}

export enum EnrichmentSource {
  GOOGLE_MAPS = "GOOGLE_MAPS",
  JUSTDIAL = "JUSTDIAL",
  INDIAMART = "INDIAMART",
  OCR = "OCR",
  LLM = "LLM",
  MANUAL = "MANUAL",
}
