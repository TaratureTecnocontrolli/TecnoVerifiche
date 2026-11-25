"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useRecordEditPermission(recordId: string, reportStatus: string | null) {
  const key = recordId + ":" + (reportStatus ?? "draft");
  const [permission, setPermission] = useState<{ key: string; allowed: boolean }>({ key: "", allowed: false });
  useEffect(() => {
    let cancelled = false;
    if (reportStatus === "issued") return;
    void (async () => {
      const { data, error } = await supabase.rpc("tv_can_edit_record", { p_record_id: recordId });
      if (!cancelled) setPermission({ key, allowed: !error && data === true });
    })();
    return () => { cancelled = true; };
  }, [key, recordId, reportStatus]);
  return reportStatus !== "issued" && permission.key === key && permission.allowed;
}

// Protect the existing multi-request measurement save against concurrent signature/emission.
export async function beginMeasurementSave(recordId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("tv12_measurement_save", { p_record_id: recordId, p_action: "begin" });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}
export async function finishMeasurementSave(recordId: string, token: string | null, success: boolean): Promise<void> {
  if (!token) return; // VT has no VI save session.
  const { error } = await supabase.rpc("tv12_measurement_save", { p_record_id: recordId, p_action: "finish", p_token: token, p_success: success });
  if (error) throw new Error(error.message);
}
export async function finishMeasurementCreation(recordId: string): Promise<void> {
  const { error } = await supabase.rpc("tv12_measurement_save", { p_record_id: recordId, p_action: "finish_create" });
  if (error) throw new Error(error.message);
}
