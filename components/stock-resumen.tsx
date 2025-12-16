"use client"

import { useEffect, useState } from "react"
import { getLiquidaciones } from "@/lib/actions/liquidaciones"

interface StockResumenProps {
  productos: any[];
}

export function StockResumen({ productos }: StockResumenProps) {
  const [dineroLiquidaciones, setDineroLiquidaciones] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarLiquidaciones = async () => {
      try {
        const liquidaciones = await getLiquidaciones()
        if (liquidaciones && liquidaciones.length > 0) {
          // Obtener la última liquidación (más reciente)
          const ultimaLiquidacion = liquidaciones[0]
          // Calcular total disponible (MP disponible + MP a liquidar + TN a liquidar)
          const totalDisponible = 
            Number(ultimaLiquidacion.mp_disponible || 0) +
            Number(ultimaLiquidacion.mp_a_liquidar || 0) +
            Number(ultimaLiquidacion.tn_a_liquidar || 0)
          setDineroLiquidaciones(totalDisponible)
        }
      } catch (error) {
        console.error("Error al cargar liquidaciones:", error)
      } finally {
        setLoading(false)
      }
    }

    cargarLiquidaciones()
  }, [])

  // Calcular patrimonio total en stock (stock total = propio + full)
  const patrimonioStock = productos.reduce((total, p) => {
    const stockTotal = Number(p.stockPropio || 0) + Number(p.stockFull || 0)
    return total + (Number(p.costoUnitarioARS || 0) * stockTotal);
  }, 0);

  const dineroTotal = dineroLiquidaciones + patrimonioStock;

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
      <h3 className="text-lg font-semibold mb-3">💰 Resumen Patrimonial</h3>
      {loading ? (
        <p className="text-sm text-gray-500">Cargando datos de liquidaciones...</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Patrimonio en Stock</p>
            <p className="text-2xl font-bold text-blue-600">
              ${patrimonioStock.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Dinero en Liquidaciones</p>
            <p className="text-2xl font-bold text-purple-600">
              ${dineroLiquidaciones.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Disponible</p>
            <p className="text-2xl font-bold text-green-600">
              ${dineroTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
