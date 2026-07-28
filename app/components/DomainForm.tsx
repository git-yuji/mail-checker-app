"use client";

import { FormEvent, useState } from "react";

type ApiResponse = {
  status: "success" | "error";
  domain?: string;
  message: string;
};

export default function DomainForm() {
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDomain = domain.trim();

    if (!trimmedDomain) {
      setError("ドメインを入力してください。");
      setResult(null);
      return;
    }

    if (!isValidDomain(trimmedDomain)) {
      setError("example.comのような形式で入力してください。");
      setResult(null);
      return;
    }

    setError("");
    setResult(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: trimmedDomain,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      setResult(data);
    } catch {
      setError("通信に失敗しました。時間を置いて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="domain" className="sr-only">
            ドメイン
          </label>

          <input
            id="domain"
            name="domain"
            type="text"
            value={domain}
            onChange={(event) => {
              setDomain(event.target.value);
              setError("");
            }}
            placeholder="example.com"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />

          {error && (
            <p className="mt-2 text-left text-sm text-red-600">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="h-fit rounded-lg bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isLoading ? "診断中..." : "診断する"}
        </button>
      </form>

      {result && (
        <div className="mt-6 rounded-lg bg-slate-100 p-4 text-left">
          <p className="text-sm text-slate-500">APIからのレスポンス</p>

          <p className="mt-2 font-bold text-slate-900">{result.message}</p>

          {result.domain && (
            <p className="mt-1 text-slate-700">{result.domain}</p>
          )}
        </div>
      )}
    </div>
  );
}

function isValidDomain(domain: string) {
  const domainPattern =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

  return domainPattern.test(domain);
}
