import { ethers } from 'ethers';
import { getDeployments } from './deployments';

export function getContractAddresses() {
  const deployments = getDeployments();
  return {
    usds: deployments.usds,
    usdc: deployments.usdc,
    usdt: deployments.usdt,
    deal: deployments.deal,
    proposals: deployments.proposals
  };
}

export async function getProposalsContract(providerOrSigner: ethers.Provider | ethers.Signer) {
  const { proposals: proposalsAddress } = getContractAddresses();
  
  const { abi } = await import('../deployments/Proposals.sol/Proposals.json');
  
  return new ethers.Contract(proposalsAddress, abi, providerOrSigner);
}

export const getEtherscanUrl = (txHash: string) => {
    const network = process.env.NEXT_PUBLIC_NETWORK || 'localhost';
    switch(network) {
      case 'mainnet':
        return `https://etherscan.io/tx/${txHash}`;
      case 'sepolia':
        return `https://sepolia.etherscan.io/tx/${txHash}`;
      case 'localhost':
        return `http://etherscan.io/${txHash}`;
      default:
        return `https://etherscan.io/tx/${txHash}`;
    }
  };