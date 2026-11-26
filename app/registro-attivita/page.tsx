import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AuditRegister, { type AuditRow } from "@/components/AuditRegister";
import { isViOnlyMode } from "@/lib/app-mode";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Log = {id:string;entity_type:string;entity_id:string|null;action:string;old_data:Record<string,unknown>|null;new_data:Record<string,unknown>|null;created_by:string|null;created_at:string};
const labels:Record<string,string>={vi12_remove_test:"Eliminazione VI di prova",metrology_bulk_period:"Configurazione massiva periodicità",vi12_confirm:"Conferma firma",vi12_claim:"Presa in carico del rapportino",vi12_release:"Rilascio presa in carico",vi12_number:"Assegnazione numero rapportino",vi12_ready:"Segna pronto",vi12_issue:"Emissione rapportino",vi12_reopen:"Riapertura per correzione",vi12_reset:"Revoca conferme",vi12_revoke:"Revoca firma personale",vi12_invite:"Aggiunta esecutore",vi12_assign_owner:"Associazione esecutore storico",vi12_measurement_begin:"Inizio salvataggio misure",vi12_measurement_finish:"Fine salvataggio misure",vi12_measurement_finish_create:"Creazione nuova VI",status_change:"Cambio stato"};
const states:Record<string,string>={draft:"Bozza",ready:"Pronto",issued:"Emesso",reopened:"Riaperto",completed:"Completata",validated:"Validata",in_progress:"In corso",cancelled:"Annullato",pending:"In attesa"};
const dateFormat=new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",dateStyle:"short",timeStyle:"medium"});
const dayFormat=new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome"});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function status(data:Record<string,unknown>|null){const v=data?.status??data?.status_label;return typeof v==="string"&&v.trim()?(states[v.toLowerCase()]??v):"—";}
function recordedNumber(log:Log){for(const v of [log.new_data?.main_report_number,log.new_data?.record_number,log.new_data?.number,log.old_data?.main_report_number,log.old_data?.record_number,log.old_data?.number])if(typeof v==="string"&&v.trim())return v;return "";}
function batches(ids:string[]){const out:string[][]=[];for(let i=0;i<ids.length;i+=100)out.push(ids.slice(i,i+100));return out;}

export default async function RegistroAttivitaPage(){
 const supabase=await createServerSupabaseClient();
 const {data:{user},error:userError}=await supabase.auth.getUser();
 if(userError||!user)redirect("/login");
 const {data:profileData,error:profileError}=await supabase.rpc("get_my_app_profile");
 const profile=Array.isArray(profileData)?profileData[0]:profileData;
 if(profileError||!profile||profile.user_id!==user.id||profile.is_active!==true||profile.role!=="master")redirect("/");
 const cutoff=new Date().toISOString();
 const logs:Log[]=[];let errorMessage="";let lookupWarning=false;
 const limit=500;
 // Stable ordering and fixed upper time boundary. No 150-row export truncation.
 for(let offset=0;;offset+=limit){
   let query=supabase.from("audit_logs").select("id,entity_type,entity_id,action,old_data,new_data,created_by,created_at").lte("created_at",cutoff);
   if(isViOnlyMode)query=query.or("action.like.vi12\\_%,action.eq.metrology_bulk_period");
   const {data,error}=await query.order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+limit-1);
   if(error){errorMessage="Caricamento incompleto del registro: "+error.message;break;}
   const part=(data??[]) as Log[];logs.push(...part);if(part.length<limit)break;
 }
 const actors=new Map<string,{name:string;role:string}>();const records=new Map<string,string>();const reportNumbers=new Map<string,string>();
 const actorIds=[...new Set(logs.map(x=>x.created_by).filter((x):x is string=>typeof x==="string"&&uuid.test(x)).map(x=>x.toLowerCase()))];
 const recordIds=[...new Set(logs.filter(x=>x.entity_type==="calibration_record"||x.entity_type==="internal_report").map(x=>x.entity_id).filter((x):x is string=>typeof x==="string"&&uuid.test(x)))];
 // The database RPC checks MASTER independently of the server-side guard.
 // It returns only names/roles for requested IDs actually present in audit_logs.
 if(actorIds.length){
   for(const ids of batches(actorIds)){
     try{
       const {data,error}=await supabase.rpc("tv_audit_actor_names_rev155",{p_actor_ids:ids});
       if(error){lookupWarning=true;continue;}
       for(const entry of (data??[]) as {actor_id:string;actor_name:string|null;actor_role:string|null}[]){
         if(entry.actor_name?.trim())actors.set(entry.actor_id.toLowerCase(),{name:entry.actor_name.trim(),role:entry.actor_role==="master"?"MASTER":entry.actor_role==="technician"?"TECNICO":entry.actor_role||""});
       }
     }catch{
       lookupWarning=true;
     }
   }
   if(actorIds.some(id=>!actors.has(id)))lookupWarning=true;
 }
 for(const ids of batches(recordIds)){
   let recordQuery=supabase.from("calibration_records").select("id,record_number").in("id",ids);
   if(isViOnlyMode)recordQuery=recordQuery.eq("verification_scope","VI");
   const {data,error}=await recordQuery;if(error){lookupWarning=true;continue;}
   const allowedIds=(data??[]).map(x=>x.id);
   for(const r of data??[])if(r.record_number)records.set(r.id,r.record_number);
   if(!allowedIds.length)continue;
   const {data:details,error:detailError}=await supabase.from("calibration_report_details").select("calibration_record_id,main_report_number").in("calibration_record_id",allowedIds);
   if(detailError){lookupWarning=true;continue;}
   for(const d of details??[])if(d.main_report_number)reportNumbers.set(d.calibration_record_id,d.main_report_number);
 }
 const removedNumbers=new Map<string,string>();
 for(const log of logs)if(log.action==="vi12_remove_test"&&log.entity_id&&recordedNumber(log))removedNumbers.set(log.entity_id,recordedNumber(log));
 const today=dayFormat.format(new Date(cutoff));
 const rows:AuditRow[]=logs.map(log=>{
   const id=log.entity_id??"";const actor=actors.get((log.created_by??"").toLowerCase());const original=recordedNumber(log)||removedNumbers.get(id)||"";const current=reportNumbers.get(id)||records.get(id)||"";
   return {id:log.id,date:dateFormat.format(new Date(log.created_at)),entity:log.entity_type==="calibration_record"?"Verifica":log.entity_type==="internal_report"?"Rapportino VI":log.entity_type,entityId:id,reference:original||current||"—",referenceCurrent:!original&&!!current,action:(labels[log.action]??log.action)+(log.action==="vi12_remove_test"&&typeof log.new_data?.reason==="string"?" · "+log.new_data.reason:log.action==="metrology_bulk_period"?` · ${log.new_data?.kind??""} ${log.new_data?.activity??""} ${log.new_data?.months??""} mesi · ${log.new_data?.updated??0} aggiornati`:""),actionCode:log.action,previous:status(log.old_data),next:status(log.new_data),actor:actor?.name||(log.created_by&&uuid.test(log.created_by)?"Utente non identificato":log.created_by)||"—",actorId:log.created_by??"",role:actor?.role??"",today:dayFormat.format(new Date(log.created_at))===today};
 });
 return <AppShell><AuditRegister rows={rows} snapshot={dateFormat.format(new Date(cutoff))} scope={isViOnlyMode?"Eventi VI e configurazioni metrologiche (REV.12 e successive)":"Eventi applicativi disponibili"} error={errorMessage} lookupWarning={lookupWarning}/></AppShell>;
}
