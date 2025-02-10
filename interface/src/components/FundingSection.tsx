import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { fundProposal } from '@/utils/proposals';
import { checkBalance } from '@/utils/dealContract';
import { getEtherscanUrl } from '@/utils/contracts';
import { Loader2 } from 'lucide-react';

type FundingSectionProps = {
  proposalId: number;
  onFundingSuccess: () => void;
};

export function FundingSection({ proposalId, onFundingSuccess }: FundingSectionProps) {
  const { address, isConnecting, connect, isConnected } = useWallet();
  const [inputAmount, setInputAmount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      const fetchBalance = async () => {
        const result = await checkBalance('deal', address);
        if (result.error) {
          setError(result.error);
        } else {
          setBalance(result.balance);
        }
      };
      fetchBalance();
    }
  }, [isConnected, address]);

  const handleSubmit = async () => {
    if (!isConnected || !inputAmount) return;
    
    if (Number(inputAmount) > Number(balance)) {
      setError('Amount exceeds your balance');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const result = await fundProposal(proposalId, inputAmount);
      if (result.success && result.hash) {
        setTxHash(result.hash);
        setInputAmount('');
        // Refresh balance
        if (address) {
          const balanceResult = await checkBalance('deal', address);
          if (!balanceResult.error) {
            setBalance(balanceResult.balance);
          }
        }
        onFundingSuccess();
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (err) {
        console.error('Funding failed:', err);
        setError(
          err instanceof Error ? err.message : 'Funding failed'
        );
      } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 p-4 bg-gray-50 rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Fund This Proposal</h2>
      
      {isConnected ? (
        <>
          <div className="mb-2 text-sm text-gray-500">
            Balance: {Number(balance).toFixed(2)} DEAL
          </div>
          
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => {
                  const newAmount = e.target.value;
                  if (Number(newAmount) > Number(balance)) {
                    setError('Amount exceeds your balance');
                  } else {
                    setError(null);
                  }
                  setInputAmount(newAmount);
                }}
                placeholder="Amount in DEAL"
                min="0"
                step="any"
                disabled={isLoading}
                className="w-full px-4 py-2 rounded-lg border [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!inputAmount || isLoading || !!error}
              className="px-6 py-2 bg-black text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Funding...
                </>
              ) : (
                'Fund'
              )}
            </button>
          </div>
          
          {error && (
            <div className="mt-2 text-sm text-red-600">
              {error}
            </div>
          )}
          
          {txHash && (
            <div className="mt-2 text-sm text-green-600">
              Funding successful! <a href={getEtherscanUrl(txHash)} target="_blank" rel="noopener noreferrer" className="underline">View on Etherscan</a>
            </div>
          )}
        </>
      ) : (
        <button
          onClick={connect}
          disabled={isConnecting}
          className={`bg-black text-white px-4 py-2 rounded-lg text-sm font-medium 
          ${isConnecting ? 'opacity-75 cursor-not-allowed' : 'hover:bg-gray-800'}`}
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
      )}
    </div>
  );
}