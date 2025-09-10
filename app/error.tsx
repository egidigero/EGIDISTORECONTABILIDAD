"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          ¡Algo salió mal!
        </h2>
        <p className="text-gray-600 mb-4">
          Ha ocurrido un error inesperado en la aplicación.
        </p>
        <button
          onClick={reset}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
