"use client";

import { useState } from "react";
import { BridgeQueryResult } from "@/lib/bridge";
import { Header } from "@/components/Header";
import { InputForm } from "@/components/InputForm";
import { Results } from "@/components/Results";
import { Footer } from "@/components/Footer";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function Home() {
  const [result, setResult] = useState<BridgeQueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetResult = (r: BridgeQueryResult | null) => {
    setError(null);
    setResult(r);
  };

  const handleError = (message: string) => {
    setError(message);
    setResult(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-8 py-20 pb-24">
      <main className="relative w-full max-w-3xl md:max-w-4xl">
        <Header />

        <InputForm
          setResult={handleSetResult}
          setIsLoading={setIsLoading}
          setError={handleError}
        />

        {error && (
          <ErrorMessage
            title="Transaction Not Found"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {isLoading && !result && <LoadingSkeleton />}

        {!isLoading && <Results result={result} setResult={handleSetResult} />}
      </main>
      <Footer />
    </div>
  );
}
