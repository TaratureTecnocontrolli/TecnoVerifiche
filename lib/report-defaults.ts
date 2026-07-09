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

function clean(value: string | null | undefined, fallback = "-") {
  const trimmed = value?.trim();

  return trimmed ? trimmed : fallback;
}

function instrumentDescription(input: ReportDefaultsInput) {
  const parts = [
    clean(input.instrumentName, "strumento"),
    input.instrumentManufacturer,
    input.instrumentModel,
    input.instrumentSerial ? "s/n " + input.instrumentSerial : null,
    input.instrumentRange ? "FS/campo " + input.instrumentRange : null,
  ].filter(Boolean);

  return parts.join(" ");
}

function referenceDescription(input: ReportDefaultsInput) {
  const parts = [
    clean(input.referenceName, "strumento campione"),
    input.referenceManufacturer,
    input.referenceModel,
    input.referenceSerial ? "s/n " + input.referenceSerial : null,
    input.referenceInternalCode ? "cod. int. " + input.referenceInternalCode : null,
  ].filter(Boolean);

  return parts.join(" ");
}

export function getCtForceReportDefaults(
  input: ReportDefaultsInput
): ReportTextDefaults {
  const instrument = instrumentDescription(input);
  const reference = referenceDescription(input);

  return {
    work_object: "Verifica della taratura di " + instrument,
    requested_tests:
      "Verifica della taratura di macchina/strumento per prove di compressione e/o trazione.",
    premise_text: [
      "Su incarico del Committente è stata eseguita la verifica della taratura dello strumento indicato nel presente rapporto.",
      "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni e nei campi di misura riportati nella sezione tecnica integrante del rapporto.",
      "I risultati riportati sono riferiti alle condizioni operative presenti al momento della verifica.",
    ].join("\n"),
    scope_text: [
      "Scopo della verifica è valutare la risposta metrologica dello strumento in prova mediante confronto con idoneo strumento campione.",
      "La verifica viene eseguita sui punti di carico previsti per la scala oggetto di controllo, rilevando le letture necessarie al calcolo degli errori di accuratezza e ripetibilità.",
      "Strumento sottoposto a verifica: " + instrument + ".",
    ].join("\n"),
    apparatus_description: [
      "L'apparato di verifica è costituito dallo strumento campione indicato nella sezione tecnica del rapporto e dagli accessori necessari all'applicazione/lettura del carico.",
      "Lo strumento campione utilizzato risulta identificato mediante codice interno, matricola, certificato e relativa scadenza, come riportato nello snapshot tecnico della verifica.",
      "Strumento campione utilizzato: " + reference + ".",
    ].join("\n"),
    execution_method: [
      "La verifica viene eseguita applicando punti di carico prestabiliti sulla scala oggetto di controllo.",
      "Per ciascun punto vengono rilevati i valori necessari alla determinazione della media, dell'errore relativo di accuratezza e dell'errore relativo di ripetibilità.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
      "La sezione tecnica integrante riporta, per ciascuna scala verificata, i punti di misura e i risultati ottenuti.",
    ].join("\n"),
    results_text: [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascun punto sono indicati il carico applicato/letto, le letture rilevate, la media, l'errore di accuratezza e l'errore di ripetibilità.",
      "La valutazione dei dati deve essere riferita esclusivamente allo strumento e alle condizioni di prova riportate nel presente rapporto.",
    ].join("\n"),
  };
}

