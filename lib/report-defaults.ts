export type ReportDefaultsInput = {
  customerName?: string | null;
  customerNumber?: string | null;
  instrumentName?: string | null;
  instrumentManufacturer?: string | null;
  instrumentModel?: string | null;
  instrumentSerial?: string | null;
  instrumentRange?: string | null;
  referenceName?: string | null;
  referenceManufacturer?: string | null;
  referenceModel?: string | null;
  referenceSerial?: string | null;
  referenceInternalCode?: string | null;
  location?: string | null;
  testDate?: string | null;
};

export type ReportTextDefaults = {
  work_object: string;
  requested_tests: string;
  premise_text: string;
  scope_text: string;
  apparatus_description: string;
  execution_method: string;
  results_text: string;
};

type ReferenceLike = {
  name?: string | null;
  internal_code?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
};

function clean(value: string | null | undefined, fallback = "-") {
  const trimmed = value?.trim();

  return trimmed ? trimmed : fallback;
}

function instrumentDescription(input: ReportDefaultsInput) {
  const parts = [
    clean(input.instrumentName, "strumento"),
    input.instrumentManufacturer,
    input.instrumentModel,
    input.instrumentSerial ? "matr. " + input.instrumentSerial : null,
    input.instrumentRange ? "fondo scala/campo " + input.instrumentRange : null,
  ].filter(Boolean);

  return parts.join(" ");
}

function referenceDescription(input: ReportDefaultsInput) {
  const parts = [
    clean(input.referenceName, "strumento campione"),
    input.referenceManufacturer,
    input.referenceModel,
    input.referenceSerial ? "matr. " + input.referenceSerial : null,
    input.referenceInternalCode ? "cod. int. " + input.referenceInternalCode : null,
  ].filter(Boolean);

  return parts.join(" ");
}

function baseDefaults(
  input: ReportDefaultsInput,
  requestedTests: string,
  scopeText: string,
  executionMethod: string,
  resultsText: string,
  referenceLabel = "strumento campione"
): ReportTextDefaults {
  const instrument = instrumentDescription(input);
  const reference = referenceDescription(input);

  return {
    work_object: "Verifica di taratura",
    requested_tests: requestedTests,
    premise_text: [
      "Su incarico del Committente è stata eseguita la verifica di taratura dello strumento indicato nel presente rapporto.",
      "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni e nei punti di misura riportati nella sezione tecnica integrante del rapporto.",
      "I risultati riportati sono riferiti alle condizioni operative presenti al momento della verifica.",
    ].join("\n"),
    scope_text: [
      scopeText,
      "Strumento sottoposto a verifica: " + instrument + ".",
    ].join("\n"),
    apparatus_description: [
      "L'apparato di verifica è costituito dal " + referenceLabel + " indicato nella sezione tecnica del rapporto e dagli accessori necessari all'esecuzione della prova.",
      "Il campione utilizzato risulta identificato mediante codice interno, matricola, certificato e relativa scadenza, come riportato nello snapshot tecnico della verifica.",
     
    ].join("\n"),
    execution_method: executionMethod,
    results_text: resultsText,
  };
}

export function combineReferenceInstrumentNames(instruments: ReferenceLike[]) {
  const names = instruments
    .map((instrument) => {
      const parts = [
        instrument.name,
        instrument.internal_code ? "cod. " + instrument.internal_code : null,
      ].filter(Boolean);

      return parts.join(" ");
    })
    .filter(Boolean);

  return names.length > 0 ? names.join(", ") : "strumenti campione";
}

