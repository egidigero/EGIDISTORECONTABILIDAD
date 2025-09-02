"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { createGastoIngreso, updateGastoIngreso, getCategorias } from "@/lib/actions/gastos-ingresos"
import { gastoIngresoSchema, type GastoIngresoFormData } from "@/lib/validations"

const canalOptions = [
  { value: "", label: "General" },
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
]

const tipoOptions = [
  { value: "Gasto", label: "Gasto" },
  { value: "OtroIngreso", label: "Otro Ingreso" },
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
}

export function GastoIngresoForm({ gastoIngreso }: GastoIngresoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categoriasSugeridas, setCategoriasSugeridas] = useState<string[]>([])
  const router = useRouter()
  const isEditing = !!gastoIngreso

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
        },
  })

  // Cargar categorías sugeridas
  useEffect(() => {
    const loadCategorias = async () => {
      try {
        const categorias = await getCategorias()
        setCategoriasSugeridas(categorias)
      } catch (error) {
        console.error("Error al cargar categorías:", error)
      }
    }
    loadCategorias()
  }, [])

  const onSubmit = async (data: GastoIngresoFormData) => {
    setIsSubmitting(true)
    try {
      const result = isEditing ? await updateGastoIngreso(gastoIngreso.id, data) : await createGastoIngreso(data)

      if (result.success) {
        toast({
          title: isEditing ? "Movimiento actualizado" : "Movimiento creado",
          description: `El ${data.tipo.toLowerCase()} ha sido ${isEditing ? "actualizado" : "creado"} correctamente.`,
        })
        router.push("/gastos")
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
        <CardTitle>{isEditing ? "Editar Movimiento" : "Nuevo Movimiento"}</CardTitle>
        <CardDescription>
          {isEditing ? "Modifica los datos del movimiento" : "Registra un nuevo gasto o ingreso"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" type="date" {...register("fecha", { valueAsDate: true })} />
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
              <Select value={watch("canal") || ""} onValueChange={(value) => setValue("canal", value as any)}>
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
              <Input
                id="categoria"
                {...register("categoria")}
                placeholder="Marketing, Envíos, Comisiones..."
                list="categorias-sugeridas"
              />
              <datalist id="categorias-sugeridas">
                {categoriasSugeridas.map((categoria) => (
                  <option key={categoria} value={categoria} />
                ))}
              </datalist>
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
            <Button type="button" variant="outline" onClick={() => router.push("/gastos")}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
