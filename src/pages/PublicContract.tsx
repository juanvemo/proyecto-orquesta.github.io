import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Download, FileSignature, Home, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { SignaturePad } from "@/components/contracts/SignaturePad";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicContract, signPublicContract } from "@/features/contracts/service";
import type { PublicContractPayload } from "@/features/contracts/types";
import { assetUrl } from "@/lib/assets";

export default function PublicContract() {
  const { token } = useParams();
  const [data, setData] = useState<PublicContractPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  const [signerName, setSignerName] = useState("");
  const [signerDoc, setSignerDoc] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getPublicContract(token)
      .then((res) => {
        setData(res);
        if (res?.client.full_name) setSignerName(res.client.full_name);
        if (res?.client.nit) setSignerDoc(res.client.nit);
        if (res?.client.email) setSignerEmail(res.client.email);
      })
      .catch(() => toast.error("No fue posible cargar el contrato"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !data) return;
    if (!signerName.trim() || !signerDoc.trim()) {
      toast.error("Ingresa tu nombre completo y documento / NIT");
      return;
    }
    if (!signatureDataUrl) {
      toast.error("Por favor registra tu firma en el recuadro antes de confirmar");
      return;
    }
    if (!accepted) {
      toast.error("Debes aceptar los términos y condiciones del contrato");
      return;
    }
    setSigning(true);
    try {
      const updated = await signPublicContract({
        accessToken: token,
        signerName,
        signerDocument: signerDoc,
        signerEmail,
        signatureDataUrl,
      });
      setData({ ...data, contract: updated });
      toast.success("Contrato firmado correctamente");
    } catch (error) {
      toast.error("No fue posible registrar la firma", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-5">
        <Skeleton className="h-[700px] rounded-[2rem]" />
      </main>
    );
  }

  if (!data || data.contract.status === "ANULADO") {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 p-5">
        <div className="max-w-md text-center">
          <XCircle className="mx-auto size-12 text-rose-500" />
          <h1 className="mt-4 text-2xl font-black">Contrato no disponible</h1>
          <p className="mt-2 text-muted-foreground">
            Este enlace no es válido o el contrato fue anulado por la organización.
          </p>
        </div>
      </main>
    );
  }

  const { contract, organization, client, event } = data;
  const isSigned = contract.status === "FIRMADO";

  return (
    <main className="min-h-screen bg-[#eeeaf7] p-3 print:bg-white print:p-0 sm:p-6">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-white text-[#251e33] shadow-xl print:rounded-none print:shadow-none">
        <header className="flex flex-col justify-between gap-4 border-b p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-4">
            <img
              src={assetUrl(organization.logo_url || "/assets/proyecto-orquesta-logo.png")}
              alt={organization.name}
              className="h-20 w-auto object-contain"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#5B21F4]">Contrato de Servicios</p>
              <h1 className="text-2xl font-black">{contract.contract_number}</h1>
              <p className="text-sm text-slate-500">{contract.title}</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-black">{organization.name}</p>
            {organization.email && <p className="text-xs text-slate-500">{organization.email}</p>}
            {organization.phone && <p className="text-xs text-slate-500">{organization.phone}</p>}
          </div>
        </header>

        <section className="grid gap-6 bg-[#f7f5fb] p-6 sm:grid-cols-2 sm:p-8">
          <div>
            <h2 className="font-black">Contratante</h2>
            <div className="mt-3 space-y-1 text-sm">
              <p><span className="text-slate-500">Nombre:</span> <strong>{client.full_name || "Cliente"}</strong></p>
              {client.company && <p><span className="text-slate-500">Empresa:</span> {client.company}</p>}
              {client.nit && <p><span className="text-slate-500">NIT / C.C.:</span> {client.nit}</p>}
              {client.email && <p><span className="text-slate-500">Correo:</span> {client.email}</p>}
            </div>
          </div>
          <div>
            <h2 className="font-black">Evento contratado</h2>
            <div className="mt-3 space-y-1 text-sm">
              <p><span className="text-slate-500">Evento:</span> <strong>{event.name || "Presentación musical"}</strong></p>
              {event.event_date && <p><span className="text-slate-500">Fecha:</span> {formatDate(event.event_date)}</p>}
              {(event.venue || event.city) && (
                <p><span className="text-slate-500">Lugar:</span> {[event.venue, event.city].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6 p-6 sm:p-8">
          {contract.body_text && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{contract.body_text}</p>
          )}

          <div className="space-y-4">
            {contract.clauses.map((clause) => (
              <div key={clause.id} className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-black uppercase text-[#24163d]">{clause.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{clause.content}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 rounded-2xl bg-[#f7f5fb] p-5 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500">Valor total</p>
              <p className="text-lg font-black text-[#24163d]">{money(contract.total_amount)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500">Anticipo</p>
              <p className="text-lg font-bold text-emerald-700">{money(contract.deposit_amount)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500">Saldo</p>
              <p className="text-lg font-bold">{money(contract.balance_amount)}</p>
            </div>
          </div>
        </section>

        <section className="border-t p-6 sm:p-8">
          {isSigned ? (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-50 p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="size-6" />
                    <h2 className="text-xl font-black">Contrato firmado y aceptado</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Firmado por <strong>{contract.signer_name}</strong> ({contract.signer_document || "Sin documento"})
                  </p>
                  {contract.signer_email && <p className="text-xs text-slate-600">{contract.signer_email}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    Fecha y hora:{" "}
                    {contract.signed_at
                      ? new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeStyle: "short" }).format(new Date(contract.signed_at))
                      : ""}
                  </p>
                </div>
                {contract.signature_data_url && (
                  <img
                    src={contract.signature_data_url}
                    alt="Firma del contratante"
                    className="h-28 w-auto rounded-2xl border bg-white p-2 object-contain"
                  />
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSign} className="space-y-5 print:hidden">
              <div className="flex items-center gap-2">
                <FileSignature className="size-5 text-[#5B21F4]" />
                <h2 className="text-xl font-black">Firma digital del contratante</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Nombre completo del firmante</Label>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    required
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Cédula o NIT</Label>
                  <Input
                    value={signerDoc}
                    onChange={(e) => setSignerDoc(e.target.value)}
                    required
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Correo electrónico</Label>
                  <Input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    className="mt-2 rounded-xl"
                  />
                </div>
              </div>

              <SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} signerName={signerName} />

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                <span className="text-sm font-semibold">
                  Acepto íntegramente las cláusulas, términos artísticos, técnicos y económicos descritos en este contrato y autorizo el registro de mi firma digital.
                </span>
              </label>

              <Button disabled={signing} className="h-12 w-full rounded-2xl bg-[#5B21F4] text-base font-black text-white hover:bg-[#4c1bd1]">
                {signing ? <LoaderCircle className="mr-2 size-5 animate-spin" /> : <ShieldCheck className="mr-2 size-5" />}
                Firmar y aceptar contrato
              </Button>
            </form>
          )}
        </section>
      </article>

      <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-between gap-3 rounded-2xl bg-white p-4 shadow-lg print:hidden">
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/proyecto-orquesta">
            <Home className="mr-2 size-4" />
            Inicio
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()} className="rounded-xl">
          <Download className="mr-2 size-4" />
          Imprimir / guardar PDF
        </Button>
      </div>
    </main>
  );
}

function money(v: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);
}

function formatDate(v: string) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(`${v}T12:00:00`));
}
