import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function QrDialog({ open, onOpenChange, equipamento }: { open: boolean; onOpenChange: (v: boolean) => void; equipamento: any }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && equipamento && ref.current) {
      const payload = JSON.stringify({ id: equipamento.id, patrimonio: equipamento.patrimonio, ns: equipamento.numero_serie });
      QRCode.toCanvas(ref.current, payload, { width: 260, margin: 1 });
    }
  }, [open, equipamento]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>QR Code do equipamento</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <canvas ref={ref} />
          <div className="text-center">
            <p className="font-semibold">{equipamento?.descricao}</p>
            <p className="text-xs text-muted-foreground font-mono">Pat: {equipamento?.patrimonio ?? "—"} · SN: {equipamento?.numero_serie ?? "—"}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}