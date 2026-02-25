export interface CostosEstimadosMargenVenta {
  costoDevolucionesPorVenta?: number
  costoGastosNegocioPorVenta?: number
  roas?: number
}

export interface MargenVentaCalculado {
  costoDevoluciones: number
  costoGastosNegocio: number
  roas: number
  margenContribucion: number
  costoPublicidad: number
  margenOperativo: number
  margenNeto: number
  rentabilidadSobrePV: number
  rentabilidadSobreCosto: number
}

interface CalcularMargenVentaParams {
  precioReferenciaAds: number
  resultadoOperativo: number
  totalCostosPlataforma: number
  costoProducto: number
  costoEnvio: number
  costosEstimados?: CostosEstimadosMargenVenta | null
}

export function calcularMargenVenta({
  precioReferenciaAds,
  resultadoOperativo,
  totalCostosPlataforma,
  costoProducto,
  costoEnvio,
  costosEstimados,
}: CalcularMargenVentaParams): MargenVentaCalculado {
  const costoDevoluciones = Number(costosEstimados?.costoDevolucionesPorVenta || 0)
  const costoGastosNegocio = Number(costosEstimados?.costoGastosNegocioPorVenta || 0)
  const roas = Number(costosEstimados?.roas || 0) > 0 ? Number(costosEstimados?.roas) : 5

  const margenContribucion = resultadoOperativo - totalCostosPlataforma - costoDevoluciones
  const costoPublicidad = roas > 0 ? precioReferenciaAds / roas : 0
  const margenOperativo = margenContribucion - costoPublicidad
  const margenNeto = margenOperativo - costoGastosNegocio

  const rentabilidadSobrePV = precioReferenciaAds > 0 ? margenNeto / precioReferenciaAds : 0
  const costoTotalBase = costoProducto + costoEnvio
  const rentabilidadSobreCosto = costoTotalBase > 0 ? margenNeto / costoTotalBase : 0

  return {
    costoDevoluciones,
    costoGastosNegocio,
    roas,
    margenContribucion,
    costoPublicidad,
    margenOperativo,
    margenNeto,
    rentabilidadSobrePV,
    rentabilidadSobreCosto,
  }
}
