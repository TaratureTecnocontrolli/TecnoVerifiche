export const STANDARD_GRAVITY_M_S2 = 9.80665;
export const DEFAULT_TORQUE_ARM_LENGTH_M = 1;
export const TORQUE_ACCURACY_LIMIT_PERCENT = 3;
export const TORQUE_METADATA_PREFIX = "TORQUE_MASS_V1:";

export type TorqueMassPointInput = {
  id: string;
  theoreticalMassKg: number;
  appliedMass1Kg: number;
  appliedMass2Kg: number;
  appliedMass3Kg: number;
};

export type TorqueMassCalculatedPoint = TorqueMassPointInput & {
  nominalTorqueNm: number;
  reading1Nm: number;
  reading2Nm: number;
  reading3Nm: number;
  maxNm: number;
  minNm: number;
  averageNm: number;
  meanErrorNm: number;
  accuracyErrorPercent: number | null;
  repeatabilityErrorPercent: number | null;
  result: "CONFORME" | "NON CONFORME" | null;
};

export type TorqueMeasurementMetadata = {
  version: 1;
  theoreticalMassKg: number;
  appliedMass1Kg: number;
  appliedMass2Kg: number;
  appliedMass3Kg: number;
  userNotes?: string | null;
};

export function torqueFromMassKg(
  massKg: number,
  armLengthM: number,
  gravityM_s2 = STANDARD_GRAVITY_M_S2
) {
  return massKg * gravityM_s2 * armLengthM;
}

export function massKgFromTorque(
  torqueNm: number,
  armLengthM: number,
  gravityM_s2 = STANDARD_GRAVITY_M_S2
) {
  const denominator = gravityM_s2 * armLengthM;
  return denominator !== 0 ? torqueNm / denominator : 0;
}

export function calculateTorqueMassPoint(
  point: TorqueMassPointInput,
  armLengthM: number,
  gravityM_s2 = STANDARD_GRAVITY_M_S2,
  accuracyLimitPercent = TORQUE_ACCURACY_LIMIT_PERCENT
): TorqueMassCalculatedPoint {
  const nominalTorqueNm = torqueFromMassKg(
    point.theoreticalMassKg,
    armLengthM,
    gravityM_s2
  );
  const reading1Nm = torqueFromMassKg(
    point.appliedMass1Kg,
    armLengthM,
    gravityM_s2
  );
  const reading2Nm = torqueFromMassKg(
    point.appliedMass2Kg,
    armLengthM,
    gravityM_s2
  );
  const reading3Nm = torqueFromMassKg(
    point.appliedMass3Kg,
    armLengthM,
    gravityM_s2
  );
  const values = [reading1Nm, reading2Nm, reading3Nm];
  const maxNm = Math.max(...values);
  const minNm = Math.min(...values);
  const averageNm = values.reduce((sum, value) => sum + value, 0) / values.length;
  const meanErrorNm = averageNm - nominalTorqueNm;
  const accuracyErrorPercent =
    nominalTorqueNm !== 0 ? (meanErrorNm / nominalTorqueNm) * 100 : null;
  const repeatabilityErrorPercent =
    averageNm !== 0 ? ((maxNm - minNm) / averageNm) * 100 : null;
  const result =
    accuracyErrorPercent === null
      ? null
      : Math.abs(accuracyErrorPercent) <= accuracyLimitPercent
        ? "CONFORME"
        : "NON CONFORME";

  return {
    ...point,
    nominalTorqueNm,
    reading1Nm,
    reading2Nm,
    reading3Nm,
    maxNm,
    minNm,
    averageNm,
    meanErrorNm,
    accuracyErrorPercent,
    repeatabilityErrorPercent,
    result,
  };
}

export function calculateTorqueMetricsFromReadings(
  nominalTorqueNm: number,
  reading1Nm: number,
  reading2Nm: number,
  reading3Nm: number,
  accuracyLimitPercent = TORQUE_ACCURACY_LIMIT_PERCENT
) {
  const values = [reading1Nm, reading2Nm, reading3Nm];
  const maxNm = Math.max(...values);
  const minNm = Math.min(...values);
  const averageNm = values.reduce((sum, value) => sum + value, 0) / values.length;
  const meanErrorNm = averageNm - nominalTorqueNm;
  const accuracyErrorPercent =
    nominalTorqueNm !== 0 ? (meanErrorNm / nominalTorqueNm) * 100 : null;
  const repeatabilityErrorPercent =
    averageNm !== 0 ? ((maxNm - minNm) / averageNm) * 100 : null;
  const result =
    accuracyErrorPercent === null
      ? null
      : Math.abs(accuracyErrorPercent) <= accuracyLimitPercent
        ? "CONFORME"
        : "NON CONFORME";

  return {
    maxNm,
    minNm,
    averageNm,
    meanErrorNm,
    accuracyErrorPercent,
    repeatabilityErrorPercent,
    result: result as "CONFORME" | "NON CONFORME" | null,
  };
}

export function overallTorqueResult(points: TorqueMassCalculatedPoint[]) {
  if (points.length === 0 || points.some((point) => point.result === null)) {
    return null;
  }

  return points.every((point) => point.result === "CONFORME")
    ? "CONFORME"
    : "NON CONFORME";
}

export function serializeTorqueMeasurementMetadata(
  metadata: Omit<TorqueMeasurementMetadata, "version">
) {
  return TORQUE_METADATA_PREFIX + JSON.stringify({ version: 1, ...metadata });
}

export function parseTorqueMeasurementMetadata(
  value: unknown
): TorqueMeasurementMetadata | null {
  const text = String(value ?? "").trim();

  if (!text.startsWith(TORQUE_METADATA_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(text.slice(TORQUE_METADATA_PREFIX.length));

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const theoreticalMassKg = Number(parsed.theoreticalMassKg);
    const appliedMass1Kg = Number(parsed.appliedMass1Kg);
    const appliedMass2Kg = Number(parsed.appliedMass2Kg);
    const appliedMass3Kg = Number(parsed.appliedMass3Kg);

    if (
      !Number.isFinite(theoreticalMassKg) ||
      !Number.isFinite(appliedMass1Kg) ||
      !Number.isFinite(appliedMass2Kg) ||
      !Number.isFinite(appliedMass3Kg)
    ) {
      return null;
    }

    return {
      version: 1,
      theoreticalMassKg,
      appliedMass1Kg,
      appliedMass2Kg,
      appliedMass3Kg,
      userNotes:
        typeof parsed.userNotes === "string" && parsed.userNotes.trim()
          ? parsed.userNotes
          : null,
    };
  } catch {
    return null;
  }
}

export function readTorqueProcedureSettings(snapshot: unknown) {
  const source =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? (snapshot as Record<string, unknown>)
      : {};
  const gravity = Number(source.gravity_acceleration_m_s2);
  const armLength = Number(source.arm_length_m);
  const accuracyLimit = Number(source.accuracy_limit_percent);

  return {
    gravityM_s2:
      Number.isFinite(gravity) && gravity > 0 ? gravity : STANDARD_GRAVITY_M_S2,
    armLengthM:
      Number.isFinite(armLength) && armLength > 0
        ? armLength
        : DEFAULT_TORQUE_ARM_LENGTH_M,
    accuracyLimitPercent:
      Number.isFinite(accuracyLimit) && accuracyLimit > 0
        ? accuracyLimit
        : TORQUE_ACCURACY_LIMIT_PERCENT,
    isMassBased:
      String(source.calculation_engine_version ?? "").toLowerCase() ===
      "torque-mass-v1",
  };
}
