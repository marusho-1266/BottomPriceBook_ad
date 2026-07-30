import type { Category, WithId } from '../../types/models';
import { ProductForm } from './ProductForm';
import { addProduct } from './api';

/**
 * 価格記録画面のピッカー内から商品を新規登録し、そのまま選択させる。
 * PC のコンボボックスとモバイルのボトムシートの両方から使う。
 */
export function NewProductForm({
  bookId,
  categories,
  onCreated,
}: {
  bookId: string;
  categories: WithId<Category>[];
  onCreated: (productId: string) => void;
}) {
  return (
    <ProductForm
      categories={categories}
      submitLabel="登録して選択"
      onSubmit={async (values) => {
        const id = await addProduct(bookId, values);
        onCreated(id);
      }}
    />
  );
}
