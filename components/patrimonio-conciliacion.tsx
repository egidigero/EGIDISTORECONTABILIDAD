import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { calcularEERR } from "@/lib/actions/eerr"
import { supabase } from "@/lib/supabase"

type PatrimonioConciliacionProps = {
  dias?: number
}

function formatDateOnly(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseDateOnly(value: string) {
  const [y, m, d] = String(value).split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatCurrency(value: number) {
  return `$${Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function metricTone(value: number) {
  if (Math.abs(value) < 0.01) return "text-muted-foreground"
  return value >= 0 ? "text-emerald-600" : "text-red-600"
}

export async function PatrimonioConciliacion({ dias = 30 }: PatrimonioConciliacionProps) {
  const { data: latestSnapshot, error: latestError } = await supabase
    .from("patrimonio_historico")
    .select("fecha, patrimonio_stock, total_liquidaciones, patrimonio_total")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError || !latestSnapshot) {
    return null
  }

  const fechaFin = parseDateOnly(String(latestSnapshot.fecha))
  const fechaInicioPeriodo = addDays(fechaFin, -(dias - 1))
  const fechaInicioStr = formatDateOnly(fechaInicioPeriodo)
  const fechaFinStr = formatDateOnly(fechaFin)
  const fechaAperturaStr = formatDateOnly(addDays(fechaInicioPeriodo, -1))

  const [{ data: apertura }, eerr] = await Promise.all([
    supabase
      .from("patrimonio_historico")
      .select("fecha, patrimonio_stock, total_liquidaciones, patrimonio_total")
      .lte("fecha", fechaAperturaStr)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    calcularEERR(new Date(`${fechaInicioStr}T00:00:00.000Z`), new Date(`${fechaFinStr}T23:59:59.999Z`), "General"),
  ])

  const snapshotInicial = apertura || latestSnapshot
  const snapshotFinal = latestSnapshot

  const deltaStock = Number(snapshotFinal.patrimonio_stock || 0) - Number(snapshotInicial.patrimonio_stock || 0)
  const deltaLiquidaciones = Number(snapshotFinal.total_liquidaciones || 0) - Number(snapshotInicial.total_liquidaciones || 0)
  const deltaPatrimonio = Number(snapshotFinal.patrimonio_total || 0) - Number(snapshotInicial.patrimonio_total || 0)

  const margenNegocio = Number((eerr as any)?.margenNetoNegocio || 0)
  const margenFinal = Number((eerr as any)?.margenFinalConPersonales ?? margenNegocio)
  const ajustePersonales = margenFinal - margenNegocio
  const diferenciaConciliacion = deltaPatrimonio - margenFinal
  const liquidacionesEsperadas = margenFinal - deltaStock

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conciliacion Patrimonio vs EERR</CardTitle>
        <CardDescription>
          {dias} dias hasta {fechaFin.toLocaleDateString("es-AR")}. Para comparar con EERR mirá patrimonio total; liquidaciones solas incluyen el traspaso con stock.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Resultado EERR negocio</p>
            <p className={`text-2xl font-bold ${metricTone(margenNegocio)}`}>{formatCurrency(margenNegocio)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Ajuste personales</p>
            <p className={`text-2xl font-bold ${metricTone(ajustePersonales)}`}>{formatCurrency(ajustePersonales)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Resultado conciliable</p>
            <p className={`text-2xl font-bold ${metricTone(margenFinal)}`}>{formatCurrency(margenFinal)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Variacion patrimonio total</p>
            <p className={`text-2xl font-bold ${metricTone(deltaPatrimonio)}`}>{formatCurrency(deltaPatrimonio)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Brecha conciliacion</p>
            <p className={`text-2xl font-bold ${metricTone(-Math.abs(diferenciaConciliacion))}`}>
              {formatCurrency(diferenciaConciliacion)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Variacion liquidaciones</p>
            <p className={`text-2xl font-bold ${metricTone(deltaLiquidaciones)}`}>{formatCurrency(deltaLiquidaciones)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Caja + dinero a liquidar.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Variacion stock</p>
            <p className={`text-2xl font-bold ${metricTone(deltaStock)}`}>{formatCurrency(deltaStock)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Si sube por importaciones o reposicion, le resta explicacion a liquidaciones.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Liquidaciones esperadas por formula</p>
            <p className={`text-2xl font-bold ${metricTone(liquidacionesEsperadas)}`}>{formatCurrency(liquidacionesEsperadas)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Resultado conciliable - variacion stock.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p>
            Formula de lectura: <strong>variacion patrimonio</strong> = <strong>variacion liquidaciones</strong> + <strong>variacion stock</strong>.
          </p>
          <p>
            Si el modelo esta bien cargado, entonces <strong>variacion patrimonio</strong> deberia acercarse al <strong>resultado EERR conciliable</strong>.
          </p>
          <p>
            Por eso <strong>liquidaciones</strong> solas no deberian coincidir con el resultado neto del EERR: les falta el movimiento de stock.
          </p>
          <p>
            Si queda una brecha chica, lo mas comun es una diferencia de criterio de fechas: hoy el EERR toma devoluciones por <strong>fecha_reclamo</strong> y liquidaciones las mueve por <strong>fecha_impacto</strong>.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
