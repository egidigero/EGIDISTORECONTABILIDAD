// Ejemplo de uso de la API de stock
import { MovimientoStock } from '@/lib/stock-models';

export async function registrarIngresoStock(movimiento: Omit<MovimientoStock, 'id' | 'fecha'>) {
  const res = await fetch('/api/stock/movimiento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(movimiento),
  });
  return res.json();
}

export async function consultarStock(productoId?: string, deposito?: string, cajaId?: string) {
  const params = new URLSearchParams();
  if (productoId) params.append('productoId', productoId);
  if (deposito) params.append('deposito', deposito);
  if (cajaId) params.append('cajaId', cajaId);
  const res = await fetch(`/api/stock?${params.toString()}`);
  return res.json();
}

export async function consultarMovimientos() {
  const res = await fetch('/api/stock/movimiento');
  return res.json();
}
