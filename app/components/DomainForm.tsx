"use client";

import { FormEvent, useState } from "react";

export default function DomainForm() {
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [submittedDomain, setSubmittedDomain] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDomain = domain.trim();

    if (!trimmedDomain) {
      setError("ドメインを入力してください。");
      setSubmittedDomain("");
      return;
    }

    if (!isValidDomain(trimmedDomain)) {
      setError("example.comのような形式で入力してください。");
      setSubmittedDomain("");
      return;
    }

    setError("");
    setSubmittedDomain(trimmedDomain);
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
          className="h-fit rounded-lg bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
        >
          診断する
        </button>
      </form>

      {submittedDomain && (
        <div className="mt-6 rounded-lg bg-slate-100 p-4 text-left">
          <p className="text-sm text-slate-500">入力されたドメイン</p>

          <p className="mt-1 font-bold text-slate-900">{submittedDomain}</p>
        </div>
      )}
    </div>
  );
}

function isValidDomain(domain: string) {
  const domainPattern =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

  return domainPattern.test(domain);
}
