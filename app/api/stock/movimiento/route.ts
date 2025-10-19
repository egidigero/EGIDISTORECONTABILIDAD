import { NextResponse } from 'next/server';
import { MovimientoStock, StockUbicacion } from '@/lib/stock-models';

// Simulación de movimientos y stock (en memoria)
let movimientos: MovimientoStock[] = [];
let stock: StockUbicacion[] = [];

export async function POST(request: Request) {
  const body = await request.json();
  const movimiento: MovimientoStock = {
    ...body,
    id: Math.random().toString(36).slice(2),
    fecha: new Date().toISOString(),
  };
  movimientos.push(movimiento);

  // Actualización de stock según tipo de movimiento
  if (movimiento.tipo === 'INGRESO') {
    let ubicacion = stock.find(s => s.productoId === movimiento.productoId && s.deposito === movimiento.depositoOrigen && s.cajaId === movimiento.cajaOrigenId);
    if (ubicacion) {
      ubicacion.cantidad += movimiento.cantidad;
    } else {
      stock.push({
        productoId: movimiento.productoId,
        deposito: movimiento.depositoOrigen,
        cantidad: movimiento.cantidad,
        cajaId: movimiento.cajaOrigenId,
      });
    }
  } else if (movimiento.tipo === 'EGRESO') {
    let ubicacion = stock.find(s => s.productoId === movimiento.productoId && s.deposito === movimiento.depositoOrigen && s.cajaId === movimiento.cajaOrigenId);
    if (ubicacion) {
      ubicacion.cantidad -= movimiento.cantidad;
      if (ubicacion.cantidad < 0) ubicacion.cantidad = 0;
    }
  } else if (movimiento.tipo === 'TRANSFERENCIA') {
    // Restar del origen
    let origen = stock.find(s => s.productoId === movimiento.productoId && s.deposito === movimiento.depositoOrigen && s.cajaId === movimiento.cajaOrigenId);
    if (origen) {
      origen.cantidad -= movimiento.cantidad;
      if (origen.cantidad < 0) origen.cantidad = 0;
    }
    // Sumar al destino
    let destino = stock.find(s => s.productoId === movimiento.productoId && s.deposito === movimiento.depositoDestino && s.cajaId === movimiento.cajaDestinoId);
    if (destino) {
      destino.cantidad += movimiento.cantidad;
    } else {
      stock.push({
        productoId: movimiento.productoId,
        deposito: movimiento.depositoDestino!,
        cantidad: movimiento.cantidad,
        cajaId: movimiento.cajaDestinoId,
      });
    }
  }

  return NextResponse.json({ ok: true, movimiento });
}

export async function GET() {
  // Devuelve historial de movimientos
  return NextResponse.json(movimientos);
}
