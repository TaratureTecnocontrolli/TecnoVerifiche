// Fetch every page with a stable unique ordering supplied by the caller.
export async function readAllRows<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>):Promise<{data:T[];error:{message:string}|null}> {
 const data:T[]=[];const size=200;
 for(let offset=0;;offset+=size){const r=await query(offset,offset+size-1);if(r.error)return {data:[],error:r.error};const part=r.data??[];data.push(...part);if(part.length<size)return {data,error:null};}
}
