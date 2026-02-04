"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface PatrimonioData {
  fecha: string
  patrimonio_stock: number
  patrimonio_total: number
  total_liquidaciones: number
  variacion_dia: number | null
  variacion_porcentaje: number | null
}

export function PatrimonioEvolucion() {
  const [datos, setDatos] = useState<PatrimonioData[]>([])
  const [loading, setLoading] = useState(true)
  const [rango, setRango] = useState<'7d' | '30d' | '90d' | 'todo'>('30d')

  const cargarDatos = async () => {
    try {
      setLoading(true)
      
      // Calcular fecha de inicio según rango
      const hoy = new Date()
      let fechaInicio: Date | null = null
      
      if (rango === '7d') {
        fechaInicio = new Date(hoy)
        fechaInicio.setDate(hoy.getDate() - 7)
      } else if (rango === '30d') {
        fechaInicio = new Date(hoy)
        fechaInicio.setDate(hoy.getDate() - 30)
      } else if (rango === '90d') {
        fechaInicio = new Date(hoy)
        fechaInicio.setDate(hoy.getDate() - 90)
      }

      let query = supabase
        .from('patrimonio_evolucion')
        .select('*')
        .order('fecha', { ascending: true })

      if (fechaInicio) {
        query = query.gte('fecha', fechaInicio.toISOString().split('T')[0])
      }

      const { data, error } = await query

      if (error) throw error
      
      // Formatear datos para el gráfico
      const formateados = (data || []).map(d => ({
        ...d,
        patrimonio_stock: Number(d.patrimonio_stock),
        patrimonio_total: Number(d.patrimonio_total),
        total_liquidaciones: Number(d.total_liquidaciones),
        variacion_dia: d.variacion_dia ? Number(d.variacion_dia) : null,
        variacion_porcentaje: d.variacion_porcentaje ? Number(d.variacion_porcentaje) : null,
      }))

      setDatos(formateados)
    } catch (error) {
      console.error("Error al cargar evolución de patrimonio:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [rango])

  if (loading) {
    return <div className="p-4">Cargando evolución del patrimonio...</div>
  }

  const ultimoDato = datos.length > 0 ? datos[datos.length - 1] : null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>📊 Evolución del Patrimonio</CardTitle>
              <CardDescription>
                Seguimiento histórico del patrimonio total del negocio
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 rounded text-sm ${rango === '7d' ? 'bg-primary text-white' : 'bg-gray-100'}`}
                onClick={() => setRango('7d')}
              >
                7 días
              </button>
              <button
                className={`px-3 py-1 rounded text-sm ${rango === '30d' ? 'bg-primary text-white' : 'bg-gray-100'}`}
                onClick={() => setRango('30d')}
              >
                30 días
              </button>
              <button
                className={`px-3 py-1 rounded text-sm ${rango === '90d' ? 'bg-primary text-white' : 'bg-gray-100'}`}
                onClick={() => setRango('90d')}
              >
                90 días
              </button>
              <button
                className={`px-3 py-1 rounded text-sm ${rango === 'todo' ? 'bg-primary text-white' : 'bg-gray-100'}`}
                onClick={() => setRango('todo')}
              >
                Todo
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ultimoDato && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Patrimonio Total</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${ultimoDato.patrimonio_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                {ultimoDato.variacion_dia !== null && (
                  <p className={`text-sm ${ultimoDato.variacion_dia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {ultimoDato.variacion_dia >= 0 ? '+' : ''}
                    ${ultimoDato.variacion_dia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    {ultimoDato.variacion_porcentaje !== null && 
                      ` (${ultimoDato.variacion_porcentaje >= 0 ? '+' : ''}${ultimoDato.variacion_porcentaje.toFixed(2)}%)`
                    }
                  </p>
                )}
              </div>
              
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-muted-foreground">En Stock</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${ultimoDato.patrimonio_stock.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {((ultimoDato.patrimonio_stock / ultimoDato.patrimonio_total) * 100).toFixed(1)}% del total
                </p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground">En Liquidaciones</p>
                <p className="text-2xl font-bold text-green-600">
                  ${ultimoDato.total_liquidaciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {((ultimoDato.total_liquidaciones / ultimoDato.patrimonio_total) * 100).toFixed(1)}% del total
                </p>
              </div>
            </div>
          )}

          {datos.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={datos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fecha" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: any) => `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('es-AR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="patrimonio_total" 
                  stackId="1"
                  stroke="#3b82f6" 
                  fill="#93c5fd" 
                  name="Patrimonio Total"
                />
                <Area 
                  type="monotone" 
                  dataKey="patrimonio_stock" 
                  stackId="2"
                  stroke="#a855f7" 
                  fill="#d8b4fe" 
                  name="Stock"
                />
                <Area 
                  type="monotone" 
                  dataKey="total_liquidaciones" 
                  stackId="3"
                  stroke="#22c55e" 
                  fill="#86efac" 
                  name="Liquidaciones"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No hay datos de patrimonio registrados
            </p>
          )}
        </CardContent>
      </Card>

      {datos.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>📈 Variaciones Diarias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={datos.filter(d => d.variacion_dia !== null)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fecha" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
                />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: any) => `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('es-AR')}
                />
                <Line 
                  type="monotone" 
                  dataKey="variacion_dia" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="Variación Diaria"
                  dot={{ fill: '#f59e0b' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
