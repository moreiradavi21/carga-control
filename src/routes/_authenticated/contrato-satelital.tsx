import { createFileRoute } from "@tanstack/react-router";
import { ContratoPage } from "@/lib/sismat/ContratoPage";

export const Route = createFileRoute("/_authenticated/contrato-satelital")({
  component: () => <ContratoPage tipo="satelital" label="Contrato Satelital" />,
});
