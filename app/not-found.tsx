import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center p-8">
        <h2 className="text-6xl font-bold text-gray-400 mb-4">404</h2>
        <h3 className="text-2xl font-bold text-gray-700 mb-4">
          Página no encontrada
        </h3>
        <p className="text-gray-600 mb-6">
          Lo sentimos, la página que buscas no existe.
        </p>
        <Link
          href="/"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
