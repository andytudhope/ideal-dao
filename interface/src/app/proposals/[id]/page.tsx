'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FundingSection } from '@/components/FundingSection';
import { FundingStatus } from '@/components/FundingStatus';
import { fetchProposals, fetchProposalDetails, type ProposalData } from '@/utils/proposals';
import { ethers } from 'ethers';


export default function ProposalPage() {
  const params = useParams();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundingRefreshCounter, setFundingRefreshCounter] = useState(0);

  useEffect(() => {
    const loadProposal = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const id = Number(params.id);
        const [fetchedProposal] = await fetchProposals(id, 1);
        if (!fetchedProposal) {
          setError('Proposal not found');
          return;
        }

        const details = await fetchProposalDetails(fetchedProposal.documentURI);
        setProposal({ ...fetchedProposal, details });
      } catch (err) {
        console.error('Failed to load proposal:', err);
        setError('Failed to load proposal');
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [params.id]);

  const handleFundingSuccess = () => {
    setFundingRefreshCounter(prev => prev + 1);
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6">Loading...</div>;
  if (error) return <div className="max-w-4xl mx-auto p-6">Error: {error}</div>;
  if (!proposal) return <div className="max-w-4xl mx-auto p-6">Proposal not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">
          {proposal.details?.name || `Proposal ${proposal.id}`}
        </h1>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Required Amount</h2>
            <p>{ethers.formatEther(proposal.dealRequired)} DEAL</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Withdrawal Address</h2>
            <p className="font-mono break-all">{proposal.payableAddress}</p>
          </div>

          {proposal.details?.problemStatement && (
            <div>
              <h2 className="text-lg font-semibold">Problem Statement</h2>
              <p className="whitespace-pre-wrap">{proposal.details.problemStatement}</p>
            </div>
          )}

          {proposal.details?.description && (
            <div>
              <h2 className="text-lg font-semibold">Description</h2>
              <p className="whitespace-pre-wrap">{proposal.details.description}</p>
            </div>
          )}

          {proposal.details?.links && (
            <div>
              <h2 className="text-lg font-semibold">Supporting Links</h2>
              <p className="whitespace-pre-wrap">{proposal.details.links}</p>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold">Submitted By</h2>
            <p className="font-mono">{proposal.details?.submittedBy}</p>
          </div>
        </div>
        <FundingStatus 
          proposalId={proposal.id}
          requiredAmount={proposal.dealRequired}
          className="my-6"
          refreshTrigger={fundingRefreshCounter}
        />
        <FundingSection 
            proposalId={proposal.id}
            onFundingSuccess={handleFundingSuccess}
        />
      </div>
    </div>
  );
}