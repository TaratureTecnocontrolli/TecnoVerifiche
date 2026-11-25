export const LAB_SITES = ["Calderara", "Tortona", "Forlì", "Scandicci"] as const;
export type LabSite = typeof LAB_SITES[number];
export function normalizeLabSite(value: string): LabSite | null {
 const s=value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
 return LAB_SITES.find(x=>x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()===s)??null;
}
export function matchesSite(value: string|null|undefined, filter: string) {return filter==="all" || (filter==="unassigned" ? !value : value===filter);}
