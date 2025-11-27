import {
  Account,
  address,
  Address,
  createSolanaRpc,
  devnet,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  getBase58Codec,
  getProgramDerivedAddress,
  mainnet,
  MaybeEncodedAccount,
  ReadonlyUint8Array,
  RpcDevnet,
  RpcMainnet,
  Signature,
  SolanaRpcApiDevnet,
  SolanaRpcApiMainnet,
} from "@solana/kit";
import {
  BridgeSolanaToBaseStateOutgoingMessageTransfer,
  decodeIncomingMessage,
  decodeOutgoingMessage,
  fetchIncomingMessage,
  fetchOutgoingMessage,
  getIncomingMessageDiscriminatorBytes,
  getOutgoingMessageDiscriminatorBytes,
  getOutputRootDiscriminatorBytes,
  getRelayMessageDiscriminatorBytes,
  getBridgeSolDiscriminatorBytes,
  parseBridgeSolInstruction,
  getBridgeSolWithBufferedCallDiscriminatorBytes,
  parseBridgeSolWithBufferedCallInstruction,
  getBridgeSplDiscriminatorBytes,
  parseBridgeSplInstruction,
  getBridgeWrappedTokenDiscriminatorBytes,
  parseBridgeWrappedTokenInstruction,
  getProveMessageDiscriminatorBytes,
  parseProveMessageInstruction,
  getProveMessageBufferedDiscriminatorBytes,
  parseProveMessageBufferedInstruction,
  IncomingMessage,
  OutgoingMessage,
} from "../../clients/ts/src/bridge";
import {
  ChainName,
  ExecuteTxDetails,
  InitialTxDetails,
  ValidationTxDetails,
} from "./transaction";
import { deriveMessageHash } from "./evm";
import { Hex, toBytes, toHex } from "viem";
import {
  getMint,
  getTokenMetadata,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { formatUnitsString } from "./base";

export enum ResultKind {
  Message = "message",
  OutputRoot = "output_root",
  IncomingMessage = "incoming_message",
}

const SOL_ADDRESS = "SoL1111111111111111111111111111111111111111";

const bridgeProgram = {
  [ChainName.Solana]: "HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM",
  [ChainName.SolanaDevnet]: "7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC",
};

function bytes32ToPubkey(inp: string): Address {
  if (inp.startsWith("0x")) {
    inp = inp.slice(2);
  }
  return address(
    getBase58Codec().decode(Uint8Array.from(Buffer.from(inp, "hex")))
  );
}

export class SolanaMessageDecoder {
  private solanaMainnetUrl: string;
  private solanaDevnetUrl: string;

  private mainnetRpc: RpcMainnet<SolanaRpcApiMainnet>;
  private devnetRpc: RpcDevnet<SolanaRpcApiDevnet>;

  constructor() {
    this.solanaMainnetUrl =
      process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com";
    this.solanaDevnetUrl =
      process.env.SOLANA_DEVNET_RPC || "https://api.devnet.solana.com";

    const mainnetUrl = mainnet(this.solanaMainnetUrl);
    const devnetUrl = devnet(this.solanaDevnetUrl);
    this.mainnetRpc = createSolanaRpc(mainnetUrl);
    this.devnetRpc = createSolanaRpc(devnetUrl);
  }

  async findSolanaInitTx(pubkeyHex: Hex, isMainnet: boolean) {
    const pubkey = bytes32ToPubkey(pubkeyHex);
    const rpc = isMainnet ? this.mainnetRpc : this.devnetRpc;

    const outgoingMessage = await fetchOutgoingMessage(rpc, pubkey);
    console.log({ outgoingMessage });
    const res = await rpc.getSignaturesForAddress(pubkey).send();
    console.log({ res });
    if (res.length !== 1) {
      throw new Error(
        "Unexpected transaction signature count for outgoing message"
      );
    }
    return await this.lookupSolanaInitialTx(res[0].signature);
  }

  async findSolanaDeliveryFromMsgHash(
    msgHash: Hex,
    isMainnet: boolean
  ): Promise<{
    validationTxDetails?: ValidationTxDetails;
    executeTxDetails?: ExecuteTxDetails;
  }> {
    const rpc = isMainnet ? this.mainnetRpc : this.devnetRpc;
    const [messageAddress] = await getProgramDerivedAddress({
      programAddress: address(
        bridgeProgram[isMainnet ? ChainName.Solana : ChainName.SolanaDevnet]
      ),
      seeds: [Buffer.from("incoming_message"), toBytes(msgHash)],
    });
    try {
      const incomingMessage = await fetchIncomingMessage(rpc, messageAddress);
      console.log({ incomingMessage });
      return this.getSolanaDeliveryFromIncomingMessage(
        incomingMessage,
        isMainnet
      );
    } catch {
      return {};
    }
  }

  private async getSolanaDeliveryFromIncomingMessage(
    incomingMessage: Account<IncomingMessage, string>,
    isMainnet: boolean
  ) {
    const rpc = isMainnet ? this.mainnetRpc : this.devnetRpc;
    const chain = isMainnet ? ChainName.Solana : ChainName.SolanaDevnet;
    const res = await rpc
      .getSignaturesForAddress(incomingMessage.address)
      .send();
    console.log({ res });
    if (res.length === 0) {
      return {};
    }
    const [tx1, tx2] = res;

    const validationTx = tx2 ?? tx1;
    const executeTx = tx2 ? tx1 : tx2;

    console.log({ executeTx });

    const validationTxDetails = {
      chain,
      transactionHash: validationTx.signature,
      timestamp: new Date(
        Number(validationTx.blockTime ?? 0) * 1000
      ).toString(),
    };

    const msgHash = await this.getIncomingMessageHash(
      validationTx.signature,
      isMainnet
    );

    let executeTxDetails: ExecuteTxDetails | undefined;
    if (executeTx) {
      let amount = "";
      let asset = "";
      let receiverAddress = "";

      const { message: msg } = incomingMessage.data;

      if (msg.__kind === "Transfer") {
        if (msg.transfer.__kind === "WrappedToken") {
          const conn = new Connection(
            isMainnet ? this.solanaMainnetUrl : this.solanaDevnetUrl
          );
          const mintPk = new PublicKey(msg.transfer.fields[0].localToken);
          const metadata = await getTokenMetadata(
            conn,
            mintPk,
            "finalized",
            TOKEN_2022_PROGRAM_ID
          );

          const mintInfo = await getMint(
            conn,
            mintPk,
            "finalized",
            TOKEN_2022_PROGRAM_ID
          );

          console.log({ metadata });
          console.log({ mintInfo });

          amount = formatUnitsString(
            String(msg.transfer.fields[0].amount),
            mintInfo.decimals
          );
          asset = metadata?.symbol ?? msg.transfer.fields[0].localToken;
          receiverAddress = msg.transfer.fields[0].to;
        } else if (msg.transfer.__kind === "Sol") {
          asset = "SOL";
          receiverAddress = msg.transfer.fields[0].to;
          amount = formatUnitsString(
            String(Number(msg.transfer.fields[0].amount)),
            9
          );
        } else {
          console.error(
            "Unrecognized IncomingMessage transfer type",
            msg.transfer.__kind
          );
          return {};
        }
      } else {
        console.error("Unrecognized IncomingMessage type", msg.__kind);
        return {};
      }
      // Parse executeTx
      executeTxDetails = {
        status: "success",
        amount,
        asset,
        chain,
        receiverAddress,
        transactionHash: executeTx.signature,
        timestamp: new Date(Number(executeTx.blockTime ?? 0) * 1000).toString(),
      };
    }

    return { validationTxDetails, executeTxDetails, msgHash };
  }

  private async getIncomingMessageHash(
    sig: Signature,
    isMainnet: boolean
  ): Promise<Hex> {
    const rpc = isMainnet ? this.mainnetRpc : this.devnetRpc;
    const tx = await rpc
      .getTransaction(sig, {
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
      })
      .send();
    console.log({ tx });
    if (!tx) {
      throw new Error("Solana transaction not found");
    }
    const { message } = tx.transaction;

    const discriminators = [
      getProveMessageDiscriminatorBytes(),
      getProveMessageBufferedDiscriminatorBytes(),
      getRelayMessageDiscriminatorBytes(),
    ];

    for (let i = 0; i < message.instructions.length; i++) {
      const ix = message.instructions[i];
      const raw = (ix as any).data as string | Uint8Array | undefined;
      if (!raw) continue;
      const bytes =
        typeof raw === "string"
          ? getBase58Codec().encode(raw)
          : (raw as Uint8Array);
      if (bytes.length < 32) continue;
      if (
        discriminators.some(
          (d) => bytes.length >= d.length && d.every((b, k) => bytes[k] === b)
        )
      ) {
        const hashBytes = bytes.slice(bytes.length - 32);
        return toHex(hashBytes);
      }
    }

    throw new Error("Message hash not found in solana tx data");
  }

  async lookupSolanaInitialTx(signature: string): Promise<{
    initTx?: InitialTxDetails;
    validationTxDetails?: ValidationTxDetails;
    executeTxDetails?: ExecuteTxDetails;
    kind: ResultKind;
    msgHash?: Hex;
  }> {
    const { kind, encodedAcct, transaction, isMainnet } =
      await this.identifySolanaTx(signature);

    if (kind === ResultKind.Message) {
      const acct = decodeOutgoingMessage(encodedAcct) as Account<
        OutgoingMessage,
        string
      >;

      console.log({ acct });
      const senderAddress = acct.data.sender ?? "";

      let asset = "";
      let amount = "0";

      if (acct.data.message.__kind === "Transfer") {
        const msg = acct.data.message.fields[0];

        if (msg.localToken === SOL_ADDRESS) {
          asset = "SOL";
          amount = String(Number(msg.amount) / 1_000_000_000);
        } else {
          // Figure out what localToken is
          const { amount: a, asset: ast } = await this.getSplData(
            msg,
            isMainnet
          );
          amount = a;
          asset = ast;
        }
      }

      return {
        initTx: {
          amount,
          asset,
          chain: isMainnet ? ChainName.Solana : ChainName.SolanaDevnet,
          senderAddress,
          transactionHash: signature,
          timestamp: new Date(
            Number(transaction?.blockTime ?? 0) * 1000
          ).toString(),
        },
        kind,
        msgHash: deriveMessageHash(acct),
      };
    } else if (kind === ResultKind.IncomingMessage) {
      const acct = decodeIncomingMessage(encodedAcct) as Account<
        IncomingMessage,
        string
      >;
      console.log({ acct });
      const { validationTxDetails, executeTxDetails, msgHash } =
        await this.getSolanaDeliveryFromIncomingMessage(acct, isMainnet);
      return {
        validationTxDetails,
        executeTxDetails,
        kind,
        msgHash,
      };
    }

    throw new Error("Unable to parse Solana transaction");
  }

  private async getSplData(
    msg: BridgeSolanaToBaseStateOutgoingMessageTransfer,
    isMainnet: boolean
  ) {
    try {
      // Figure out what localToken is
      const conn = new Connection(
        isMainnet ? this.solanaMainnetUrl : this.solanaDevnetUrl
      );
      const metadata = await getTokenMetadata(
        conn,
        new PublicKey(msg.localToken),
        "finalized",
        TOKEN_2022_PROGRAM_ID
      );
      const mintInfo = await getMint(
        conn,
        new PublicKey(msg.localToken),
        "finalized",
        TOKEN_2022_PROGRAM_ID
      );
      console.log({ mintInfo });
      const amount = formatUnitsString(String(msg.amount), mintInfo.decimals);
      const asset = metadata?.symbol ?? msg.localToken;
      return { amount, asset };
    } catch {}

    try {
      // Figure out what localToken is
      const conn = new Connection(
        isMainnet ? this.solanaMainnetUrl : this.solanaDevnetUrl
      );
      const metadata = await getTokenMetadata(
        conn,
        new PublicKey(msg.localToken),
        "finalized",
        TOKEN_PROGRAM_ID
      );
      console.log({ metadata });
      const mintInfo = await getMint(
        conn,
        new PublicKey(msg.localToken),
        "finalized",
        TOKEN_PROGRAM_ID
      );
      console.log({ mintInfo });
      const amount = formatUnitsString(String(msg.amount), mintInfo.decimals);
      const asset = msg.localToken;
      // const asset = metadata?.symbol ?? msg.localToken;
      return { amount, asset };
    } catch {}

    throw new Error("SPL data unknown");
  }

  private async identifySolanaTx(signature: string) {
    // Try mainnet first, fall back to devnet
    const tryFetch = async (
      rpc: RpcMainnet<SolanaRpcApiMainnet> | RpcDevnet<SolanaRpcApiDevnet>
    ) =>
      rpc
        .getTransaction(signature as Signature, {
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
        })
        .send();

    let rpc: RpcMainnet<SolanaRpcApiMainnet> | RpcDevnet<SolanaRpcApiDevnet> =
      this.mainnetRpc;
    let chainName: ChainName = ChainName.Solana;
    let transaction = await tryFetch(rpc);
    if (!transaction) {
      rpc = this.devnetRpc;
      chainName = ChainName.SolanaDevnet;
      transaction = await tryFetch(rpc);
    }
    console.log({ transaction });

    if (!transaction) {
      throw new Error("Solana transaction not found");
    }

    const { message } = transaction.transaction;
    let bridgeSeen = false;

    for (let i = 0; i < message.instructions.length; i++) {
      const ix = message.instructions[i];
      // Treat seeing any recognizable bridge instruction as "bridgeSeen"
      const rawIxData = (ix as any).data as string | Uint8Array | undefined;
      if (rawIxData && this.isRelayMessageCall(ix)) {
        bridgeSeen = true;
        // Lookup accounts
        if ("accounts" in ix) {
          const encodedAccts = await fetchEncodedAccounts(
            rpc,
            ix.accounts.map((acct) => acct)
          );

          for (let j = 0; j < encodedAccts.length; j++) {
            const encodedAcct = encodedAccts[j];
            if (this.isIncomingMessage(encodedAcct)) {
              return {
                kind: ResultKind.IncomingMessage,
                encodedAcct,
                transaction,
                isMainnet: chainName === ChainName.Solana,
              };
            }
          }
        }
      }

      // Fallback: detect initial bridge instructions without relying on program address
      try {
        const rawIx = (ix as any).data as string | Uint8Array | undefined;
        if (!rawIx) {
          // If this instruction is fully parsed and has no raw data, skip
          throw new Error("No raw data on instruction");
        }
        const data =
          typeof rawIx === "string"
            ? getBase58Codec().encode(rawIx)
            : (rawIx as Uint8Array);

        // Normalize accounts to AccountMeta[] expected by parse*Instruction helpers
        const accountKeys = (message as any)?.accountKeys ?? [];
        const metas =
          (ix as any).accounts?.map((acct: any) => {
            let pubkeyStr: string | undefined;
            if (typeof acct === "string") pubkeyStr = acct;
            else if (typeof acct === "number") {
              const entry = accountKeys[acct];
              pubkeyStr = entry?.pubkey ?? entry?.address;
            } else if (acct && typeof acct === "object") {
              pubkeyStr = (acct.pubkey ?? acct.address) as string | undefined;
            }
            const keyInfo =
              accountKeys.find(
                (k: any) => (k.pubkey ?? k.address) === pubkeyStr
              ) ?? {};
            return {
              address: pubkeyStr,
              isSigner: Boolean(keyInfo.signer),
              isWritable: Boolean(keyInfo.writable),
            } as any;
          }) ?? [];

        const tryMatch = (
          discriminator: ReadonlyUint8Array,
          parseFn: (instruction: any) => { accounts: any }
        ): string | undefined => {
          if (
            data.length >= discriminator.length &&
            discriminator.every((b, k) => data[k] === b)
          ) {
            const parsed = parseFn({
              programAddress: ix.programId,
              accounts: metas,
              data,
            } as any);
            const omMeta = (parsed.accounts?.outgoingMessage ??
              parsed.accounts?.message ??
              undefined) as { address?: string } | string | undefined;
            const omAddr =
              typeof omMeta === "string" ? omMeta : omMeta?.address;
            return omAddr;
          }
          return undefined;
        };

        const outgoingMessageAddr =
          tryMatch(
            getBridgeSolDiscriminatorBytes(),
            parseBridgeSolInstruction
          ) ||
          tryMatch(
            getBridgeSolWithBufferedCallDiscriminatorBytes(),
            parseBridgeSolWithBufferedCallInstruction
          ) ||
          tryMatch(
            getBridgeSplDiscriminatorBytes(),
            parseBridgeSplInstruction
          ) ||
          tryMatch(
            getBridgeWrappedTokenDiscriminatorBytes(),
            parseBridgeWrappedTokenInstruction
          );

        // Also detect proveMessage and proveMessageBuffered (incoming message)
        const incomingMessageAddr =
          tryMatch(
            getProveMessageDiscriminatorBytes(),
            parseProveMessageInstruction
          ) ||
          tryMatch(
            getProveMessageBufferedDiscriminatorBytes(),
            parseProveMessageBufferedInstruction
          );

        if (outgoingMessageAddr) {
          bridgeSeen = true;
          const encodedAcct = await fetchEncodedAccount(
            rpc,
            address(outgoingMessageAddr)
          );
          if (this.isOutgoingMessage(encodedAcct)) {
            return {
              kind: ResultKind.Message,
              encodedAcct,
              transaction,
              isMainnet: chainName === ChainName.Solana,
            };
          }
        } else if (incomingMessageAddr) {
          bridgeSeen = true;
          const encodedAcct = await fetchEncodedAccount(
            rpc,
            address(incomingMessageAddr)
          );
          if (this.isIncomingMessage(encodedAcct)) {
            return {
              kind: ResultKind.IncomingMessage,
              encodedAcct,
              transaction,
              isMainnet: chainName === ChainName.Solana,
            };
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    console.log({ bridgeSeen });

    if (!bridgeSeen) {
      throw new Error("Transaction not recognized");
    }

    const innerInstructions = transaction.meta?.innerInstructions ?? [];

    for (let i = 0; i < innerInstructions.length; i++) {
      const { instructions } = innerInstructions[i];

      for (let j = 0; j < instructions.length; j++) {
        const ix = instructions[j];

        if (!("parsed" in ix) || ix.parsed.type !== "createAccount") {
          continue;
        }

        const { info } = ix.parsed;

        if (!info || !("owner" in info) || !("newAccount" in info)) {
          continue;
        }

        const encodedAcct = await fetchEncodedAccount(
          rpc,
          address(info.newAccount as string)
        );
        console.log({ encodedAcct });

        if (this.isOutgoingMessage(encodedAcct)) {
          return {
            kind: ResultKind.Message,
            encodedAcct,
            transaction,
            isMainnet: chainName === ChainName.Solana,
          };
        } else if (this.isOutputRoot(encodedAcct)) {
          return {
            kind: ResultKind.OutputRoot,
            encodedAcct,
            transaction,
            isMainnet: chainName === ChainName.Solana,
          };
        } else if (this.isIncomingMessage(encodedAcct)) {
          return {
            kind: ResultKind.IncomingMessage,
            encodedAcct,
            transaction,
            isMainnet: chainName === ChainName.Solana,
          };
        }
      }
    }

    throw new Error("Solana transaction type not recognized");
  }

  private isOutgoingMessage(acct: MaybeEncodedAccount<string>): boolean {
    return this.isExpectedAccount(acct, getOutgoingMessageDiscriminatorBytes());
  }

  private isOutputRoot(acct: MaybeEncodedAccount<string>): boolean {
    return this.isExpectedAccount(acct, getOutputRootDiscriminatorBytes());
  }

  private isIncomingMessage(acct: MaybeEncodedAccount<string>): boolean {
    return this.isExpectedAccount(acct, getIncomingMessageDiscriminatorBytes());
  }

  private isRelayMessageCall(ix: any): boolean {
    const d = getRelayMessageDiscriminatorBytes();
    const rawIxData = (ix as any).data as string | Uint8Array | undefined;
    if (!rawIxData) return false;
    const data =
      typeof rawIxData === "string"
        ? getBase58Codec().encode(rawIxData)
        : (rawIxData as Uint8Array);
    return data.length >= d.length && d.every((byte, i) => data[i] === byte);
  }

  private isExpectedAccount(
    acct: MaybeEncodedAccount<string>,
    d: ReadonlyUint8Array
  ): boolean {
    return (
      acct.exists &&
      acct.data instanceof Uint8Array &&
      acct.data.length >= d.length &&
      d.every((byte, i) => acct.data[i] === byte)
    );
  }
}
