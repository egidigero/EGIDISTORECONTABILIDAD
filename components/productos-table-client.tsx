"use client"

import { DataTable } from "./data-table"
import { ProductoActions } from "./producto-actions"
import type { Producto } from "@/lib/types"

interface ProductosTableClientProps {
  productos: Producto[]
  onUpdate?: () => void
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
    key: "stockPropio",
    header: "Stock propio",
    render: (producto: any) => {
      const stock = producto.stockPropio;
      return stock !== null && stock !== undefined ? Number(stock).toLocaleString() : "0";
    },
  },
  {
    key: "stockFull",
    header: "Stock full",
    render: (producto: any) => {
      const stock = producto.stockFull;
      return stock !== null && stock !== undefined ? Number(stock).toLocaleString() : "0";
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
      return { ...col, render: (producto: any) => <ProductoActions producto={producto} onUpdate={props.onUpdate} /> };
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
