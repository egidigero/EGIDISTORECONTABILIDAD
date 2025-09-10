"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { gastoIngresoSchema, type GastoIngresoFormData } from "@/lib/validations"
import type { GastoIngresoFilters } from "@/lib/types"

// Función simple para generar ID único
function generateUniqueId(): string {
  return `gi-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export async function getGastosIngresos(filters?: GastoIngresoFilters) {
  try {
    let query = supabase
      .from('gastos_ingresos')
      .select('id, fecha, canal, tipo, categoria, descripcion, montoARS, esPersonal, createdAt, updatedAt')
      .order('fecha', { ascending: false })

    if (filters?.fechaDesde) {
      query = query.gte('fecha', filters.fechaDesde.toISOString().split('T')[0])
    }
    if (filters?.fechaHasta) {
      query = query.lte('fecha', filters.fechaHasta.toISOString().split('T')[0])
    }
    if (filters?.canal && filters.canal !== "General") {
      // Si es canal específico, mostrar los de ese canal, los generales (null, 'General', '')
      query = query.or(`canal.eq.${filters.canal},canal.is.null,canal.eq.General,canal.eq.`)
    }
    // Si es General, no filtrar (traer todos)
    if (filters?.tipo) {
      query = query.eq('tipo', filters.tipo)
    }
    if (filters?.categoria) {
      query = query.ilike('categoria', `%${filters.categoria}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching gastos/ingresos:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getGastosIngresos:', error)
    return []
  }
}

