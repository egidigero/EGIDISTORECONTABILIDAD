"use client"

import { useState, useMemo } from "react"
import { DevolucionesTable } from "@/components/devoluciones-table"
import { DevolucionesGestionFiltro } from "@/components/devoluciones-gestion-filtro"

interface DevolucionesClientWrapperProps {
  devoluciones: any[]
}

export function DevolucionesClientWrapper({ devoluciones }: DevolucionesClientWrapperProps) {
  const [filtros, setFiltros] = useState<any>({})

  const devolucionesFiltradas = useMemo(() => {
    let resultado = [...devoluciones]

    // Filtro por búsqueda
    if (filtros.busqueda) {
      const termino = filtros.busqueda.toLowerCase()
      resultado = resultado.filter(dev => {
        const id = (dev.id_devolucion || dev.numeroDevolucion || '').toLowerCase()
        const comprador = (dev.comprador || dev.nombre_contacto || '').toLowerCase()
        const producto = (dev.producto_modelo || '').toLowerCase()
        const telefono = (dev.telefono_contacto || '').toLowerCase()
        const motivo = (dev.motivo || '').toLowerCase()
        
        return id.includes(termino) || 
               comprador.includes(termino) || 
               producto.includes(termino) ||
               telefono.includes(termino) ||
               motivo.includes(termino)
      })
    }

    // Filtro por fecha de reclamo
    if (filtros.fechaInicio) {
      const fechaInicio = new Date(filtros.fechaInicio)
      resultado = resultado.filter(dev => {
        const fechaReclamo = dev.fecha_reclamo || dev.fechaReclamo
        if (!fechaReclamo) return false
        const fecha = new Date(fechaReclamo)
        return fecha >= fechaInicio
      })
    }

    if (filtros.fechaFin) {
      const fechaFin = new Date(filtros.fechaFin)
      fechaFin.setHours(23, 59, 59, 999)
      resultado = resultado.filter(dev => {
        const fechaReclamo = dev.fecha_reclamo || dev.fechaReclamo
        if (!fechaReclamo) return false
        const fecha = new Date(fechaReclamo)
        return fecha <= fechaFin
      })
    }

    // Filtro por plataforma
    if (filtros.plataforma) {
      resultado = resultado.filter(dev => dev.plataforma === filtros.plataforma)
    }

    // Filtro por estado
    if (filtros.estado) {
      resultado = resultado.filter(dev => dev.estado === filtros.estado)
    }

    // Filtro por estado de recepción
    if (filtros.estadoRecepcion) {
      if (filtros.estadoRecepcion === 'recibido') {
        resultado = resultado.filter(dev => {
          const fechaRecepcion = dev.fecha_recepcion || dev.fechaRecepcion
          return !!fechaRecepcion
        })
      } else if (filtros.estadoRecepcion === 'no_recibido') {
        resultado = resultado.filter(dev => {
          const fechaRecepcion = dev.fecha_recepcion || dev.fechaRecepcion
          return !fechaRecepcion
        })
      }
    }

    // Filtro por estado de prueba
    if (filtros.estadoPrueba) {
      if (filtros.estadoPrueba === 'probado') {
        resultado = resultado.filter(dev => {
          const fechaPrueba = dev.fecha_prueba || dev.fechaPrueba
          return !!fechaPrueba
        })
      } else if (filtros.estadoPrueba === 'no_probado') {
        resultado = resultado.filter(dev => {
          const fechaPrueba = dev.fecha_prueba || dev.fechaPrueba
          return !fechaPrueba
        })
      } else if (filtros.estadoPrueba === 'pendiente_probar') {
        resultado = resultado.filter(dev => {
          const fechaRecepcion = dev.fecha_recepcion || dev.fechaRecepcion
          const fechaPrueba = dev.fecha_prueba || dev.fechaPrueba
          // Mostrar todos los recibidos sin probar, independiente de si completó reembolso/cambio
          return !!fechaRecepcion && !fechaPrueba
        })
      } else if (filtros.estadoPrueba === 'funciona') {
        resultado = resultado.filter(dev => {
          const resultado = dev.resultado_prueba || dev.resultadoPrueba || ''
          return resultado.includes('Funciona')
        })
      } else if (filtros.estadoPrueba === 'no_funciona') {
        resultado = resultado.filter(dev => {
          const resultado = dev.resultado_prueba || dev.resultadoPrueba || ''
          return resultado.includes('No funciona')
        })
      }
    }

    return resultado
  }, [devoluciones, filtros])

  return (
    <>
      <DevolucionesGestionFiltro 
        onFilter={setFiltros}
        totalDevoluciones={devoluciones.length}
        devolucionesFiltradas={devolucionesFiltradas.length}
      />
      <DevolucionesTable devoluciones={devolucionesFiltradas} />
    </>
  )
}
