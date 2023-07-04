import type { Account } from '../../accounts/types.js'
import { parseAccount } from '../../accounts/utils/parseAccount.js'
import type { WalletClient } from '../../clients/createWalletClient.js'
import type { Transport } from '../../clients/transports/createTransport.js'
import { AccountNotFoundError } from '../../errors/account.js'
import type { GetAccountParameter } from '../../types/account.js'
import type { Chain, GetChain } from '../../types/chain.js'
import { type RpcTransactionRequest } from '../../types/rpc.js'
import type {
  TransactionRequest,
  TransactionSerializable,
  TransactionSerialized,
} from '../../types/transaction.js'
import type { UnionOmit } from '../../types/utils.js'
import { assertCurrentChain } from '../../utils/chain.js'
import {
  type FormattedTransactionRequest,
  formatTransactionRequest,
} from '../../utils/formatters/transactionRequest.js'
import { numberToHex } from '../../utils/index.js'
import { assertRequest } from '../../utils/transaction/assertRequest.js'
import { getChainId } from '../public/getChainId.js'

export type SignTransactionParameters<
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
  TChainOverride extends Chain | undefined = Chain,
> = UnionOmit<FormattedTransactionRequest<TChainOverride | TChain>, 'from'> &
  GetAccountParameter<TAccount> & { prepare?: boolean } & (
    | (GetChain<TChain, TChainOverride> & {
        chainId?: never
      })
    | {
        chainId: number
        chain?: never
      }
  )

export type SignTransactionReturnType = TransactionSerialized

export async function signTransaction<
  TChain extends Chain | undefined,
  TAccount extends Account | undefined,
  TTransactionSerializable extends TransactionSerializable,
  TChainOverride extends Chain | undefined,
>(
  client: WalletClient<Transport, TChain, TAccount>,
  args: SignTransactionParameters<TChain, TAccount, TChainOverride>,
): Promise<SignTransactionReturnType> {
  const {
    account: account_ = client.account,
    chain = client.chain,
    ...transaction
  } = args

  if (!account_)
    throw new AccountNotFoundError({
      docsPath: '/docs/actions/wallet/signMessage',
    })
  const account = parseAccount(account_)

  assertRequest({
    account,
    ...args,
  })

  const chainId = await getChainId(client)
  if (chain !== null)
    assertCurrentChain({
      currentChainId: chainId,
      chain,
    })

  const formatters = chain?.formatters || client.chain?.formatters
  const format =
    formatters?.transactionRequest?.format || formatTransactionRequest

  if (account.type === 'local')
    return account.signTransaction(
      {
        chainId,
        ...transaction,
      } as unknown as TTransactionSerializable,
      { serializer: client.chain?.serializers?.transaction },
    ) as Promise<SignTransactionReturnType>

  return await client.request({
    method: 'eth_signTransaction',
    params: [
      {
        chainId: numberToHex(chainId),
        ...format(transaction as unknown as TransactionRequest),
      } as unknown as RpcTransactionRequest,
    ],
  })
}
