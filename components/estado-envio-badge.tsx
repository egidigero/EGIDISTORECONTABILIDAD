import { Badge } from "@/components/ui/badge"
import type { EstadoEnvio } from "@/lib/types"

interface EstadoEnvioBadgeProps {
  estado: EstadoEnvio
}

const estadoConfig = {
  Pendiente: { variant: "secondary" as const, label: "Pendiente" },
  EnCamino: { variant: "default" as const, label: "En Camino" },
  Entregado: { variant: "default" as const, label: "Entregado" },
  Devuelto: { variant: "destructive" as const, label: "Devuelto" },
  Cancelado: { variant: "destructive" as const, label: "Cancelado" },
}

export function EstadoEnvioBadge({ estado }: EstadoEnvioBadgeProps) {
  const config = estadoConfig[estado]

  return <Badge variant={config.variant}>{config.label}</Badge>
}
