# Base Bridge Explorer Tool

An explorer tool to look up information about cross-chain messages in [Base Bridge](https://github.com/base/bridge). Supports both testnet and mainnet.

## Features

- 🔍 **Transaction Lookup**: Search for bridge transactions using Solana signatures or Base transaction hashes
- 🔗 **Cross-Chain Tracking**: Track message flow from initiation → validation → execution
- ⏱️ **Real-Time Status**: View current status of bridge transactions (Pending, Pre-validated, Executed)
- 🌐 **Multi-Network Support**: Works with both mainnet (Base + Solana) and testnet (Base Sepolia + Solana Devnet)
- 📋 **Easy Copy**: One-click copy for transaction hashes and addresses
- 🔗 **Explorer Links**: Direct links to block explorers (Basescan, Solana Explorer)

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Run the app

```bash
npm run dev
```

3. Visit [localhost:3000](http://localhost:3000/) in your browser

## Environment Variables (Optional)

Create a `.env.local` file with custom RPC endpoints for better performance:

```env
BASE_MAINNET_RPC=https://your-base-mainnet-rpc.com
BASE_SEPOLIA_RPC=https://your-base-sepolia-rpc.com
SOLANA_MAINNET_RPC=https://your-solana-mainnet-rpc.com
SOLANA_DEVNET_RPC=https://your-solana-devnet-rpc.com
```

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **EVM**: [viem](https://viem.sh/) for Base blockchain interactions
- **Solana**: [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/) for Solana blockchain interactions
- **TypeScript**: Full type safety throughout the codebase

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints for blockchain queries
│   ├── layout.tsx         # Root layout with fonts and analytics
│   └── page.tsx           # Main explorer page
├── components/            # React components
│   ├── ErrorMessage.tsx   # Error display component
│   ├── ExploreButton.tsx  # Main explore action button
│   ├── Footer.tsx         # Footer with useful links
│   ├── Header.tsx         # Page header
│   ├── InputForm.tsx      # Transaction input form
│   ├── LoadingSkeleton.tsx # Loading state skeleton
│   ├── Results.tsx        # Transaction results display
│   ├── Status.tsx         # Status badge component
│   └── Toast.tsx          # Toast notification system
└── lib/                   # Utility libraries
    ├── base.ts            # Base blockchain decoder
    ├── bridge.ts          # Bridge types and interfaces
    ├── solana.ts          # Solana blockchain decoder
    └── transaction.ts     # Transaction types
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Related Projects

- [Base Bridge](https://github.com/base/bridge) - The core bridge implementation
- [Base Docs](https://docs.base.org) - Official Base documentation
