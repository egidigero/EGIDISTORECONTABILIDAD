"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { CircleHelp, DollarSign, Target, TrendingUp } from "lucide-react"
import type { ModelBreakdownRow } from "@/components/roas-analysis-modal"
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface ROASAnalysisChartProps {
  ventasNetas: number
  margenContribucion: number
  baseNegocioAntesAds: number
  resultadoNetoSinInteresesMP: number
  resultadoNetoFinal: number
  inversionMarketing: number
  gastosAds: number
  gastosUGC: number
  cantidadVentas: number
  modelBreakdown: ModelBreakdownRow[]
  devolucionesNoAsignadas: number
}

const round2 = (value: number): number => Math.round(value * 100) / 100

interface HelpText {
  simple: string
  avanzado: string
}

const HELP_TEXTS: Record<string, HelpText> = {
  margenContribucion: {
    simple: "Ganancia despues de costos variables. Es la plata disponible para pagar marketing y estructura.",
    avanzado: "Ventas netas - producto - comisiones - envios - devoluciones. Define cuanto podes invertir para adquirir clientes.",
  },
  roasEscala: {
    simple: "ROAS minimo para que marketing no pierda plata. Si tu ROAS actual esta arriba, podes aumentar inversion.",
    avanzado: "Se calcula contra el margen de contribucion. Mide la rentabilidad del sistema de adquisicion sin considerar gastos fijos.",
  },
  roasNegocio: {
    simple: "ROAS necesario para cubrir marketing + estructura del negocio.",
    avanzado: "Incluye gastos fijos del negocio sin intereses MP. Si estas arriba, el negocio completo es rentable.",
  },
  baseNegocioSinMarketing: {
    simple: "Lo que genera el negocio antes de invertir en marketing.",
    avanzado: "Margen de contribucion - estructura + otros ingresos operativos. Se usa para calcular el break-even real del negocio.",
  },
  cpaBeMarketing: {
    simple: "Lo maximo que podes pagar por una venta sin perder plata en adquisicion.",
    avanzado: "Margen de contribucion / cantidad de ventas. Si tu CPA actual esta abajo, podes escalar.",
  },
  colchonCpa: {
    simple: "Diferencia entre tu CPA actual y el maximo permitido.",
    avanzado: "Define cuanto podes aumentar inversion manteniendo rentabilidad.",
  },
  sensibilidadRoas: {
    simple: "Muestra como cambia tu ganancia si subis o bajas la inversion en marketing.",
    avanzado: "Simula distintos ROAS manteniendo constantes los costos del negocio.",
  },
}

function HelpTooltip({ helpKey }: { helpKey: keyof typeof HELP_TEXTS }) {
  const text = HELP_TEXTS[helpKey]
  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground">
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs space-y-1 text-left">
        <div><span className="font-semibold">Simple:</span> {text.simple}</div>
        <div><span className="font-semibold">Avanzado:</span> {text.avanzado}</div>
      </TooltipContent>
    </UITooltip>
  )
}

