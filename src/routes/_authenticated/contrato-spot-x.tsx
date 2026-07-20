import { createFileRoute } from "@tanstack/react-router";
import { ContratoPage } from "@/lib/sismat/ContratoPage";

export const Route = createFileRoute("/_authenticated/contrato-spot-x")({
  component: () => <ContratoPage tipo="spot_x" label="Contrato Spot X" />,
});
