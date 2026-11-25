export type Kind = "interni" | "campioni";
export type ActivityKind = "VI" | "LAT" | "RdT";
export type Instrument = {id:string;lab_site?:string|null;internal_code:string|null;name:string;manufacturer:string|null;model:string|null;serial_number:string|null;status:string|null;is_active?:boolean;certificate_number?:string|null;certificate_date?:string|null;certificate_expiry?:string|null};
export type Profile = {id?:string;internal_instrument_id:string|null;reference_instrument_id:string|null;ontrack_code:string|null;avcp:string|null;lab_authorization:string|null;acceptance_criteria:string|null;operating_instruction:string|null;notes:string|null;vi_months:number|null;lat_months:number|null;rdt_months:number|null;vi_first_due:string|null;lat_first_due:string|null;rdt_first_due:string|null};
export type Event = {id:string;instrumentId:string;kind:ActivityKind;date:string;reference:string;source:"VI emessa"|"Certificato corrente"};
export const months=["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
export const activityKinds: ActivityKind[]=["VI","LAT","RdT"];
export function blankProfile(kind:Kind,id:string):Profile{return {internal_instrument_id:kind==="interni"?id:null,reference_instrument_id:kind==="campioni"?id:null,ontrack_code:null,avcp:null,lab_authorization:null,acceptance_criteria:null,operating_instruction:null,notes:null,vi_months:null,lat_months:null,rdt_months:null,vi_first_due:null,lat_first_due:null,rdt_first_due:null};}
export function dateIt(date:string|null|undefined){return date?date.slice(0,10).split("-").reverse().join("/"):"—";}
export function dateValid(d:string|null|undefined):d is string{return !!d&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d));}
export function addMonths(date:string,n:number){const [y,m,d]=date.split("-").map(Number);const target=new Date(Date.UTC(y,m-1+n,1));const max=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(d,max));return target.toISOString().slice(0,10);}
export function period(p:Profile,k:ActivityKind){return k==="VI"?p.vi_months:k==="LAT"?p.lat_months:p.rdt_months;}
export function initialDue(p:Profile,k:ActivityKind){return k==="VI"?p.vi_first_due:k==="LAT"?p.lat_first_due:p.rdt_first_due;}
export function inactive(i:Instrument){return i.is_active===false||["dismissed","out_of_service"].includes(i.status??"");}
export function schedule(i:Instrument,p:Profile,events:Event[],k:ActivityKind,year:number){
 if(inactive(i))return [] as string[];
 const n=period(p,k);const initial=initialDue(p,k);
 // Latest actual event is used only for the matching activity. The current
 // reference certificate has no guaranteed LAT/RdT classification: do not infer it.
 const last=k==="VI"?events.filter(e=>e.kind==="VI"&&dateValid(e.date)).map(e=>e.date).sort().at(-1):undefined;
 const anchor=last&&n?addMonths(last,n):initial;
 if(!dateValid(anchor))return [];
 const out:string[]=[];for(let x=0;x<1500;x++){const d=x===0?anchor:n?addMonths(anchor,x*n):"";if(!d||d>`${year}-12-31`)break;if(d>=`${year}-01-01`)out.push(d);if(!n)break;}return out;
}
export function stateLabel(s:string|null){return ({active:"Attivo",valid:"Operativo",expiring:"In scadenza",expired:"Scaduto",out_of_service:"Fuori servizio",dismissed:"Dismesso"} as Record<string,string>)[s??""]??s??"—";}
