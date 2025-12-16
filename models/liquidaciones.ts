// models/liquidaciones.ts

export function calcularDineroDisponibleTotal(dineroLiquidaciones: number, patrimonioStock: number): number {
  return dineroLiquidaciones + patrimonioStock;
}