export function ROASAnalysisChart({
  ventasNetas,
  margenContribucion,
  baseNegocioAntesAds,
  resultadoNetoSinInteresesMP,
  resultadoNetoFinal,
  inversionMarketing,
  gastosAds,
  gastosUGC,
  cantidadVentas,
  modelBreakdown,
  devolucionesNoAsignadas,
}: ROASAnalysisChartProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

  const roasEscalaBE = margenContribucion > 0 ? ventasNetas / margenContribucion : 0
  const roasNegocioBE = baseNegocioAntesAds > 0 ? ventasNetas / baseNegocioAntesAds : 0
  const roasActual = inversionMarketing > 0 ? ventasNetas / inversionMarketing : 0

  const acosBeEscala = ventasNetas > 0 ? margenContribucion / ventasNetas : 0
  const acosActual = ventasNetas > 0 ? inversionMarketing / ventasNetas : 0

  const cpaBeMarketing = cantidadVentas > 0 ? margenContribucion / cantidadVentas : 0
  const cpaActual = cantidadVentas > 0 ? inversionMarketing / cantidadVentas : 0

  const colchonAcosEscala = acosBeEscala - acosActual
  const colchonAcosEscalaPct = acosBeEscala > 0 ? (colchonAcosEscala / acosBeEscala) * 100 : 0
  const colchonCpa = cpaBeMarketing - cpaActual
  const colchonCpaPct = cpaBeMarketing > 0 ? (colchonCpa / cpaBeMarketing) * 100 : 0

  const interesesMP = resultadoNetoFinal - resultadoNetoSinInteresesMP

  const chartData: Array<{
    roas: number
    roasLabel: string
    inversion: number
    resultadoMarketing: number
    resultadoNetoSinIntereses: number
    resultadoNetoFinal: number
  }> = []

  for (let roas = 0.5; roas <= 10; roas += 0.5) {
    const inversionSimulada = ventasNetas / roas
    const resultadoMarketingSim = margenContribucion - inversionSimulada
    const resultadoNetoSinInteresesSim = baseNegocioAntesAds - inversionSimulada
    const resultadoNetoFinalSim = resultadoNetoSinInteresesSim + interesesMP

    chartData.push({
      roas,
      roasLabel: `${roas.toFixed(1)}x`,
      inversion: round2(inversionSimulada),
      resultadoMarketing: round2(resultadoMarketingSim),
      resultadoNetoSinIntereses: round2(resultadoNetoSinInteresesSim),
      resultadoNetoFinal: round2(resultadoNetoFinalSim),
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="inline-flex items-center gap-1">
                1) ROAS para ESCALAR ADS
                <HelpTooltip helpKey="roasEscala" />
              </span>
            </CardTitle>
            <CardDescription>Ads+UGC vs margen de contribucion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>ROAS para ESCALAR ADS (BE)</span><span className="font-semibold">{roasEscalaBE.toFixed(2)}x</span></div>
            <div className="flex justify-between"><span>ROAS Actual</span><span className={`font-semibold ${roasActual >= roasEscalaBE ? "text-green-600" : "text-red-600"}`}>{roasActual.toFixed(2)}x</span></div>
            <div className="flex justify-between"><span>ACOS BE Escala</span><span className="font-semibold">{acosBeEscala.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>ACOS Actual</span><span className="font-semibold">{acosActual.toFixed(2)}</span></div>
            <div className={`rounded-md px-2 py-1 text-xs ${colchonAcosEscala >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {colchonAcosEscala >= 0
                ? `Podes aumentar inversion manteniendo rentabilidad: +${Math.abs(colchonAcosEscalaPct).toFixed(0)}%`
                : `Estas por encima del limite de escala: -${Math.abs(colchonAcosEscalaPct).toFixed(0)}%`}
            </div>
            <div className="pt-2 border-t text-xs text-muted-foreground">Inversion = Ads {formatCurrency(gastosAds)} + UGC {formatCurrency(gastosUGC)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="inline-flex items-center gap-1">
                2) ROAS para NO PERDER PLATA
                <HelpTooltip helpKey="roasNegocio" />
              </span>
            </CardTitle>
            <CardDescription>Excluye intereses MP del BE</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>ROAS para NO PERDER PLATA (BE)</span><span className="font-semibold">{roasNegocioBE.toFixed(2)}x</span></div>
            <div className="flex justify-between"><span>ROAS Actual</span><span className={`font-semibold ${roasActual >= roasNegocioBE ? "text-green-600" : "text-red-600"}`}>{roasActual.toFixed(2)}x</span></div>
            <div className="flex justify-between"><span>Brecha</span><span className="font-semibold">{(roasActual - roasNegocioBE >= 0 ? "+" : "") + (roasActual - roasNegocioBE).toFixed(2)}x</span></div>
            <div className="flex justify-between">
              <span className="inline-flex items-center gap-1">
                Ganancia del negocio sin marketing
                <HelpTooltip helpKey="baseNegocioSinMarketing" />
              </span>
              <span className="font-semibold">{formatCurrency(baseNegocioAntesAds)}</span>
            </div>
            <div className="pt-2 border-t text-xs text-muted-foreground">Intereses MP ({formatCurrency(interesesMP)}) solo impactan en resultado final.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              3) CPA Marketing
            </CardTitle>
            <CardDescription>Lectura operativa por venta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="inline-flex items-center gap-1">
                CPA BE Marketing
                <HelpTooltip helpKey="cpaBeMarketing" />
              </span>
              <span className="font-semibold">{formatCurrency(cpaBeMarketing)}</span>
            </div>
            <div className="flex justify-between"><span>CPA Actual</span><span className={`font-semibold ${cpaActual <= cpaBeMarketing ? "text-green-600" : "text-red-600"}`}>{formatCurrency(cpaActual)}</span></div>
            <div className={`flex justify-between rounded-md px-2 py-1 ${colchonCpa >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              <span className="inline-flex items-center gap-1">
                Colchon CPA
                <HelpTooltip helpKey="colchonCpa" />
              </span>
              <span className="font-semibold">
                {formatCurrency(colchonCpa)} ({colchonCpaPct >= 0 ? "+" : ""}{colchonCpaPct.toFixed(0)}%)
              </span>
            </div>
            <div className="flex justify-between"><span>Cantidad ventas</span><span className="font-semibold">{cantidadVentas}</span></div>
            <div className="flex justify-between">
              <span className="inline-flex items-center gap-1">
                Margen contribucion
                <HelpTooltip helpKey="margenContribucion" />
              </span>
              <span className="font-semibold">{formatCurrency(margenContribucion)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-1">
            Analisis de Sensibilidad ROAS
            <HelpTooltip helpKey="sensibilidadRoas" />
          </CardTitle>
          <CardDescription>
            Varía la inversion de marketing por ROAS y muestra impacto en resultado de marketing y neto sin intereses MP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="roas" label={{ value: "ROAS", position: "insideBottom", offset: -5 }} />
              <YAxis label={{ value: "Resultado ($)", angle: -90, position: "insideLeft" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white p-3 border rounded shadow text-sm">
                      <div className="font-semibold mb-1">ROAS {label}x</div>
                      <div>Inversion: {formatCurrency(d.inversion)}</div>
                      <div>Resultado Marketing: {formatCurrency(d.resultadoMarketing)}</div>
                      <div>Resultado Neto s/ intereses: {formatCurrency(d.resultadoNetoSinIntereses)}</div>
                      <div>Resultado Neto final: {formatCurrency(d.resultadoNetoFinal)}</div>
                    </div>
                  )
                }}
              />
              <Legend />

              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
              <ReferenceLine x={roasEscalaBE.toFixed(1)} stroke="#2563eb" strokeDasharray="4 4" label={{ value: `BE Escala ${roasEscalaBE.toFixed(2)}x`, position: "top", fill: "#2563eb" }} />
              <ReferenceLine x={roasNegocioBE.toFixed(1)} stroke="#7c3aed" strokeDasharray="4 4" label={{ value: `BE Negocio ${roasNegocioBE.toFixed(2)}x`, position: "top", fill: "#7c3aed" }} />
              {inversionMarketing > 0 && (
                <ReferenceLine
                  x={roasActual.toFixed(1)}
                  stroke="#16a34a"
                  strokeDasharray="3 3"
                  label={{ value: "Hoy estas aca", position: "top", fill: "#16a34a" }}
                />
              )}

              <Line type="monotone" dataKey="resultadoNetoSinIntereses" stroke="#111827" strokeWidth={3} dot={false} name="Neto s/ intereses MP" />
              <Line type="monotone" dataKey="resultadoMarketing" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Resultado Marketing" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contribucion por Modelo</CardTitle>
          <CardDescription>Vista por producto sin usar ventas para CPA BE de modelo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3">Modelo</th>
                  <th className="py-2 pr-3 text-right">Contrib. Bruta</th>
                  <th className="py-2 pr-3 text-right">Devoluciones</th>
                  <th className="py-2 pr-3 text-right">Contrib. Neta</th>
                  <th className="py-2 pr-3 text-right">%PV</th>
                  <th className="py-2 text-right">%Costo</th>
                </tr>
              </thead>
              <tbody>
                {modelBreakdown.map((row) => (
                  <tr key={row.modelo} className="border-b">
                    <td className="py-2 pr-3">{row.modelo}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(row.contribucionBruta)}</td>
                    <td className="py-2 pr-3 text-right text-red-600">-{formatCurrency(row.devolucionesAsignadas)}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${row.contribucionNeta >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(row.contribucionNeta)}
                    </td>
                    <td className="py-2 pr-3 text-right">{row.pctPV.toFixed(1)}%</td>
                    <td className="py-2 text-right">{row.pctCosto.toFixed(1)}%</td>
                  </tr>
                ))}
                {modelBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-center text-muted-foreground">Sin datos suficientes para calcular contribucion por modelo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {devolucionesNoAsignadas > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              Nota: hay {formatCurrency(devolucionesNoAsignadas)} de devoluciones no asignadas a modelo.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
