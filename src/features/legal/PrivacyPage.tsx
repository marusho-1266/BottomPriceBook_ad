import { CONTACT_FORM_URL } from './contact';
import { LegalLayout, LegalSection } from './LegalLayout';

// ドラフト文面(Issue #14 T2)。事業者表記・制定日はユーザーレビューで確定(T7)
export function PrivacyPage() {
  return (
    <LegalLayout title="プライバシーポリシー">
      <p>
        そこねこ運営者(以下「運営者」)は、底値帳アプリ「そこねこ」(以下「本サービス」)における
        利用者の情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
      </p>

      <LegalSection title="1. 収集する情報">
        <p>本サービスは、以下の情報を収集します。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-bold">アカウント情報</span>
            :メールアドレス、および Google アカウントでログインした場合はその表示名。
            認証基盤(Firebase Authentication)で管理します
          </li>
          <li>
            <span className="font-bold">利用者が入力したデータ</span>
            :商品・価格の記録、店舗・カテゴリの名称など、本サービスの機能として保存した内容
            (Cloud Firestore に保存されます)
          </li>
          <li>
            <span className="font-bold">利用状況</span>
            :アクセス解析(Firebase Analytics)による閲覧ページ・機能の利用状況。
            個人を特定する情報や入力内容そのものは含まれません
          </li>
          <li>
            <span className="font-bold">エラー情報</span>
            :不具合調査のためのエラー内容(Sentry)。メールアドレス等の個人情報は
            送信しないよう設定しています
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの提供・維持(ログイン、データの保存・共有)</li>
          <li>品質改善(利用状況の把握、機能改善の検討)</li>
          <li>不具合の調査・対応</li>
          <li>お問い合わせへの対応</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. 第三者提供">
        <p>
          法令に基づく場合を除き、収集した情報を第三者に提供することはありません。
          なお、本サービスの運営に必要な範囲で、以下の外部サービスに情報の処理を委託しています。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Google(Firebase:認証・データベース・アクセス解析)</li>
          <li>Sentry(エラー情報の収集)</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Cookie 等の利用">
        <p>
          本サービスは、ログイン状態の維持およびアクセス解析のために、Cookie
          および類似技術(ローカルストレージ等)を利用します。
        </p>
      </LegalSection>

      <LegalSection title="5. データの保存期間と削除">
        <p>
          収集した情報は、アカウントが存在する間保存されます。設定画面の退会機能により、
          アカウントと保存されたデータ(単独で利用している底値帳の記録を含む)を削除できます。
        </p>
      </LegalSection>

      <LegalSection title="6. ポリシーの変更">
        <p>
          本ポリシーの内容は、必要に応じて変更することがあります。重要な変更を行う場合は、
          本サービス上でお知らせします。
        </p>
      </LegalSection>

      <LegalSection title="7. お問い合わせ">
        <p>
          本ポリシーおよび個人情報の取り扱いに関するお問い合わせは、以下のフォームからお願いします。
        </p>
        <p>
          <a
            href={CONTACT_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary-deep underline"
          >
            お問い合わせフォーム
          </a>
        </p>
      </LegalSection>

      <p className="pt-2 text-xs text-ink-faint">2026 年 7 月 18 日 制定</p>
    </LegalLayout>
  );
}
