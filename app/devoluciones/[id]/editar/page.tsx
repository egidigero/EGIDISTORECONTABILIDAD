import React from 'react'
import { DevolucionForm } from '@/components/devolucion-form'
import { getDevolucionById } from '@/lib/actions/devoluciones'

// Next.js may provide `params` as a thenable in some environments; await it
export default async function EditarDevolucionPage(props: any) {
  // In some Next.js runtimes `props.params` can be a thenable. Await it explicitly.
  const params = await props.params
  const id = params?.id
  if (!id) return <div>No se especificó ID de devolución</div>

  try {
    const devolucion = await getDevolucionById(id)
    return (
      <div className="p-6">
        <DevolucionForm devolucion={devolucion} />
      </div>
    )
  } catch (err) {
    console.error('Error cargando devolución para editar:', err)
    return <div>Error al cargar la devolución para editar.</div>
  }
}
