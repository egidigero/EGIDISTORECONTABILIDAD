"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Download } from "lucide-react"

const importOrdersSchema = z.object({
  source: z.enum(["TN", "ML"], { required_error: "Selecciona una plataforma" }),
  from: z.string().optional(),
  to: z.string().optional(),
})

type ImportOrdersFormData = z.infer<typeof importOrdersSchema>

export function ImportOrdersForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [lastResult, setLastResult] = useState<any>(null)

  const form = useForm<ImportOrdersFormData>({
    resolver: zodResolver(importOrdersSchema),
    defaultValues: {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 7 días atrás
      to: new Date().toISOString().split("T")[0], // hoy
    },
  })

  async function onSubmit(data: ImportOrdersFormData) {
    setIsLoading(true)
    try {
      const response = await fetch("/api/import/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Error al importar órdenes")
      }

      setLastResult(result.result)
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al importar órdenes")
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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Desde</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hasta</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Download className="mr-2 h-4 w-4" />
            Importar Órdenes
          </Button>
        </form>
      </Form>

      {lastResult && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Resultado de la importación:</h4>
          <div className="text-sm space-y-1">
            <div className="text-green-600">✓ {lastResult.success} órdenes procesadas</div>
            {lastResult.errors.length > 0 && <div className="text-red-600">✗ {lastResult.errors.length} errores</div>}
            {lastResult.warnings.length > 0 && (
              <div className="text-yellow-600">⚠ {lastResult.warnings.length} advertencias</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
