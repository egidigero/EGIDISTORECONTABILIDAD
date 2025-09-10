"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CalendarIcon, ArrowRight, DollarSign } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { procesarLiquidacion, asegurarLiquidacionParaFecha } from "@/lib/actions/liquidaciones"
import { formatCurrency } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

const procesarLiquidacionSchema = z.object({
  fecha: z.date({
    required_error: "La fecha es obligatoria",
  }),
  mp_liquidado: z.number().min(0, "El monto debe ser mayor o igual a 0"),
  tn_liquidado: z.number().min(0, "El monto debe ser mayor o igual a 0"),
  iibb_descuento: z.number().min(0, "El descuento debe ser mayor o igual a 0"),
})

type ProcesarLiquidacionFormData = z.infer<typeof procesarLiquidacionSchema>

export function ProcesarLiquidacionModal() {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ProcesarLiquidacionFormData>({
    resolver: zodResolver(procesarLiquidacionSchema),
    defaultValues: {
      fecha: new Date(),
      mp_liquidado: 0,
      tn_liquidado: 0,
      iibb_descuento: 0,
    },
  })

  const watchedValues = form.watch()
  const netoTN = watchedValues.tn_liquidado - watchedValues.iibb_descuento
  const totalNeto = watchedValues.mp_liquidado + netoTN

  const onSubmit = async (data: ProcesarLiquidacionFormData) => {
    setIsSubmitting(true)
    try {
      // Asegurar que existe la liquidación para la fecha seleccionada
      const initResult = await asegurarLiquidacionParaFecha(data.fecha.toISOString().split('T')[0])
      if (!initResult.success) {
        toast({
          title: "❌ Error de inicialización",
          description: initResult.error || "No se pudo inicializar la liquidación para la fecha seleccionada",
          variant: "destructive",
        })
        return
      }

      // Procesar los movimientos para la fecha seleccionada
      const result = await procesarLiquidacion(
        data.fecha,
        data.mp_liquidado,
        data.tn_liquidado,
        data.iibb_descuento
      )

      if (result.success) {
        toast({
          title: "✅ Liquidación procesada",
          description: `Se procesó correctamente la liquidación del ${format(data.fecha, "dd/MM/yyyy", { locale: es })}`,
        })
        setOpen(false)
        form.reset()
        // Refrescar la página para mostrar los cambios
        window.location.reload()
      } else {
        toast({
          title: "❌ Error al procesar",
          description: result.error || "No se pudo procesar la liquidación",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error inesperado",
        description: "Ocurrió un error al procesar la liquidación",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <DollarSign className="h-4 w-4" />
          Procesar Liquidación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>💰 Procesar Liquidación del Día</DialogTitle>
          <DialogDescription>
            Actualiza automáticamente los montos cuando se procesan liquidaciones de MP o TN
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lado izquierdo: Formulario */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="fecha"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de liquidación</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: es })
                              ) : (
                                <span>Selecciona una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mp_liquidado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MP Liquidado</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Dinero que se liberó en MercadoPago hoy
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tn_liquidado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TN Liquidado</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Dinero que Tienda Nube liquidó hoy
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="iibb_descuento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descuento IIBB</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        IIBB descontado en la transferencia de TN a MP
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Lado derecho: Preview del resultado */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">🔄 Proceso Automático</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* MercadoPago */}
                    {watchedValues.mp_liquidado > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm font-medium text-blue-700 mb-2">📱 MercadoPago</div>
                        <div className="text-xs text-blue-600 space-y-1">
                          <div className="flex justify-between">
                            <span>A Liquidar:</span>
                            <span>-{formatCurrency(watchedValues.mp_liquidado)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Disponible:</span>
                            <span>+{formatCurrency(watchedValues.mp_liquidado)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tienda Nube → MercadoPago */}
                    {watchedValues.tn_liquidado > 0 && (
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="text-sm font-medium text-purple-700 mb-2">🛒 Tienda Nube → MP</div>
                        <div className="text-xs text-purple-600 space-y-1">
                          <div className="flex justify-between">
                            <span>TN A Liquidar:</span>
                            <span>-{formatCurrency(watchedValues.tn_liquidado)}</span>
                          </div>
                          {watchedValues.iibb_descuento > 0 && (
                            <div className="flex justify-between text-red-600">
                              <span>IIBB:</span>
                              <span>-{formatCurrency(watchedValues.iibb_descuento)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-purple-200 pt-1">
                            <span>MP Disponible:</span>
                            <span>+{formatCurrency(netoTN)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Resumen total */}
                    {totalNeto > 0 && (
                      <div className="p-3 bg-green-50 rounded-lg border-2 border-green-200">
                        <div className="text-sm font-medium text-green-700 mb-2">💰 Total Neto</div>
                        <div className="text-lg font-bold text-green-600">
                          +{formatCurrency(totalNeto)}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Se sumará a MP Disponible
                        </div>
                      </div>
                    )}

                    {totalNeto === 0 && (
                      <Alert>
                        <AlertDescription>
                          Ingresa los montos para ver el resumen de la operación
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || totalNeto === 0}>
                {isSubmitting ? "Procesando..." : "Procesar Liquidación"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
