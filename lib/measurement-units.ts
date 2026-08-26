const CANONICAL_UNITS: Record<string, string> = {
  n: "N",
  kn: "kN",
  kg: "kg",
  g: "g",
  mg: "mg",
  pa: "Pa",
  kpa: "kPa",
  mpa: "MPa",
  gpa: "GPa",
  bar: "bar",
  mbar: "mbar",
  mm: "mm",
  cm: "cm",
  m: "m",
  "µm": "µm",
  um: "µm",
  l: "L",
  ml: "mL",
  cl: "cL",
  dl: "dL",
  "l/min": "L/min",
  "ml/min": "mL/min",
  nm: "N·m",
  "n·m": "N·m",
  "n*m": "N·m",
  knm: "kN·m",
  "kn·m": "kN·m",
  "kn*m": "kN·m",
  c: "°C",
  "°c": "°C",
};

export function canonicalMeasurementUnit(value: unknown) {
  const unit = String(value ?? "").trim();

  if (!unit || unit === "-") {
    return "";
  }

  return CANONICAL_UNITS[unit.toLowerCase()] ?? unit;
}

export function measurementUnitSuffix(value: unknown) {
  const unit = canonicalMeasurementUnit(value);

  return unit ? " (" + unit + ")" : "";
}
