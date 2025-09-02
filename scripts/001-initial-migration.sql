-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('TN', 'ML', 'Directo');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('PagoNube', 'MercadoPago', 'Transferencia', 'Efectivo');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('Pendiente', 'EnCamino', 'Entregado', 'Devuelto', 'Cancelado');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('Gasto', 'OtroIngreso');

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "costoUnitarioARS" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas" (
    "id" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "comisionPct" DECIMAL(5,4) NOT NULL,
    "iibbPct" DECIMAL(5,4) NOT NULL,
    "fijoPorOperacion" DECIMAL(10,2) NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarifas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprador" TEXT NOT NULL,
    "tipoOperacion" TEXT NOT NULL DEFAULT 'Venta',
    "plataforma" "Plataforma" NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "productoId" TEXT NOT NULL,
    "pvBruto" DECIMAL(10,2) NOT NULL,
    "cargoEnvioCosto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "comision" DECIMAL(10,2) NOT NULL,
    "iibb" DECIMAL(10,2) NOT NULL,
    "precioNeto" DECIMAL(10,2) NOT NULL,
    "costoProducto" DECIMAL(10,2) NOT NULL,
    "ingresoMargen" DECIMAL(10,2) NOT NULL,
    "rentabilidadSobrePV" DECIMAL(5,4) NOT NULL,
    "rentabilidadSobreCosto" DECIMAL(5,4) NOT NULL,
    "trackingUrl" TEXT,
    "estadoEnvio" "EstadoEnvio" NOT NULL DEFAULT 'Pendiente',
    "courier" TEXT,
    "externalOrderId" TEXT,
    "saleCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "dineroFP" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "disponibleMP_MELI" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "aLiquidarMP" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "liquidadoMP" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "aLiquidarTN" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_ingresos" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canal" "Plataforma",
    "tipo" "TipoMovimiento" NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "montoARS" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_ingresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ventaId" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "montoDevuelto" DECIMAL(10,2) NOT NULL,
    "costoEnvioIda" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "costoEnvioVuelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "recuperoProducto" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devoluciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "productos_modelo_key" ON "productos"("modelo");

-- CreateIndex
CREATE UNIQUE INDEX "tarifas_key_key" ON "tarifas"("key");

-- CreateIndex
CREATE UNIQUE INDEX "tarifas_plataforma_metodoPago_key" ON "tarifas"("plataforma", "metodoPago");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_saleCode_key" ON "ventas"("saleCode");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_fecha_key" ON "liquidaciones"("fecha");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
