"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, Calculator } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { liquidacionSchema, type LiquidacionFormData } from "@/lib/validations"
import { formatCurrency } from "@/lib/utils"

interface LiquidacionFormProps {
  defaultValues?: Partial<LiquidacionFormData>
  onSubmit: (data: LiquidacionFormData) => Promise<void>
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

export function LiquidacionForm({ defaultValues, onSubmit, isLoading = false, mode = 'create' }: LiquidacionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<LiquidacionFormData>({
    resolver: zodResolver(liquidacionSchema),
    defaultValues: {
      fecha: new Date(),
      mp_disponible: 0,
      mp_a_liquidar: 0,
      mp_liquidado_hoy: 0,
      tn_a_liquidar: 0,
      tn_liquidado_hoy: 0,
      tn_iibb_descuento: 0,
      ...defaultValues,
    },
  })

  const watchedValues = form.watch()

  // Cálculos automáticos
  const mpTotal = watchedValues.mp_disponible + watchedValues.mp_a_liquidar
  const totalDisponible = mpTotal + watchedValues.tn_a_liquidar
  const movimientoNetoDia = mode === 'edit' 
    ? watchedValues.mp_liquidado_hoy + watchedValues.tn_liquidado_hoy - watchedValues.tn_iibb_descuento 
    : 0

  const handleSubmit = async (data: LiquidacionFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna 1: Fecha y MercadoPago */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">📱 MercadoPago</CardTitle>
              <CardDescription>
                Gestión de fondos en MercadoPago
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha</FormLabel>
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
                name="mp_disponible"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MP Disponible {mode === 'edit' && <Badge variant="secondary" className="ml-2">Auto-calculado</Badge>}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value === 0 ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value
                          field.onChange(value === '' ? 0 : parseFloat(value))
                        }}
                        readOnly={mode === 'edit'}
                        disabled={mode === 'edit'}
                        className={mode === 'edit' ? 'bg-muted' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      {mode === 'edit' 
                        ? 'Se recalcula automáticamente basado en el día anterior + movimientos'
                        : 'Dinero disponible para usar en MP'
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mp_a_liquidar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MP A Liquidar {mode === 'edit' && <Badge variant="secondary" className="ml-2">Auto-calculado</Badge>}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value || ''}
                        onChange={(e) => {
                          const value = e.target.value
                          field.onChange(value === '' ? 0 : parseFloat(value))
                        }}
                        readOnly={mode === 'edit'}
                        disabled={mode === 'edit'}
                        className={mode === 'edit' ? 'bg-muted' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      {mode === 'edit' 
                        ? 'Se recalcula automáticamente basado en el día anterior - liquidado hoy'
                        : 'Dinero pendiente de liberar en MP'
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {mode === 'edit' && (
                <FormField
                  control={form.control}
                  name="mp_liquidado_hoy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MP Liquidado Hoy</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? 0 : parseFloat(value))
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Lo que se liberó hoy (va de "A Liquidar" a "Disponible")
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">MP Total:</span>
                  <Badge variant="outline" className="text-blue-600">
                    {formatCurrency(mpTotal)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Columna 2: Tienda Nube */}
          <Card>
            <CardHeader>
              <CardTitle className="text-purple-600">🛒 Tienda Nube</CardTitle>
              <CardDescription>
                Gestión de fondos en Tienda Nube
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="tn_a_liquidar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TN A Liquidar {mode === 'edit' && <Badge variant="secondary" className="ml-2">Auto-calculado</Badge>}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value || ''}
                        onChange={(e) => {
                          const value = e.target.value
                          field.onChange(value === '' ? 0 : parseFloat(value))
                        }}
                        readOnly={mode === 'edit'}
                        disabled={mode === 'edit'}
                        className={mode === 'edit' ? 'bg-muted' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      {mode === 'edit' 
                        ? 'Se recalcula automáticamente basado en el día anterior - liquidado hoy'
                        : 'Dinero pendiente en Tienda Nube'
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {mode === 'edit' && (
                <FormField
                  control={form.control}
                  name="tn_liquidado_hoy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TN Liquidado Hoy</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? 0 : parseFloat(value))
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Lo que TN liquidó hoy (va automáticamente a MP)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {mode === 'edit' && (
                <FormField
                  control={form.control}
                  name="tn_iibb_descuento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descuento IIBB</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? 0 : parseFloat(value))
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        IIBB descontado en la transferencia TN→MP
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Columna 3: Resumen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Resumen Automático
              </CardTitle>
              <CardDescription>
                Cálculos en tiempo real
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm font-medium">MP Total:</span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(mpTotal)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm font-medium">Total Disponible:</span>
                  <span className="font-bold text-lg text-green-600">
                    {formatCurrency(totalDisponible)}
                  </span>
                </div>

                <Separator />

                {mode === 'edit' && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Movimiento del Día:</div>
                    <div className={`p-2 rounded ${
                      movimientoNetoDia > 0 
                        ? 'bg-green-50 text-green-600' 
                        : movimientoNetoDia < 0 
                          ? 'bg-red-50 text-red-600' 
                          : 'bg-gray-50 text-gray-600'
                    }`}>
                      <div className="text-xs opacity-80 mb-1">
                        MP: {formatCurrency(watchedValues.mp_liquidado_hoy)}
                      </div>
                      <div className="text-xs opacity-80 mb-1">
                        TN: {formatCurrency(watchedValues.tn_liquidado_hoy)}
                      </div>
                      {watchedValues.tn_iibb_descuento > 0 && (
                        <div className="text-xs opacity-80 mb-1">
                          IIBB: -{formatCurrency(watchedValues.tn_iibb_descuento)}
                        </div>
                      )}
                      <div className="border-t border-current/20 pt-1 font-semibold">
                        Neto: {formatCurrency(movimientoNetoDia)}
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• MP Total = Disponible + A Liquidar</div>
                  <div>• Total = MP Total + TN A Liquidar</div>
                  <div>• Movimiento = MP Liq. + TN Liq. - IIBB</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? "Guardando..." : defaultValues ? "Actualizar" : "Crear"} Liquidación
          </Button>
        </div>
      </form>
    </Form>
  )
}
