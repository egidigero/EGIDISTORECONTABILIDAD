"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Target, TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface PuntoEquilibrioAnalisisProps {
  precioVenta: number
  margenContribucionUnitario: number
  margenOperativoUnitario: number
  roasActual?: number
  costosFijosSugeridos?: number
  unidadesSugeridas?: number
  periodoLabel?: string
}

interface EscenarioEscala {
  unidades: number
  ingresos: number
  costoFijoPorUnidad: number
  margenNetoPorUnidad: number
  resultadoTotal: number
  margenPctSobreVenta: number
  roasNegocioBE: number | null
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function formatCurrency(value: number) {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function PuntoEquilibrioAnalisis({
  precioVenta,
  margenContribucionUnitario,
  margenOperativoUnitario,
  roasActual = 0,
  costosFijosSugeridos,
  unidadesSugeridas,
  periodoLabel = "los ultimos 30 dias",
}: PuntoEquilibrioAnalisisProps) {
  const [costosFijosPeriodo, setCostosFijosPeriodo] = useState(() =>
    round2(Number(costosFijosSugeridos || 0))
  )
  const [unidadesReferencia, setUnidadesReferencia] = useState(() =>
    Math.max(1, Math.round(Number(unidadesSugeridas || 10)))
  )

  useEffect(() => {
    if ((costosFijosSugeridos || 0) > 0) {
      setCostosFijosPeriodo((prev) => (prev > 0 ? prev : round2(Number(costosFijosSugeridos))))
    }
  }, [costosFijosSugeridos])

  useEffect(() => {
    if ((unidadesSugeridas || 0) > 0) {
      const siguienteValor = Math.max(1, Math.round(Number(unidadesSugeridas)))
      setUnidadesReferencia((prev) => (prev > 0 ? prev : siguienteValor))
    }
  }, [unidadesSugeridas])

  const costosFijosActivos = costosFijosPeriodo > 0
  const margenUnitario = round2(margenOperativoUnitario)
  const ingresosReferencia = round2(precioVenta * unidadesReferencia)
  const costoFijoPorUnidadReferencia = unidadesReferencia > 0 ? round2(costosFijosPeriodo / unidadesReferencia) : 0
  const resultadoTotalReferencia = round2(margenUnitario * unidadesReferencia - costosFijosPeriodo)
  const margenNetoPorUnidadReferencia = unidadesReferencia > 0 ? round2(resultadoTotalReferencia / unidadesReferencia) : 0
  const margenPctReferencia = ingresosReferencia > 0 ? round2((resultadoTotalReferencia / ingresosReferencia) * 100) : 0

  const puntoEquilibrioExacto =
    costosFijosActivos && margenUnitario > 0 ? costosFijosPeriodo / margenUnitario : null
  const puntoEquilibrioUnidades = puntoEquilibrioExacto ? Math.ceil(puntoEquilibrioExacto) : null

  const buildScenario = (unidades: number): EscenarioEscala => {
    const unidadesNormalizadas = Math.max(1, Math.round(unidades))
    const ingresos = round2(precioVenta * unidadesNormalizadas)
    const resultadoTotal = round2(margenUnitario * unidadesNormalizadas - costosFijosPeriodo)
    const costoFijoPorUnidad = round2(costosFijosPeriodo / unidadesNormalizadas)
    const margenNetoPorUnidad = round2(resultadoTotal / unidadesNormalizadas)
    const margenPctSobreVenta = ingresos > 0 ? round2((resultadoTotal / ingresos) * 100) : 0
    const baseNegocioAntesAds = round2(margenContribucionUnitario * unidadesNormalizadas - costosFijosPeriodo)
    const roasNegocioBE = ingresos > 0 && baseNegocioAntesAds > 0
      ? round2(ingresos / baseNegocioAntesAds)
      : null

    return {
      unidades: unidadesNormalizadas,
      ingresos,
      costoFijoPorUnidad,
      margenNetoPorUnidad,
      resultadoTotal,
      margenPctSobreVenta,
      roasNegocioBE,
    }
  }

  const escenariosBase =
    costosFijosActivos && puntoEquilibrioUnidades
      ? [
          Math.max(1, Math.floor(puntoEquilibrioUnidades * 0.5)),
          Math.max(1, Math.floor(puntoEquilibrioUnidades * 0.8)),
          unidadesReferencia,
          puntoEquilibrioUnidades,
          Math.ceil(puntoEquilibrioUnidades * 1.25),
        ]
      : [
          Math.max(1, Math.floor(unidadesReferencia * 0.5)),
          unidadesReferencia,
          Math.max(unidadesReferencia + 5, 10),
          Math.max(unidadesReferencia + 10, 15),
        ]

  const escenarios = Array.from(new Set(escenariosBase))
    .filter((value) => value > 0)
    .sort((a, b) => a - b)
    .map(buildScenario)

  const maximoGrafico = Math.max(
    8,
    unidadesReferencia,
    puntoEquilibrioUnidades ? Math.ceil(puntoEquilibrioUnidades * 1.6) : 0,
    unidadesSugeridas ? Math.ceil(Number(unidadesSugeridas) * 1.25) : 0
  )
  const pasoGrafico = maximoGrafico <= 24 ? 1 : Math.ceil(maximoGrafico / 24)
  const chartMap = new Map<number, EscenarioEscala>()

  for (let unidades = 1; unidades <= maximoGrafico; unidades += pasoGrafico) {
    chartMap.set(unidades, buildScenario(unidades))
  }

  chartMap.set(maximoGrafico, buildScenario(maximoGrafico))

  if (unidadesReferencia > 0) {
    chartMap.set(unidadesReferencia, buildScenario(unidadesReferencia))
  }

  if (puntoEquilibrioUnidades) {
    chartMap.set(puntoEquilibrioUnidades, buildScenario(puntoEquilibrioUnidades))
  }

  const chartData = Array.from(chartMap.values()).sort((a, b) => a.unidades - b.unidades)

  return (
    <Card className="border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-sky-700" />
          Punto de equilibrio y escala
        </CardTitle>
        <CardDescription>
          Separa el analisis de costos fijos del margen unitario para ver cuantas unidades cubren estructura y
          como cambia el margen cuando aumenta el volumen.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Costos fijos del periodo (ARS)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={costosFijosPeriodo}
              onChange={(e) => setCostosFijosPeriodo(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Ej: 250000"
            />
            <p className="text-xs text-muted-foreground">
              Carga alquiler, sueldos, herramientas y estructura.{" "}
              {costosFijosSugeridos
                ? `Sugerencia tomada de ${periodoLabel}: $${formatCurrency(costosFijosSugeridos)}.`
                : "Si no tenes historico, podes ingresarlo manualmente."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Unidades a evaluar</Label>
            <Input
              type="number"
              min={1}
              step="1"
              value={unidadesReferencia}
              onChange={(e) => setUnidadesReferencia(Math.max(1, Math.round(Number(e.target.value) || 1)))}
              placeholder="Ej: 30"
            />
            <p className="text-xs text-muted-foreground">
              Sirve para medir el margen neto a un volumen puntual.{" "}
              {unidadesSugeridas ? `Base sugerida: ${Math.round(unidadesSugeridas)} unidades.` : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-white/90 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Margen unitario para fijos</div>
            <div className={`mt-2 text-2xl font-semibold ${margenUnitario >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              ${formatCurrency(margenUnitario)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Margen operativo por unidad, despues de publicidad.</div>
          </div>

          <div className="rounded-xl border bg-white/90 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Punto de equilibrio</div>
            <div className="mt-2 text-2xl font-semibold text-sky-700">
              {costosFijosActivos && puntoEquilibrioUnidades ? `${puntoEquilibrioUnidades} u.` : "-"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {costosFijosActivos && puntoEquilibrioExacto
                ? `${puntoEquilibrioExacto.toFixed(1)} unidades exactas para cubrir estructura.`
                : "Carga costos fijos para calcularlo."}
            </div>
          </div>

          <div className="rounded-xl border bg-white/90 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Resultado con {unidadesReferencia} u.</div>
            <div
              className={`mt-2 text-2xl font-semibold ${
                resultadoTotalReferencia >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              ${formatCurrency(resultadoTotalReferencia)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Margen operativo total menos costos fijos del periodo.</div>
          </div>

          <div className="rounded-xl border bg-white/90 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Margen neto por unidad</div>
            <div
              className={`mt-2 text-2xl font-semibold ${
                margenNetoPorUnidadReferencia >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              ${formatCurrency(margenNetoPorUnidadReferencia)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {margenPctReferencia.toFixed(1)}% sobre venta con {unidadesReferencia} unidades.
            </div>
          </div>
        </div>

        {costosFijosActivos && (
          <div className="rounded-xl border bg-white/90 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-muted-foreground">ROAS actual:</span>{" "}
                <span className={`font-semibold ${roasActual > 0 ? "text-violet-700" : "text-muted-foreground"}`}>
                  {roasActual > 0 ? `${roasActual.toFixed(2)}x` : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">ROAS negocio BE con {unidadesReferencia} u.:</span>{" "}
                <span className="font-semibold text-sky-700">
                  {escenarios.find((escenario) => escenario.unidades === unidadesReferencia)?.roasNegocioBE
                    ? `${escenarios.find((escenario) => escenario.unidades === unidadesReferencia)?.roasNegocioBE?.toFixed(2)}x`
                    : "No cubre estructura"}
                </span>
              </div>
            </div>
          </div>
        )}

        {!costosFijosActivos && (
          <div className="rounded-xl border border-dashed border-sky-300 bg-white/80 p-4 text-sm text-sky-800">
            El punto de equilibrio necesita un costo fijo total del periodo. Si activas el analisis de ultimos 30 dias,
            la calculadora te sugiere automaticamente la estructura historica.
          </div>
        )}

        {costosFijosActivos && margenUnitario <= 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Con este precio y estos costos, cada unidad deja ${formatCurrency(margenUnitario)} antes de absorber fijos.
            No hay punto de equilibrio hasta mejorar el margen unitario.
          </div>
        )}

        {costosFijosActivos && margenUnitario > 0 && (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border bg-white/90 p-4">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-700" />
                <div>
                  <div className="font-semibold">Resultado total segun unidades</div>
                  <div className="text-xs text-muted-foreground">
                    Azul: resultado total. Violeta: ROAS negocio BE. La linea punteada muestra tu ROAS actual.
                  </div>
                </div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="unidades" type="number" tickFormatter={(value) => `${value}`} />
                    <YAxis tickFormatter={(value) => `$${formatCurrency(Number(value))}`} width={90} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) => `${Number(value).toFixed(1)}x`}
                      width={60}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "resultadoTotal") return [`$${formatCurrency(Number(value))}`, "Resultado total"]
                        if (name === "roasNegocioBE") {
                          return [
                            value ? `${Number(value).toFixed(2)}x` : "No cubre estructura",
                            "ROAS negocio BE",
                          ]
                        }
                        return [value, name]
                      }}
                      labelFormatter={(value) => `${value} unidades`}
                    />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                    <ReferenceLine
                      x={unidadesReferencia}
                      stroke="#2563eb"
                      strokeDasharray="4 4"
                      label={{ value: "Escenario actual", position: "top" }}
                    />
                    {puntoEquilibrioExacto && (
                      <ReferenceLine
                        x={Number(puntoEquilibrioExacto.toFixed(2))}
                        stroke="#0f766e"
                        strokeDasharray="4 4"
                        label={{ value: `BE ${puntoEquilibrioExacto.toFixed(1)} u.`, position: "top" }}
                      />
                    )}
                    {roasActual > 0 && (
                      <ReferenceLine
                        yAxisId="right"
                        y={roasActual}
                        stroke="#7c3aed"
                        strokeDasharray="4 4"
                        label={{ value: `ROAS actual ${roasActual.toFixed(2)}x`, position: "insideTopRight" }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="resultadoTotal"
                      stroke="#0284c7"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="roasNegocioBE"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border bg-white/90 p-4">
              <div className="font-semibold">Escenarios de margen</div>
              <div className="mt-1 text-xs text-muted-foreground">
                A medida que vendes mas, el costo fijo por unidad cae y mejora el margen neto.
              </div>

              <div className="mt-4 space-y-3">
                {escenarios.map((escenario) => {
                  const esReferencia = escenario.unidades === unidadesReferencia
                  const esPuntoEquilibrio = puntoEquilibrioUnidades === escenario.unidades

                  return (
                    <div
                      key={escenario.unidades}
                      className={`rounded-lg border p-3 ${
                        esPuntoEquilibrio
                          ? "border-emerald-300 bg-emerald-50"
                          : esReferencia
                            ? "border-blue-300 bg-blue-50"
                            : "bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">
                          {escenario.unidades} unidades {esReferencia ? "(actual)" : esPuntoEquilibrio ? "(BE)" : ""}
                        </div>
                        <div
                          className={`text-sm font-semibold ${
                            escenario.resultadoTotal >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          ${formatCurrency(escenario.resultadoTotal)}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Fijo/u.: ${formatCurrency(escenario.costoFijoPorUnidad)}</div>
                        <div>Margen/u.: ${formatCurrency(escenario.margenNetoPorUnidad)}</div>
                        <div>Ingresos: ${formatCurrency(escenario.ingresos)}</div>
                        <div>{escenario.margenPctSobreVenta.toFixed(1)}% s/venta</div>
                        <div>ROAS negocio: {escenario.roasNegocioBE ? `${escenario.roasNegocioBE.toFixed(2)}x` : "No cubre estructura"}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
