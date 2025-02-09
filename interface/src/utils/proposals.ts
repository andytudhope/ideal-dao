import { ethers } from 'ethers';
import { getProposalsContract } from './contracts';
import { EXCLUDED_PROPOSAL_IDS } from '@/config/excludedProposals';

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