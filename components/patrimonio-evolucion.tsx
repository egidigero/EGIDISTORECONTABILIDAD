"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { addDaysToDateOnly, getTodayDateOnly, parseDateOnly } from "@/lib/date"
import { supabase } from "@/lib/supabase"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface PatrimonioActual {
  fecha: string
  patrimonio_stock: number
  unidades_stock: number
  mp_disponible: number
  mp_a_liquidar: number
  mp_retenido: number
  tn_a_liquidar: number
  total_liquidaciones: number
  patrimonio_total: number
}

interface PatrimonioData {
  fecha: string
  patrimonio_stock: number
  patrimonio_total: number
  total_liquidaciones: number
  variacion_dia: number | null
  variacion_porcentaje: number | null
  es_live?: boolean
}

type RangoPatrimonio = "7d" | "30d" | "90d" | "todo"

function formatCurrency(value: number) {
  return `$${Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`
}

function formatSignedPercent(value: number | null) {
  if (value === null) return null
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function metricTone(value: number | null) {
  if (value === null || Math.abs(value) < 0.01) return "text-muted-foreground"
  return value >= 0 ? "text-green-600" : "text-red-600"
}

function getRangeLabel(rango: RangoPatrimonio) {
  switch (rango) {
    case "7d":
      return "7 días"
    case "30d":
      return "30 días"
    case "90d":
      return "90 días"
    default:
      return "todo el histórico"
  }
}

function getRangeButtonLabel(rango: RangoPatrimonio) {
  return rango === "todo" ? "Todo" : getRangeLabel(rango)
}

function getRangeStart(rango: RangoPatrimonio) {
  const hoy = getTodayDateOnly()

  switch (rango) {
    case "7d":
      return addDaysToDateOnly(hoy, -6)
    case "30d":
      return addDaysToDateOnly(hoy, -29)
    case "90d":
      return addDaysToDateOnly(hoy, -89)
    default:
      return null
  }
}

function safePercentage(value: number, total: number) {
  if (!total) return 0
  return (value / total) * 100
}

function buildLivePoint(patrimonioActual: PatrimonioActual, ultimoSnapshot: PatrimonioData | null): PatrimonioData {
  const patrimonioTotal = Number(patrimonioActual.patrimonio_total || 0)
  const patrimonioAnterior = Number(ultimoSnapshot?.patrimonio_total || 0)
  const variacionDia = ultimoSnapshot ? patrimonioTotal - patrimonioAnterior : null
  const variacionPorcentaje =
    ultimoSnapshot && patrimonioAnterior > 0 && variacionDia !== null
      ? (variacionDia / patrimonioAnterior) * 100
      : null

  return {
    fecha: getTodayDateOnly(),
    patrimonio_stock: Number(patrimonioActual.patrimonio_stock || 0),
    patrimonio_total: patrimonioTotal,
    total_liquidaciones: Number(patrimonioActual.total_liquidaciones || 0),
    variacion_dia: variacionDia,
    variacion_porcentaje: variacionPorcentaje,
    es_live: true,
  }
}

export function PatrimonioEvolucion({ patrimonioActual }: { patrimonioActual?: PatrimonioActual | null }) {
  const [datos, setDatos] = useState<PatrimonioData[]>([])
  const [loading, setLoading] = useState(true)
  const [rango, setRango] = useState<RangoPatrimonio>("30d")

  const cargarDatos = async () => {
    try {
      setLoading(true)

      const hoy = getTodayDateOnly()
      const fechaInicio = getRangeStart(rango)

      let query = supabase
        .from("patrimonio_evolucion")
        .select("*")
        .lt("fecha", hoy)
        .order("fecha", { ascending: true })

      if (fechaInicio) {
        query = query.gte("fecha", fechaInicio)
      }

      const { data, error } = await query

      if (error) throw error

      let formateados: PatrimonioData[] = (data || []).map((row) => ({
        fecha: String(row.fecha).split("T")[0],
        patrimonio_stock: Number(row.patrimonio_stock || 0),
        patrimonio_total: Number(row.patrimonio_total || 0),
        total_liquidaciones: Number(row.total_liquidaciones || 0),
        variacion_dia: row.variacion_dia === null || row.variacion_dia === undefined ? null : Number(row.variacion_dia),
        variacion_porcentaje:
          row.variacion_porcentaje === null || row.variacion_porcentaje === undefined ? null : Number(row.variacion_porcentaje),
      }))

      if (patrimonioActual) {
        const puntoLive = buildLivePoint(patrimonioActual, formateados[formateados.length - 1] || null)
        const entraEnRango = !fechaInicio || puntoLive.fecha >= fechaInicio

        if (entraEnRango) {
          formateados = [...formateados, puntoLive]
        }
      }

      setDatos(formateados)
    } catch (error) {
      console.error("Error al cargar evolucion de patrimonio:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargarDatos()
  }, [rango, patrimonioActual])

  if (loading) {
    return <div className="p-4">Cargando evolucion del patrimonio...</div>
  }

  const primerDato = datos[0] || null
  const ultimoDato = datos[datos.length - 1] || null
  const ultimoSnapshotCerrado = [...datos].reverse().find((dato) => !dato.es_live) || null
  const rangoLabel = getRangeLabel(rango)

  const variacionPeriodo = primerDato && ultimoDato
    ? ultimoDato.patrimonio_total - primerDato.patrimonio_total
    : null

  const variacionPeriodoPorcentaje = primerDato && variacionPeriodo !== null && primerDato.patrimonio_total > 0
    ? (variacionPeriodo / primerDato.patrimonio_total) * 100
    : null

  const variacionPeriodoStock = primerDato && ultimoDato
    ? ultimoDato.patrimonio_stock - primerDato.patrimonio_stock
    : null

  const variacionPeriodoLiquidaciones = primerDato && ultimoDato
    ? ultimoDato.total_liquidaciones - primerDato.total_liquidaciones
    : null

  const porcentajeStock = ultimoDato
    ? safePercentage(ultimoDato.patrimonio_stock, ultimoDato.patrimonio_total)
    : 0

  const porcentajeLiquidaciones = ultimoDato
    ? safePercentage(ultimoDato.total_liquidaciones, ultimoDato.patrimonio_total)
    : 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Evolucion del Patrimonio</CardTitle>
              <CardDescription>
                Snapshots cerrados hasta ayer. Hoy se muestra en vivo y el cierre se toma a las 23:59 AR.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {(["7d", "30d", "90d", "todo"] as RangoPatrimonio[]).map((opcion) => (
                <button
                  key={opcion}
                  className={`px-3 py-1 rounded text-sm ${rango === opcion ? "bg-primary text-white" : "bg-gray-100"}`}
                  onClick={() => setRango(opcion)}
                >
                  {getRangeButtonLabel(opcion)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {primerDato && ultimoDato ? (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <p>Periodo analizado: {parseDateOnly(primerDato.fecha).toLocaleDateString("es-AR")} al {parseDateOnly(ultimoDato.fecha).toLocaleDateString("es-AR")}</p>
                {ultimoSnapshotCerrado ? (
                  <p>Ultimo snapshot cerrado: {parseDateOnly(ultimoSnapshotCerrado.fecha).toLocaleDateString("es-AR")}</p>
                ) : null}
                {ultimoDato.es_live ? <p>Hoy en vivo: {parseDateOnly(ultimoDato.fecha).toLocaleDateString("es-AR")}</p> : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="p-4 rounded-lg border bg-slate-50">
                  <p className="text-sm text-muted-foreground">Apertura del periodo</p>
                  <p className="text-2xl font-bold">{formatCurrency(primerDato.patrimonio_total)}</p>
                </div>

                <div className="p-4 rounded-lg border bg-blue-50">
                  <p className="text-sm text-muted-foreground">{ultimoDato.es_live ? "Valor actual" : "Cierre del periodo"}</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(ultimoDato.patrimonio_total)}</p>
                </div>

                <div className="p-4 rounded-lg border bg-amber-50">
                  <p className="text-sm text-muted-foreground">Variacion del periodo</p>
                  <p className={`text-2xl font-bold ${metricTone(variacionPeriodo)}`}>
                    {formatSignedCurrency(variacionPeriodo || 0)}
                  </p>
                  {variacionPeriodoPorcentaje !== null ? (
                    <p className={`text-sm ${metricTone(variacionPeriodo)}`}>{formatSignedPercent(variacionPeriodoPorcentaje)}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">{rangoLabel}</p>
                </div>

                <div className="p-4 rounded-lg border bg-white">
                  <p className="text-sm text-muted-foreground">{ultimoDato.es_live ? "Cambio de hoy vs cierre anterior" : "Ultimo cambio diario"}</p>
                  <p className={`text-2xl font-bold ${metricTone(ultimoDato.variacion_dia)}`}>
                    {formatSignedCurrency(ultimoDato.variacion_dia || 0)}
                  </p>
                  {ultimoDato.variacion_porcentaje !== null ? (
                    <p className={`text-sm ${metricTone(ultimoDato.variacion_dia)}`}>
                      {formatSignedPercent(ultimoDato.variacion_porcentaje)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ultimoDato.es_live ? "Hoy en vivo contra el ultimo snapshot" : "Contra el snapshot anterior"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-purple-50">
                  <p className="text-sm text-muted-foreground">En Stock</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(ultimoDato.patrimonio_stock)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{porcentajeStock.toFixed(1)}% del total</p>
                  {variacionPeriodoStock !== null ? (
                    <p className={`text-sm mt-2 ${metricTone(variacionPeriodoStock)}`}>
                      Periodo: {formatSignedCurrency(variacionPeriodoStock)}
                    </p>
                  ) : null}
                </div>

                <div className="p-4 rounded-lg bg-green-50">
                  <p className="text-sm text-muted-foreground">En Liquidaciones</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(ultimoDato.total_liquidaciones)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{porcentajeLiquidaciones.toFixed(1)}% del total</p>
                  {variacionPeriodoLiquidaciones !== null ? (
                    <p className={`text-sm mt-2 ${metricTone(variacionPeriodoLiquidaciones)}`}>
                      Periodo: {formatSignedCurrency(variacionPeriodoLiquidaciones)}
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {datos.length > 0 ? (
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={datos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={(value) => parseDateOnly(String(value)).toLocaleDateString("es-AR", { month: "short", day: "numeric" })}
                />
                <YAxis tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(Number(value))}
                  labelFormatter={(label) => parseDateOnly(String(label)).toLocaleDateString("es-AR")}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="patrimonio_stock"
                  stackId="composicion"
                  stroke="#a855f7"
                  fill="#d8b4fe"
                  fillOpacity={0.75}
                  name="Stock"
                />
                <Area
                  type="monotone"
                  dataKey="total_liquidaciones"
                  stackId="composicion"
                  stroke="#22c55e"
                  fill="#86efac"
                  fillOpacity={0.55}
                  name="Liquidaciones"
                />
                <Line
                  type="monotone"
                  dataKey="patrimonio_total"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={false}
                  name="Patrimonio Total"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No hay datos de patrimonio registrados
            </p>
          )}
        </CardContent>
      </Card>

      {datos.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Variaciones Diarias</CardTitle>
            <CardDescription>Cambio diario del patrimonio total usando cierre historico y hoy en vivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={datos.filter((dato) => dato.variacion_dia !== null)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={(value) => parseDateOnly(String(value)).toLocaleDateString("es-AR", { month: "short", day: "numeric" })}
                />
                <YAxis tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(Number(value))}
                  labelFormatter={(label) => parseDateOnly(String(label)).toLocaleDateString("es-AR")}
                />
                <Line
                  type="monotone"
                  dataKey="variacion_dia"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Variacion Diaria"
                  dot={{ fill: "#f59e0b" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
