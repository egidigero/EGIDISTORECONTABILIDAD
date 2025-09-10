"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { createProducto, updateProducto } from "@/lib/actions/productos"
import { productoSchema, type ProductoFormData } from "@/lib/validations"
import { CalculadoraPrecios } from "@/components/calculadora-precios"

// Schema específico para el formulario sin defaults
const productoFormSchema = z.object({
  modelo: z.string().min(1, "El modelo es requerido"),
  sku: z.string().min(1, "El SKU es requerido"),
  costoUnitarioARS: z.number().min(0, "El costo debe ser mayor a 0"),
  precio_venta: z.number().min(0, "El precio de venta debe ser mayor o igual a 0"),
  stockPropio: z.number().min(0, "El stock propio debe ser mayor o igual a 0"),
  stockFull: z.number().min(0, "El stock full debe ser mayor o igual a 0"),
  activo: z.boolean(),
})

type ProductoFormInputs = z.infer<typeof productoFormSchema>

interface ProductoFormProps {
  producto?: ProductoFormInputs & { id: string }
  onSuccess?: () => void
}

export function ProductoForm({ producto, onSuccess }: ProductoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const isEditing = !!producto

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductoFormInputs>({
    resolver: zodResolver(productoFormSchema),
    defaultValues: producto
      ? {
          modelo: producto.modelo,
          sku: producto.sku,
          costoUnitarioARS: Number(producto.costoUnitarioARS),
          precio_venta: Number(producto.precio_venta || 0),
          stockPropio: producto.stockPropio,
          stockFull: producto.stockFull,
          activo: producto.activo,
        }
      : {
          activo: true,
          precio_venta: 0,
        },
  })

  const activo = watch("activo")

  const onSubmit: SubmitHandler<ProductoFormInputs> = async (data) => {
    setIsSubmitting(true)
    try {
      // Convertir a ProductoFormData con valores por defecto si es necesario
      const productData: ProductoFormData = {
        modelo: data.modelo,
        sku: data.sku,
        costoUnitarioARS: data.costoUnitarioARS,
        precio_venta: data.precio_venta ?? 0,
        stockPropio: data.stockPropio ?? 0,
        stockFull: data.stockFull ?? 0,
        activo: data.activo ?? true,
      }
      const result = isEditing ? await updateProducto(producto.id, productData) : await createProducto(productData)
      
      if (result.success) {
        toast({
          title: isEditing ? "Producto actualizado" : "Producto creado",
          description: `El producto ${productData.modelo} ha sido ${isEditing ? "actualizado" : "creado"} correctamente.`,
        })
        if (onSuccess) onSuccess();
        else router.push("/productos")
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
        <CardTitle>{isEditing ? "Editar Producto" : "Nuevo Producto"}</CardTitle>
        <CardDescription>
          {isEditing ? "Modifica los datos del producto" : "Completa los datos del nuevo producto"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input id="modelo" {...register("modelo")} placeholder="SW-ROSE-GOLD-42" />
              {errors.modelo && <p className="text-sm text-destructive">{errors.modelo.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...register("sku")} placeholder="SWRG42001" />
              {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costoUnitarioARS">Costo Unitario (ARS)</Label>
              <Input
                id="costoUnitarioARS"
                type="number"
                step="0.01"
                {...register("costoUnitarioARS", { valueAsNumber: true })}
                placeholder="15000.00"
              />
              {errors.costoUnitarioARS && <p className="text-sm text-destructive">{errors.costoUnitarioARS.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="precio_venta">Precio de Venta Final (ARS)</Label>
              <CalculadoraPrecios
                costoProducto={watch("costoUnitarioARS") || 0}
                precioVentaInicial={watch("precio_venta") || 0}
                onPrecioCalculado={(precio) => setValue("precio_venta", precio)}
                trigger={
                  <Button variant="outline" size="sm" type="button">
                    Calculadora
                  </Button>
                }
              />
            </div>
            <Input
              id="precio_venta"
              type="number"
              step="0.01"
              {...register("precio_venta", { valueAsNumber: true })}
              placeholder="40000.00"
            />
            {errors.precio_venta && <p className="text-sm text-destructive">{errors.precio_venta.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stockPropio">Stock propio</Label>
              {isEditing && producto?.stockPropio !== undefined ? (
                <div className="text-xs text-muted-foreground mb-1">Stock actual: <span className="font-bold">{producto.stockPropio}</span></div>
              ) : null}
              <Input
                id="stockPropio"
                  type="number"
                  min={0}
                  {...register("stockPropio", { valueAsNumber: true })}
                  defaultValue={isEditing && producto?.stockPropio !== undefined ? producto.stockPropio : undefined}
                  placeholder="0"
                />
                {errors.stockPropio && <p className="text-sm text-destructive">{errors.stockPropio.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stockFull">Stock full</Label>
                {isEditing && producto?.stockFull !== undefined ? (
                  <div className="text-xs text-muted-foreground mb-1">Stock actual: <span className="font-bold">{producto.stockFull}</span></div>
                ) : null}
                <Input
                  id="stockFull"
                  type="number"
                  min={0}
                  {...register("stockFull", { valueAsNumber: true })}
                  defaultValue={isEditing && producto?.stockFull !== undefined ? producto.stockFull : undefined}
                  placeholder="0"
                />
                {errors.stockFull && <p className="text-sm text-destructive">{errors.stockFull.message}</p>}
              </div>
            </div>

          <div className="flex items-center space-x-2">
            <Switch id="activo" checked={activo} onCheckedChange={(checked) => setValue("activo", checked)} />
            <Label htmlFor="activo">Producto activo</Label>
          </div>

          <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isEditing
                    ? "Actualizando..."
                    : "Creando..."
                  : isEditing
                    ? "Actualizar Producto"
                    : "Crear Producto"}
              </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
