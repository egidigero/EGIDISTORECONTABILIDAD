"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function DiagnosticoLiquidacionesPage() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [diagnostico, setDiagnostico] = useState<any>(null)
  const [diagnosticoTN, setDiagnosticoTN] = useState<any>(null)

  const establecerSaldos = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/establecer-saldos-iniciales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'establecer' })
      })
      const data = await response.json()
      setResultado(data)
    } catch (error) {
      console.error('Error:', error)
      setResultado({ success: false, error: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  const diagnosticarHoy = async () => {
    setLoading(true)
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const response = await fetch('/api/establecer-saldos-iniciales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'diagnosticar', fecha: hoy })
      })
      const data = await response.json()
      setDiagnostico(data)
    } catch (error) {
      console.error('Error:', error)
      setDiagnostico({ success: false, error: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  const diagnosticarTNLiquidacion = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/establecer-saldos-iniciales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'diagnosticar-tn', fecha: '2025-09-01' })
      })
      const data = await response.json()
      setDiagnosticoTN(data)
    } catch (error) {
      console.error('Error:', error)
      setDiagnosticoTN({ success: false, error: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Diagnóstico de Liquidaciones</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>🔧 Establecer Saldos Iniciales</CardTitle>
            <CardDescription>
              Configura los saldos iniciales de septiembre 2025
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-1">
              <div>💰 Dinero disponible: $40.976.132,41</div>
              <div>🔵 MP a liquidar: $879.742,32</div>
              <div>🟢 TN a liquidar: $1.180.104,47</div>
            </div>
            <Button onClick={establecerSaldos} disabled={loading} className="w-full">
              {loading ? 'Procesando...' : 'Establecer Saldos Iniciales'}
            </Button>
            
            {resultado && (
              <div className={`p-3 rounded text-sm ${
                resultado.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                <div className="font-medium">
                  {resultado.success ? '✅ Éxito' : '❌ Error'}
                </div>
                <div>{resultado.message || resultado.error}</div>
                {resultado.saldosEstablecidos && (
                  <div className="mt-2 text-xs">
                    <div>MP Disponible: {formatCurrency(resultado.saldosEstablecidos.mp_disponible)}</div>
                    <div>MP a Liquidar: {formatCurrency(resultado.saldosEstablecidos.mp_a_liquidar)}</div>
                    <div>TN a Liquidar: {formatCurrency(resultado.saldosEstablecidos.tn_a_liquidar)}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔍 Diagnóstico TN Liquidación</CardTitle>
            <CardDescription>
              Analizar cálculos de ventas TN y liquidación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-1">
              <div>📊 Revisar cálculos del 01/09/2025</div>
              <div>🔢 Verificar suma de ventas TN</div>
              <div>💡 Detectar discrepancias</div>
            </div>
            <Button onClick={diagnosticarTNLiquidacion} disabled={loading} className="w-full">
              {loading ? 'Analizando...' : 'Diagnosticar TN Liquidación'}
            </Button>
            
            {diagnosticoTN && (
              <div className={`p-3 rounded text-sm ${
                diagnosticoTN.success !== false ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'
              }`}>
                <div className="font-medium">
                  🔍 Diagnóstico TN Liquidación
                </div>
                {diagnosticoTN.error ? (
                  <div>❌ {diagnosticoTN.error}</div>
                ) : (
                  <div className="mt-2 text-xs space-y-1">
                    <div><strong>Base anterior:</strong> {formatCurrency(diagnosticoTN.calculoEsperado?.base || 0)}</div>
                    <div><strong>Ventas del día:</strong> {formatCurrency(diagnosticoTN.calculoEsperado?.masVentasDelDia || 0)}</div>
                    <div><strong>Liquidado hoy:</strong> {formatCurrency(diagnosticoTN.calculoEsperado?.menosLiquidadoHoy || 0)}</div>
                    <div><strong>Esperado:</strong> {formatCurrency(diagnosticoTN.calculoEsperado?.resultadoEsperado || 0)}</div>
                    <div><strong>Actual:</strong> {formatCurrency(diagnosticoTN.calculoEsperado?.resultadoActual || 0)}</div>
                    <div className={`font-medium ${
                      Math.abs(diagnosticoTN.calculoEsperado?.diferencia || 0) < 0.01 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <strong>Diferencia:</strong> {formatCurrency(diagnosticoTN.calculoEsperado?.diferencia || 0)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔍 Diagnosticar Cálculo TN</CardTitle>
            <CardDescription>
              Analiza el cálculo de TN a liquidar para hoy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={diagnosticarHoy} disabled={loading} className="w-full">
              {loading ? 'Analizando...' : 'Diagnosticar Hoy'}
            </Button>
            
            {diagnostico && (
              <div className={`p-3 rounded text-sm space-y-2 ${
                diagnostico.success ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'
              }`}>
                {diagnostico.success ? (
                  <div className="space-y-2">
                    <div className="font-medium">📊 Diagnóstico Completo</div>
                    
                    {diagnostico.diagnostico?.liquidacionAnterior && (
                      <div>
                        <Badge variant="outline">Liquidación Anterior</Badge>
                        <div className="text-xs mt-1">
                          Fecha: {diagnostico.diagnostico.liquidacionAnterior.fecha}<br/>
                          TN a liquidar: {formatCurrency(diagnostico.diagnostico.liquidacionAnterior.tn_a_liquidar)}
                        </div>
                      </div>
                    )}
                    
                    {diagnostico.diagnostico?.ventasTN && (
                      <div>
                        <Badge variant="outline">Ventas TN del Día</Badge>
                        <div className="text-xs mt-1">
                          Cantidad: {diagnostico.diagnostico.ventasTN.length} ventas
                        </div>
                      </div>
                    )}
                    
                    {diagnostico.diagnostico?.calculoManual && (
                      <div>
                        <Badge variant={diagnostico.diagnostico.calculoManual.diferencia === 0 ? "default" : "destructive"}>
                          Cálculo Manual
                        </Badge>
                        <div className="text-xs mt-1">
                          TN Calculado: {formatCurrency(diagnostico.diagnostico.calculoManual.tnCalculado)}<br/>
                          Diferencia: {formatCurrency(diagnostico.diagnostico.calculoManual.diferencia)}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">❌ Error</div>
                    <div>{diagnostico.error}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
