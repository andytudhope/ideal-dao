"use client"
import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { ArrowDown, Loader2, Check } from 'lucide-react';
import { 
  calculateMintAmount, 
  calculateBurnAmount, 
  checkBalance,
  mintDeal,
  burnDeal,
  type TransactionResult 
} from '@/utils/dealContract';
import { getEtherscanUrl } from '@/utils/contracts';

type Mode = 'mint' | 'burn';
type TxStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

export default function DealPage() {
  const { address, isConnected, connect } = useWallet();
  const [mode, setMode] = useState<Mode>('mint');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');

  // Check balance when connected
  useEffect(() => {
    if (isConnected && address) {
      const fetchBalance = async () => {
        const result = await checkBalance(mode === 'mint' ? 'dai' : 'deal', address);
        if (result.error) {
          setError(result.error);
        } else {
          setBalance(result.balance);
        }
      };
      fetchBalance();
    }
  }, [isConnected, address, mode]);

  // Calculate output with debounce
  useEffect(() => {
    if (!inputAmount || isNaN(Number(inputAmount))) {
      setOutputAmount('');
      setError(null);
      return;
    }

    const calculate = async () => {
      setIsCalculating(true);
      setError(null);
      
      try {
        const result = mode === 'mint' 
          ? await calculateMintAmount(inputAmount)
          : await calculateBurnAmount(inputAmount);
        
        if (result.error) {
          setError(result.error);
          setOutputAmount('');
        } else {
          setOutputAmount(result.amount);
        }
      } catch (err) {
        console.error('Calculation error:', err);
        setError('Failed to calculate amount');
        setOutputAmount('');
      } finally {
        setIsCalculating(false);
      }
    };

    const timeoutId = setTimeout(calculate, 500);
    return () => clearTimeout(timeoutId);
  }, [inputAmount, mode]);

  const handleSubmit = async () => {
    if (!isConnected || !inputAmount) return;
    
    setTxStatus('pending');
    setError(null);
    setTxHash(null);

    try {
      const result: TransactionResult = mode === 'mint'
        ? await mintDeal(inputAmount)
        : await burnDeal(inputAmount);

      if (result.success && result.hash) {
        setTxHash(result.hash);
        setTxStatus('confirmed');
        setInputAmount('');
        setOutputAmount('');
        
        // Refresh balance
        if (address) {
            const balanceResult = await checkBalance(mode === 'mint' ? 'dai' : 'deal', address);
            if (!balanceResult.error) {
              setBalance(balanceResult.balance);
            }
        }
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (err) {
      console.error('Transaction failed:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setTxStatus('failed');
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setInputAmount('');
    setOutputAmount('');
    setError(null);
    setTxStatus('idle');
    setTxHash(null);
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-4">
        {/* Mode Toggle */}
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={() => handleModeChange('mint')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'mint' ? 'bg-black text-white' : 'text-gray-500'
            }`}
          >
            Mint
          </button>
          <button 
            onClick={() => handleModeChange('burn')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'burn' ? 'bg-black text-white' : 'text-gray-500'
            }`}
          >
            Redeem
          </button>
        </div>

        {/* Balance Display */}
        {isConnected && (
          <div className="mb-2 text-sm text-gray-500">
            Balance: {Number(balance).toFixed(2)} {mode === 'mint' ? 'DAI' : 'DEAL'}
          </div>
        )}

        {/* Input Amount */}
        <div className="bg-gray-50 rounded-xl p-4 mb-2">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-500">
              {mode === 'mint' ? 'You pay' : 'You sell'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="any"
              disabled={txStatus === 'pending'}
              className="bg-transparent text-2xl outline-none w-full disabled:cursor-not-allowed"
            />
            <div className="flex items-center bg-white rounded-full px-3 py-1 shadow-sm">
                <img 
                    src={mode === 'mint' ? "/dai-logo.svg" : "/logo.png"} 
                    alt={mode === 'mint' ? "DAI" : "DEAL"} 
                    className="w-5 h-5 mr-2" 
                />
              <span>{mode === 'mint' ? 'DAI' : 'DEAL'}</span>
            </div>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center -my-2 relative z-10">
          <div className="bg-white rounded-lg p-2 shadow-md">
            <ArrowDown className="w-4 h-4" />
          </div>
        </div>

        {/* Output Amount */}
        <div className="bg-gray-50 rounded-xl p-4 mt-2">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-500">
              {mode === 'mint' ? 'You receive' : 'You receive'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center flex-1">
              <input
                type="text"
                value={outputAmount}
                readOnly
                placeholder="0"
                className="bg-transparent text-2xl outline-none w-full"
              />
              {isCalculating && (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin ml-2" />
              )}
            </div>
            <div className="flex items-center bg-white rounded-full px-3 py-1 shadow-sm">
                <img 
                    src={mode === 'mint' ? "/logo.png" : "/dai-logo.svg"} 
                    alt={mode === 'mint' ? "DEAL" : "DAI"} 
                    className="w-5 h-5 mr-2" 
                />
              <span>{mode === 'mint' ? 'DEAL' : 'DAI'}</span>
            </div>
          </div>
        </div>

        {/* Transaction Status */}
        {txStatus === 'confirmed' && txHash && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <p className="text-sm text-green-700">Transaction confirmed!</p>
            </div>
            <a
              href={getEtherscanUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline mt-1 block"
            >
              View on Etherscan
            </a>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Action Button */}
        {isConnected ? (
          <button
            onClick={handleSubmit}
            disabled={!inputAmount || txStatus === 'pending' || isCalculating || !!error}
            className="w-full mt-4 bg-black text-white py-4 rounded-xl font-medium 
              disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors
              flex items-center justify-center"
          >
            {txStatus === 'pending' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {mode === 'mint' ? 'Minting...' : 'Redeeming...'}
              </>
            ) : (
              mode === 'mint' ? 'Mint DEAL' : 'Redeem DEAL'
            )}
          </button>
        ) : (
          <button
            onClick={connect}
            className="w-full mt-4 bg-gray-500 hover:bg-gray-600 text-white py-4 
              rounded-xl font-medium transition-colors"
          >
            Connect wallet
          </button>
        )}
      </div>
    </div>
  );
}