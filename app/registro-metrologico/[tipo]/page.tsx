import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import MetrologyRegister from "@/components/MetrologyRegister";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Event,Instrument,Kind,Profile } from "@/lib/metrology-register";
export const dynamic="force-dynamic";
export const revalidate=0;
export default async function RegisterPage({params}:{params:Promise<{tipo:string}>}){
 const {tipo}=await params;if(tipo!=="interni"&&tipo!=="campioni")notFound();const kind:Kind=tipo;
 const db=await createServerSupabaseClient();const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)redirect("/login");
 const {data:raw,error:profileError}=await db.rpc("get_my_app_profile");const profile=Array.isArray(raw)?raw[0]:raw;if(profileError||!profile||profile.user_id!==user.id||profile.is_active!==true||!["master","technician"].includes(profile.role))redirect("/");
 const errors:string[]=[];const instruments:Instrument[]=[];const profiles:Profile[]=[];const events:Event[]=[];
 const table=kind==="interni"?"internal_instruments":"reference_instruments";
 const common="lab_site,id,internal_code,name,manufacturer,model,serial_number,status";
 const cols=common+(kind==="interni"?",is_active":",certificate_number,certificate_date,certificate_expiry");
 const fk=kind==="interni"?"internal_instrument_id":"reference_instrument_id";
 const size=200;
 for(let offset=0;;offset+=size){const {data,error}=await db.from(table).select(cols).order("id").range(offset,offset+size-1);if(error){errors.push("Anagrafica: "+error.message);break;}const part=(data??[]) as unknown as Instrument[];instruments.push(...part);if(part.length<size)break;}
 for(let offset=0;;offset+=size){const {data,error}=await db.from("metrology_profiles").select("*").not(fk,"is",null).order("id").range(offset,offset+size-1);if(error){errors.push("Configurazioni EMAS: "+error.message);break;}const part=(data??[]) as Profile[];profiles.push(...part);if(part.length<size)break;}
 if(kind==="interni"){
  const records:{id:string;internal_instrument_id:string;verification_date:string;record_number:string|null}[]=[];
  for(let offset=0;;offset+=size){const {data,error}=await db.from("calibration_records").select("id,internal_instrument_id,verification_date,record_number").eq("verification_scope","VI").eq("report_status","issued").not("internal_instrument_id","is",null).order("id").range(offset,offset+size-1);if(error){errors.push("VI emesse: "+error.message);break;}const part=(data??[]) as typeof records;records.push(...part);if(part.length<size)break;}
  const numbers=new Map<string,string>();for(let i=0;i<records.length;i+=50){const ids=records.slice(i,i+50).map(r=>r.id);const {data,error}=await db.from("calibration_report_details").select("calibration_record_id,main_report_number").in("calibration_record_id",ids);if(error){errors.push("Numerazione rapportini: "+error.message);break;}for(const row of data??[])if(row.main_report_number)numbers.set(row.calibration_record_id,row.main_report_number);}
  for(const r of records)events.push({id:r.id,instrumentId:r.internal_instrument_id,kind:"VI",date:r.verification_date,reference:numbers.get(r.id)||r.record_number||"Numero non disponibile",source:"VI emessa"});
 }
 return <AppShell><MetrologyRegister key={kind} kind={kind} instruments={instruments} profiles={profiles} events={events} errors={errors} canEdit={profile.role==="master"}/></AppShell>;
}