export function getPressureReportDefaults(
  input: ReportDefaultsInput
): ReportTextDefaults {
  const instrument = instrumentDescription(input);
  const reference = referenceDescription(input);

  return {
    work_object: "Verifica della taratura di " + instrument,
    requested_tests:
      "Verifica della taratura di manometro / strumento di misura della pressione.",
    premise_text: [
      "Su incarico del Committente è stata eseguita la verifica della taratura dello strumento indicato nel presente rapporto.",
      "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni e nei punti di misura riportati nella sezione tecnica integrante del rapporto.",
      "I risultati riportati sono riferiti alle condizioni operative presenti al momento della verifica.",
    ].join("\n"),
    scope_text: [
      "Scopo della verifica è valutare la risposta metrologica dello strumento di pressione mediante confronto con idoneo strumento campione.",
      "La verifica viene eseguita rilevando le letture dello strumento in prova sui punti di pressione previsti, in carico ed eventualmente in scarico.",
      "Strumento sottoposto a verifica: " + instrument + ".",
    ].join("\n"),
    apparatus_description: [
      "L'apparato di verifica è costituito dallo strumento campione indicato nella sezione tecnica del rapporto e dagli accessori necessari alla generazione e lettura della pressione di riferimento.",
      "Lo strumento campione utilizzato risulta identificato mediante codice interno, matricola, certificato e relativa scadenza, come riportato nello snapshot tecnico della verifica.",
      "Strumento campione utilizzato: " + reference + ".",
    ].join("\n"),
    execution_method: [
      "La verifica viene eseguita confrontando i valori indicati dallo strumento in prova con i valori applicati tramite lo strumento campione.",
      "Per ogni punto vengono rilevate tre letture dello strumento in prova.",
      "Per ciascun punto vengono determinati lettura massima, lettura minima, media delle letture, errore medio, errore di accuratezza percentuale e ripetibilità percentuale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    results_text: [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascun punto sono indicati il valore applicato, le letture rilevate, la media, l'errore medio, l'errore di accuratezza percentuale e l'errore di ripetibilità percentuale.",
    ].join("\n"),
  };
}

export function getTorqueReportDefaults(
  input: ReportDefaultsInput
): ReportTextDefaults {
  const instrument = instrumentDescription(input);
  const reference = referenceDescription(input);

  return {
    work_object: "Verifica della taratura di " + instrument,
    requested_tests:
      "Verifica della taratura di chiave dinamometrica / strumento di coppia.",
    premise_text: [
      "Su incarico del Committente è stata eseguita la verifica della taratura dello strumento indicato nel presente rapporto.",
      "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni e nei punti di misura riportati nella sezione tecnica integrante del rapporto.",
      "I risultati riportati sono riferiti alle condizioni operative presenti al momento della verifica.",
    ].join("\n"),
    scope_text: [
      "Scopo della verifica è valutare la risposta metrologica dello strumento di coppia mediante confronto con idoneo strumento campione.",
      "La verifica è eseguita su punti di coppia prestabiliti, rilevando tre letture per ciascun punto e calcolando media, errore medio, errore di accuratezza percentuale e ripetibilità.",
      "Strumento sottoposto a verifica: " + instrument + ".",
    ].join("\n"),
    apparatus_description: [
      "L'apparato di verifica è costituito dallo strumento campione indicato nella sezione tecnica del rapporto e dagli eventuali accessori necessari all'applicazione controllata della coppia.",
      "Lo strumento campione utilizzato risulta identificato mediante codice interno, matricola, certificato e relativa scadenza, come riportato nello snapshot tecnico della verifica.",
      "Strumento campione utilizzato: " + reference + ".",
    ].join("\n"),
    execution_method: [
      "La verifica viene eseguita applicando i punti di coppia previsti e rilevando, per ciascun punto, tre letture consecutive dello strumento in prova.",
      "Per ogni punto vengono determinati il valore massimo, il valore minimo, la media delle letture, l'errore medio, l'errore di accuratezza percentuale e l'errore di ripetibilità percentuale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    results_text: [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascun punto di coppia sono indicati il valore applicato, le tre letture rilevate, la media, l'errore medio, l'errore di accuratezza percentuale e l'errore di ripetibilità percentuale.",
    ].join("\n"),
  };
}

export function getFlowReportDefaults(
  input: ReportDefaultsInput
): ReportTextDefaults {
  const instrument = instrumentDescription(input);
  const reference = referenceDescription(input);

  return {
    work_object: "Verifica taratura di " + instrument,
    requested_tests: "Verifica taratura contalitri / strumento di misura volume-portata.",
    premise_text: [
      "Su incarico del Committente è stata eseguita la verifica della taratura dello strumento indicato nel presente rapporto.",
      "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni e nei punti di misura riportati nella sezione tecnica integrante del rapporto.",
      "Strumento sottoposto a verifica: " + instrument + ".",
    ].join("\n"),
    scope_text: [
      "Scopo della verifica è valutare la risposta metrologica del contalitri / strumento di misura volume-portata mediante confronto con idoneo strumento campione.",
      "La verifica è eseguita confrontando il volume impostato sullo strumento in verifica con le letture rilevate sullo strumento campione, su tre cicli di misura.",
    ].join("\n"),
    apparatus_description: [
      "La verifica di taratura dello strumento è stata eseguita con l'ausilio dello strumento campione indicato nella sezione tecnica, comparando i risultati su tre cicli di misura.",
      "La temperatura e l'umidità ambientale sono riportate, ove rilevate, nella sezione risultati del rapporto.",
      "L'apparato utilizzato comprende: " + reference + ".",
    ].join("\n"),
    execution_method: [
      "La verifica viene eseguita impostando sullo strumento in prova i volumi nominali previsti e rilevando tre letture per ciascun punto.",
      "Per ciascun punto vengono determinati media delle letture, errore ed errore percentuale.",
      "Errore = Media letture - Volume impostato.",
      "Errore % = Errore / Volume impostato x 100.",
    ].join("\n"),
    results_text: [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascun punto sono indicati volume nominale, volume impostato nello strumento in verifica, tre letture, media letture, errore ed errore percentuale.",
    ].join("\n"),
  };
}

