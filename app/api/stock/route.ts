import { NextResponse } from 'next/server';
import { StockUbicacion } from '@/lib/stock-models';

// Simulación de stock actual (en memoria)
let stock: StockUbicacion[] = [];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productoId = searchParams.get('productoId');
  const deposito = searchParams.get('deposito');
  const cajaId = searchParams.get('cajaId');

  let resultado = stock;
  if (productoId) resultado = resultado.filter(s => s.productoId === productoId);
  if (deposito) resultado = resultado.filter(s => s.deposito === deposito);
  if (cajaId) resultado = resultado.filter(s => s.cajaId === cajaId);

  return NextResponse.json(resultado);
}
