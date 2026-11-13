import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, FileDown, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractDocumentView } from "@/features/contracts/ContractDocumentView";
import { downloadContractPdf } from "@/features/contracts/pdf";
import { acceptContract, getPublicContract } from "@/features/contracts/service";
import { contractConsent, contractError, type ContractDocument } from "@/features/contracts/types";

export default function PublicContract() {
  const { token } = useParams();
  const [contract, setContract] = useState<ContractDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const mutation = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setContract(null); setLoadError(null); setConfirmed(false);
    if (!token) { setLoading(false); return; }
    getPublicContract(token).then((data) => { if (active) { setContract(data); setName(data?.client_snapshot.full_name || ""); setEmail(data?.client_snapshot.email || ""); } }).catch((error) => { if (active) setLoadError(contractError(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!contract || !token || mutation.current || !confirmed) return;
    mutation.current = true; setSaving(true);
    try { const signed = await acceptContract(token, contract, name, email, confirmed); setContract(signed); toast.success("Contrato aceptado", { description: "Tu aceptación quedó registrada. Puedes descargar el contrato firmado en PDF." }); }
    catch (error) { toast.error("No se pudo registrar la aceptación", { description: contractError(error) }); }
    finally { mutation.current = false; setSaving(false); }
  };
  const download = async () => { if (!contract || downloading) return; setDownloading(true); try { await downloadContractPdf(contract); } catch (error) { toast.error("No se pudo generar el PDF", { description: contractError(error) }); } finally { setDownloading(false); } };
  if (loading) return <main className="mx-auto max-w-4xl p-5"><Skeleton className="h-[650px] rounded-[2rem]" /></main>;
  if (!contract) return <main className="grid min-h-screen place-items-center bg-violet-50 p-5"><div className="max-w-lg rounded-[2rem] border bg-white p-8 text-center"><XCircle className="mx-auto size-12 text-rose-600" /><h1 className="mt-4 text-2xl font-black text-slate-900">Contrato no disponible</h1><p className="mt-3 text-sm text-slate-700">{loadError ? "No fue posible consultar el contrato. Intenta abrir el enlace nuevamente." : "El enlace puede ser inválido, estar cancelado o corresponder a una versión anterior. Solicita el enlace actualizado."}</p></div></main>;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: contract.organization_snapshot.timezone || "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const expired = Boolean(contract.valid_until && contract.valid_until < today);
  return <main className="min-h-screen bg-violet-50 p-3 sm:p-6"><div className="mx-auto max-w-4xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-bold text-violet-800"><ShieldCheck className="size-5" />Documento privado · {contract.organization_snapshot.name}</p><Button disabled={downloading || saving} onClick={() => void download()} className="rounded-xl">{downloading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />}Descargar PDF</Button></div>
    <ContractDocumentView contract={contract} />
    {contract.status === "FIRMADO" ? <section className="rounded-[2rem] border border-emerald-300 bg-white p-6 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h2 className="mt-3 text-xl font-black text-slate-900">Contrato aceptado</h2><p className="mt-2 text-sm text-slate-700">La aceptación está registrada en este documento. Guarda el PDF como respaldo.</p></section> : expired ? <section className="rounded-2xl border border-orange-300 bg-white p-6 text-orange-800">El plazo para aceptar este contrato venció. Contacta al equipo para recibir una versión actualizada.</section> : <section className="rounded-[2rem] border bg-white p-5 text-slate-900 sm:p-8"><h2 className="text-xl font-black">Aceptar y firmar electrónicamente</h2><p className="mt-2 text-sm text-slate-700">Lee el documento completo antes de aceptar. Usa el correo del cliente destinatario. Esta aceptación electrónica registra tu voluntad; no corresponde a una firma digital certificada.</p><form onSubmit={submit} className="mt-5 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="contract-signer-name">Nombre completo del firmante</Label><Input id="contract-signer-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={160} disabled={saving} className="mt-2 rounded-xl border-slate-300 bg-white text-slate-900" /></div><div><Label htmlFor="contract-signer-email">Correo del destinatario</Label><Input id="contract-signer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={300} disabled={saving} className="mt-2 rounded-xl border-slate-300 bg-white text-slate-900" /></div></div><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"><Checkbox checked={confirmed} disabled={saving} onCheckedChange={(value) => setConfirmed(value === true)} className="mt-1 border-violet-700" /><span className="text-sm leading-6">{contractConsent}</span></label><Button disabled={!confirmed || saving} className="h-12 w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">{saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}Aceptar contrato · Versión {contract.version}</Button></form></section>}
  </div></main>;
}
