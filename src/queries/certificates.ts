// AI-generated (Claude)
// The Cards tab: the diver's SSI certification cards, and the Wallet signing
// certificate that turns one into a pass.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { fetchSsiCards, type SsiCards } from '@/lib/ssi/certificates';
import { queryKeys } from '@/lib/query-keys';
import { addCardToWallet } from '@/lib/wallet/add-to-wallet';
import { deletePassIdentity, readPassIdentity, savePassIdentity } from '@/lib/wallet/identity';
import type { PassIdentityInfo } from '@/lib/wallet/signing';
import type { SsiCertificate } from '@/models/ssi/certificates';

/**
 * Cards change only when a course is finished, so an hour is fresh enough; a
 * pull to refresh asks again. Kept for the session so the tab opens at once.
 */
export function useSsiCards(enabled = true): UseQueryResult<SsiCards> {
  return useQuery({
    queryKey: queryKeys.ssiCards(),
    queryFn: ({ signal }) => fetchSsiCards(signal),
    enabled,
    staleTime: 60 * 60 * 1000,
    gcTime: Infinity,
    retry: 1,
  });
}

export function useSsiCard(id: string): { card: SsiCertificate | null; holder: string | null; query: UseQueryResult<SsiCards> } {
  const query = useSsiCards();
  return {
    card: query.data?.cards.find((card) => card.id === id) ?? null,
    holder: query.data?.holder ?? null,
    query,
  };
}

/** What the stored certificate is, never the key: that stays in the keychain. */
export function useWalletIdentity(): UseQueryResult<PassIdentityInfo | null> {
  return useQuery({
    queryKey: queryKeys.walletIdentity(),
    queryFn: async () => {
      const identity = await readPassIdentity();
      return identity === null
        ? null
        : {
            passTypeIdentifier: identity.passTypeIdentifier,
            teamIdentifier: identity.teamIdentifier,
            name: identity.name,
            expiresAt: identity.expiresAt,
          };
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useImportWalletIdentity(): UseMutationResult<
  PassIdentityInfo,
  Error,
  { p12Base64: string; password: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ p12Base64, password }) => {
      // Decrypting a .p12 is a few hundred milliseconds of JS; let the spinner show first.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const { passTypeIdentifier, teamIdentifier, name, expiresAt } = await savePassIdentity(p12Base64, password);
      return { passTypeIdentifier, teamIdentifier, name, expiresAt };
    },
    onSuccess: (info) => client.setQueryData(queryKeys.walletIdentity(), info),
  });
}

export function useRemoveWalletIdentity(): UseMutationResult<void, Error, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => deletePassIdentity(),
    onSuccess: () => client.setQueryData(queryKeys.walletIdentity(), null),
  });
}

export function useAddCardToWallet(): UseMutationResult<
  boolean,
  Error,
  { card: SsiCertificate; holder: string | null }
> {
  return useMutation({
    mutationFn: ({ card, holder }) => addCardToWallet(card, holder),
  });
}
