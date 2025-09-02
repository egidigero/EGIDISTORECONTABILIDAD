"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, RefreshCw } from "lucide-react"

const updateTrackingSchema = z.object({
  source: z.enum(["TN", "ML"], { required_error: "Selecciona una plataforma" }),
  orderIds: z.string().optional(),
})

type UpdateTrackingFormData = z.infer<typeof updateTrackingSchema>

export function UpdateTrackingForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [lastResult, setLastResult] = useState<any>(null)

  const form = useForm<UpdateTrackingFormData>({
    resolver: zodResolver(updateTrackingSchema),
  })

  async function onSubmit(data: UpdateTrackingFormData) {
    setIsLoading(true)
    try {
      const orderIds = data.orderIds
        ? data.orderIds
            .split("\n")
            .map((id) => id.trim())
            .filter(Boolean)
        : undefined

      const response = await fetch("/api/import/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: data.source,
          orderIds,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Error al actualizar tracking")
      }

      setLastResult(result)
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar tracking")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plataforma</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona plataforma" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="TN">Tienda Nube</SelectItem>
                    <SelectItem value="ML">Mercado Libre</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IDs de Órdenes (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Deja vacío para actualizar todas las órdenes, o ingresa IDs separados por línea..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar Tracking
          </Button>
        </form>
      </Form>

      {lastResult && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Resultado de la actualización:</h4>
          <div className="text-sm space-y-1">
            <div className="text-green-600">✓ {lastResult.updated} ventas actualizadas</div>
            {lastResult.errors && lastResult.errors.length > 0 && (
              <div className="text-red-600">✗ {lastResult.errors.length} errores</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
