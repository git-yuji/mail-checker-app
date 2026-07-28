export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-5">
          <p className="text-lg font-bold">メール設定診断</p>
        </div>
      </header>

      <main>
        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-bold tracking-widest text-blue-600">
              MAIL CONFIGURATION CHECKER
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              メール設定を
              <span className="text-blue-600">簡単にチェック</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl leading-8 text-slate-600">
              ドメインを入力すると、SPF・DMARC・MXレコードなどの
              メールに関するDNS設定を確認できます。
            </p>

            <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <form className="flex flex-col gap-4 sm:flex-row">
                <label htmlFor="domain" className="sr-only">
                  ドメイン
                </label>

                <input
                  id="domain"
                  name="domain"
                  type="text"
                  placeholder="example.com"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  診断する
                </button>
              </form>

              <p className="mt-4 text-left text-sm text-slate-500">
                URLではなく、example.comのようにドメインのみ入力してください。
              </p>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold">確認できる項目</h2>

              <p className="mt-3 text-slate-600">
                メール送受信に関係する主要なDNSレコードを確認します。
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-bold text-blue-600">SPF</p>

                <h3 className="mt-2 text-lg font-bold">送信元サーバーの確認</h3>

                <p className="mt-3 leading-7 text-slate-600">
                  メールを送信できるサーバーが正しく設定されているか確認します。
                </p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-bold text-blue-600">DMARC</p>

                <h3 className="mt-2 text-lg font-bold">なりすまし対策の確認</h3>

                <p className="mt-3 leading-7 text-slate-600">
                  SPFやDKIMの認証に失敗したメールの扱いを確認します。
                </p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-bold text-blue-600">MX</p>

                <h3 className="mt-2 text-lg font-bold">受信サーバーの確認</h3>

                <p className="mt-3 leading-7 text-slate-600">
                  メールを受信するサーバーが設定されているか確認します。
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white px-6 py-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold">ご利用にあたって</h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              本ツールの診断結果は参考情報です。実際にDNSやメール設定を変更する際は、
              ご利用中のサーバー会社やメールサービスの公式情報もご確認ください。
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-900 px-6 py-6 text-center text-sm text-slate-400">
        <p>© 2026 Mail Configuration Checker</p>
      </footer>
    </div>
  );
}
