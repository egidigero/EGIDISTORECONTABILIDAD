const TN_ENVIO_IIBB_PCT = 0.01

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export const GASTO_ENVIO_TN_CATEGORY = "Gastos del negocio - Envios"

export function calcularIibbEnvioVenta(
  plataforma?: string | null,
  cargoEnvioCosto?: number | null,
): number {
  const envioBase = Number(cargoEnvioCosto || 0)
  if (plataforma !== "TN" || envioBase <= 0) return 0
  return round2(envioBase * TN_ENVIO_IIBB_PCT)
}

export function calcularCostoEnvioTotalVenta(
  plataforma?: string | null,
  cargoEnvioCosto?: number | null,
): number {
  const envioBase = Number(cargoEnvioCosto || 0)
  return round2(envioBase + calcularIibbEnvioVenta(plataforma, envioBase))
}

export function debeCrearGastoEnvioTN(
  plataforma?: string | null,
  cargoEnvioCosto?: number | null,
): boolean {
  return plataforma === "TN" && Number(cargoEnvioCosto || 0) > 0
}

export function buildEnvioTNGastoDescripcion(
  comprador: string,
  saleCode?: string | null,
): string {
  const suffix = saleCode ? ` - Venta ${saleCode}` : ""
  return `Envio Nube - Compradora: ${comprador}${suffix}`
}