export function getSclerometricReportDefaults(
  input: ReportDefaultsInput
): ReportTextDefaults {
  const instrument = instrumentDescription(input);
  const reference = referenceDescription(input);

  return {
    work_object: "Verifica della taratura di " + instrument,
    requested_tests:
      "Verifica della taratura di sclerometro / strumento di prova non distruttiva a rimbalzo.",
    premise_text: [
      "Su incarico del Committente è stata eseguita la verifica della taratura dello strumento indicato nel presente rapporto.",
      "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni riportate nella sezione tecnica integrante del rapporto.",
      "Strumento sottoposto a verifica: " + instrument + ".",
    ].join("\n"),
    scope_text: [
      "Scopo della verifica è valutare la risposta metrologica dello sclerometro mediante confronto con incudine di riferimento a valore nominale fisso.",
      "La verifica è eseguita tramite battute ripetute sull'incudine di riferimento, rilevando tre letture per battuta e calcolando media, errore medio ed errore percentuale rispetto al valore nominale di riferimento.",
    ].join("\n"),
    apparatus_description: [
      "L'apparato di verifica è costituito dall'incudine di riferimento indicata nella sezione tecnica del rapporto, a valore nominale certificato.",
      "L'incudine di riferimento utilizzata risulta identificata mediante codice interno, matricola, certificato e relativa scadenza, come riportato nello snapshot tecnico della verifica.",
      "Strumento campione utilizzato: " + reference + ".",
    ].join("\n"),
    execution_method: [
      "La verifica viene eseguita effettuando un numero prestabilito di battute sull'incudine di riferimento e rilevando, per ciascuna battuta, tre letture consecutive dello strumento in prova.",
      "Per ciascuna battuta viene determinata la media delle letture, l'errore medio e l'errore percentuale rispetto al valore nominale dell'incudine di riferimento.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    results_text: [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascuna battuta sono indicati il valore nominale di riferimento, le tre letture rilevate, la media, l'errore medio e l'errore percentuale.",
    ].join("\n"),
  };
}

export function getMassReportDefaults(
  input: ReportDefaultsInput
): ReportTextDefaults {
  const instrument = instrumentDescription(input);
  const reference = referenceDescription(input);

  return {
    work_object: "Verifica della taratura di " + instrument,
    requested_tests:
      "Verifica della taratura di bilancia / strumento di misura della massa mediante prove di ripetibilità, eccentricità e linearità.",
    premise_text: [
      "Su incarico del Committente è stata eseguita la verifica della taratura dello strumento indicato nel presente rapporto.",
      "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni e nei punti di misura riportati nella sezione tecnica integrante del rapporto.",
      "Strumento sottoposto a verifica: " + instrument + ".",
    ].join("\n"),
    scope_text: [
      "Scopo della verifica è valutare la risposta metrologica della bilancia mediante confronto con masse campione.",
      "La verifica è eseguita tramite tre prove distinte: ripetibilità (letture ripetute su un unico punto), eccentricità (letture su più zone del piatto di pesata) e linearità (letture su più punti dell'intero campo di pesata).",
    ].join("\n"),
    apparatus_description: [
      "L'apparato di verifica è costituito dalle masse campione indicate nella sezione tecnica del rapporto.",
      "Le masse campione utilizzate risultano identificate mediante codice interno, matricola, certificato e relativa scadenza, come riportato nello snapshot tecnico della verifica.",
      "Strumento campione utilizzato: " + reference + ".",
    ].join("\n"),
    execution_method: [
      "La prova di ripetibilità viene eseguita rilevando tre letture su un unico punto di carico, calcolando media, errore ed errore di ripetibilità percentuale.",
      "La prova di eccentricità viene eseguita rilevando tre letture su più zone del piatto di pesata (centro e periferia), calcolando per ciascuna zona media, errore e ripetibilità percentuale.",
      "La prova di linearità viene eseguita rilevando tre letture su più punti distribuiti sull'intero campo di pesata, calcolando per ciascun punto media, errore, errore percentuale rispetto al peso campione e ripetibilità percentuale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    results_text: [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto, distinti per prova di ripetibilità, eccentricità e linearità.",
      "Per ciascun punto sono indicati il peso nominale, il peso campione, le tre letture rilevate, la media, l'errore e la ripetibilità percentuale (l'errore percentuale rispetto al peso campione è indicato solo per la prova di linearità).",
    ].join("\n"),
  };
}

