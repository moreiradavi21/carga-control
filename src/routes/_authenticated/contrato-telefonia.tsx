import { createFileRoute } from "@tanstack/react-router";
import { ContratoPage } from "@/lib/sismat/ContratoPage";

export const Route = createFileRoute("/_authenticated/contrato-telefonia")({
  component: () => <ContratoPage tipo="telefonia" label="Contrato Telefonia" />,
});
