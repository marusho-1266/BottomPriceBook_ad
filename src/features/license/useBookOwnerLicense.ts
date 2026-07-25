import { useBook } from '../books/BookProvider';
import { resolveLicenseStatus } from './policy';
import type { LicenseStatus } from '../../types/models';

/** 現在の帳の実効ライセンス（オーナーのミラー）。欠落は free */
export function useBookOwnerLicense(): LicenseStatus {
  const { book } = useBook();
  return resolveLicenseStatus(
    book?.ownerLicenseStatus ? { status: book.ownerLicenseStatus } : null,
  );
}
