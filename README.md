# Ideal DAO

Simply a better way of doing DAOs.

Blockchains, used intelligently, do two things:

1. Move money freely.
2. Create programs that enable more people to participate in the additional value that is created by virtue of money moving freely.

IdealDAO is based on two contracts: [Proposals.sol](/contract/src/Proposals.sol) and [DEAL.sol](/contract/src/DEAL.sol) that do exactly that, and only that.

## Contracts

Test the contracts with [forge](https://book.getfoundry.sh/):

```bash
cd contract
forge install --no-git foundry-rs/forge-std
forge test
```

If you'd like to run the frontend, you'll need to start a local network and deploy the contracts. 

(You'll need to copy the contents of env.example to .env.local and insert your own values in order for Arweave uploads and ENS name resolution to work).

Run `anvil` in one terminal and, in another terminal:

```bash
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
```

## Interface

Run the Nextjs web interface as below:

```bash
npm run dev
```

Enjoy a DAO that allocates capital in an optimal manner without any governance.