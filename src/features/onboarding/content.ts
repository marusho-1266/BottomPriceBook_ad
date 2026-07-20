import { BarChart3, Home, Plus, Share2, type LucideIcon } from 'lucide-react';

export interface OnboardingSlide {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    icon: Plus,
    title: '価格を記録しよう',
    description: '店頭で見かけた商品の価格を、その場でサッと記録できます。',
  },
  {
    icon: Home,
    title: 'ホームで底値をチェック',
    description: '商品ごとの底値と、どの店が一番安いかが一覧でわかります。',
  },
  {
    icon: BarChart3,
    title: 'カテゴリ内で比較',
    description: '同じカテゴリの商品を単価で横断比較して、お得な商品を見つけられます。',
  },
  {
    icon: Share2,
    title: '底値帳を共有しよう',
    description: '招待コードで家族や友人と底値帳を共有できます。',
  },
];
