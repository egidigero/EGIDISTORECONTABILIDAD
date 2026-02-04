"use client"

import { DataTable } from "./data-table"
import { ProductoActions } from "./producto-actions"
import type { Producto } from "@/lib/types"

interface ProductosTableClientProps {
  productos: Producto[]
  onUpdate?: () => void
  movimientosPorProducto?: any
  ventasPorProducto?: boolean
}

const columns = [
  {
    key: "modelo",
    header: "Modelo",
  },
  {
    key: "sku",
    header: "SKU",
  },
  {
    key: "costoUnitarioARS",
    header: "Costo Unitario",
    render: (producto: any) => `$${Number(producto.costoUnitarioARS || 0).toLocaleString()}`,
  },
  {
    key: "precio_venta",
    header: "Precio Venta",
    render: (producto: any) => `$${Number(producto.precio_venta || 0).toLocaleString()}`,
  },
  {
    key: "stockTotal",
    header: "Stock Total",
    render: (producto: any) => {
      const stockTotal = Number(producto.stockTotal || producto.stockPropio || 0) + Number(producto.stockFull || 0)
      return stockTotal.toLocaleString()
    },
  },
  {
    key: "patrimonioProducto",
    header: "Patrimonio",
    render: (producto: any) => {
      const stockTotal = Number(producto.stockTotal || producto.stockPropio || 0) + Number(producto.stockFull || 0)
      const patrimonio = Number(producto.costoUnitarioARS || 0) * stockTotal
      return `$${patrimonio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
  },
  {
    key: "activo",
    header: "Estado",
    render: (producto: any) => (
      <span className={producto.activo ? "text-green-600" : "text-red-600"}>{producto.activo ? "Activo" : "Inactivo"}</span>
    ),
  },
  {
    key: "acciones",
    header: "Acciones",
    render: undefined, // Se sobrescribe en customColumns
  },
]

export function ProductosTableClient(props: ProductosTableClientProps) {
  // Renderizamos la tabla y reemplazamos la columna de acciones por un wrapper que pasa el prop onUpdate
  // Definir onUpdate correctamente como prop
  // Usar el prop onUpdate directamente en el mapeo
  const customColumns = columns.map(col => {
    if (col.key === "acciones") {
      return {
        ...col,
        render: (producto: any) => {
          // Obtener movimientos específicos de este producto (convertir a string para buscar)
          const movimientosProducto = props.movimientosPorProducto?.[String(producto.id)] || []
          return (
            <ProductoActions
              producto={producto}
              onUpdate={props.onUpdate}
              movimientos={movimientosProducto}
              ventasPorProducto={props.ventasPorProducto}
            />
          )
        },
      };
    }
    return col;
  });
  return (
    <DataTable
      data={props.productos}
      columns={customColumns}
      searchable
      searchPlaceholder="Buscar productos..."
    />
  );
}
