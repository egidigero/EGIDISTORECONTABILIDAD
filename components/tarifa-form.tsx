"use client"

import React, { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { createTarifa, updateTarifa } from "@/lib/actions/tarifas"
import { tarifaSchema, type TarifaFormData } from "@/lib/validations"
import * as z from "zod"

// Schema específico para el formulario sin defaults problemáticos
const tarifaFormSchema = z.object({
  id: z.string().optional(), // ID opcional para formulario
  plataforma: z.enum(["TN", "ML", "Directo"], {
    required_error: "Selecciona una plataforma",
  }),
  metodoPago: z.enum(["PagoNube", "MercadoPago", "Transferencia", "Efectivo"], {
    required_error: "Selecciona un método de pago",
  }),
  condicion: z.enum(["Transferencia", "Cuotas sin interés", "Normal"], {
    required_error: "Selecciona una condición de pago",
  }),
  comisionPct: z.number().min(0).max(100, "La comisión debe estar entre 0 y 100%"),
  comisionExtraPct: z.number().min(0).max(100, "La comisión extra debe estar entre 0 y 100%").optional(),
  iibbPct: z.number().min(0).max(100, "El IIBB debe estar entre 0 y 100%"),
  fijoPorOperacion: z.number().min(0, "El monto fijo debe ser mayor o igual a 0"),
  descuentoPct: z.number().min(0).max(100, "El descuento debe estar entre 0 y 100%").default(0),
})

type TarifaFormInputs = z.infer<typeof tarifaFormSchema>

interface TarifaFormProps {
  tarifa?: TarifaFormInputs & { id?: string }
  onSuccess?: () => void
}

const plataformaOptions = [
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
]

const metodoPagoOptionsTN = [
  { value: "PagoNube", label: "Pago Nube" },
  { value: "MercadoPago", label: "Mercado Pago" },
]
const metodoPagoOptionsML = [{ value: "MercadoPago", label: "Mercado Pago" }]
const metodoPagoOptionsDirecto = [
  { value: "Transferencia", label: "Transferencia" },
  { value: "Efectivo", label: "Efectivo" },
]

export function TarifaForm({ tarifa, onSuccess }: TarifaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const isEditing = !!tarifa

  const form = useForm<TarifaFormInputs>({
    resolver: zodResolver(tarifaFormSchema) as any,
    defaultValues: {
      id: tarifa?.id, // Solo incluir ID si estamos editando
      plataforma: tarifa?.plataforma ?? "TN",
      metodoPago: tarifa?.metodoPago ?? (tarifa?.plataforma === "ML" ? "MercadoPago" : "PagoNube"),
      condicion: tarifa?.condicion ?? "Transferencia",
      // Los valores ya vienen como porcentajes desde getTarifas()
      comisionPct: tarifa?.comisionPct ?? 0,
      comisionExtraPct: tarifa?.comisionExtraPct ?? 0,
      iibbPct: tarifa?.iibbPct ?? 0,
      fijoPorOperacion: tarifa?.fijoPorOperacion ?? 0,
      descuentoPct: tarifa?.descuentoPct ?? 0,
    },
  })

  const { register, handleSubmit, formState: { errors }, watch, setValue } = form
  const plataforma = watch("plataforma")
  const metodoPago = watch("metodoPago")

  const metodoPagoOptions = useMemo(() => {
    if (plataforma === "TN") return metodoPagoOptionsTN
    if (plataforma === "ML") return metodoPagoOptionsML
    return metodoPagoOptionsDirecto
  }, [plataforma])

  const onSubmit: SubmitHandler<TarifaFormInputs> = async (data) => {
    setIsSubmitting(true)
    try {
      let result
      if (isEditing) {
        // Para edición, necesitamos el TarifaFormData completo con id
        // Convertir porcentajes a decimales (dividir entre 100)
        const tarifaData: TarifaFormData = {
          id: tarifa!.id!,
          plataforma: data.plataforma,
          metodoPago: data.metodoPago,
          condicion: data.condicion ?? "Transferencia",
          comisionPct: data.comisionPct / 100, // Convertir % a decimal
          comisionExtraPct: (data.comisionExtraPct ?? 0) / 100, // Convertir % a decimal
          iibbPct: data.iibbPct / 100, // Convertir % a decimal
          fijoPorOperacion: data.fijoPorOperacion,
          descuentoPct: (data.descuentoPct ?? 0) / 100, // Convertir % a decimal
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        result = await updateTarifa(tarifa!.id!, tarifaData)
      } else {
        console.log("🆕 Modo creación")
        // Para creación, omitimos el id ya que se genera automáticamente
        const tarifaDataForCreate = {
          plataforma: data.plataforma,
          metodoPago: data.metodoPago,
          condicion: data.condicion ?? "Transferencia",
          comisionPct: data.comisionPct / 100, // Convertir porcentaje a decimal
          comisionExtraPct: (data.comisionExtraPct ?? 0) / 100, // Convertir porcentaje a decimal
          iibbPct: data.iibbPct / 100, // Convertir porcentaje a decimal
          fijoPorOperacion: data.fijoPorOperacion,
          descuentoPct: (data.descuentoPct ?? 0) / 100, // Convertir % a decimal
        }
        console.log("📤 Enviando datos para crear:", tarifaDataForCreate)
        result = await createTarifa(tarifaDataForCreate)
      }

      console.log("📥 Resultado recibido:", result)

      if (result.success) {
        toast({
          title: isEditing ? "Tarifa actualizada" : "Tarifa creada",
          description: `La tarifa ${data.plataforma} - ${data.metodoPago} fue ${isEditing ? "actualizada" : "creada"} correctamente.`,
        })
        if (onSuccess) onSuccess()
        else router.push("/tarifas")
      } else {
        console.error("❌ Error en el resultado:", result.error)
        toast({
          title: "Error",
          description: result.error || "No se pudo guardar la tarifa.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("❌ Error en onSubmit:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Tarifa" : "Nueva Tarifa"}</CardTitle>
        <CardDescription>
          {isEditing ? "Modifica los datos de la tarifa" : "Configura una nueva combinación de plataforma y método de pago"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="condicion">Condición</Label>
              <Select value={watch("condicion")} onValueChange={(value) => setValue("condicion", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una condición" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Cuotas sin interés">Cuotas sin interés</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                </SelectContent>
              </Select>
              {errors.condicion && <p className="text-sm text-destructive">{errors.condicion.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plataforma">Plataforma</Label>
              <Select value={plataforma} onValueChange={(value) => setValue("plataforma", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {plataformaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.plataforma && <p className="text-sm text-destructive">{errors.plataforma.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de Pago</Label>
              <Select value={metodoPago} onValueChange={(value) => setValue("metodoPago", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un método de pago" />
                </SelectTrigger>
                <SelectContent>
                  {metodoPagoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.metodoPago && <p className="text-sm text-destructive">{errors.metodoPago.message}</p>}
            </div>
          </div>

          {/* Segunda fila: Comisiones y Descuento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comisionPct">Comisión (%)</Label>
              <Input id="comisionPct" type="number" step="0.01" {...register("comisionPct", { valueAsNumber: true })} placeholder="3.50" />
              {errors.comisionPct && <p className="text-sm text-destructive">{errors.comisionPct.message}</p>}
              {plataforma === "TN" && metodoPago === "MercadoPago" && (
                <p className="text-xs text-muted-foreground mt-1">
                  ⚡ <strong>% Base:</strong> Configurable (ej: 3.99%). Al crear una venta, el recargo por cuotas se suma al monto:
                  <br />• Sin cuotas (1): +0% | 2 cuotas: +5.20% | 3 cuotas: +7.60% | 6 cuotas: +13.50%
                  <br />• Ejemplo con 3.99% base y 6 cuotas: 3.99% + 13.50% = <strong>17.49% total</strong>
                </p>
              )}
              {plataforma === "TN" && metodoPago !== "MercadoPago" && (
                <p className="text-xs text-muted-foreground mt-1">IVA 21% e IIBB 0,3%.</p>
              )}
              {plataforma === "ML" && (
                <p className="text-xs text-muted-foreground mt-1">IVA incluido.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="comisionExtraPct">Comisión Extra (%)</Label>
              <Input id="comisionExtraPct" type="number" step="0.01" {...register("comisionExtraPct", { valueAsNumber: true })} placeholder="0.00" />
              {errors.comisionExtraPct && <p className="text-sm text-destructive">{errors.comisionExtraPct.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="descuentoPct">Descuento Pre-Comisión (%)</Label>
              <Input id="descuentoPct" type="number" step="0.01" {...register("descuentoPct", { valueAsNumber: true })} placeholder="15.00" />
              <p className="text-xs text-muted-foreground">Descuento aplicado ANTES de calcular comisiones (ej: 15% para TN + Transferencia)</p>
              {errors.descuentoPct && <p className="text-sm text-destructive">{errors.descuentoPct.message}</p>}
            </div>
          </div>

          {/* Tercera fila: IIBB y Fijo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="iibbPct">IIBB (%)</Label>
              <Input id="iibbPct" type="number" step="0.01" {...register("iibbPct", { valueAsNumber: true })} placeholder="2.10" />
              {errors.iibbPct && <p className="text-sm text-destructive">{errors.iibbPct.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fijoPorOperacion">Fijo por Operación (ARS)</Label>
              <Input id="fijoPorOperacion" type="number" step="0.01" {...register("fijoPorOperacion", { valueAsNumber: true })} placeholder="50.00" />
              {errors.fijoPorOperacion && <p className="text-sm text-destructive">{errors.fijoPorOperacion.message}</p>}
            </div>
          </div>

          <div className="flex gap-4">
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isEditing ? "Guardar cambios" : "Crear tarifa"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

