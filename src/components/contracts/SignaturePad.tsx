import { useEffect, useRef, useState } from "react";
import { Eraser, PenTool, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  signerName?: string;
}

export function SignaturePad({ value, onChange, signerName }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [mode, setMode] = useState<"drawn" | "typed">("drawn");
  const [typedSignature, setTypedSignature] = useState(signerName ?? "");
  const [hasStroke, setHasStroke] = useState(Boolean(value));

  useEffect(() => {
    if (signerName && !typedSignature) setTypedSignature(signerName);
  }, [signerName, typedSignature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 560;
    const height = 180;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, height - 34);
    ctx.lineTo(width - 24, height - 34);
    ctx.stroke();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e1b4b";
    ctx.lineWidth = 2.6;
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = getPoint(e);
    ctx.strokeStyle = "#1e1b4b";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasStroke) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const clearDrawn = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = canvas.clientWidth || 560;
    const height = 180;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, height - 34);
    ctx.lineTo(width - 24, height - 34);
    ctx.stroke();
    setHasStroke(false);
    onChange("");
  };

  const generateTypedImage = (text: string) => {
    setTypedSignature(text);
    const clean = text.trim();
    if (!clean) {
      onChange("");
      return;
    }
    const offscreen = document.createElement("canvas");
    offscreen.width = 640;
    offscreen.height = 180;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 138);
    ctx.lineTo(608, 138);
    ctx.stroke();
    ctx.fillStyle = "#1e1b4b";
    ctx.font = 'italic 44px "Georgia", "Times New Roman", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clean, offscreen.width / 2, 92, 560);
    onChange(offscreen.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
      <Tabs
        value={mode}
        onValueChange={(val) => {
          const nextMode = val === "typed" ? "typed" : "drawn";
          setMode(nextMode);
          if (nextMode === "typed" && typedSignature.trim()) {
            generateTypedImage(typedSignature);
          } else if (nextMode === "drawn" && !hasStroke) {
            onChange("");
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="rounded-xl">
            <TabsTrigger value="drawn" className="rounded-lg">
              <PenTool className="mr-1.5 size-3.5" />
              Firma manuscrita
            </TabsTrigger>
            <TabsTrigger value="typed" className="rounded-lg">
              <Type className="mr-1.5 size-3.5" />
              Firma tipográfica
            </TabsTrigger>
          </TabsList>
          {mode === "drawn" && (
            <Button type="button" variant="outline" size="sm" onClick={clearDrawn} className="rounded-xl">
              <Eraser className="mr-1.5 size-3.5" />
              Limpiar trazo
            </Button>
          )}
        </div>

        <TabsContent value="drawn" className="mt-3">
          <div className="overflow-hidden rounded-2xl border bg-white">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="h-[180px] w-full cursor-crosshair touch-none"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Dibuja tu firma con el dedo o el cursor sobre la línea de firma.
          </p>
        </TabsContent>

        <TabsContent value="typed" className="mt-3 space-y-3">
          <div>
            <Label>Escribe tu nombre como firma digital</Label>
            <Input
              value={typedSignature}
              onChange={(e) => generateTypedImage(e.target.value)}
              placeholder="Ej. Carlos Andrés Ramírez"
              className="mt-2 rounded-xl bg-white"
            />
          </div>
          <div className="grid min-h-[110px] place-items-center rounded-2xl border bg-white px-6 py-4">
            {typedSignature.trim() ? (
              <p className="font-serif text-3xl italic text-[#1e1b4b]">{typedSignature}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Vista previa de tu firma</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
