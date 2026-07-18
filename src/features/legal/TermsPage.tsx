import { CONTACT_FORM_URL } from './contact';
import { LegalLayout, LegalSection } from './LegalLayout';

// ドラフト文面(Issue #14 T2)。事業者表記・制定日はユーザーレビューで確定(T7)
export function TermsPage() {
  return (
    <LegalLayout title="利用規約">
      <p>
        本利用規約(以下「本規約」)は、そこねこ運営者(以下「運営者」)が提供する
        底値帳アプリ「そこねこ」(以下「本サービス」)の利用条件を定めるものです。
        利用者は、本サービスを利用することにより、本規約に同意したものとみなします。
      </p>

      <LegalSection title="1. アカウント">
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの利用にはアカウント登録(メールアドレスまたは Google アカウント)が必要です</li>
          <li>ログイン情報は利用者自身の責任で管理してください</li>
          <li>アカウントはいつでも設定画面の退会機能から削除できます</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. 禁止事項">
        <p>利用者は、以下の行為をしてはなりません。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>不正アクセス、本サービスの運営を妨害する行為</li>
          <li>他の利用者への迷惑行為(共有機能の濫用を含む)</li>
          <li>法令または公序良俗に違反する行為</li>
          <li>本サービスを商用目的で無断利用する行為</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. サービスの提供・変更・終了">
        <p>
          本サービスは個人が運営する無料のサービスです。運営者は、事前の通知なく、
          本サービスの内容の変更、提供の中断または終了を行うことがあります。
          終了する場合は、可能な範囲で事前にお知らせするよう努めます。
        </p>
      </LegalSection>

      <LegalSection title="4. 免責事項">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            本サービスに記録される価格等の情報は利用者自身が入力するものであり、
            運営者はその正確性・有用性を保証しません
          </li>
          <li>
            運営者は、本サービスの利用または利用不能により生じた損害について、
            運営者に故意または重過失がある場合を除き、責任を負いません
          </li>
          <li>データの保全には努めますが、バックアップの完全性は保証されません</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. 知的財産">
        <p>
          本サービスに関する知的財産権は運営者または正当な権利者に帰属します。
          利用者が入力したデータの権利は利用者に帰属します。
        </p>
      </LegalSection>

      <LegalSection title="6. 規約の変更">
        <p>
          運営者は、必要に応じて本規約を変更することがあります。重要な変更を行う場合は、
          本サービス上でお知らせします。変更後に本サービスを利用した場合、
          変更後の規約に同意したものとみなします。
        </p>
      </LegalSection>

      <LegalSection title="7. 準拠法・管轄">
        <p>
          本規約は日本法に準拠します。本サービスに関して紛争が生じた場合は、
          運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
      </LegalSection>

      <LegalSection title="8. お問い合わせ">
        <p>
          本規約に関するお問い合わせは、
          <a
            href={CONTACT_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary-deep underline"
          >
            お問い合わせフォーム
          </a>
          からお願いします。
        </p>
      </LegalSection>

      <p className="pt-2 text-xs text-ink-faint">2026 年 7 月 18 日 制定</p>
    </LegalLayout>
  );
}
