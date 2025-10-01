"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { TarifaActions } from "@/components/tarifa-actions"
import { Badge } from "@/components/ui/badge"

const plataformaLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  Directo: "Venta Directa",
}

const metodoPagoLabels = {
  PagoNube: "Pago Nube",
  MercadoPago: "Mercado Pago",
  Transferencia: "Transferencia",
  Efectivo: "Efectivo",
}

const condicionLabels = {
  "Transferencia": "Transferencia",
  "Cuotas sin interés": "Cuotas sin interés",
  "Normal": "Normal",
}

interface TarifasTableClientProps {
  tarifas: any[]
  onTarifaUpdated?: () => void
}

export function TarifasTableClient({ tarifas, onTarifaUpdated }: TarifasTableClientProps) {
  const IVA_PCT = 21;
  const columns = [
    {
      key: "plataforma",
      header: "Plataforma",
      render: (tarifa: any) => (
        <Badge variant="outline">{plataformaLabels[tarifa.plataforma as keyof typeof plataformaLabels]}</Badge>
      ),
    },
    {
      key: "metodoPago",
      header: "Método de Pago",
      render: (tarifa: any) => (
        <Badge variant="secondary">{metodoPagoLabels[tarifa.metodoPago as keyof typeof metodoPagoLabels]}</Badge>
      ),
    },
    {
      key: "condicion",
      header: "Condición",
      render: (tarifa: any) => (
        <Badge variant="default">{condicionLabels[tarifa.condicion as keyof typeof condicionLabels]}</Badge>
      ),
    },
    {
      key: "comisionPct",
      header: "Comisión %",
      render: (tarifa: any) => `${Number(tarifa.comisionPct).toFixed(2).replace(/\.?0+$/, '')}%`,
    },
    {
      key: "comisionExtraPct",
      header: "Comisión Extra %",
      render: (tarifa: any) => `${Number(tarifa.comisionExtraPct || 0).toFixed(2).replace(/\.?0+$/, '')}%`,
    },
    {
      key: "descuentoPct",
      header: "Descuento %",
      render: (tarifa: any) => {
        const descuento = Number(tarifa.descuentoPct || 0);
        return descuento > 0 ? `${descuento.toFixed(2).replace(/\.?0+$/, '')}%` : '-';
      },
    },
    {
      key: "iibbPct",
      header: "IIBB %",
      render: (tarifa: any) => `${Number(tarifa.iibbPct).toFixed(2).replace(/\.?0+$/, '')}%`,
    },
    {
      key: "fijoPorOperacion",
      header: "Fijo por Operación",
      render: (tarifa: any) => `$${Number(tarifa.fijoPorOperacion).toLocaleString()}`,
    },
  ]

  return (
    <DataTable
      data={tarifas}
      columns={columns}
      searchable
      searchPlaceholder="Buscar tarifas..."
      actions={(tarifa) => (
        <TarifaActions 
          tarifa={{
            id: tarifa.id,
            plataforma: tarifa.plataforma,
            metodoPago: tarifa.metodoPago,
            condicion: tarifa.condicion,
            comisionPct: tarifa.comisionPct,
            comisionExtraPct: tarifa.comisionExtraPct,
            iibbPct: tarifa.iibbPct,
            fijoPorOperacion: tarifa.fijoPorOperacion,
            descuentoPct: tarifa.descuentoPct,
          }}
          onUpdated={onTarifaUpdated}
        />
      )}
    />
  )
}
