import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Iniciando seed de datos...")

  // Crear productos de ejemplo
  const producto1 = await prisma.producto.create({
    data: {
      modelo: "SW-ROSE-GOLD-42",
      sku: "SWRG42001",
      costoUnitarioARS: 15000.0,
      activo: true,
    },
  })

  const producto2 = await prisma.producto.create({
    data: {
      modelo: "SW-SILVER-38",
      sku: "SWSL38001",
      costoUnitarioARS: 12000.0,
      activo: true,
    },
  })

  console.log("✅ Productos creados")

  // Crear tarifas por canal/método
  const tarifas = [
    // Tienda Nube
    { plataforma: "TN", metodoPago: "PagoNube", comisionPct: 3.5, iibbPct: 2.1, fijoPorOperacion: 50 },
    { plataforma: "TN", metodoPago: "Transferencia", comisionPct: 0, iibbPct: 2.1, fijoPorOperacion: 0 },

    // Mercado Libre
    { plataforma: "ML", metodoPago: "MercadoPago", comisionPct: 6.8, iibbPct: 2.1, fijoPorOperacion: 0 },

    // Directo
    { plataforma: "Directo", metodoPago: "Transferencia", comisionPct: 0, iibbPct: 0, fijoPorOperacion: 0 },
    { plataforma: "Directo", metodoPago: "Efectivo", comisionPct: 0, iibbPct: 0, fijoPorOperacion: 0 },
  ]

  for (const tarifa of tarifas) {
    await prisma.tarifa.create({
      data: {
        ...tarifa,
        key: `${tarifa.plataforma}|${tarifa.metodoPago}`,
      },
    })
  }

  console.log("✅ Tarifas creadas")

  // Crear ventas de ejemplo
  const venta1 = await prisma.venta.create({
    data: {
      comprador: "María González",
      plataforma: "TN",
      metodoPago: "PagoNube",
      productoId: producto1.id,
      pvBruto: 25000.0,
      cargoEnvioCosto: 800.0,
      comision: 925.0, // 3.5% + 50
      iibb: 525.0, // 2.1%
      precioNeto: 23550.0,
      costoProducto: 15000.0,
      ingresoMargen: 7750.0,
      rentabilidadSobrePV: 0.31,
      rentabilidadSobreCosto: 0.5167,
      estadoEnvio: "Entregado",
      saleCode: "EG-TEST-001",
    },
  })

  const venta2 = await prisma.venta.create({
    data: {
      comprador: "Ana Rodríguez",
      plataforma: "ML",
      metodoPago: "MercadoPago",
      productoId: producto2.id,
      pvBruto: 20000.0,
      cargoEnvioCosto: 600.0,
      comision: 1360.0, // 6.8%
      iibb: 420.0, // 2.1%
      precioNeto: 18220.0,
      costoProducto: 12000.0,
      ingresoMargen: 5620.0,
      rentabilidadSobrePV: 0.281,
      rentabilidadSobreCosto: 0.4683,
      estadoEnvio: "Pendiente",
      saleCode: "EG-TEST-002",
    },
  })

  console.log("✅ Ventas de ejemplo creadas")

  console.log("🎉 Seed completado exitosamente!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
