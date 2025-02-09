"use client"
import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { ArrowDown, Loader2, Check, ChevronDown } from 'lucide-react';
import { 
  calculateMintAmount, 
  calculateBurnAmount, 
  checkContractReserves,
  checkBalance,
  mintDeal,
  burnDeal,
  type TransactionResult 
} from '@/utils/dealContract';
import { getEtherscanUrl } from '@/utils/contracts';

type Mode = 'mint' | 'burn';
type TxStatus = 'idle' | 'pending' | 'confirmed' | 'failed';
type TokenType = 'usds' | 'usdc' | 'usdt';

const TOKEN_INFO = {
  usds: {
    name: 'USDS',
    logo: '/usds-logo.svg',
    decimals: 18
  },
  usdc: {
    name: 'USDC',
    logo: '/usdc-logo.svg',
    decimals: 6
  },
  usdt: {
    name: 'USDT',
    logo: '/usdt-logo.svg',
    decimals: 6
  }
} as const;

export default function DealPage() {
  const { address, isConnected, connect } = useWallet();
  const [mode, setMode] = useState<Mode>('mint');
  const [selectedToken, setSelectedToken] = useState<TokenType>('usds');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractReserves, setContractReserves] = useState<string>('0');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isTokenListOpen, setIsTokenListOpen] = useState(false);

  // Close token list when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.token-selector')) {
        setIsTokenListOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

// Load both balance and reserves
useEffect(() => {
    if (!isConnected || !address) return;
  
    const loadData = async () => {
      // Clear any existing errors
      setError(null);
  
      // Load user's balance
      const balanceResult = await checkBalance(
        mode === 'mint' ? selectedToken : 'deal',
        address
      );
      if (balanceResult.error) {
        setError(balanceResult.error);
        return;
      }
      setBalance(balanceResult.balance);
  
      // Load contract reserves if in burn mode
      if (mode === 'burn') {
        const reservesResult = await checkContractReserves(selectedToken);
        if (reservesResult.error) {
          setError(reservesResult.error);
          return;
        }
        setContractReserves(reservesResult.available);
      }
    };
  
    loadData();
  }, [isConnected, address, mode, selectedToken]);
  
  // Calculations for validations
  useEffect(() => {
    // Reset output if no input
    if (!inputAmount || isNaN(Number(inputAmount))) {
      setOutputAmount('');
      setError(null);
      return;
    }
  
    // Check user's balance
    if (Number(inputAmount) > Number(balance)) {
      setError('Amount exceeds your balance');
      setOutputAmount('');
      return;
    }
  
    const calculate = async () => {
      setIsCalculating(true);
      setError(null);
  
      try {
        const result = mode === 'mint'
          ? await calculateMintAmount(inputAmount, selectedToken)
          : await calculateBurnAmount(inputAmount, selectedToken);
  
        if (result.error) {
          throw new Error(result.error);
        }
  
        // For burn mode, validate against contract reserves
        if (mode === 'burn' && Number(result.amount) > Number(contractReserves)) {
          throw new Error('reserve_exceeded');
        }
  
        setOutputAmount(result.amount);
      } catch (err) {
        console.error('Calculation error:', err);
        setOutputAmount('');
        
        if (err instanceof Error && err.message === 'reserve_exceeded') {
          setError('You cannot redeem that much DEAL for this specific collateral. Pick another and try again.');
        } else {
          setError('Failed to calculate amount');
        }
      } finally {
        setIsCalculating(false);
      }
    };
  
    const timeoutId = setTimeout(calculate, 500);
    return () => clearTimeout(timeoutId);
  }, [inputAmount, mode, selectedToken, balance, contractReserves]);

  const handleSubmit = async () => {
    if (!isConnected || !inputAmount) return;

    if (Number(inputAmount) > Number(balance)) {
        setError('Amount exceeds your balance');
        return;
    }
    
    setTxStatus('pending');
    setError(null);
    setTxHash(null);

    try {
      const result: TransactionResult = mode === 'mint'
        ? await mintDeal(inputAmount, selectedToken)
        : await burnDeal(inputAmount, selectedToken);

      if (result.success && result.hash) {
        setTxHash(result.hash);
        setTxStatus('confirmed');
        setInputAmount('');
        setOutputAmount('');
        
        // Refresh balance
        if (address) {
          const balanceResult = await checkBalance(
            mode === 'mint' ? selectedToken : 'deal',
            address
          );
          if (!balanceResult.error) {
            setBalance(balanceResult.balance);
          }
        }
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (err) {
        console.error('Transaction failed:', err);
        if (mode === 'burn' && typeof err === 'object' && err !== null && 'toString' in err && err.toString().includes('insufficient liquidity')) {
          setError('You need to redeem a different kind of collateral. Please select another option and try again.');
        } else {
          setError(
            typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' 
              ? err.message 
              : 'Transaction failed'
          );
        }
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

  const TokenSelector = () => (
    <div className="relative token-selector">
      <button
        onClick={() => setIsTokenListOpen(!isTokenListOpen)}
        className="flex items-center bg-white rounded-full px-3 py-1 shadow-sm"
        type="button"
      >
        <img 
          src={TOKEN_INFO[selectedToken].logo}
          alt={TOKEN_INFO[selectedToken].name}
          className="w-5 h-5 mr-2"
        />
        <span>{TOKEN_INFO[selectedToken].name}</span>
        <ChevronDown className="w-4 h-4 ml-2" />
      </button>
      
      {isTokenListOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg py-1 z-20">
          {Object.entries(TOKEN_INFO).map(([value, info]) => (
            <button
              key={value}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center"
              onClick={() => {
                setSelectedToken(value as TokenType);
                setIsTokenListOpen(false);
              }}
            >
              <img 
                src={info.logo}
                alt={info.name}
                className="w-5 h-5 mr-2"
              />
              <span>{info.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const DealDisplay = () => (
    <div className="flex items-center bg-white rounded-full px-3 py-1 shadow-sm">
      <img 
        src="/logo.png"
        alt="DEAL"
        className="w-5 h-5 mr-2"
      />
      <span>DEAL</span>
    </div>
  );

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
            Balance: {Number(balance).toFixed(2)} {mode === 'mint' ? TOKEN_INFO[selectedToken].name : 'DEAL'}
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
            <div className="flex flex-1 items-center">
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
                placeholder="0"
                min="0"
                max={balance}
                step="any"
                disabled={txStatus === 'pending'}
                className="bg-transparent text-2xl outline-none w-full disabled:cursor-not-allowed [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {isConnected && (
                <button
                  onClick={() => setInputAmount(balance)}
                  className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded"
                >
                  max
                </button>
              )}
            </div>
            {mode === 'mint' ? <TokenSelector /> : <DealDisplay />}
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
            {mode === 'burn' && (
              <span className="text-sm text-gray-500">
                Available: {Number(contractReserves).toFixed(TOKEN_INFO[selectedToken].decimals === 18 ? 2 : 6)} {TOKEN_INFO[selectedToken].name}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center flex-1">
              <input
                type="text"
                value={outputAmount}
                readOnly
                placeholder="0"
                className="bg-transparent text-2xl outline-none w-full disabled:cursor-not-allowed [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {isCalculating && (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin ml-2" />
              )}
            </div>
            {mode === 'mint' ? <DealDisplay /> : <TokenSelector />}
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