import { getVentas } from "@/lib/actions/ventas"
import type { VentaFilters } from "@/lib/types"
import { VentasTableClient } from "./ventas-table-client"

interface VentasTableProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function VentasTable({ searchParams }: VentasTableProps) {
  // Esperar searchParams para Next.js 15 
  const params = await searchParams
  
  // Construir filtros desde searchParams
  const filters: VentaFilters = {}

  // Si es un objeto plano, usar acceso directo
  if (params.fechaDesde) filters.fechaDesde = new Date(params.fechaDesde as string)
  if (params.fechaHasta) filters.fechaHasta = new Date(params.fechaHasta as string)
  if (params.plataforma) filters.plataforma = params.plataforma as any
  if (params.metodoPago) filters.metodoPago = params.metodoPago as any
  if (params.estadoEnvio) filters.estadoEnvio = params.estadoEnvio as any
  if (params.comprador) filters.comprador = params.comprador as string
  if (params.externalOrderId) filters.externalOrderId = params.externalOrderId as string

  const ventas = await getVentas(filters)

  // Renderizar solo el client component y pasarle los datos
  return <VentasTableClient ventas={ventas} />
}
