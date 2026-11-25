"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabase";
import {useAppUser} from "@/lib/app-user";
import LabSiteSelect from "@/components/LabSiteSelect";
export default function InstrumentSiteCard({id,kind,initialSite}:{id:string;kind:"interni"|"campioni";initialSite:string|null}) {
 const {profile}=useAppUser();const router=useRouter();const [site,setSite]=useState(initialSite??"");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function save(){if(busy||profile.role!=="master")return;setBusy(true);setMessage("");try{const {data,error}=await supabase.from(kind==="interni"?"internal_instruments":"reference_instruments").update({lab_site:site||null}).eq("id",id).select("id,lab_site").single();if(error||!data)throw new Error(error?.message||"Salvataggio non confermato");setMessage("Sede aggiornata");router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Errore");}finally{setBusy(false);}}
 return <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-bold">Sede aziendale</h2>{profile.role==="master"?<div className="mt-2 flex flex-wrap items-end gap-3"><LabSiteSelect value={site} onChange={setSite} disabled={busy}/><button type="button" className="tc-action" disabled={busy} onClick={()=>void save()}>Salva sede</button></div>:<p>{initialSite||"Da assegnare"}</p>}{message&&<p role="status" className="mt-2 text-sm">{message}</p>}</section>;
}
