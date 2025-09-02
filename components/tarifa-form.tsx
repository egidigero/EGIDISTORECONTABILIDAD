"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { createTarifa, updateTarifa } from "@/lib/actions/tarifas"
import { tarifaSchema, type TarifaFormData } from "@/lib/validations"

const plataformaOptions = [
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
]

const metodoPagoOptions = [
  { value: "PagoNube", label: "Pago Nube" },
  { value: "MercadoPago", label: "Mercado Pago" },
  { value: "Transferencia", label: "Transferencia" },
  { value: "Efectivo", label: "Efectivo" },
]

interface TarifaFormProps {
  tarifa?: {
    id: string
    plataforma: string
    metodoPago: string
    comisionPct: number
    iibbPct: number
    fijoPorOperacion: number
  }
}

export function TarifaForm({ tarifa }: TarifaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const isEditing = !!tarifa

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TarifaFormData>({
    resolver: zodResolver(tarifaSchema),
    defaultValues: tarifa
      ? {
          plataforma: tarifa.plataforma as any,
          metodoPago: tarifa.metodoPago as any,
          comisionPct: Number(tarifa.comisionPct),
          iibbPct: Number(tarifa.iibbPct),
          fijoPorOperacion: Number(tarifa.fijoPorOperacion),
        }
      : undefined,
  })

  const plataforma = watch("plataforma")
  const metodoPago = watch("metodoPago")

  const onSubmit = async (data: TarifaFormData) => {
    setIsSubmitting(true)
    try {
      const result = isEditing ? await updateTarifa(tarifa.id, data) : await createTarifa(data)

      if (result.success) {
        toast({
          title: isEditing ? "Tarifa actualizada" : "Tarifa creada",
          description: `La tarifa ${data.plataforma} - ${data.metodoPago} ha sido ${
            isEditing ? "actualizada" : "creada"
          } correctamente.`,
        })
        router.push("/tarifas")
      } else {
        toast({
          title: "Error",
          description: result.error || "Ocurrió un error inesperado.",
          variant: "destructive",
        })
      }
    } catch (error) {
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
          {isEditing
            ? "Modifica los datos de la tarifa"
            : "Configura una nueva combinación de plataforma y método de pago"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <SelectValue placeholder="Selecciona un método" />
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comisionPct">Comisión (%)</Label>
              <Input
                id="comisionPct"
                type="number"
                step="0.01"
                {...register("comisionPct", { valueAsNumber: true })}
                placeholder="3.50"
              />
              {errors.comisionPct && <p className="text-sm text-destructive">{errors.comisionPct.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="iibbPct">IIBB (%)</Label>
              <Input
                id="iibbPct"
                type="number"
                step="0.01"
                {...register("iibbPct", { valueAsNumber: true })}
                placeholder="2.10"
              />
              {errors.iibbPct && <p className="text-sm text-destructive">{errors.iibbPct.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fijoPorOperacion">Fijo por Operación (ARS)</Label>
              <Input
                id="fijoPorOperacion"
                type="number"
                step="0.01"
                {...register("fijoPorOperacion", { valueAsNumber: true })}
                placeholder="50.00"
              />
              {errors.fijoPorOperacion && <p className="text-sm text-destructive">{errors.fijoPorOperacion.message}</p>}
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Actualizando..."
                  : "Creando..."
                : isEditing
                  ? "Actualizar Tarifa"
                  : "Crear Tarifa"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/tarifas")}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
