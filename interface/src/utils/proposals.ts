import { ethers } from 'ethers';
import { getProposalsContract } from './contracts';
import { getDealContract } from './dealContract';
import { EXCLUDED_PROPOSAL_IDS } from '@/config/excludedProposals';

export type FundingResult = {
  success: boolean;
  hash: string | null;
  error: string | null;
};

export interface ProposalData {
  id: number;
  dealRequired: bigint;
  payableAddress: string;
  documentURI: string;
  details?: ProposalDetails;
}

export interface ProposalDetails {
  name: string;
  problemStatement: string;
  description: string;
  links: string;
  submittedBy: string;
  timestamp: string;
}

export async function fundProposal(proposalId: number, amount: string): Promise<FundingResult> {
    try {
      if (!window.ethereum) throw new Error('No wallet found');
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const proposalsContract = await getProposalsContract(signer);
      const dealContract = await getDealContract(signer);
      const amountInWei = ethers.parseUnits(amount, 18);

      const approveTx = await dealContract.approve(proposalsContract.target, amountInWei);
      await approveTx.wait();
      
      const tx = await proposalsContract.fundProposal(proposalId, amountInWei);
      await tx.wait();
  
      return {
        success: true,
        hash: tx.hash,
        error: null
      };
    } catch (err) {
      console.error('Error funding proposal:', err);
      return {
        success: false,
        hash: null,
        error: err instanceof Error ? err.message : 'Failed to fund proposal'
      };
    }
}

export async function getProposalFunding(proposalId: number): Promise<string> {
    try {
      if (!window.ethereum) throw new Error('No wallet found');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = await getProposalsContract(signer);
      const funding = await contract.getCurrentFunding(proposalId);
      return ethers.formatEther(funding);
    } catch (error) {
      console.error('Error getting proposal funding:', error);
      return '0';
    }
}

export async function fetchProposals(startIndex: number, count: number): Promise<ProposalData[]> {
    if (!window.ethereum) throw new Error('No wallet found');
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = await getProposalsContract(provider);
    
    const totalProposals = await contract.proposalCount();
    const endIndex = Math.min(Number(startIndex + count), Number(totalProposals));
    
    const proposals: ProposalData[] = [];
    const seenIds = new Set<number>();
    
    for (let i = startIndex; i < endIndex; i++) {
      if (EXCLUDED_PROPOSAL_IDS.includes(i)) continue;
      
      if (seenIds.has(i)) continue;
      
      const proposal = await contract.getProposal(i);
      proposals.push({
        id: i,
        dealRequired: proposal.dealRequired,
        payableAddress: proposal.payableAddress,
        documentURI: proposal.documentURI,
      });
      
      seenIds.add(i);
    }
    
    return proposals;
  }

export async function fetchProposalDetails(documentURI: string): Promise<ProposalDetails> {
  const arweaveId = documentURI.replace('ar://', '');
  const response = await fetch(`https://arweave.net/${arweaveId}`);
  if (!response.ok) throw new Error('Failed to fetch proposal details');
  return response.json();
}