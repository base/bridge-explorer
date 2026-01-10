import {
  Address,
  Block,
  createPublicClient,
  decodeEventLog,
  ethAddress,
  Hash,
  Hex,
  http,
  Log,
  toHex,
  TransactionReceipt,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import BridgeValidator from "../../abis/BridgeValidator";
import Bridge from "../../abis/Bridge";
import ERC20 from "../../abis/ERC20";
import {
  ChainName,
  ExecuteTxDetails,
  InitialTxDetails,
  ValidationTxDetails,
} from "./transaction";
import { BaseTxContainer, TxMessageRef } from "./bridge";

const bridgeAddress: Record<number, Address> = {
  8453: "0x3eff766C76a1be2Ce1aCF2B69c78bCae257D5188", // Base Mainnet
  84532: "0x01824a90d32A69022DdAEcC6C5C14Ed08dB4EB9B", // Base Sepolia
};
const bridgeValidatorAddress: Record<number, Address> = {
  8453: "0xAF24c1c24Ff3BF1e6D882518120fC25442d6794B", // Base Mainnet
  84532: "0x863Bed3E344035253CC44C75612Ad5fDF5904aEE", // Base Sepolia
};
const bridgeStartBlock: Record<number, bigint> = {
  8453: BigInt(38692795), // Base Mainnet
  84532: BigInt(32743922), // Base Sepolia
};
const MESSAGE_SUCCESSFULLY_RELAYED_TOPIC =
  "0x68bfb2e57fcbb47277da442d81d3e40ff118cbbcaf345b07997b35f592359e49";
const FAILED_TO_RELAY_MESSAGE_TOPIC =
  "0x1dc47a66003d9a2334f04c3d23d98f174d7e65e9a4a72fa13277a15120c1559e";
const TRANSFER_INITIALIZED_TOPIC =
  "0xf1109ae3af61805fa998753209b2a90166bfc4b38ad8a6b5a268591ce18f99c0";
const TRANSFER_FINALIZED_TOPIC =
  "0x6899b9db6ebabd932aa1fc835134c9b9ca2168d78a4cbee8854b1c00c8647609";
const MESSAGE_REGISTERED_TOPIC =
  "0x5e55930eb861ee57d9b7fa9e506b7f413cb1599c9886e57f1c8091f5fee5fc33";
const MESSAGE_INITIATED_TOPIC =
  "0x877352bc1cb00627bdb5bf16a3664cfe784f66bb3c1bfef68bf5b4ae34e66599";

// Formats a big integer value given its token decimals into a human-friendly string
export function formatUnitsString(
  value: string,
  decimals: number,
  maxFractionDigits = 6
): string {
  const isNegative = value.startsWith("-");
  const digits = isNegative ? value.slice(1) : value;
  const trimmed = digits.replace(/^0+/, "") || "0";

  if (decimals === 0) {
    return (isNegative ? "-" : "") + trimmed;
  }

  const padded = trimmed.padStart(decimals + 1, "0");
  const integerPart = padded.slice(0, padded.length - decimals);
  let fractionPart = padded.slice(padded.length - decimals);

  // Trim trailing zeros, then clamp to maxFractionDigits
  fractionPart = fractionPart.replace(/0+$/, "");
  if (fractionPart.length > maxFractionDigits) {
    fractionPart = fractionPart.slice(0, maxFractionDigits);
  }

  return (
    (isNegative ? "-" : "") +
    integerPart +
    (fractionPart ? `.${fractionPart}` : "")
  );
}

export class BaseMessageDecoder {
  private baseClient = createPublicClient({
    chain: base,
    transport: http(
      process.env.BASE_MAINNET_RPC || "https://base-rpc.publicnode.com"
    ),
  });
  private baseSepoliaClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC),
  });
  private recognizedChainId: number = 0;

  private async getApproximateBlockFromTimestamp(
    timestamp: number,
    client: any
  ): Promise<bigint> {
    try {
      const currentBlock = await client.getBlock();
      const currentHeight = currentBlock.number;
      const currentTime = Number(currentBlock.timestamp);

      if (timestamp > currentTime) {
        return currentHeight;
      }

      // Base has 2s blocks
      const estimatedDiff = BigInt(Math.floor((currentTime - timestamp) / 2));
      let searchBlock = currentHeight - estimatedDiff;

      if (searchBlock < BigInt(0)) searchBlock = BigInt(0);

      // Safety buffer of 10 minutes (300 blocks)
      searchBlock = searchBlock - BigInt(300);
      if (searchBlock < BigInt(0)) searchBlock = BigInt(0);

      return searchBlock;
    } catch (e) {
      console.error("Error estimating block from timestamp", e);
      return BigInt(0);
    }
  }

  async getBaseInitTxFromMsgHash(
    msgHash: Hash,
    isMainnet: boolean,
    minTimestamp?: number
  ): Promise<InitialTxDetails> {
    this.recognizedChainId = isMainnet ? base.id : baseSepolia.id;

    const client = isMainnet ? this.baseClient : this.baseSepoliaClient;

    let fromBlock = bridgeStartBlock[this.recognizedChainId];
    if (minTimestamp) {
      const estimatedBlock = await this.getApproximateBlockFromTimestamp(
        minTimestamp,
        client
      );
      if (estimatedBlock > fromBlock) {
        fromBlock = estimatedBlock;
      }
    }

    const logs = await this.getLogsWithChunking(
      client,
      bridgeAddress[this.recognizedChainId],
      [MESSAGE_INITIATED_TOPIC as Hex, msgHash],
      fromBlock
    );

    if (logs.length === 0) {
      throw new Error("No logs found in init tx receipt");
    }

    const [log] = logs;
    if (!log.transactionHash) throw new Error("Log transaction hash is null");
    const { initTxDetails } = await this.getBaseMessageInfoFromTransactionHash(
      log.transactionHash
    );
    if (!initTxDetails) {
      throw new Error("Init tx details not found");
    }
    return initTxDetails;
  }

  async getBaseMessageInfoFromMsgHash(
    msgHash: Hash,
    isMainnet: boolean,
    minTimestamp?: number
  ): Promise<{
    validationTxDetails?: ValidationTxDetails;
    executeTxDetails?: ExecuteTxDetails;
    pubkey?: Hex;
  }> {
    this.recognizedChainId = isMainnet ? base.id : baseSepolia.id;
    const client = isMainnet ? this.baseClient : this.baseSepoliaClient;

    let fromBlock = bridgeStartBlock[this.recognizedChainId];
    if (minTimestamp) {
      const estimatedBlock = await this.getApproximateBlockFromTimestamp(
        minTimestamp,
        client
      );
      if (estimatedBlock > fromBlock) {
        fromBlock = estimatedBlock;
      }
    }

    const validationResult = await this.getValidationTxFromMsgHash(
      msgHash,
      isMainnet,
      fromBlock
    );
    const executionTx = await this.getExecutionTxFromMsgHash(
      msgHash,
      isMainnet,
      fromBlock
    );
    return {
      validationTxDetails: validationResult?.validationTx,
      executeTxDetails: executionTx,
      pubkey: validationResult?.pubkey,
    };
  }

  async getBaseMessageInfoFromTransactionHash(hash: Hash): Promise<{
    initTxDetails?: InitialTxDetails;
    validationTxDetails?: ValidationTxDetails;
    executeTxDetails?: ExecuteTxDetails;
    pubkey?: Hex;
    msgHash?: Hex;
    txContainer?: BaseTxContainer;
  }> {
    // If this returns without erroring, we know the tx is part of a bridge interaction
    const { validationTx, executeTx, messageInit, receipt, client } =
      await this.identifyBaseTx(hash);

    const msgHash = this.extractMsgHashFromReceipt(receipt);
    const isMainnet = (client.chain.id as number) === base.id;

    if (messageInit) {
      if (validationTx) {
        throw new Error("Base transaction is both init and validation");
      }
      if (executeTx) {
        throw new Error("Base transaction is both init and execution");
      }
      // Only need init details
      const initTx = await this.getInitTxFromReceipt(receipt, isMainnet);
      return { initTxDetails: initTx, msgHash };
    }
    // Destination-chain tx: treat as container of many messages
    if (validationTx || executeTx) {
      const txContainer = await this.buildTxContainerFromReceipt(
        receipt,
        client
      );
      return { txContainer };
    }

    throw new Error("Unrecognized bridge transaction type");
  }

  private async buildTxContainerFromReceipt(
    receipt: TransactionReceipt,
    client: {
      chain: { id: number; name: string };
      getBlock: (args: { blockHash: Hash }) => Promise<{ timestamp: bigint }>;
    }
  ): Promise<BaseTxContainer> {
    const block = await client.getBlock({ blockHash: receipt.blockHash });
    const preValidated: TxMessageRef[] = [];
    const executed: TxMessageRef[] = [];

    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      if (this.isValidationLog(log)) {
        const decodedData = decodeEventLog({
          abi: BridgeValidator,
          data: log.data,
          topics: log.topics,
        }) as {
          eventName: "MessageRegistered";
          args: {
            messageHash: `0x${string}`;
          };
        };
        preValidated.push({
          messageHash: decodedData.args.messageHash,
          logIndex: Number(log.logIndex ?? i),
        });
      } else if (this.isExecutionLog(log)) {
        const msgHash = (log.topics?.[2] ?? "0x") as Hex;
        executed.push({
          messageHash: msgHash,
          logIndex: Number(log.logIndex ?? i),
        });
      }
    }

    return {
      chain: client.chain.name as string,
      txHash: receipt.transactionHash,
      timestamp: new Date(Number(block.timestamp) * 1000).toString(),
      preValidated,
      executed,
    };
  }

  private async getInitTxFromReceipt(
    receipt: TransactionReceipt,
    isMainnet: boolean
  ): Promise<InitialTxDetails> {
    const client = isMainnet ? this.baseClient : this.baseSepoliaClient;

    const { logs } = receipt;

    const senderAddress = receipt.from;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      if (this.isTransferInitLog(log)) {
        const decodedData = decodeEventLog({
          abi: Bridge,
          data: log.data,
          topics: log.topics,
        }) as {
          eventName: "TransferInitialized";
          args: {
            localToken: Address;
            remoteToken: Hex;
            to: Hex;
            amount: bigint;
          };
        };

        const amount = String(decodedData.args.amount);
        const localToken = decodedData.args.localToken;

        let block: Block;
        let asset = "";
        let decimals = 18;

        if (localToken.toLowerCase() === ethAddress.toLowerCase()) {
          asset = "ETH";
          block = await client.getBlock({ blockHash: receipt.blockHash });
        } else {
          const calls: any = [
            client.getBlock({ blockHash: receipt.blockHash }),
            client.multicall({
              contracts: [
                {
                  address: localToken,
                  abi: ERC20,
                  functionName: "symbol",
                },
                {
                  address: localToken,
                  abi: ERC20,
                  functionName: "decimals",
                },
              ],
            }),
          ];
          const [blockRes, multicallResults] = await Promise.all(calls);
          block = blockRes;
          const [assetRes, decimalsRes] = multicallResults;
          if (assetRes.status === "success") {
            asset = assetRes.result;
          }
          if (decimalsRes.status === "success") {
            decimals = decimalsRes.result;
          }
        }

        return {
          amount: formatUnitsString(amount, decimals),
          asset,
          chain: client.chain.name as ChainName,
          senderAddress,
          transactionHash: receipt.transactionHash,
          timestamp: new Date(Number(block.timestamp) * 1000).toString(),
        };
      }
    }

    throw new Error("Init tx info not found in receipt");
  }

  private async identifyBaseTx(hash: Hash) {
    // Try Base mainnet first, then Base Sepolia
    let client: {
      chain: { id: number; name: string };
      getTransactionReceipt: (args: {
        hash: Hash;
      }) => Promise<TransactionReceipt>;
      getBlock: (args: { blockHash: Hash }) => Promise<{ timestamp: bigint }>;
    } = this.baseClient as any;
    let receipt: TransactionReceipt | undefined;
    try {
      receipt = await client.getTransactionReceipt({ hash });
      this.recognizedChainId = client.chain.id;
    } catch (e) {
      console.error(e);
      client = this.baseSepoliaClient as any;
      receipt = await client.getTransactionReceipt({ hash });
      this.recognizedChainId = client.chain.id;
    }
    const { logs } = receipt;

    let bridgeSeen = false;
    let validationTx = false;
    let executeTx = false;
    let messageInit = false;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      if (this.isBridgeLog(log)) {
        bridgeSeen = true;
      }

      if (this.isValidationLog(log)) {
        validationTx = true;
      } else if (this.isExecutionLog(log)) {
        executeTx = true;
      } else if (this.isMessageInitLog(log)) {
        messageInit = true;
      }
    }

    if (!bridgeSeen) {
      throw new Error("Transaction not recognized");
    }

    return { validationTx, executeTx, messageInit, receipt, client };
  }

  private async getValidationTxFromMsgHash(
    msgHash: Hex,
    isMainnet: boolean,
    fromBlock: bigint
  ): Promise<{ validationTx: ValidationTxDetails; pubkey: Hex } | undefined> {
    const client = isMainnet ? this.baseClient : this.baseSepoliaClient;

    const logs = await this.getLogsWithChunking(
      client,
      bridgeValidatorAddress[this.recognizedChainId],
      [MESSAGE_REGISTERED_TOPIC as Hex, msgHash],
      fromBlock
    );

    if (logs.length === 0) {
      return undefined;
    }

    const [log] = logs;
    if (!log.blockHash || !log.transactionHash) {
      throw new Error("Log blockHash or transactionHash is null");
    }
    const prevalidatedBlockHash = log.blockHash;
    const prevalidatedTransactionHash = log.transactionHash;
    const block = await client.getBlock({
      blockHash: prevalidatedBlockHash,
    });
    const prevalidatedTimestamp = block.timestamp;
    const pubkey = this.extractPubkeyFromLog(log);
    return {
      validationTx: {
        chain: client.chain.name as ChainName,
        transactionHash: prevalidatedTransactionHash,
        timestamp: new Date(Number(prevalidatedTimestamp) * 1000).toString(),
      },
      pubkey,
    };
  }

  async getExecutionTxFromReceipt(
    receipt: TransactionReceipt,
    isMainnet: boolean
  ): Promise<ExecuteTxDetails> {
    const client = isMainnet ? this.baseClient : this.baseSepoliaClient;

    const { logs } = receipt;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      if (this.isTransferExecutionLog(log)) {
        const decodedData = decodeEventLog({
          abi: Bridge,
          data: log.data,
          topics: log.topics,
        }) as {
          eventName: string;
          args: {
            localToken: `0x${string}`;
            remoteToken: `0x${string}`;
            to: `0x${string}`;
            amount: bigint;
          };
        };
        const amount = String(decodedData.args.amount);
        const receiverAddress = String(decodedData.args.to);
        const localToken = decodedData.args.localToken;

        const calls: any = [
          client.getBlock({ blockHash: receipt.blockHash }),
          client.multicall({
            contracts: [
              {
                address: localToken,
                abi: ERC20,
                functionName: "symbol",
              },
              {
                address: localToken,
                abi: ERC20,
                functionName: "decimals",
              },
            ],
          }),
        ];

        let asset: string = localToken;
        let decimals = 18;

        if (asset.toLowerCase() === ethAddress) {
          asset = "ETH";
        }

        const [block, multicallResults] = await Promise.all(calls);
        const [assetRes, decimalsRes] = multicallResults;
        if (assetRes.status === "success") {
          asset = assetRes.result;
        }
        if (decimalsRes.status === "success") {
          decimals = decimalsRes.result;
        }

        return {
          status: "success",
          amount: formatUnitsString(amount, decimals),
          asset,
          chain: client.chain.name as ChainName,
          receiverAddress,
          transactionHash: receipt.transactionHash,
          timestamp: new Date(Number(block.timestamp) * 1000).toString(),
        };
      }
    }

    throw new Error("Execution tx info not found in receipt");
  }

  private async getExecutionTxFromMsgHash(
    msgHash: Hex,
    isMainnet: boolean,
    fromBlock: bigint
  ): Promise<ExecuteTxDetails | undefined> {
    const chainId = isMainnet ? base.id : baseSepolia.id;
    const chainName = isMainnet ? ChainName.Base : ChainName.BaseSepolia;
    const client = isMainnet ? this.baseClient : this.baseSepoliaClient;

    const deliveredLogs = await this.getLogsWithChunking(
      client,
      bridgeAddress[chainId],
      [MESSAGE_SUCCESSFULLY_RELAYED_TOPIC as Hex, null, msgHash],
      fromBlock
    );

    if (deliveredLogs.length === 0) {
      // Check if attempted
      const failureLogs = await this.getLogsWithChunking(
        client,
        bridgeAddress[chainId],
        [FAILED_TO_RELAY_MESSAGE_TOPIC as Hex, null, msgHash],
        fromBlock
      );

      if (failureLogs.length > 0) {
        // Message execution was attempted but failed
        return {
          status: "failed",
          amount: "0",
          asset: "",
          chain: chainName,
          receiverAddress: "",
          transactionHash: "",
          timestamp: "",
        };
      }
      return undefined;
    }

    const [log] = deliveredLogs;
    if (!log.transactionHash) throw new Error("Log transaction hash is null");
    const executedTransactionHash = log.transactionHash;
    const receipt = await client.getTransactionReceipt({
      hash: executedTransactionHash,
    });
    return await this.getExecutionTxFromReceipt(receipt, isMainnet);
  }

  private isBridgeLog(log: Log): boolean {
    return (
      log.address.toLowerCase() ===
        bridgeValidatorAddress[this.recognizedChainId].toLowerCase() ||
      log.address.toLowerCase() ===
        bridgeAddress[this.recognizedChainId].toLowerCase()
    );
  }

  private isValidationLog(log: Log): boolean {
    return (
      log.address.toLowerCase() ===
        bridgeValidatorAddress[this.recognizedChainId].toLowerCase() &&
      log.topics[0] === MESSAGE_REGISTERED_TOPIC
    );
  }

  private isExecutionLog(log: Log): boolean {
    return (
      log.address.toLowerCase() ===
        bridgeAddress[this.recognizedChainId].toLowerCase() &&
      log.topics[0] === MESSAGE_SUCCESSFULLY_RELAYED_TOPIC
    );
  }

  private isTransferInitLog(log: Log): boolean {
    return (
      log.address.toLowerCase() ===
        bridgeAddress[this.recognizedChainId].toLowerCase() &&
      log.topics[0] === TRANSFER_INITIALIZED_TOPIC
    );
  }

  private isTransferExecutionLog(log: Log): boolean {
    return (
      log.address.toLowerCase() ===
        bridgeAddress[this.recognizedChainId].toLowerCase() &&
      log.topics[0] === TRANSFER_FINALIZED_TOPIC
    );
  }

  private isMessageInitLog(log: Log): boolean {
    return (
      log.address.toLowerCase() ===
        bridgeAddress[this.recognizedChainId].toLowerCase() &&
      log.topics[0] === MESSAGE_INITIATED_TOPIC
    );
  }

  private extractMsgHashFromReceipt(receipt: TransactionReceipt): Hex {
    const { logs } = receipt;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      if (this.isValidationLog(log)) {
        const decodedData = decodeEventLog({
          abi: BridgeValidator,
          data: log.data,
          topics: log.topics,
        }) as {
          eventName: "MessageRegistered";
          args: {
            messageHash: `0x${string}`;
            outgoingMessagePubkey: `0x${string}`;
          };
        };
        return decodedData.args.messageHash as Hex;
      } else if (this.isExecutionLog(log)) {
        if (log.topics && log.topics.length > 2) {
          return log.topics[2] as Hex;
        }
      } else if (this.isMessageInitLog(log)) {
        if (log.topics && log.topics.length > 1) {
          return log.topics[1] as Hex;
        }
      }
    }

    throw new Error("Message hash not found in receipt");
  }

  private extractPubkeyFromReceipt(receipt: TransactionReceipt): Hex {
    const { logs } = receipt;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      if (this.isValidationLog(log)) {
        return this.extractPubkeyFromLog(log);
      }
    }

    throw new Error("Pubkey not found in receipt");
  }

  private extractPubkeyFromLog(log: {
    data: Hex;
    topics: [] | readonly Hex[] | Hex[];
  }): Hex {
    const decodedData = decodeEventLog({
      abi: BridgeValidator,
      data: log.data,
      topics: log.topics as any,
    }) as {
      eventName: "MessageRegistered";
      args: {
        messageHash: `0x${string}`;
        outgoingMessagePubkey: `0x${string}`;
      };
    };
    return decodedData.args.outgoingMessagePubkey;
  }

  private async getLogsWithChunking(
    client: any,
    address: Address,
    topics: any[],
    fromBlock: bigint
  ) {
    const currentBlock = await client.getBlockNumber();
    const chunkSize = BigInt(10000);
    const logs: any[] = [];

    const chunks: { from: bigint; to: bigint }[] = [];
    for (let i = fromBlock; i <= currentBlock; i += chunkSize) {
      const end =
        i + chunkSize - BigInt(1) > currentBlock
          ? currentBlock
          : i + chunkSize - BigInt(1);
      chunks.push({ from: i, to: end });
    }

    // Process chunks in batches
    const BATCH_SIZE = 3;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ({ from, to }) => {
          try {
            return await client.request({
              method: "eth_getLogs",
              params: [
                {
                  address,
                  topics,
                  fromBlock: toHex(from),
                  toBlock: toHex(to),
                },
              ],
            });
          } catch (e) {
            console.error(`Failed to fetch logs for range ${from}-${to}:`, e);
            throw e;
          }
        })
      );
      results.forEach((r) => logs.push(...r));
    }
    return logs;
  }
}
