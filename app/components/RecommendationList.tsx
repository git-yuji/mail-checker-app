import type {
  Recommendation,
  RecommendationLevel,
} from "@/app/types/dns";

type RecommendationListProps = {
  recommendations: Recommendation[];
};

const levelConfig: Record<
  RecommendationLevel,
  {
    label: string;
    cardClass: string;
    badgeClass: string;
  }
> = {
  info: {
    label: "参考",
    cardClass: "border-blue-200 bg-blue-50",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  warning: {
    label: "要確認",
    cardClass: "border-yellow-200 bg-yellow-50",
    badgeClass: "bg-yellow-100 text-yellow-700",
  },
  important: {
    label: "優先対応",
    cardClass: "border-red-200 bg-red-50",
    badgeClass: "bg-red-100 text-red-700",
  },
};

export default function RecommendationList({
  recommendations,
}: RecommendationListProps) {
  if (recommendations.length === 0) {
    return (
      <section className="rounded-lg border border-green-200 bg-green-50 p-5">
        <h2 className="font-bold text-green-900">
          現時点で優先して確認する項目はありません
        </h2>
        <p className="mt-2 text-sm text-green-800">
          今回確認したMX・SPF・DMARCには、大きな問題は見つかりませんでした。
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="recommendations-heading">
      <div>
        <h2
          id="recommendations-heading"
          className="text-lg font-bold text-slate-900"
        >
          次に確認すること
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          診断結果をもとに、確認をおすすめする項目です。
        </p>
      </div>

      <div className="space-y-3">
        {recommendations.map((recommendation) => {
          const config = levelConfig[recommendation.level];

          return (
            <article
              key={recommendation.id}
              className={`rounded-lg border p-5 ${config.cardClass}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-bold text-slate-900">
                  {recommendation.title}
                </h3>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${config.badgeClass}`}
                >
                  {config.label}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {recommendation.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
