# Ideal DAO

Simply a better way of doing DAOs.

Blockchains, used intelligently, do two things:

1. Move money freely.
2. Create programs that enable more people to participate in the additional value that is created by virtue of money moving freely.

IdealDAO is based on two contracts: [Proposals.sol](/contracts/src/Proposals.sol) and [DEAL.sol](/contracts/src/DEAL.sol) that do exactly that, and only that.

## Contracts

Test the contracts with [forge](https://book.getfoundry.sh/):

```bash
cd contracts
forge install --no-git foundry-rs/forge-std
forge test
```

## Interface

Run the Nextjs web interface as below:

```bash
npm run dev
```

Enjoy a DAO that allocates capital in an optimal manner without any governance.