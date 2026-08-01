import { Cat, Pencil, Scale, Trophy } from 'lucide-react';
import { Link } from 'react-router';

const FEATURES = [
  {
    icon: Pencil,
    title: '価格を記録',
    body: '店頭でその場入力。オフラインでも書けます',
  },
  {
    icon: Trophy,
    title: '底値を確認',
    body: '商品ごとの最安値と店舗が一覧でわかります',
  },
  {
    icon: Scale,
    title: '単価で比較',
    body: '内容量が違っても 100g あたり等で比べられます',
  },
] as const;

function CtaLink({ className }: { className: string }) {
  return (
    <Link to="/" className={className}>
      無料で始める
    </Link>
  );
}

/** 宣伝用 LP。未ログインでも閲覧可。CTA はログイン画面へ(Issue #31) */
export function WelcomePage() {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <section className="flex flex-col items-center gap-3 rounded-b-[28px] bg-primary px-6 pt-16 pb-10 text-center text-white">
        <Cat aria-hidden className="size-14 text-white" strokeWidth={1.8} />
        <h1 className="text-3xl font-extrabold tracking-wider">そこねこ</h1>
        <h2 className="max-w-sm text-lg font-extrabold leading-snug">
          店頭で、その場で底値がわかる
        </h2>
        <p className="max-w-sm text-sm font-bold leading-relaxed text-white/80">
          スーパーやドラッグストアで見かけた価格を記録して、商品ごとの底値と店舗を一目で確認できる底値帳アプリです。
        </p>
        <CtaLink className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-white px-8 text-sm font-extrabold text-primary active:bg-surface-alt" />
      </section>

      <div className="mx-auto flex w-full max-w-md flex-col gap-10 px-6 py-10">
        <section aria-labelledby="welcome-features" className="flex flex-col gap-5">
          <h2 id="welcome-features" className="text-base font-extrabold">
            できること
          </h2>
          <ul className="flex flex-col gap-5">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-5" strokeWidth={2.2} />
                </span>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-sm font-extrabold">{title}</h3>
                  <p className="text-xs font-bold leading-relaxed text-ink-sub">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="welcome-usage" className="flex flex-col gap-2">
          <h2 id="welcome-usage" className="text-base font-extrabold">
            利用イメージ
          </h2>
          <p className="text-sm font-bold leading-relaxed text-ink-sub">
            買い物中にスマホでサッと記録。帰宅後や次の買い物前に、底値と特売を見比べて「今は買いか」を判断できます。
          </p>
        </section>

        <footer className="flex flex-col items-center gap-4 border-t border-line-strong pt-8 pb-4">
          <CtaLink className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-extrabold text-white active:bg-primary-deep" />
          <div className="flex items-center gap-4 text-[11px] font-bold text-ink-faint">
            <Link to="/terms" className="underline">
              利用規約
            </Link>
            <Link to="/privacy" className="underline">
              プライバシーポリシー
            </Link>
          </div>
          <p className="text-[11px] font-bold text-ink-faint">そこねこ運営者</p>
        </footer>
      </div>
    </main>
  );
}
