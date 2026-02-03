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
  if (params.fechaDesde) {
    // Si viene como string yyyy-MM-dd, convertir a Date conservando zona horaria local
    const fecha = params.fechaDesde as string
    if (fecha.length === 10) {
      // yyyy-MM-dd
      const [year, month, day] = fecha.split("-").map(Number)
      filters.fechaDesde = new Date(year, month - 1, day, 0, 0, 0)
    } else {
      filters.fechaDesde = new Date(fecha)
    }
  }
  if (params.fechaHasta) {
    const fecha = params.fechaHasta as string
    if (fecha.length === 10) {
      // yyyy-MM-dd
      const [year, month, day] = fecha.split("-").map(Number)
      // Para incluir todo el día, setear hora máxima
      filters.fechaHasta = new Date(year, month - 1, day, 23, 59, 59)
    } else {
      filters.fechaHasta = new Date(fecha)
    }
  }
  if (params.plataforma) filters.plataforma = params.plataforma as any
  if (params.metodoPago) filters.metodoPago = params.metodoPago as any
  if (params.estadoEnvio) filters.estadoEnvio = params.estadoEnvio as any
  if (params.productoId) filters.productoId = parseInt(params.productoId as string, 10)
  if (params.comprador) filters.comprador = params.comprador as string
  if (params.externalOrderId) filters.externalOrderId = params.externalOrderId as string

  const ventas = await getVentas(filters)

  // Renderizar solo el client component y pasarle los datos
  return <VentasTableClient ventas={ventas} />
}
