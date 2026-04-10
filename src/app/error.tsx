'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Something went wrong</h2>
      <p className="text-sm text-gray-500">{error.message ?? 'An unexpected error occurred.'}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
