import { useState } from "react"
import { ProductoForm } from "./producto-form"

export function NuevoProductoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.2)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">Nuevo producto</h2>
        <ProductoForm onSuccess={onClose} />
      </div>
    </div>
  ) : null
}
