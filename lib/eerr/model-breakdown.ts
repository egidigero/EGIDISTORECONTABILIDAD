import type { ModelBreakdownRow } from "@/components/roas-analysis-modal"

interface BuildModelBreakdownParams {
  detalleVentas: any[]
  devoluciones: any[]
  ventasNetas: number
  ventaIdToModelFallback?: Record<string, string>
}

interface BuildModelBreakdownResult {
  modelBreakdown: ModelBreakdownRow[]
  devolucionesNoAsignadas: number
  cantidadVentas: number
}

type InternalRow = ModelBreakdownRow & { costoBase: number }

const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const round2 = (value: number): number => Math.round(value * 100) / 100

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const extractModel = (...values: unknown[]): string => {
  for (const value of values) {
    const model = String(value ?? "").trim()
    if (model) return model
  }
  return ""
}

const getSaleModel = (sale: any): string =>
  extractModel(sale?.producto?.modelo, sale?.productos?.modelo, sale?.modelo, "Sin modelo")

const getDevolucionModel = (devolucion: any): string =>
  extractModel(
    devolucion?.producto_modelo,
    devolucion?.productoModelo,
    devolucion?.modelo,
    devolucion?.producto?.modelo,
    devolucion?.productos?.modelo,
    devolucion?.venta?.producto?.modelo,
    devolucion?.venta?.productos?.modelo,
  )

const ensureModelRow = (map: Map<string, InternalRow>, modelo: string): InternalRow => {
  const current = map.get(modelo)
  if (current) return current

  const created: InternalRow = {
    modelo,
    ventas: 0,
    contribucionBruta: 0,
    devolucionesAsignadas: 0,
    contribucionNeta: 0,
    cpaBreakEven: 0,
    pctPV: 0,
    pctCosto: 0,
    costoBase: 0,
  }
  map.set(modelo, created)
  return created
}

export function buildModelBreakdown({
  detalleVentas,
  devoluciones,
  ventasNetas,
  ventaIdToModelFallback = {},
}: BuildModelBreakdownParams): BuildModelBreakdownResult {
  const devolucionesExclusionIds = new Set<string>()
  for (const devolucion of Array.isArray(devoluciones) ? devoluciones : []) {
    const tipo = normalize(devolucion?.tipo_resolucion || devolucion?.estado)
    const isReembolso = tipo.includes("reembolso") || toNumber(devolucion?.monto_reembolsado) > 0
    const isEnDevolucion = normalize(devolucion?.estado) === normalize("En devolucion")
    if ((isReembolso || isEnDevolucion) && devolucion?.venta_id) {
      devolucionesExclusionIds.add(String(devolucion.venta_id))
    }
  }

  const allSales = Array.isArray(detalleVentas) ? detalleVentas : []
  const salesForModels = allSales.filter((sale: any) => !devolucionesExclusionIds.has(String(sale?.id ?? "")))

  const byModel = new Map<string, InternalRow>()
  const saleIdToModel = new Map<string, string>()

  for (const sale of allSales) {
    const saleId = String(sale?.id ?? "").trim()
    const modelo = getSaleModel(sale)
    if (saleId && modelo) saleIdToModel.set(saleId, modelo)
  }

  for (const sale of salesForModels) {
    const saleId = String(sale?.id ?? "").trim()
    const modelo = getSaleModel(sale)
    const pvBruto = toNumber(sale?.pvBruto ?? sale?.pv_bruto)
    const costo = toNumber(sale?.costoProducto ?? sale?.costo_producto)
    const comisionTotal = toNumber(sale?.comision) + toNumber(sale?.iva) + toNumber(sale?.iibb)
    const envio = toNumber(sale?.cargoEnvioCosto ?? sale?.cargo_envio_costo)
    const contribucion = round2(pvBruto - costo - comisionTotal - envio)

    const row = ensureModelRow(byModel, modelo)
    row.ventas += 1
    row.contribucionBruta = round2(row.contribucionBruta + contribucion)
    row.costoBase = round2(row.costoBase + costo)

    if (saleId && modelo) saleIdToModel.set(saleId, modelo)
  }

  let devolucionesNoAsignadas = 0
  for (const devolucion of Array.isArray(devoluciones) ? devoluciones : []) {
    const saleId = String(devolucion?.venta_id ?? "").trim()
    const perdida = toNumber(devolucion?.perdida_total)
    if (perdida === 0) continue

    const modelFromFallback = saleId ? String(ventaIdToModelFallback[saleId] ?? "").trim() : ""
    const modelo = getDevolucionModel(devolucion) || (saleId ? saleIdToModel.get(saleId) ?? "" : "") || modelFromFallback

    if (!modelo) {
      devolucionesNoAsignadas = round2(devolucionesNoAsignadas + perdida)
      continue
    }

    const row = ensureModelRow(byModel, modelo)
    row.devolucionesAsignadas = round2(row.devolucionesAsignadas + perdida)
  }

  const modelBreakdown: ModelBreakdownRow[] = Array.from(byModel.values())
    .map((row) => {
      const contribucionNeta = round2(row.contribucionBruta - row.devolucionesAsignadas)
      return {
        modelo: row.modelo,
        ventas: row.ventas,
        contribucionBruta: row.contribucionBruta,
        devolucionesAsignadas: row.devolucionesAsignadas,
        contribucionNeta,
        cpaBreakEven: row.ventas > 0 ? round2(contribucionNeta / row.ventas) : 0,
        pctPV: ventasNetas > 0 ? round2((contribucionNeta / ventasNetas) * 100) : 0,
        pctCosto: row.costoBase > 0 ? round2((contribucionNeta / row.costoBase) * 100) : 0,
      }
    })
    .sort((a, b) => b.contribucionNeta - a.contribucionNeta)

  return {
    modelBreakdown,
    devolucionesNoAsignadas,
    cantidadVentas: salesForModels.length,
  }
}
