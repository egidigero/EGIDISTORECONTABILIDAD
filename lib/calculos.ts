import { prisma } from "./prisma"
import type { Plataforma, MetodoPago } from "./types"

export interface TarifaData {
  comisionPct: number
  iibbPct: number
  fijoPorOperacion: number
}

export interface VentaCalculos {
  comision: number
  iibb: number
  precioNeto: number
  costoProducto: number
  ingresoMargen: number
  rentabilidadSobrePV: number
  rentabilidadSobreCosto: number
}

export async function getTarifa(plataforma: Plataforma, metodoPago: MetodoPago): Promise<TarifaData | null> {
  const tarifa = await prisma.tarifa.findUnique({
    where: {
      plataforma_metodoPago: {
        plataforma,
        metodoPago,
      },
    },
  })

  if (!tarifa) return null

  return {
    comisionPct: Number(tarifa.comisionPct),
    iibbPct: Number(tarifa.iibbPct),
    fijoPorOperacion: Number(tarifa.fijoPorOperacion),
  }
}

export function calcularVenta(
  pvBruto: number,
  cargoEnvioCosto: number,
  costoProducto: number,
  tarifa: TarifaData,
): VentaCalculos {
  // Cálculos según las reglas de negocio
  const comision = pvBruto * (tarifa.comisionPct / 100) + tarifa.fijoPorOperacion
  const iibb = pvBruto * (tarifa.iibbPct / 100)
  const precioNeto = pvBruto - comision - iibb
  const ingresoMargen = precioNeto - cargoEnvioCosto - costoProducto
  const rentabilidadSobrePV = pvBruto > 0 ? ingresoMargen / pvBruto : 0
  const rentabilidadSobreCosto = costoProducto > 0 ? ingresoMargen / costoProducto : 0

  return {
    comision: Number(comision.toFixed(2)),
    iibb: Number(iibb.toFixed(2)),
    precioNeto: Number(precioNeto.toFixed(2)),
    costoProducto: Number(costoProducto.toFixed(2)),
    ingresoMargen: Number(ingresoMargen.toFixed(2)),
    rentabilidadSobrePV: Number(rentabilidadSobrePV.toFixed(4)),
    rentabilidadSobreCosto: Number(rentabilidadSobreCosto.toFixed(4)),
  }
}

export function generarSaleCode(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `EG-${timestamp}-${random}`.toUpperCase()
}