export function getCtForceReportDefaults(input: ReportDefaultsInput): ReportTextDefaults {
  const instrument = instrumentDescription(input);

  return {
    work_object: "Verifica di taratura",
    requested_tests:
      "Verifica di taratura di macchina/strumento per prove di compressione/trazione.",
    premise_text: [
      "Su incarico del Committente è stata eseguita la verifica di taratura dello strumento indicato nel presente Rapporto di Prova.",
      "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni e nei punti di misura riportati nella sezione tecnica che è parte integrante del presente Rapporto di Prova.",
      "Lo strumento sottoposto a verifica è: " + instrument + ".",
    ].join("\n"),
    scope_text: [
      "Lo scopo della verifica è valutare la risposta metrologica dello strumento mediante comparazione con idoneo sistema campione sui punti di carico previsti.",
      "La verifica viene eseguita sui ⅘ superiori della sua portata massima. Tale verifica è il procedimento di controllo per determinare gli errori della pressa.",
      "Gli errori si distinguono in:",
      "a) errore di ripetibilità;",
      "b) errore di accuratezza.",
    ].join("\n"),
    apparatus_description: [
      "L'apparato di verifica è costituito dagli strumenti campione indicati nella sezione tecnica del rapporto e accessori necessari all'esecuzione della prova.",
      "I campioni utilizzati risultano identificati mediante codice interno, matricola, certificato e relativa scadenza, come riportato nello snapshot tecnico della verifica.",
    ].join("\n"),
    execution_method: [
      "La verifica è stata eseguita disponendo lo strumento campione tra le piastre della pressa. Prima dell'inizio della verifica il sistema è stato portato al suo carico massimo per due volte a temperatura ambiente. La verifica è stata effettuata sui ⅘ superiori della portata massima della pressa e in particolare su n. 5 punti regolarmente spaziati.",
      "La temperatura e l’umidità sono state verificate con un termo-igrometro.",
      "L'insieme di queste operazioni rappresenta una serie di prove.",
    ].join("\n"),
    results_text: [
      "La verifica del punto di gradazione della scala viene effettuata leggendo il corrispondente valore effettivo sul dispositivo di verifica, con carico di prova crescente, quando i sistemi sono in equilibrio.",
      "Per ogni livello di carico l'errore relativo di accuratezza, espresso in percentuale, viene determinato confrontando il carico indicato dalla macchina con la media delle letture del dispositivo campione.",
      "L'errore relativo di ripetibilità è determinato a partire dalla differenza tra il valore massimo e il valore minimo delle letture rilevate.",
    ].join("\n"),
  };
}

export function getPressureReportDefaults(input: ReportDefaultsInput): ReportTextDefaults {
  return baseDefaults(
    input,
    "Verifica di taratura di manometro / strumento di misura della pressione.",
    "Scopo della verifica è valutare la risposta metrologica dello strumento di pressione mediante confronto con idoneo strumento campione, in carico ed eventualmente in scarico.",
    [
      "La verifica viene eseguita confrontando i valori indicati dallo strumento in prova con i valori applicati tramite lo strumento campione.",
      "Per ogni punto vengono rilevate due letture dello strumento in prova.",
      "Per ciascun punto vengono determinati lettura massima, lettura minima, media delle letture, errore medio, errore di accuratezza percentuale e ripetibilità percentuale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Le tabelle riportano, separatamente ove previsto, la prova in carico e la prova in scarico, con punto di applicazione, letture, media, errore medio, errore di accuratezza percentuale e ripetibilità percentuale.",
    ].join("\n")
  );
}

export function getTorqueReportDefaults(input: ReportDefaultsInput): ReportTextDefaults {
  return baseDefaults(
    input,
    "Verifica di taratura di chiave dinamometrica / strumento di coppia.",
    "Scopo della verifica è valutare la risposta metrologica dello strumento di coppia mediante confronto con idoneo strumento campione.",
    [
      "La verifica viene eseguita applicando i punti di coppia previsti e rilevando, per ciascun punto, tre letture consecutive dello strumento in prova.",
      "Per ogni punto vengono determinati il valore massimo, il valore minimo, la media delle letture, l'errore medio, l'errore di accuratezza percentuale e l'errore di ripetibilità percentuale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascun punto di coppia sono indicati il valore applicato, le tre letture rilevate, la media, l'errore medio, l'errore di accuratezza percentuale e l'errore di ripetibilità percentuale.",
    ].join("\n")
  );
}

export function getFlowReportDefaults(input: ReportDefaultsInput): ReportTextDefaults {
  return baseDefaults(
    input,
    "Verifica di taratura di contalitri / strumento di misura volume-portata.",
    "Scopo della verifica è valutare la risposta metrologica del contalitri / strumento di misura volume-portata mediante confronto con idoneo strumento campione.",
    [
      "La verifica viene eseguita impostando sullo strumento in prova i volumi nominali previsti e rilevando tre letture per ciascun punto.",
      "Per ciascun punto vengono determinati media delle letture, errore medio ed errore percentuale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascun punto sono indicati volume nominale, volume impostato, tre letture, media letture, errore medio ed errore percentuale.",
    ].join("\n")
  );
}

export function getMassReportDefaults(input: ReportDefaultsInput): ReportTextDefaults {
  return baseDefaults(
    input,
    "Verifica di taratura di bilancia / strumento di misura della massa.",
    "Scopo della verifica è valutare la risposta metrologica della bilancia mediante prove di ripetibilità, eccentricità e linearità.",
    [
      "La verifica viene eseguita mediante tre prove distinte: ripetibilità, eccentricità e linearità.",
      "Per ciascun punto vengono rilevate le letture previste e vengono determinati media, errore medio, errore percentuale ove applicabile ed errore di ripetibilità percentuale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto, distinti per ripetibilità, eccentricità e linearità.",
      "Per ciascun punto sono indicati il peso nominale, le letture rilevate, la media, l'errore medio e gli errori percentuali ove previsti.",
    ].join("\n"),
    "massa campione"
  );
}

