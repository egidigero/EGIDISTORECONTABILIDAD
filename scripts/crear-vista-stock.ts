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

async function crearVistaStock() {
  console.log('🔄 Creando vista de stock calculado...')
  
  try {
    // Leer el archivo SQL
    const sqlPath = join(process.cwd(), 'migration_vista_stock_calculado.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    
    // Ejecutar el SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      console.error('❌ Error:', error)
      console.log('\n⚠️  La vista necesita ser creada manualmente en Supabase SQL Editor')
      console.log('📄 Contenido del SQL:')
      console.log(sql)
    } else {
      console.log('✅ Vista creada exitosamente')
    }
    
  } catch (error) {
    console.error('❌ Error general:', error)
    console.log('\n⚠️  Ejecuta este SQL manualmente en Supabase SQL Editor:')
    const sqlPath = join(process.cwd(), 'migration_vista_stock_calculado.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    console.log(sql)
  }
}

crearVistaStock()
