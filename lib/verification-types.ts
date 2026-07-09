export type VerificationModuleStatus = "active" | "development";

export type VerificationTypeCode =
  | "CT_FORCE"
  | "PRESSURE"
  | "TORQUE"
  | "FLOW"
  | "TEMPERATURE"
  | "DIMENSIONAL"
  | "MASS"
  | "SCLEROMETRIC";

export type VerificationTypeConfig = {
  code: VerificationTypeCode;
  title: string;
  shortTitle: string;
  description: string;
  status: VerificationModuleStatus;
  tag: string;
  createHref: string;
  measuresPathTemplate: string;
  reportPathTemplate: string;
};

export const verificationTypes: VerificationTypeConfig[] = [
  {
    code: "CT_FORCE",
    title: "Compressione / trazione",
    shortTitle: "CT",
    description:
      "Modulo per verifiche su macchine di prova a compressione e trazione, con scale, strumenti campione, punti di misura, rapporto e sezione tecnica.",
    status: "active",
    tag: "Disponibile",
    createHref: "/nuova-verifica/ct",
    measuresPathTemplate: "/verifiche/{id}/misure",
    reportPathTemplate: "/verifiche/{id}/rapporto/finale",
  },
  {
    code: "PRESSURE",
    title: "Manometri / pressione",
    shortTitle: "Pressione",
    description:
      "Modulo per verifiche su manometri, trasduttori e strumenti di pressione.",
    status: "active",
    tag: "Disponibile",
    createHref: "/nuova-verifica/pressione",
    measuresPathTemplate: "/verifiche/{id}/misure-pressione",
    reportPathTemplate: "/verifiche/{id}/rapporto/finale",
  },
  {
    code: "TORQUE",
    title: "Chiavi dinamometriche",
    shortTitle: "Coppia",
    description:
      "Modulo per verifiche su chiavi dinamometriche, strumenti di coppia e serraggi controllati.",
    status: "active",
    tag: "Disponibile",
    createHref: "/nuova-verifica/dinamometria",
    measuresPathTemplate: "/verifiche/{id}/misure-dinamometria",
    reportPathTemplate: "/verifiche/{id}/rapporto/finale",
  },
  {
    code: "FLOW",
    title: "Portata / contalitri",
    shortTitle: "Portata",
    description:
      "Modulo per verifiche su contalitri, misuratori di portata e strumenti collegati alla misura di volume/portata.",
    status: "active",
    tag: "Disponibile",
    createHref: "/nuova-verifica/portata",
    measuresPathTemplate: "/verifiche/{id}/misure-portata",
    reportPathTemplate: "/verifiche/{id}/rapporto/finale",
  },
  {
    code: "TEMPERATURE",
    title: "Temperatura",
    shortTitle: "Temperatura",
    description:
      "Modulo per termometri, sonde, datalogger e strumenti di misura temperatura.",
    status: "active",
    tag: "Disponibile",
    createHref: "/nuova-verifica/temperatura",
    measuresPathTemplate: "/verifiche/{id}/misure-temperatura",
    reportPathTemplate: "/verifiche/{id}/rapporto/finale",
  },
  {
    code: "DIMENSIONAL",
    title: "Dimensionale",
    shortTitle: "Dimensionale",
    description:
      "Modulo per calibri, micrometri, comparatori e strumenti dimensionali.",
    status: "active",
    tag: "Disponibile",
    createHref: "/nuova-verifica/dimensionale",
    measuresPathTemplate: "/verifiche/{id}/misure-dimensionale",
    reportPathTemplate: "/verifiche/{id}/rapporto/finale",
  },
  {
    code: "MASS",
    title: "Massa / bilance",
    shortTitle: "Massa",
    description:
      "Modulo per bilance, masse campione e strumenti collegati alle pesate.",
    status: "active",
    tag: "Disponibile",
    createHref: "/nuova-verifica/massa",
    measuresPathTemplate: "/verifiche/{id}/misure-massa",
    reportPathTemplate: "/verifiche/{id}/rapporto/finale",
  },
  {
    code: "SCLEROMETRIC",
    title: "Prove sclerometriche",
    shortTitle: "Sclerometro",
    description:
      "Modulo per sclerometri e strumenti di prova non distruttiva a rimbalzo, verificati su incudine di riferimento a valore nominale fisso.",
    status: "active",
    tag: "Disponibile",
    createHref: "/nuova-verifica/sclerometro",
    measuresPathTemplate: "/verifiche/{id}/misure-sclerometro",
    reportPathTemplate: "/verifiche/{id}/rapporto/finale",
  },
];

export function getVerificationTypeConfig(code: string | null | undefined) {
  return verificationTypes.find((type) => type.code === code) ?? null;
}

export function buildVerificationPath(template: string, recordId: string) {
  return template.replace("{id}", recordId);
}

export function getVerificationModuleFromMode(mode: string | null | undefined) {
  if (mode === "pressione") return "PRESSURE";
  if (mode === "dinamometria" || mode === "coppia") return "TORQUE";
  if (mode === "portata" || mode === "contalitri" || mode === "flow") return "FLOW";
  if (mode === "massa" || mode === "bilance") return "MASS";
  if (mode === "dimensionale") return "DIMENSIONAL";
  if (mode === "temperatura") return "TEMPERATURE";
  if (mode === "sclerometro" || mode === "sclerometrica") return "SCLEROMETRIC";

  return "CT_FORCE";
}
