"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type CustomerOption,
  type Technician,
  type Vehicle,
  fetchCustomers,
  fetchTechnicians,
  fetchVehicles,
} from "@/lib/fleet";

/** Anagrafiche usate da calendario e attività: mezzi, tecnici, clienti. */
export function useFleetReferenceData() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [v, t, c] = await Promise.all([
        fetchVehicles(),
        fetchTechnicians(),
        fetchCustomers(),
      ]);
      setVehicles(v);
      setTechnicians(t);
      setCustomers(c);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Errore nel caricamento delle anagrafiche."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento iniziale dati
    reload();
  }, [reload]);

  return { vehicles, technicians, customers, isLoading, error, reload };
}
