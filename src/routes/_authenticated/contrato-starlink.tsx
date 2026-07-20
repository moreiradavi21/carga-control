import { createFileRoute } from "@tanstack/react-router";
import { ContratoPage } from "@/lib/sismat/ContratoPage";

export const Route = createFileRoute("/_authenticated/contrato-starlink")({
  component: () => <ContratoPage tipo="starlink" label="Contrato Starlink" />,
});