export function getDimensionalReportDefaults(
  input: ReportDefaultsInput
): ReportTextDefaults {
  const instrument = instrumentDescription(input);
  const reference = referenceDescription(input);

  return {
    work_object: "Verifica della taratura di " + instrument,
    requested_tests:
      "Verifica della taratura di calibro / strumento dimensionale mediante confronto con blocchi o campioni di riferimento.",
    premise_text: [
      "Su incarico del Committente è stata eseguita la verifica della taratura dello strumento indicato nel presente rapporto.",
      "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni e nei punti di misura riportati nella sezione tecnica integrante del rapporto.",
      "Strumento sottoposto a verifica: " + instrument + ".",
    ].join("\n"),
    scope_text: [
      "Scopo della verifica è valutare la risposta metrologica dello strumento dimensionale mediante confronto con campioni di riferimento.",
      "La verifica è eseguita su punti prestabiliti, rilevando tre scostamenti per ciascun punto e calcolando media, errore medio, errore di accuratezza percentuale, ripetibilità e incertezza strumentale.",
    ].join("\n"),
    apparatus_description: [
      "L'apparato di verifica è costituito dai campioni di riferimento indicati nella sezione tecnica del rapporto.",
      "I campioni di riferimento utilizzati risultano identificati mediante codice interno, matricola, certificato e relativa scadenza, come riportato nello snapshot tecnico della verifica.",
      "Strumento campione utilizzato: " + reference + ".",
    ].join("\n"),
    execution_method: [
      "La verifica viene eseguita confrontando lo strumento in prova con i campioni di riferimento sui punti previsti, rilevando tre scostamenti consecutivi per ciascun punto.",
      "Per ogni punto vengono determinati il valore massimo, il valore minimo, la media degli scostamenti, l'errore medio, l'errore di accuratezza percentuale, l'errore di ripetibilità percentuale e l'incertezza strumentale.",
      "Le formule utilizzate sono riportate nella sezione di espressione dei risultati del presente rapporto.",
    ].join("\n"),
    results_text: [
      "I risultati della verifica sono riportati nella sezione tecnica integrante del presente rapporto.",
      "Per ciascun punto sono indicati il valore nominale, i tre scostamenti rilevati, la media, l'errore medio, l'errore di accuratezza percentuale, l'errore di ripetibilità percentuale e l'incertezza strumentale.",
    ].join("\n"),
  };
}

export function getReportDefaultsByModule(
  module: string | null | undefined,
  mode: string | null | undefined,
  input: ReportDefaultsInput
): ReportTextDefaults {
  if (module === "PRESSURE" || mode === "pressione") {
    return getPressureReportDefaults(input);
  }

  if (module === "TORQUE" || mode === "dinamometria") {
    return getTorqueReportDefaults(input);
  }

  if (module === "FLOW" || mode === "portata") {
    return getFlowReportDefaults(input);
  }

  if (module === "SCLEROMETRIC" || mode === "sclerometro") {
    return getSclerometricReportDefaults(input);
  }

  if (module === "MASS" || mode === "massa") {
    return getMassReportDefaults(input);
  }

  if (module === "DIMENSIONAL" || mode === "dimensionale") {
    return getDimensionalReportDefaults(input);
  }

  return getCtForceReportDefaults(input);
}
