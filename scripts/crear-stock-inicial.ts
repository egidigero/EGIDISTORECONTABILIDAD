import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Leer variables de entorno del archivo .env.local
const envPath = join(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const envLines = envContent.split('\n')

let supabaseUrl = ''
let supabaseKey = ''

for (const line of envLines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim()
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    supabaseKey = line.split('=')[1].trim()
  }
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function crearStockInicial() {
  console.log('🔄 Iniciando creación de stock inicial...')
  
  try {
    // Obtener productos que tienen stock pero no tienen movimientos
    const { data: productos, error: errorProductos } = await supabase
      .from('productos')
      .select('id, modelo, sku, stockPropio')
      .eq('activo', true)
      .gt('stockPropio', 0)
    
    if (errorProductos) {
      console.error('❌ Error al obtener productos:', errorProductos)
      return
    }
    
    console.log(`📦 Encontrados ${productos?.length || 0} productos con stock`)
    
    if (!productos || productos.length === 0) {
      console.log('✅ No hay productos que necesiten stock inicial')
      return
    }
    
    // Para cada producto, verificar si ya tiene movimientos
    let creados = 0
    let omitidos = 0
    
    for (const producto of productos) {
      // Verificar si ya tiene movimientos
      const { data: movimientos, error: errorMov } = await supabase
        .from('movimientos_stock')
        .select('id')
        .eq('producto_id', producto.id)
        .limit(1)
      
      if (errorMov) {
        console.error(`❌ Error verificando movimientos para ${producto.modelo}:`, errorMov)
        continue
      }
      
      if (movimientos && movimientos.length > 0) {
        console.log(`⏭️  ${producto.modelo} ya tiene movimientos, omitiendo...`)
        omitidos++
        continue
      }
      
      // Crear movimiento inicial
      const { error: errorInsert } = await supabase
        .from('movimientos_stock')
        .insert({
          producto_id: producto.id,
          tipo: 'entrada',
          cantidad: producto.stockPropio,
          deposito_origen: 'PROPIO',
          fecha: '2025-01-01T00:00:00.000Z',
          observaciones: 'Inventario inicial - Stock de apertura',
          origen_tipo: 'ingreso_manual'
        })
      
      if (errorInsert) {
        console.error(`❌ Error creando movimiento para ${producto.modelo}:`, errorInsert)
        continue
      }
      
      console.log(`✅ ${producto.modelo} (SKU: ${producto.sku}): Stock inicial de ${producto.stockPropio} unidades creado`)
      creados++
    }
    
    console.log('\n📊 Resumen:')
    console.log(`   ✅ Movimientos creados: ${creados}`)
    console.log(`   ⏭️  Productos omitidos (ya tenían movimientos): ${omitidos}`)
    console.log(`   📦 Total productos procesados: ${productos.length}`)
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

crearStockInicial()
