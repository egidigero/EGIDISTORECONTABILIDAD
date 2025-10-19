"use client"

import dynamic from "next/dynamic"

// dynamic import to ensure client-only loading
const NuevaDevolucionModal = dynamic(() => import("@/components/nueva-devolucion-modal").then(m => m.NuevaDevolucionModal), { ssr: false })

export default function NuevaDevolucionModalWrapper() {
  return <NuevaDevolucionModal />
}
