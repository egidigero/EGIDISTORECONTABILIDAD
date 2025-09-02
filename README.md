# EGIDI Store - Sistema de Gestión Contable

Sistema completo de gestión contable y control para EGIDI Store, especializado en la venta de smartwatches y accesorios tecnológicos.

## 🚀 Características

- **Gestión de Productos**: Control de inventario con costos y SKUs
- **Sistema de Tarifas**: Configuración de comisiones por canal/método de pago
- **Registro de Ventas**: Seguimiento completo con cálculos automáticos de rentabilidad
- **Estado de Resultados**: Reportes financieros detallados
- **Gastos e Ingresos**: Control de movimientos por canal
- **Devoluciones**: Gestión de devoluciones y recupero de productos
- **Liquidaciones**: Control diario de fondos por plataforma
- **Integraciones**: APIs para Tienda Nube y Mercado Libre

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 15 + TypeScript + TailwindCSS
- **Backend**: Next.js API Routes + Server Actions
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Validación**: Zod + React Hook Form
- **UI**: Componentes personalizados con shadcn/ui

## 📦 Instalación

1. **Clonar el repositorio**
\`\`\`bash
git clone <repository-url>
cd egidi-store-system
\`\`\`

2. **Instalar dependencias**
\`\`\`bash
npm install
\`\`\`

3. **Configurar variables de entorno**
\`\`\`bash
cp .env.example .env.local
\`\`\`

Editar `.env.local` con tus credenciales:
- `DATABASE_URL`: URL de conexión a PostgreSQL (recomendado: Neon)
- Credenciales de APIs de Tienda Nube y Mercado Libre

4. **Configurar base de datos**
\`\`\`bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
\`\`\`

5. **Ejecutar en desarrollo**
\`\`\`bash
npm run dev
\`\`\`

## 🚀 Deploy en Vercel

1. Conectar repositorio en Vercel
2. Configurar variables de entorno en el dashboard de Vercel
3. Deploy automático

## 📊 Módulos del Sistema

### Productos
- Gestión de modelos, SKUs y costos
- Control de productos activos/inactivos

### Tarifas
- Configuración de comisiones por plataforma y método de pago
- Cálculo automático de IIBB y costos fijos

### Ventas
- Registro de ventas con cálculos automáticos
- Seguimiento de envíos y estados
- Filtros avanzados y búsqueda

### EERR (Estado de Resultados)
- Reportes financieros por período y canal
- Cálculo de rentabilidad y márgenes

### Gastos e Ingresos
- Control de movimientos por canal
- Categorización de gastos

### Devoluciones
- Gestión de devoluciones vinculadas a ventas
- Control de recupero de productos

### Liquidaciones
- Control diario de fondos por plataforma
- Seguimiento de liquidaciones pendientes

## 🔧 Scripts Disponibles

- `npm run dev`: Servidor de desarrollo
- `npm run build`: Build de producción
- `npm run start`: Servidor de producción
- `npm run prisma:generate`: Generar cliente Prisma
- `npm run prisma:migrate`: Ejecutar migraciones
- `npm run prisma:studio`: Abrir Prisma Studio
- `npm run prisma:seed`: Poblar base de datos con datos de ejemplo

## 📱 Canales de Venta Soportados

- **Tienda Nube**: E-commerce principal
- **Mercado Libre**: Marketplace
- **Ventas Directas**: Transferencias y efectivo

## 🔐 Integraciones API

El sistema está preparado para integrarse con:
- **Tienda Nube API**: Importación de órdenes y tracking
- **Mercado Libre API**: Sincronización de ventas y estados

## 📈 Cálculos Automáticos

El sistema calcula automáticamente:
- Comisiones por plataforma/método
- IIBB según configuración
- Precio neto después de deducciones
- Margen de ganancia
- Rentabilidad sobre precio de venta y costo

## 🎯 Próximas Funcionalidades

- Dashboard con métricas en tiempo real
- Notificaciones de envíos pendientes
- Exportación de reportes a Excel
- Integración con sistemas de courier
