import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download, Upload, RefreshCw, Settings, ExternalLink } from "lucide-react"
import { ImportOrdersForm } from "@/components/import-orders-form"
import { UpdateTrackingForm } from "@/components/update-tracking-form"

export default function IntegracionesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                ← Volver al inicio
              </Link>
              <h1 className="text-2xl font-bold text-foreground mt-1">Integraciones</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Estado de Integraciones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Estado de Integraciones
              </CardTitle>
              <CardDescription>Configuración y estado de las conexiones con plataformas externas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Tienda Nube</span>
                  <Badge variant={process.env.TN_ACCESS_TOKEN ? "default" : "secondary"}>
                    {process.env.TN_ACCESS_TOKEN ? "Conectado" : "No configurado"}
                  </Badge>
                </div>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Configurar
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Mercado Libre</span>
                  <Badge variant={process.env.ML_ACCESS_TOKEN ? "default" : "secondary"}>
                    {process.env.ML_ACCESS_TOKEN ? "Conectado" : "No configurado"}
                  </Badge>
                </div>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Configurar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas de Importación */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Última Sincronización
              </CardTitle>
              <CardDescription>Información sobre las últimas importaciones de datos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Tienda Nube:</span>
                <span className="text-sm">No sincronizado</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Mercado Libre:</span>
                <span className="text-sm">No sincronizado</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Tracking:</span>
                <span className="text-sm">No actualizado</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Importar Órdenes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importar Órdenes
              </CardTitle>
              <CardDescription>Sincroniza órdenes aprobadas desde Tienda Nube y Mercado Libre.</CardDescription>
            </CardHeader>
            <CardContent>
              <ImportOrdersForm />
            </CardContent>
          </Card>

          {/* Actualizar Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Actualizar Tracking
              </CardTitle>
              <CardDescription>Actualiza información de envío y estados de tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <UpdateTrackingForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
