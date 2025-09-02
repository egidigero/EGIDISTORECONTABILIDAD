import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, CreditCard, ShoppingCart, BarChart3, Receipt, RotateCcw, Banknote, Zap } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">EGIDI Store</h1>
              <p className="text-sm text-muted-foreground">Sistema de Gestión Contable</p>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/ventas" className="text-sm font-medium hover:text-primary">
                Ventas
              </Link>
              <Link href="/productos" className="text-sm font-medium hover:text-primary">
                Productos
              </Link>
              <Link href="/tarifas" className="text-sm font-medium hover:text-primary">
                Tarifas
              </Link>
              <Link href="/eerr" className="text-sm font-medium hover:text-primary">
                EERR
              </Link>
              <Link href="/gastos" className="text-sm font-medium hover:text-primary">
                Gastos
              </Link>
              <Link href="/devoluciones" className="text-sm font-medium hover:text-primary">
                Devoluciones
              </Link>
              <Link href="/liquidaciones" className="text-sm font-medium hover:text-primary">
                Liquidaciones
              </Link>
              <Link href="/integraciones" className="text-sm font-medium hover:text-primary">
                Integraciones
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-balance mb-2">Bienvenido al Sistema EGIDI Store</h2>
          <p className="text-muted-foreground text-pretty">
            Gestiona tu negocio de smartwatches con control completo de ventas, productos y finanzas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Ventas
              </CardTitle>
              <CardDescription>Registra y gestiona todas tus ventas con cálculos automáticos</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/ventas">Gestionar Ventas</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Productos
              </CardTitle>
              <CardDescription>Administra tu catálogo de smartwatches y accesorios</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/productos">Ver Productos</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Tarifas
              </CardTitle>
              <CardDescription>Configura comisiones por canal y método de pago</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/tarifas">Configurar Tarifas</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Estado de Resultados
              </CardTitle>
              <CardDescription>Reportes financieros y análisis de rentabilidad</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/eerr">Ver Reportes</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Gastos e Ingresos
              </CardTitle>
              <CardDescription>Control de movimientos por canal y categoría</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/gastos">Gestionar Gastos</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-primary" />
                Devoluciones
              </CardTitle>
              <CardDescription>Gestiona devoluciones y recupero de productos</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/devoluciones">Ver Devoluciones</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                Liquidaciones
              </CardTitle>
              <CardDescription>Control diario de fondos por plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/liquidaciones">Ver Liquidaciones</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Integraciones
              </CardTitle>
              <CardDescription>Sincroniza datos con Tienda Nube y Mercado Libre</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/integraciones">Configurar APIs</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