export function getSclerometricReportDefaults(input: ReportDefaultsInput): ReportTextDefaults {
  return baseDefaults(
    input,
    "Verifica di taratura di sclerometro / strumento a rimbalzo.",
    "Scopo della verifica è valutare la risposta dello sclerometro mediante battute ripetute su incudine di riferimento a valore nominale noto.",
    [
      "La verifica viene eseguita effettuando battute sull'incudine di riferimento e rilevando tre letture per ciascuna battuta finale valida.",
      "Per ciascuna battuta vengono determinati media delle letture, errore medio ed errore percentuale rispetto al valore nominale dell'incudine.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascuna battuta sono indicati limite di controllo, letture L1-L2-L3, media, errore medio, errore medio percentuale ed esito.",
    ].join("\n"),
    "incudine di riferimento"
  );
}

export function getDimensionalReportDefaults(input: ReportDefaultsInput): ReportTextDefaults {
  return baseDefaults(
    input,
    "Verifica di taratura di strumento dimensionale.",
    "Scopo della verifica è valutare la risposta metrologica dello strumento dimensionale mediante confronto con campioni di riferimento.",
    [
      "La verifica viene eseguita confrontando lo strumento in prova con i campioni di riferimento sui punti previsti.",
      "Per ciascun punto vengono rilevati tre scostamenti e vengono determinati media, errore medio, errore di accuratezza percentuale, errore di ripetibilità percentuale e incertezza strumentale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascun punto sono indicati valore nominale, letture/scostamenti, media, errore medio, errore di accuratezza percentuale, ripetibilità e incertezza strumentale.",
    ].join("\n"),
    "campione di riferimento"
  );
}

export function getTemperatureReportDefaults(input: ReportDefaultsInput): ReportTextDefaults {
  return baseDefaults(
    input,
    "Monitoraggio / verifica temperatura.",
    "Scopo della verifica è rilevare e documentare i valori di temperatura secondo le modalità operative previste.",
    [
      "Il monitoraggio viene eseguito rilevando, a orari prefissati, la temperatura indicata dallo strumento in prova e la temperatura indicata dallo strumento di riferimento.",
      "I valori sono riportati come rilevati, senza calcolo automatico di errore o esito, salvo diversa indicazione della procedura applicabile.",
    ].join("\n"),
    [
      "I risultati sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascuna rilevazione sono indicati data, orario e valori misurati.",
    ].join("\n"),
    "termometro / strumento di riferimento"
  );
}

export function getPullOffReportDefaults(input: ReportDefaultsInput): ReportTextDefaults {
  return baseDefaults(
    input,
    "Verifica di taratura di strumentazione pull-off.",
    "Scopo della verifica è valutare la risposta metrologica della strumentazione pull-off mediante confronto con cella di carico campione.",
    [
      "La verifica viene eseguita applicando i punti di carico previsti tramite cella di carico campione e rilevando tre letture consecutive dello strumento in prova.",
      "Per ogni punto vengono determinati valore massimo, valore minimo, media delle letture, errore medio, errore di accuratezza percentuale ed errore di ripetibilità percentuale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascun punto di carico sono indicati valore applicato, tre letture, media, errore medio, errore di accuratezza percentuale e ripetibilità percentuale.",
    ].join("\n"),
    "cella di carico campione"
  );
}

export function getReportDefaultsByModule(
  module: string | null | undefined,
  mode: string | null | undefined,
  input: ReportDefaultsInput
): ReportTextDefaults {
  if (module === "PRESSURE" || mode === "pressione") return getPressureReportDefaults(input);
  if (module === "TORQUE" || mode === "dinamometria") return getTorqueReportDefaults(input);
  if (module === "FLOW" || mode === "portata") return getFlowReportDefaults(input);
  if (module === "MASS" || mode === "massa") return getMassReportDefaults(input);
  if (module === "SCLEROMETRIC" || mode === "sclerometro") return getSclerometricReportDefaults(input);
  if (module === "DIMENSIONAL" || mode === "dimensionale") return getDimensionalReportDefaults(input);
  if (module === "TEMPERATURE" || mode === "temperatura") return getTemperatureReportDefaults(input);
  if (module === "PULLOFF" || mode === "pulloff") return getPullOffReportDefaults(input);

  return getCtForceReportDefaults(input);
}