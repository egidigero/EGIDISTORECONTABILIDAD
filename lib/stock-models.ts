// Modelo de Producto
export interface Producto {
  id: string; // SKU o identificador único
  nombre: string;
  descripcion?: string;
}

// Modelo de Depósito
export type Deposito = 'CASA' | 'FULL_ML';

// Modelo de Caja (solo para depósito CASA)
export interface Caja {
  id: string; // Identificador de la caja
  nombre: string;
}

// Modelo de Stock por ubicación
export interface StockUbicacion {
  productoId: string;
  deposito: Deposito;
  cantidad: number;
  cajaId?: string; // Solo si deposito === 'CASA'
}

// Modelo de Movimiento de Stock
export interface MovimientoStock {
  id: string;
  productoId: string;
  depositoOrigen: Deposito;
  depositoDestino?: Deposito;
  cajaOrigenId?: string;
  cajaDestinoId?: string;
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';
  cantidad: number;
  fecha: string; // ISO timestamp
  observaciones?: string;
}
