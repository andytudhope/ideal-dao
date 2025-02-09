'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchProposals, fetchProposalDetails, type ProposalData } from '@/utils/proposals';
import { ethers } from 'ethers';

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadProposals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const batchSize = 5;
      const newProposals = await fetchProposals(page * batchSize, batchSize);
      
      // Fetch details for each proposal
      const proposalsWithDetails = await Promise.all(
        newProposals.map(async (proposal) => {
          try {
            const details = await fetchProposalDetails(proposal.documentURI);
            return { ...proposal, details };
          } catch (err) {
            console.error(`Failed to fetch details for proposal ${proposal.id}:`, err);
            return proposal;
          }
        })
      );
      
      // For first page, replace existing proposals
      // For subsequent pages, append
      setProposals(prev => 
        page === 0 ? proposalsWithDetails : [...prev, ...proposalsWithDetails]
      );
      
      setHasMore(newProposals.length === batchSize);
    } catch (err) {
      console.error('Failed to load proposals:', err);
      setError('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProposals();
  }, [page]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Active Proposals</h1>
      
      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {proposals.map((proposal) => (
          <Link 
            key={proposal.id}
            href={`/proposals/${proposal.id}`}
            className="block hover:shadow-lg transition-shadow"
          >
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-2">
                {proposal.details?.name || `Proposal ${proposal.id}`}
              </h2>
              <p className="text-sm text-gray-500 mb-2">
                {ethers.formatEther(proposal.dealRequired)} DEAL
              </p>
              <p className="text-sm text-gray-500 truncate">
                {proposal.payableAddress}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {loading && (
        <div className="text-center mt-4">
          <p>Loading proposals...</p>
        </div>
      )}

      {!loading && hasMore && (
        <button
          onClick={() => setPage(p => p + 1)}
          className="w-full mt-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
        >
          Load More
        </button>
      )}
    </div>
  );
}