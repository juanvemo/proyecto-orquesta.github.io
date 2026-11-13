import { assetUrl } from "@/lib/assets";
import type { LetterheadData } from "@/features/contracts/types";

export function DocumentLetterhead({ organization, label, reference }: { organization: LetterheadData; label: string; reference: string }) {
  return <header className="flex flex-col justify-between gap-5 border-b-4 border-primary p-6 sm:flex-row sm:items-center sm:p-8">
    <div className="flex min-w-0 items-center gap-4"><img src={assetUrl(organization.logo_url || "/assets/proyecto-orquesta-logo.png")} alt={`Logo de ${organization.name}`} className="h-20 w-24 shrink-0 object-contain" /><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.14em] text-primary">{label}</p><h1 className="mt-2 break-words text-xl font-black text-slate-900 sm:text-2xl">{organization.name}</h1><p className="mt-1 break-words text-sm font-semibold text-slate-600">{reference}</p></div></div>
    <div className="shrink-0 space-y-1 text-sm text-slate-700 sm:max-w-52 sm:text-right">{organization.email && <p className="break-words">{organization.email}</p>}{organization.phone && <p>{organization.phone}</p>}{organization.whatsapp && organization.whatsapp !== organization.phone && <p>WhatsApp: {organization.whatsapp}</p>}{organization.website && <p className="break-words">{organization.website}</p>}</div>
  </header>;
}
