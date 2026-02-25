'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">A critical error occurred</h2>
          <p className="text-gray-600 mb-8 max-w-lg">
            The application encountered a global error and could not be rendered.
          </p>
          <button
            onClick={() => reset()}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-lg"
          >
            Refresh Application
          </button>
        </div>
      </body>
    </html>
  );
}
