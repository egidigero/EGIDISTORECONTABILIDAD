const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const isFalseLike = (value: unknown): boolean =>
  value === false ||
  value === 0 ||
  value === "0" ||
  value === "false" ||
  value === "f" ||
  value === "no"

export function esSinReembolso(row: any): boolean {
  const tipo = normalize(row?.tipo_resolucion ?? row?.tipoResolucion ?? "")
  const estado = normalize(row?.estado ?? "")
  return tipo === "sin reembolso" || estado.includes("sin reembolso")
}

export function esMercadoLibreSinReclamo(row: any): boolean {
  const plataforma = normalize(row?.plataforma ?? "")
  if (plataforma !== "ml") return false
  const fueReclamo = row?.fue_reclamo ?? row?.fueReclamo
  return isFalseLike(fueReclamo)
}

export function costoEnvioOriginalPerdido(row: any): number {
  if (esSinReembolso(row)) return 0
  if (esMercadoLibreSinReclamo(row)) return 0
  return toNumber(row?.costo_envio_original ?? row?.costoEnvioOriginal)
}

export function costoEnvioDevolucionPerdido(row: any): number {
  if (esSinReembolso(row)) return 0
  if (esMercadoLibreSinReclamo(row)) return 0
  return toNumber(row?.costo_envio_devolucion ?? row?.costoEnvioDevolucion)
}

export function costoEnvioNuevoPerdido(row: any): number {
  if (esSinReembolso(row)) return 0
  if (esMercadoLibreSinReclamo(row)) return 0
  return toNumber(row?.costo_envio_nuevo ?? row?.costoEnvioNuevo)
}

export function calcularPerdidaTotalAjustada(row: any): number {
  const perdidaBase = toNumber(row?.perdida_total ?? row?.perdidaTotal ?? row?.perdida)
  if (esSinReembolso(row)) return 0

  if (esMercadoLibreSinReclamo(row)) {
    const envioOriginal = toNumber(row?.costo_envio_original ?? row?.costoEnvioOriginal)
    const envioDevolucion = toNumber(row?.costo_envio_devolucion ?? row?.costoEnvioDevolucion)
    const envioNuevo = toNumber(row?.costo_envio_nuevo ?? row?.costoEnvioNuevo)
    return Math.max(0, Math.round((perdidaBase - envioOriginal - envioDevolucion - envioNuevo) * 100) / 100)
  }

  return Math.round(perdidaBase * 100) / 100
}
