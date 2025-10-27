const fs = require('fs')
const path = require('path')

const file = path.resolve(__dirname, '../lib/calculos.ts')
let src
try {
  src = fs.readFileSync(file, 'utf8')
} catch (err) {
  console.error('No se pudo leer lib/calculos.ts:', err.message)
  process.exit(1)
}

// Buscar casos de cuotas y sus valores
const re = /case\s*(\d+)\s*:\s*return\s*([0-9\.]+)/g
const found = {}
let m
while ((m = re.exec(src)) !== null) {
  const cuota = Number(m[1])
  const valor = Number(m[2])
  found[cuota] = valor
}

console.log('Valores encontrados en lib/calculos.ts → getRecargoCuotasMP:')
console.log(found)

if (!found[2] || !found[3] || !found[6]) {
  console.warn('\nNo se encontraron las 3 cuotas esperadas (2,3,6). Revisa el archivo fuente.')
} else {
  console.log('\nResumen legible:')
  console.log(`2 cuotas: ${(found[2]*100).toFixed(2)}%`) 
  console.log(`3 cuotas: ${(found[3]*100).toFixed(2)}%`) 
  console.log(`6 cuotas: ${(found[6]*100).toFixed(2)}%`)
}

console.log('\nSi esto muestra los valores nuevos, entonces el código fuente se actualizó correctamente.')
console.log('Siguiente paso recomendado: reconstruir y redeploy / reiniciar server para que Next.js use los cambios compilados.')
