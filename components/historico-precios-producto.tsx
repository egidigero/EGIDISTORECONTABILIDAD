
import { useEffect, useState } from "react"
import { getVentas } from "@/lib/actions/ventas"
import { getDevoluciones } from "@/lib/actions/devoluciones"
import { getGastosIngresos } from "@/lib/actions/gastos-ingresos"

export default function HistoricoPreciosProducto({ productoId }: { productoId?: string }) {
  const [loading, setLoading] = useState(true)
  const [ventas, setVentas] = useState<any[]>([])
  const [devoluciones, setDevoluciones] = useState<any[]>([])
  const [gastosIngresos, setGastosIngresos] = useState<any[]>([])

  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true)
      const fecha30DiasAtras = new Date()
      fecha30DiasAtras.setDate(fecha30DiasAtras.getDate() - 30)

      // Traer ventas filtradas por producto si hay productoId
      const ventasData = await getVentas({ fechaDesde: fecha30DiasAtras })
      setVentas(productoId ? (ventasData || []).filter((v: any) => v.productoId === productoId) : ventasData || [])

      // Traer devoluciones (no hay filtro directo por producto, se filtra en front)
      const devolucionesData = await getDevoluciones()
      setDevoluciones(productoId ? (devolucionesData || []).filter((d: any) => d.productoId === productoId) : devolucionesData || [])

      // Gastos e ingresos últimos 30 días
      const gastosIngresosData = await getGastosIngresos({ fechaDesde: fecha30DiasAtras })
      setGastosIngresos(gastosIngresosData || [])

      setLoading(false)
    }
    cargarDatos()
  }, [productoId])

  if (loading) return <div className="text-center text-muted-foreground py-4">Cargando histórico...</div>

  // Cálculos principales (placeholders, reemplazar con lógica real)
  const pvPromedio = ventas.length > 0 ? ventas.reduce((sum, v) => sum + Number(v.pvBruto || 0), 0) / ventas.length : 0
  const costoPromedio = ventas.length > 0 ? ventas.reduce((sum, v) => sum + Number(v.costoProducto || 0), 0) / ventas.length : 0
  const comisionPromedio = ventas.length > 0 ? ventas.reduce((sum, v) => sum + Number(v.comision || 0), 0) / ventas.length : 0
  const envioPromedio = ventas.length > 0 ? ventas.reduce((sum, v) => sum + Number(v.cargoEnvioCosto || 0), 0) / ventas.length : 0
  const adsTotal = gastosIngresos.filter((gi: any) => gi.tipo === "Gasto" && (gi.categoria?.toLowerCase().includes("ads") || gi.categoria?.toLowerCase().includes("publicidad"))).reduce((sum, gi) => sum + Number(gi.montoARS || 0), 0)
  const unidadesVendidas = ventas.length
  const adsPorUnidad = unidadesVendidas > 0 ? adsTotal / unidadesVendidas : 0

  // Devoluciones: costo incidencia = perdida total / (ventas - devoluciones)
  const perdidasDevoluciones = devoluciones.reduce((sum, d) => sum + Number(d.perdidaTotal || 0), 0)
  const devolucionesCount = devoluciones.length
  const ventasNetas = unidadesVendidas - devolucionesCount
  const incidenciaDevolucion = ventasNetas > 0 ? perdidasDevoluciones / ventasNetas : 0

  // Otros gastos/ingresos por unidad
  const otrosGastos = gastosIngresos.filter((gi: any) => gi.tipo === "Gasto" && !(gi.categoria?.toLowerCase().includes("ads") || gi.categoria?.toLowerCase().includes("publicidad"))).reduce((sum, gi) => sum + Number(gi.montoARS || 0), 0)
  const otrosIngresos = gastosIngresos.filter((gi: any) => gi.tipo === "Ingreso").reduce((sum, gi) => sum + Number(gi.montoARS || 0), 0)
  const incidenciaOtros = ventasNetas > 0 ? (otrosGastos - otrosIngresos) / ventasNetas : 0

  // Margen operativo y neto (simplificado)
  const margenOperativo = pvPromedio - costoPromedio - comisionPromedio - envioPromedio
  const margenNeto = margenOperativo - adsPorUnidad - incidenciaDevolucion - incidenciaOtros

  return (
    <div className="space-y-2">
      <div className="font-bold text-lg mb-2">Histórico últimos 30 días</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <div>PV promedio: <span className="font-mono">${pvPromedio.toFixed(2)}</span></div>
          <div>Costo promedio: <span className="font-mono">${costoPromedio.toFixed(2)}</span></div>
          <div>Comisión promedio: <span className="font-mono">${comisionPromedio.toFixed(2)}</span></div>
          <div>Envío promedio: <span className="font-mono">${envioPromedio.toFixed(2)}</span></div>
        </div>
        <div>
          <div>ADS por unidad: <span className="font-mono">${adsPorUnidad.toFixed(2)}</span></div>
          <div>Incidencia devolución: <span className="font-mono">${incidenciaDevolucion.toFixed(2)}</span></div>
          <div>Incidencia otros gastos: <span className="font-mono">${incidenciaOtros.toFixed(2)}</span></div>
        </div>
      </div>
      <div className="mt-2">
        <div>Margen operativo: <span className="font-mono">${margenOperativo.toFixed(2)}</span></div>
        <div>Margen neto: <span className="font-mono">${margenNeto.toFixed(2)}</span></div>
        <div className="text-xs text-muted-foreground">% sobre PV: {(pvPromedio > 0 ? (margenNeto / pvPromedio) * 100 : 0).toFixed(1)}% | % sobre costo: {(costoPromedio > 0 ? (margenNeto / costoPromedio) * 100 : 0).toFixed(1)}%</div>
      </div>
      <div className="text-xs text-muted-foreground mt-2">* Cálculos sobre ventas, devoluciones y gastos/ingresos de los últimos 30 días para este producto.</div>
    </div>
  )
}
