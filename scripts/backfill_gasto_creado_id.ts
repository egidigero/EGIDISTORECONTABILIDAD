import { createClient } from '@supabase/supabase-js'

// Usage: set env SUPABASE_URL and SUPABASE_KEY then run with ts-node or compile
// This script iterates devoluciones without gasto_creado_id and tries to find a gastos_ingresos
// whose descripcion contains 'devol <id>' and writes gasto_creado_id on the devolución.

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Set SUPABASE_URL and SUPABASE_KEY in env to run this script')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: devols, error: err } = await supabase
    .from('devoluciones')
    .select('id')
    .is('gasto_creado_id', null)
    .limit(1000)

  if (err) {
    console.error('Error fetching devoluciones:', err)
    process.exit(1)
  }

  console.log('Found', devols?.length || 0, 'devoluciones without gasto_creado_id')

  for (const row of devols || []) {
    const id = row.id
    try {
      const { data: found } = await supabase
        .from('gastos_ingresos')
        .select('id')
        .ilike('descripcion', `%devol ${id}%`)
        .limit(1)
        .single()

      if (found && found.id) {
        const { error: upErr } = await supabase
          .from('devoluciones')
          .update({ gasto_creado_id: found.id })
          .eq('id', id)

        if (upErr) {
          console.warn('Failed to update devolucion', id, upErr)
        } else {
          console.log('Backfilled devolucion', id, '-> gasto', found.id)
        }
      } else {
        // No match
      }
    } catch (e) {
      console.warn('Error processing devol', id, e)
    }
  }

  console.log('Backfill done')
}

run().catch(e => { console.error(e); process.exit(1) })
