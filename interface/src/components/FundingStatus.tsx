import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { getProposalFunding } from '@/utils/proposals';

type FundingStatusProps = {
    proposalId: number;
    requiredAmount: bigint;
    className?: string;
    refreshTrigger?: number; 
  };
  
  export function FundingStatus({ 
    proposalId, 
    requiredAmount, 
    className = '',
    refreshTrigger = 0
  }: FundingStatusProps) {
    const [currentFunding, setCurrentFunding] = useState<string>('0');
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
      const loadFunding = async () => {
        const funding = await getProposalFunding(proposalId);
        setCurrentFunding(funding);
        setLoading(false);
      };
      loadFunding();
    }, [proposalId, refreshTrigger]);

  const requiredEther = Number(ethers.formatEther(requiredAmount));
  const currentEther = Number(currentFunding);
  const percentage = Math.min((currentEther / requiredEther) * 100, 100);

  if (loading) return <div className="h-6 bg-gray-100 rounded animate-pulse" />;

  return (
    <div className={className}>
      <div className="flex justify-between text-sm mb-1">
        <span>
          {currentEther.toFixed(2)} / {requiredEther.toFixed(2)} DEAL
        </span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-red-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}