export async function getGastosIngresosByFecha(fecha: string) {
  try {
    const { data, error } = await supabase
      .from('gastos_ingresos')
      .select('*')
      .eq('fecha', fecha)
      .order('createdAt', { ascending: true })

    if (error) {
      console.error('Error fetching gastos/ingresos by fecha:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getGastosIngresosByFecha:', error)
    return []
  }
}

export async function calcularImpactoEnMPDisponible(fecha: string) {
  try {
    const gastosIngresos = await getGastosIngresosByFecha(fecha)
    
    let totalIngresos = 0
    let totalGastos = 0
    let totalGastosPersonales = 0
    let totalOtrosIngresos = 0
    
    gastosIngresos.forEach(item => {
      if (item.tipo === 'Ingreso') {
        if (item.categoria === 'Otros Ingresos' || item.esPersonal) {
          totalOtrosIngresos += item.montoARS || 0
        } else {
          totalIngresos += item.montoARS || 0
        }
      } else if (item.tipo === 'Gasto') {
        // TODOS los gastos afectan liquidaciones (empresariales Y personales)
        totalGastos += item.montoARS || 0
        
        // Separar gastos personales solo para reporting, pero SÍ afectan liquidaciones
        if (item.esPersonal) {
          totalGastosPersonales += item.montoARS || 0
        }
      }
    })
    
    // TODOS los gastos (empresariales + personales) afectan las liquidaciones
    // Solo los "otros ingresos" no afectan liquidaciones
    const impactoNeto = totalIngresos - totalGastos
    
    console.log(`Impacto gastos/ingresos ${fecha}:`, {
      totalIngresos,
      totalGastos,
      totalGastosPersonales,
      totalOtrosIngresos,
      impactoNeto,
      items: gastosIngresos.length
    })
    
    return {
      totalIngresos,
      totalGastos,
      totalGastosPersonales,
      totalOtrosIngresos,
      impactoNeto,
      items: gastosIngresos
    }
  } catch (error) {
    console.error('Error calculando impacto en MP Disponible:', error)
    return {
      totalIngresos: 0,
      totalGastos: 0,
      totalGastosPersonales: 0,
      totalOtrosIngresos: 0,
      impactoNeto: 0,
      items: []
    }
  }
}

export async function recalcularLiquidacionesPorGastoIngreso(fecha: string) {
  try {
    // Importar dinámicamente para evitar dependencias circulares
    const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
    
    console.log(`Recalculando liquidaciones desde ${fecha} por cambio en gastos/ingresos`)

    // Usar el nuevo sistema de recálculo en cascada
    const resultado = await recalcularLiquidacionesEnCascada(fecha)
    
    if (!resultado.success) {
      console.error('Error recalculando liquidaciones:', resultado.error)
      return resultado
    }

    console.log(`✓ Liquidaciones recalculadas exitosamente desde ${fecha}`)
    return { success: true }
  } catch (error) {
    console.error('Error en recalcularLiquidacionesPorGastoIngreso:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

export async function createGastoIngreso(data: GastoIngresoFormData) {
  try {
    const result = gastoIngresoSchema.safeParse(data)
    if (!result.success) {
      return { success: false, error: "Datos inválidos" }
    }

    const { data: insertData, error } = await supabase
      .from('gastos_ingresos')
      .insert([{
        id: generateUniqueId(),
        fecha: result.data.fecha.toISOString().split('T')[0],
        tipo: result.data.tipo,
        categoria: result.data.categoria,
        descripcion: result.data.descripcion,
        montoARS: result.data.montoARS,
        canal: result.data.canal,
        updatedAt: new Date().toISOString()
      }])
      .select()

    if (error) {
      console.error('Error creating gasto/ingreso:', error)
      return { success: false, error: "Error al crear el registro" }
    }

    // Recalcular liquidaciones desde la fecha del gasto/ingreso
    const fechaStr = result.data.fecha.toISOString().split('T')[0]
    
    // Asegurar que existe liquidación para esa fecha antes de recalcular
    const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
    await asegurarLiquidacionParaFecha(fechaStr)
    
    await recalcularLiquidacionesPorGastoIngreso(fechaStr)

    revalidatePath("/gastos")
    revalidatePath("/eerr")
    revalidatePath("/liquidaciones")
    return { success: true, data: insertData?.[0] }
  } catch (error) {
    console.error("Error al crear gasto/ingreso:", error)
    return { success: false, error: "Error al crear gasto/ingreso" }
  }
}

export async function updateGastoIngreso(id: string, data: GastoIngresoFormData) {
  try {
    const result = gastoIngresoSchema.safeParse(data)
    if (!result.success) {
      return { success: false, error: "Datos inválidos" }
    }

    // Obtener la fecha original antes de actualizar
    const { data: originalData } = await supabase
      .from('gastos_ingresos')
      .select('fecha')
      .eq('id', id)
      .single()

    const { data: updateData, error } = await supabase
      .from('gastos_ingresos')
      .update({
        fecha: result.data.fecha.toISOString().split('T')[0],
        tipo: result.data.tipo,
        categoria: result.data.categoria,
        descripcion: result.data.descripcion,
        montoARS: result.data.montoARS,
        canal: result.data.canal,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error updating gasto/ingreso:', error)
      return { success: false, error: "Error al actualizar el registro" }
    }

    // Recalcular liquidaciones desde la fecha más antigua (original o nueva)
    const fechaOriginal = originalData?.fecha || result.data.fecha.toISOString().split('T')[0]
    const fechaNueva = result.data.fecha.toISOString().split('T')[0]
    const fechaDesde = fechaOriginal <= fechaNueva ? fechaOriginal : fechaNueva
    
    // Asegurar que existen liquidaciones para ambas fechas antes de recalcular
    const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
    await asegurarLiquidacionParaFecha(fechaNueva)
    if (fechaOriginal !== fechaNueva) {
      await asegurarLiquidacionParaFecha(fechaOriginal)
    }
    
    await recalcularLiquidacionesPorGastoIngreso(fechaDesde)

    revalidatePath("/gastos")
    revalidatePath("/eerr")
    revalidatePath("/liquidaciones")
    return { success: true, data: updateData[0] }
  } catch (error) {
    console.error("Error al actualizar gasto/ingreso:", error)
    return { success: false, error: "Error al actualizar gasto/ingreso" }
  }
}

export async function deleteGastoIngreso(id: string) {
  try {
    // Obtener la fecha antes de eliminar
    const { data: originalData } = await supabase
      .from('gastos_ingresos')
      .select('fecha')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('gastos_ingresos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting gasto/ingreso:', error)
      return { success: false, error: "Error al eliminar el registro" }
    }

    // Recalcular liquidaciones desde la fecha del gasto/ingreso eliminado
    if (originalData?.fecha) {
      console.log('🗑️ Gasto/Ingreso eliminado, recalculando liquidaciones desde:', originalData.fecha)
      await recalcularLiquidacionesPorGastoIngreso(originalData.fecha)
    }

    revalidatePath("/gastos")
    revalidatePath("/eerr")
    revalidatePath("/liquidaciones")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar gasto/ingreso:", error)
    return { success: false, error: "Error al eliminar gasto/ingreso" }
  }
}

export async function getGastoIngresoById(id: string) {
  try {
    const { data, error } = await supabase
      .from('gastos_ingresos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching gasto/ingreso by id:', error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error al obtener gasto/ingreso:", error)
    return null
  }
}

export async function getCategorias() {
  try {
    const { data, error } = await supabase
      .from('gastos_ingresos')
      .select('categoria')
      .not('categoria', 'is', null)
      .order('categoria')

    if (error) {
      console.error('Error fetching categorias:', error)
      return []
    }

    // Extraer categorías únicas de la base de datos
    const categoriasDB = [...new Set(data.map(item => item.categoria))].filter(Boolean)
    
    // Categorías sugeridas predefinidas (especialmente para publicidad/ROAS)
    const categoriasSugeridas = [
      "Publicidad Facebook",
      "Publicidad Instagram", 
      "Publicidad Google Ads",
      "Publicidad TikTok",
      "Marketing Digital",
      "Publicidad Display",
      "Email Marketing",
      "Influencer Marketing",
      "SEO/SEM",
      "Comisiones de venta",
      "Gastos de envío",
      "Papelería",
      "Servicios profesionales",
      "Impuestos",
      "Servicios bancarios",
      "Gastos generales"
    ]
    
    // Combinar y eliminar duplicados
    const todasCategorias = [...new Set([...categoriasSugeridas, ...categoriasDB])]
    return todasCategorias.sort()
  } catch (error) {
    console.error("Error al obtener categorías:", error)
    return []
  }
}

