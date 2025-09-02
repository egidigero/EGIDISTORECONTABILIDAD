"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, Banknote } from "lucide-react"
import { liquidacionSchema, type LiquidacionFormData } from "@/lib/validations"
import { crearLiquidacion, actualizarLiquidacion } from "@/lib/actions/liquidaciones"
import type { Liquidacion } from "@prisma/client"

interface LiquidacionFormProps {
  liquidacion?: Liquidacion
}

export function LiquidacionForm({ liquidacion }: LiquidacionFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const form = useForm<LiquidacionFormData>({
    resolver: zodResolver(liquidacionSchema),
    defaultValues: {
      fecha: liquidacion?.fecha
        ? new Date(liquidacion.fecha).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      dineroFP: liquidacion?.dineroFP?.toString() || "",
      disponibleMP_MELI: liquidacion?.disponibleMP_MELI?.toString() || "",
      aLiquidarMP: liquidacion?.aLiquidarMP?.toString() || "",
      liquidadoMP: liquidacion?.liquidadoMP?.toString() || "",
      aLiquidarTN: liquidacion?.aLiquidarTN?.toString() || "",
      observaciones: liquidacion?.observaciones || "",
    },
  })

  async function onSubmit(data: LiquidacionFormData) {
    setIsLoading(true)
    try {
      if (liquidacion) {
        await actualizarLiquidacion(liquidacion.id, data)
        toast.success("Liquidación actualizada correctamente")
      } else {
        await crearLiquidacion(data)
        toast.success("Liquidación creada correctamente")
      }
      router.push("/liquidaciones")
      router.refresh()
    } catch (error) {
      toast.error("Error al guardar la liquidación")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          {liquidacion ? "Editar Liquidación" : "Nueva Liquidación"}
        </CardTitle>
        <CardDescription>Registra el control diario de fondos por plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dineroFP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dinero FP</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="disponibleMP_MELI"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Disponible MP/MELI</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aLiquidarMP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A Liquidar MP</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="liquidadoMP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Liquidado MP</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aLiquidarTN"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A Liquidar TN</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observaciones adicionales..." className="min-h-[100px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {liquidacion ? "Actualizar" : "Crear"} Liquidación
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
