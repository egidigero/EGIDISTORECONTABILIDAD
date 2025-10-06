"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, SubmitHandler, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { createGastoIngreso, updateGastoIngreso } from "@/lib/actions/gastos-ingresos"
import { gastoIngresoSchema, type GastoIngresoFormData } from "@/lib/validations"

const canalOptions = [
  { value: "General", label: "General" },
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
]

const tipoOptions = [
  { value: "Gasto", label: "Gasto" },
  { value: "Ingreso", label: "Ingreso" },
]

interface GastoIngresoFormProps {
  gastoIngreso?: {
    id: string
    fecha: Date
    canal?: string | null
    tipo: string
    categoria: string
    descripcion: string
    montoARS: number
  }
  onSuccess?: () => void
  onCancel?: () => void
  isModal?: boolean
}

export function GastoIngresoForm({ gastoIngreso, onSuccess, onCancel, isModal }: GastoIngresoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const isEditing = !!gastoIngreso

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<GastoIngresoFormData>({
    resolver: zodResolver(gastoIngresoSchema),
    defaultValues: gastoIngreso
      ? {
          fecha: new Date(gastoIngreso.fecha),
          canal: gastoIngreso.canal as any,
          tipo: gastoIngreso.tipo as any,
          categoria: gastoIngreso.categoria,
          descripcion: gastoIngreso.descripcion,
          montoARS: Number(gastoIngreso.montoARS),
        }
      : {
          fecha: new Date(),
          tipo: "Gasto",
          canal: "General",
        },
  })

  // Registrar manualmente el campo fecha
  const fechaField = register("fecha", { required: true })

  // Observar campos
  const watchTipo = watch("tipo")
  const watchCategoria = watch("categoria")
  const watchCanal = watch("canal")
  const watchFecha = watch("fecha")

  useEffect(() => {
    // Registrar el campo fecha y asegurar que tenga un valor inicial
    if (!gastoIngreso) {
      setValue("fecha", new Date())
    }
  }, [])

  const onSubmit: SubmitHandler<GastoIngresoFormData> = async (data) => {
    setIsSubmitting(true)
    try {
      const result = isEditing
        ? await updateGastoIngreso(gastoIngreso.id, data)
        : await createGastoIngreso(data)

      if (result.success) {
        toast({
          title: "Éxito",
          description: isEditing
            ? "Movimiento actualizado correctamente"
            : "Movimiento creado correctamente",
        })
        
        if (onSuccess) {
          onSuccess()
        } else {
          router.push("/gastos")
        }
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

  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !watch("fecha") && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {watch("fecha") ? (
                  format(watch("fecha"), "PPP", { locale: es })
                ) : (
                  <span>Selecciona una fecha</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={watch("fecha")}
                onSelect={(date) => setValue("fecha", date || new Date())}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>
          {errors.fecha && <p className="text-sm text-destructive">{errors.fecha.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={watch("tipo")} onValueChange={(value) => setValue("tipo", value as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un tipo" />
            </SelectTrigger>
            <SelectContent>
              {tipoOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.tipo && <p className="text-sm text-destructive">{errors.tipo.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Canal</Label>
          <Select value={watch("canal") || "General"} onValueChange={(value) => setValue("canal", value as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un canal" />
            </SelectTrigger>
            <SelectContent>
              {canalOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoria">Categoría</Label>
          <Controller
            name="categoria"
            control={control}
            rules={{ required: "La categoría es requerida" }}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Gastos del Negocio</SelectLabel>
                    <SelectItem value="Gastos del negocio - ADS">Gastos del negocio - ADS</SelectItem>
                    <SelectItem value="Gastos del negocio - Envios">Gastos del negocio - Envios</SelectItem>
                    <SelectItem value="Gastos del negocio - Envios devoluciones">Gastos del negocio - Envios devoluciones</SelectItem>
                    <SelectItem value="Otros gastos del negocio">Otros gastos del negocio</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Ingresos del Negocio</SelectLabel>
                    <SelectItem value="Ingresos por intereses de MP">Ingresos por intereses de MP</SelectItem>
                    <SelectItem value="Otros Ingresos">Otros Ingresos</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Gastos Personales</SelectLabel>
                    <SelectItem value="Gastos de Casa">Gastos de Casa</SelectItem>
                    <SelectItem value="Gastos de Geronimo">Gastos de Geronimo</SelectItem>
                    <SelectItem value="Gastos de Sergio">Gastos de Sergio</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          {errors.categoria && <p className="text-sm text-destructive">{errors.categoria.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          {...register("descripcion")}
          placeholder="Describe el gasto o ingreso..."
          rows={3}
        />
        {errors.descripcion && <p className="text-sm text-destructive">{errors.descripcion.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="montoARS">Monto (ARS)</Label>
        <Input
          id="montoARS"
          type="number"
          step="0.01"
          {...register("montoARS", { valueAsNumber: true })}
          placeholder="1500.00"
        />
        {errors.montoARS && <p className="text-sm text-destructive">{errors.montoARS.message}</p>}
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEditing
              ? "Actualizando..."
              : "Creando..."
            : isEditing
              ? "Actualizar Movimiento"
              : "Crear Movimiento"}
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            if (onCancel) {
              onCancel()
            } else {
              router.push("/gastos")
            }
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )

  return (
    <>
      {!isModal ? (
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? "Editar Movimiento" : "Nuevo Movimiento"}</CardTitle>
            <CardDescription>
              {isEditing ? "Modifica los datos del movimiento" : "Registra un nuevo gasto o ingreso"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {formContent}
          </CardContent>
        </Card>
      ) : (
        formContent
      )}
    </>
  )
}
