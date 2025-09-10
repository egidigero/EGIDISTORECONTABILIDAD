// Utilidades para cálculos de ROAS y publicidad

/**
 * Calcula el gasto necesario basado en ventas y ROAS objetivo
 * @param ventasPeriodo - Total de ventas del período
 * @param roasObjetivo - ROAS objetivo (ej: 3.0 = $3 en ventas por cada $1 gastado)
 * @returns Gasto calculado
 */
export function calcularGastoPorROAS(ventasPeriodo: number, roasObjetivo: number): number {
  if (roasObjetivo <= 0) return 0
  return ventasPeriodo / roasObjetivo
}

/**
 * Calcula el ROAS actual basado en ventas y gasto
 * @param ventasPeriodo - Total de ventas del período
 * @param gastoPublicidad - Gasto en publicidad del período
 * @returns ROAS actual
 */
export function calcularROASActual(ventasPeriodo: number, gastoPublicidad: number): number {
  if (gastoPublicidad <= 0) return 0
  return ventasPeriodo / gastoPublicidad
}

/**
 * Verifica si una categoría es de publicidad/marketing
 * @param categoria - Nombre de la categoría
 * @returns true si es una categoría de publicidad
 */
export function esGastoPublicidad(categoria: string): boolean {
  const terminos = categoria.toLowerCase()
  return (
    terminos.includes("publicidad") ||
    terminos.includes("marketing") ||
    terminos.includes("ads") ||
    terminos.includes("facebook") ||
    terminos.includes("google") ||
    terminos.includes("instagram") ||
    terminos.includes("tiktok") ||
    terminos.includes("influencer") ||
    terminos.includes("seo") ||
    terminos.includes("sem")
  )
}

/**
 * Formatea un valor de ROAS para mostrar
 * @param roas - Valor del ROAS
 * @returns String formateado
 */
export function formatearROAS(roas: number): string {
  return `${roas.toFixed(1)}x`
}

/**
 * Calcula el porcentaje de margen de ganancia
 * @param ventas - Total de ventas
 * @param gastoPublicidad - Gasto en publicidad
 * @returns Porcentaje del gasto respecto a las ventas
 */
export function calcularPorcentajeGasto(ventas: number, gastoPublicidad: number): number {
  if (ventas <= 0) return 0
  return (gastoPublicidad / ventas) * 100
}
