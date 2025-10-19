"use client";
import React, { useEffect, useState } from "react";
import { getProductos } from "@/lib/actions/productos";
import { consultarStock, consultarMovimientos } from "@/lib/stock-api";

export default function StockPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const prods = await getProductos();
        setProductos(prods || []);
      } catch (e) {
        console.error(e);
      }
    })();

    (async () => {
      try {
        const [s, m] = await Promise.all([consultarStock(), consultarMovimientos()]);
        setStock(s || []);
        setMovimientos(m || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">Stock</h1>

      <div className="mt-4">
        <label className="block mb-2">Producto</label>
        <select className="w-full border p-2 rounded">
          <option value="">-- seleccionar producto --</option>
          {productos.map((p: any) => (
            <option key={p.id} value={p.id}>{p.modelo ?? p.sku ?? p.id}</option>
          ))}
        </select>
      </div>

      <div className="mt-4">Stock total: {stock.length}</div>
      <div className="mt-2">Movimientos: {movimientos.length}</div>
    </div>
  );
}

