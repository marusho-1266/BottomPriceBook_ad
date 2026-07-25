import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDoc } from '../../lib/firestoreHooks';
import type { LicenseStatus, UserLicense } from '../../types/models';
import { resolveLicenseStatus } from './policy';

interface UserDoc {
  license?: UserLicense;
}

/** 本人の users/{uid}.license を購読。欠落・未作成は free */
export function useUserLicense(uid: string | undefined): {
  status: LicenseStatus;
  loading: boolean;
} {
  const ref = useMemo(() => (uid ? doc(db, 'users', uid) : null), [uid]);
  const { data, loading } = useDoc<UserDoc>(ref);
  return {
    status: resolveLicenseStatus(data?.license),
    loading: Boolean(uid) && loading,
  };
}
