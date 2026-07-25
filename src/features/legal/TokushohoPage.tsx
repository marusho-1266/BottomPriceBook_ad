import { CONTACT_FORM_URL } from './contact';
import { LegalLayout, LegalSection } from './LegalLayout';
import { LIFETIME_PRICE_JPY } from '../license/pricing';

/**
 * 特定商取引法に基づく表記（Issue #37）。
 * 事業者の実値は公開前に差し替え必須（プレースホルダ）。
 */
export function TokushohoPage() {
  return (
    <LegalLayout title="特定商取引法に基づく表記">
      <LegalSection title="販売業者">
        {/* 公開前差し替え: 正式な販売業者名 */}
        <p>【公開前差し替え】販売業者名（個人事業主の氏名または屋号）</p>
      </LegalSection>

      <LegalSection title="運営責任者">
        {/* 公開前差し替え: 運営責任者名 */}
        <p>【公開前差し替え】運営責任者名</p>
      </LegalSection>

      <LegalSection title="所在地">
        {/* 公開前差し替え: 所在地。請求があれば遅滞なく開示する旨でも可 */}
        <p>【公開前差し替え】所在地（都道府県・市区町村以降）</p>
      </LegalSection>

      <LegalSection title="連絡先">
        <p>
          お問い合わせは
          <a
            href={CONTACT_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-1 font-bold text-primary-deep underline"
          >
            お問い合わせフォーム
          </a>
          よりご連絡ください。
        </p>
      </LegalSection>

      <LegalSection title="販売価格">
        <p>
          買い切りライセンス: 税込 ¥{LIFETIME_PRICE_JPY.toLocaleString('ja-JP')}（一回払い）
        </p>
      </LegalSection>

      <LegalSection title="商品の対価以外に必要な料金">
        <p>インターネット接続料金等は利用者の負担となります。</p>
      </LegalSection>

      <LegalSection title="支払方法">
        <p>クレジットカード等（決済代行: Stripe 経由）</p>
      </LegalSection>

      <LegalSection title="支払時期">
        <p>購入手続き完了時に決済されます。</p>
      </LegalSection>

      <LegalSection title="役務の提供時期">
        <p>決済完了後、ただちに買い切りライセンス（lifetime）を付与します。</p>
      </LegalSection>

      <LegalSection title="返品・キャンセル">
        <p>
          デジタルコンテンツの性質上、購入後の返品・キャンセルは原則お受けできません。
          サービス不具合等により利用できない場合は、お問い合わせフォームよりご連絡ください。
          個別に対応します。
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
