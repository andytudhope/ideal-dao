import { ethers } from 'ethers';
import { getDeployments } from './deployments';

export function getContractAddresses() {
  const deployments = getDeployments();
  return {
    dai: deployments.dai,
    deal: deployments.deal,
    proposals: deployments.proposals
  };
}

export async function getProposalsContract(signer: ethers.Signer) {
  const { proposals: proposalsAddress } = getContractAddresses();
  
  const { abi } = await import('../deployments/Proposals.sol/Proposals.json');
  
  return new ethers.Contract(proposalsAddress, abi, signer);
}