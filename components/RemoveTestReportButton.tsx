"use client";
import {useState} from "react";
import {useAppUser} from "@/lib/app-user";
import {supabase} from "@/lib/supabase";
export default function RemoveTestReportButton({id,label,onRemoved,previouslyIssued=false}:{id:string;label:string;onRemoved:(id:string)=>void;previouslyIssued?:boolean}){
 const {profile}=useAppUser();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 if(profile.role!=="master"||(previouslyIssued&&!/(^|[^a-z0-9])(PROVA|TEST)([^a-z0-9]|$)/i.test(label)))return null;
 async function remove(){
  if(busy)return;setError("");
  const reason=window.prompt(`Rimozione della VI DI PROVA: ${label}\nIndicare il motivo (minimo 5 caratteri). Non usare per rapportini ufficiali.`);
  if(reason===null)return;if(reason.trim().length<5||reason.trim().length>500){setError("Inserire una motivazione da 5 a 500 caratteri.");return;}
  const confirmation=window.prompt(`La VI ${label} e i dati collegati saranno rimossi dall'archivio operativo. Una copia dei dati e l'evento resteranno conservati.\nConfermo che si tratta esclusivamente di una prova: digitare ELIMINA PROVA.`);
  if(confirmation!=="ELIMINA PROVA")return;
  setBusy(true);try{const {data,error}=await supabase.rpc("tv141_remove_test",{p_record_id:id,p_reason:reason.trim(),p_confirmation:confirmation});if(error||data?.removed!==id)throw new Error(error?.message||"Rimozione non confermata");onRemoved(id);}catch(e){setError(e instanceof Error?e.message:"Rimozione non riuscita");}finally{setBusy(false);}
 }
 return <div className="min-w-0 print-hidden"><button type="button" disabled={busy} title="Rimuovi esclusivamente una VI di prova. I documenti ufficiali firmati/emessi sono protetti." onClick={()=>void remove()} className="rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{busy?"Rimozione…":"Elimina prova"}</button>{error&&<p role="alert" className="mt-1 break-words text-xs text-red-700">{error}</p>}</div>;
}
