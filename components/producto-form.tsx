
"use client"
import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  // Estados para stock inicial solo en modo creación
  const [cantidadInicial, setCantidadInicial] = useState(0)
  const [observacionesInicial, setObservacionesInicial] = useState('')
  const [depositoInicial, setDepositoInicial] = useState('PROPIO')
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
      // Convertir a ProductoFormData - el stock siempre empieza en 0, se maneja por movimientos
      const productData: ProductoFormData = {
        modelo: data.modelo,
        sku: data.sku,
        costoUnitarioARS: data.costoUnitarioARS,
        precio_venta: data.precio_venta ?? 0,
        stockPropio: 0, // Siempre 0, el stock real se calcula desde movimientos
        stockFull: 0,   // Siempre 0, el stock real se calcula desde movimientos
        activo: data.activo ?? true,
      }
      
      const result = isEditing ? await updateProducto(producto.id, productData) : await createProducto(productData)
      
      if (result.success) {
        // Si es una creación y hay stock inicial, crear movimiento inicial
        if (!isEditing && cantidadInicial > 0 && result.data?.id) {
          const { createClient } = await import("@/lib/supabase/client")
          const supabase = createClient()
          
          await supabase.from('movimientos_stock').insert({
            producto_id: result.data.id,
            tipo: 'entrada',
            cantidad: cantidadInicial,
            deposito_origen: depositoInicial,
            fecha: new Date().toISOString(),
            observaciones: observacionesInicial || 'Inventario inicial - Stock de apertura',
            origen_tipo: 'ingreso_manual',
          })
        }
        
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
                productoId={producto?.id}
                productoSku={watch("sku") || producto?.sku}
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

          {/* Stock: Solo mostrar en modo creación */}
          {!isEditing && (
            <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
              <div className="text-sm font-medium text-gray-700">Stock Inicial (opcional)</div>
              <p className="text-xs text-gray-600">Si el producto tiene stock inicial, se registrará un movimiento de entrada automáticamente.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cantidadInicial" className="text-xs">Cantidad inicial</Label>
                  <Input
                    id="cantidadInicial"
                    type="number"
                    min={0}
                    value={cantidadInicial}
                    onChange={(e) => setCantidadInicial(Number(e.target.value))}
                    placeholder="0"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="depositoInicial" className="text-xs">Depósito</Label>
                  <Select value={depositoInicial} onValueChange={setDepositoInicial}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROPIO">PROPIO</SelectItem>
                      <SelectItem value="FULL">FULL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacionesInicial" className="text-xs">Observaciones (opcional)</Label>
                <Input
                  id="observacionesInicial"
                  type="text"
                  value={observacionesInicial}
                  onChange={(e) => setObservacionesInicial(e.target.value)}
                  placeholder="Ej: Stock de apertura - Inventario inicial"
                  className="h-9"
                />
              </div>

              {cantidadInicial > 0 && (
                <div className="p-2 bg-green-50 rounded border border-green-200 mt-2">
                  <div className="text-xs text-green-900 font-medium">
                    ✓ Se registrará un movimiento de entrada por {cantidadInicial} unidades en {depositoInicial}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Campos hidden para mantener compatibilidad */}
          <Input
            id="stockPropio"
            type="number"
            {...register("stockPropio", { valueAsNumber: true })}
            value={0}
            className="hidden"
          />
          <Input
            id="stockFull"
            type="number"
            {...register("stockFull", { valueAsNumber: true })}
            value={0}
            className="hidden"
          />

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
