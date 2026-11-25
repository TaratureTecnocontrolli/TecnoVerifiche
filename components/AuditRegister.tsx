"use client";
import { useState } from "react";

export type AuditRow={id:string;date:string;entity:string;entityId:string;reference:string;referenceCurrent:boolean;action:string;actionCode:string;previous:string;next:string;actor:string;actorId:string;role:string;today:boolean};
const PAGE_SIZE=25;
export default function AuditRegister({rows,snapshot,scope,error,lookupWarning}:{rows:AuditRow[];snapshot:string;scope:string;error:string;lookupWarning:boolean}){
 const [page,setPage]=useState(0);const [exporting,setExporting]=useState(false);const [exportError,setExportError]=useState("");
 const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));const current=Math.min(page,pages-1);
 async function exportExcel(){
   setExporting(true);setExportError("");
   try{
     const XLSX=await import("xlsx");const book=XLSX.utils.book_new();
     const data=rows.map(r=>[r.date,r.entity,r.reference,r.referenceCurrent?"Riferimento attuale":"Da evento (se disponibile)",r.action,r.previous,r.next,r.actor,r.role,r.entityId,r.actorId,r.id,r.actionCode]);
     const sheet=XLSX.utils.aoa_to_sheet([["Data / ora (Italia)","Entità","Rapportino / riferimento","Origine riferimento","Operazione","Stato precedente","Nuovo stato","Utente (anagrafica attuale)","Profilo attuale","ID verifica","ID utente","ID evento","Codice operazione"],...data]);
     sheet["!cols"]=[23,18,24,26,38,22,22,30,16,39,39,39,35].map(wch=>({wch}));
     sheet["!autofilter"]={ref:`A1:M${rows.length+1}`};XLSX.utils.book_append_sheet(book,sheet,"Registro attività");
     const meta=XLSX.utils.aoa_to_sheet([["Tecnocontrolli – Gestionale Metrologico"],["Registro attività",scope],["Estrazione (Europe/Rome)",snapshot],["Numero eventi",rows.length],["Note","I nominativi/profili e i riferimenti non presenti nell'evento sono ricavati dalle anagrafiche attuali, se disponibili."],["Anagrafiche",lookupWarning?"Alcuni riferimenti non sono stati risolti":"Consultazione completata"]]);meta["!cols"]=[36,100].map(wch=>({wch}));XLSX.utils.book_append_sheet(book,meta,"Informazioni");
     XLSX.writeFile(book,`Registro_attivita_${new Date().toISOString().slice(0,10)}.xlsx`);
   }catch(e){setExportError(e instanceof Error?e.message:"Esportazione non riuscita.");}finally{setExporting(false);}
 }
 return <div className="tc-audit">
   <section className="tc-panel tc-audit-heading tc-audit-screen" style={{borderRadius:12}}><div><p style={{color:"#b01018",fontWeight:800,textTransform:"uppercase",letterSpacing:".08em"}}>Controllo e tracciabilità</p><h1>Registro attività</h1><p>{scope} · Riservato al MASTER</p></div><div className="tc-audit-actions print-hidden"><button className="tc-action tc-action-primary" type="button" disabled={!!error||exporting} onClick={()=>void exportExcel()}>{exporting?"Esportazione…":"Esporta Excel"}</button><button className="tc-action" type="button" disabled={!!error} onClick={()=>window.print()}>Stampa / PDF</button></div></section>
   {(error||exportError||lookupWarning)&&<div className="tc-audit-screen rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{error||exportError||"Alcuni nominativi o riferimenti non sono disponibili: gli identificativi originali vengono conservati."}</div>}
   <div className="tc-audit-summary tc-audit-screen">{[["Eventi registrati",rows.length],["Emissioni",rows.filter(r=>r.actionCode==="vi12_issue").length],["Riaperture",rows.filter(r=>r.actionCode==="vi12_reopen").length],["Eventi odierni",rows.filter(r=>r.today).length]].map(([label,value])=><div key={label} className="tc-panel"><small>{label}</small><strong>{error?"—":value}</strong></div>)}</div>
   <div className="tc-audit-print-heading"><h1 style={{fontSize:18,fontWeight:800}}>Tecnocontrolli – Gestionale Metrologico</h1><h2 style={{fontSize:15,fontWeight:700}}>Registro attività</h2><p>{scope} · Estrazione: {snapshot} · {rows.length} eventi</p><p>Nominativi, profili e riferimenti contrassegnati come attuali provengono dalle anagrafiche alla data di estrazione.</p></div>
   <section className="tc-panel tc-audit-list"><div className="tc-audit-toolbar tc-audit-screen"><h2>Eventi registrati</h2><span style={{fontSize:12,color:"#526174"}}>Estrazione: {snapshot}</span></div>
   {rows.length===0?<p className="tc-audit-empty">{error?"Registro non disponibile.":"Nessun evento registrato nel perimetro selezionato."}</p>:<table className="tc-audit-table"><thead><tr><th>Data / Ora</th><th>Entità / Riferimento</th><th>Operazione</th><th>Stato</th><th>Utente</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id} className={i>=current*PAGE_SIZE&&i<(current+1)*PAGE_SIZE?"":"tc-audit-offpage"}><td data-label="Data / Ora"><div>{r.date}</div></td><td data-label="Riferimento"><div><strong>{r.reference}</strong>{r.referenceCurrent&&<small>Riferimento attuale</small>}<small>{r.entity} · {r.entityId||"—"}</small></div></td><td data-label="Operazione"><div style={{fontWeight:650}}>{r.action}</div></td><td data-label="Stato"><div><span>Da: {r.previous}</span><br/><strong>A: {r.next}</strong></div></td><td data-label="Utente"><div><strong>{r.actor}</strong>{r.role&&<small>{r.role} (attuale)</small>}{r.actorId&&r.actorId!==r.actor&&<small>{r.actorId}</small>}</div></td></tr>)}</tbody></table>}
   <div className="tc-audit-pagination print-hidden"><span>{rows.length?`${current*PAGE_SIZE+1}–${Math.min((current+1)*PAGE_SIZE,rows.length)} di ${rows.length}`:"0 eventi"}</span><button className="tc-action" type="button" disabled={current===0} onClick={()=>setPage(current-1)}>← Indietro</button><span>Pagina {current+1}/{pages}</span><button className="tc-action" type="button" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Avanti →</button></div></section>
 </div>;
}
