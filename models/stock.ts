// models/stock.ts

export interface Producto {
  sku: string;
  nombre: string;
  modelos: Modelo[];
}

export interface Modelo {
  sku: string;
  nombre: string;
  stock: number;
  precioVenta: number;
  costoUnitario: number;
}

export function calcularCosteoPorProducto(modelo: Modelo): number {
  return modelo.stock * modelo.costoUnitario;
}

export function calcularPatrimonioStock(productos: Producto[]): number {
  return productos.reduce((total, producto) => {
    return (
      total +
      producto.modelos.reduce(
        (subtotal, modelo) => subtotal + calcularCosteoPorProducto(modelo),
        0
      )
    );
  }, 0);
}
