"use client";
import {LAB_SITES} from "@/lib/lab-sites";
export default function LabSiteSelect({value,onChange,filter=false,disabled=false}:{value:string;onChange:(s:string)=>void;filter?:boolean;disabled?:boolean}) {
 return <label className="block text-sm font-semibold">Sede<select aria-label="Sede" className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}>{filter&&<option value="all">Tutte le sedi</option>}<option value={filter?"unassigned":""}>Da assegnare</option>{LAB_SITES.map(s=><option key={s} value={s}>{s}</option>)}</select></label>;
}
