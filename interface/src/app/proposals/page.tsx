"use client"
import React, { useState, useCallback, useEffect } from 'react';
import { resolveENSName } from '@/utils/ens';
import { useWallet } from '@/contexts/WalletContext';
import { ethers } from 'ethers';
import { getProposalsContract } from '@/utils/contracts';
import { uploadToArweave } from '@/utils/arweave';
import { Loader2 } from 'lucide-react';

interface FormData {
  withdrawalAddress: string;
  minimumAmount: string;
  name: string;
  problemStatement: string;
  description: string;
  links: string;
}

type TxStatus = 'idle' | 'preparing' | 'uploading' | 'confirming' | 'pending' | 'mining' | 'success';

const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const isENSName = (value: string) => value.endsWith('.eth');

const getEtherscanUrl = (txHash: string) => {
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

const getArweaveExplorerUrl = (txId: string) => {
  return `https://arweave.net/${txId}`;
};

export default function ProposalsPage() {
  const { address } = useWallet();
  
  const [formData, setFormData] = useState<FormData>({
    withdrawalAddress: '',
    minimumAmount: '',
    name: '',
    problemStatement: '',
    description: '',
    links: '',
  });
  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const [originalENS, setOriginalENS] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isResolvingENS, setIsResolvingENS] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [txHash, setTxHash] = useState<string>('');
  const [arweaveTxId, setArweaveTxId] = useState<string>('');

  useEffect(() => {
    if (address) {
      setFormData(prev => ({
        ...prev,
        withdrawalAddress: address
      }));
      setResolvedAddress(address);
    }
  }, [address]);

  const handleAddressChange = useCallback(async (value: string) => {
    setFormData(prev => ({ ...prev, withdrawalAddress: value }));
    setIsResolvingENS(true);
    setError('');
    
    if (isENSName(value)) {
      setOriginalENS(value);
      const result = await resolveENSName(value);
      if (result.address) {
        setResolvedAddress(result.address);
      } else if (result.error) {
        setError(result.error);
      }
    } else {
      setOriginalENS('');
      setResolvedAddress('');
    }
    
    setIsResolvingENS(false);
  }, []);

  const validateForm = useCallback((): boolean => {
    if (!resolvedAddress) {
      setError('Please enter a valid withdrawal address');
      return false;
    }

    const amount = parseFloat(formData.minimumAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid minimum amount');
      return false;
    }

    return true;
  }, [formData.minimumAmount, resolvedAddress]);

  const submitProposal = async (arweaveUrl: string) => {
    if (!window.ethereum) throw new Error('No wallet found');
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const contract = await getProposalsContract(signer);
    const amountInWei = ethers.parseUnits(formData.minimumAmount, 18);

    const tx = await contract.createProposal(
        amountInWei,
        resolvedAddress || formData.withdrawalAddress,
        arweaveUrl
    );
    
    return tx;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    setTxStatus('preparing');
    setTxHash('');
    setArweaveTxId('');
    setUploadProgress(0);

    try {
      if (!validateForm()) {
        setIsSubmitting(false);
        setTxStatus('idle');
        return;
      }

      // Prepare proposal data
      const proposalData = {
        name: formData.name,
        problemStatement: formData.problemStatement,
        description: formData.description,
        links: formData.links,
        submittedBy: address,
        withdrawalAddress: resolvedAddress || formData.withdrawalAddress,
        minimumAmount: formData.minimumAmount,
        timestamp: new Date().toISOString()
      };

      // Upload to Arweave
      setTxStatus('uploading');
      const { arweaveUrl, txId } = await uploadToArweave(proposalData, (progress) => {
        setUploadProgress(progress.progress);
        setTxStatus(progress.status);
      });
      setArweaveTxId(txId);

      // Submit to contract
      setTxStatus('pending');
      const tx = await submitProposal(arweaveUrl);
      setTxStatus('mining');
      setTxHash(tx.hash);
      
      await tx.wait();
      setTxStatus('success');
      
      console.log('Proposal submitted successfully:', {
        txHash: tx.hash,
        arweaveUrl,
        arweaveTxId: txId
      });
      
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit proposal');
      setTxStatus('idle');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, resolvedAddress, address, validateForm]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-2">Create a New Proposal</h1>
        <p className="text-gray-600 mb-6">
          Submit your proposal for funding. All proposals require a valid withdrawal address and minimum funding amount.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Required Fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="withdrawalAddress" className="block text-sm font-medium text-gray-700">
                Withdrawal Address (ENS or Ethereum address) *
              </label>
              <input
                id="withdrawalAddress"
                type="text"
                value={formData.withdrawalAddress}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="vitalik.eth or 0x..."
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-sm md:text-base"
              />
              {isResolvingENS && (
                <p className="mt-1 text-sm text-blue-500">Resolving address...</p>
              )}
              {originalENS && resolvedAddress && !isResolvingENS && (
                <p className="mt-1 text-sm text-gray-500 font-mono">
                  Resolved address: {window.innerWidth < 768 ? shortenAddress(resolvedAddress) : resolvedAddress}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="minimumAmount" className="block text-sm font-medium text-gray-700">
                Minimum Amount (in DEAL) *
              </label>
              <input
                id="minimumAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.minimumAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, minimumAmount: e.target.value }))}
                placeholder="1000"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div className="space-y-4 pt-6 border-t">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Proposal Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Awesome Project"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="problemStatement" className="block text-sm font-medium text-gray-700">
                Problem Statement
              </label>
              <textarea
                id="problemStatement"
                value={formData.problemStatement}
                onChange={(e) => setFormData(prev => ({ ...prev, problemStatement: e.target.value }))}
                placeholder="What problem are you trying to solve?"
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description of Work
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the work you'll do to solve this problem"
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="links" className="block text-sm font-medium text-gray-700">
                Supporting Links
              </label>
              <textarea
                id="links"
                value={formData.links}
                onChange={(e) => setFormData(prev => ({ ...prev, links: e.target.value }))}
                placeholder="Enter links to supporting documentation"
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status Messages */}
          {txStatus !== 'idle' && (
            <div className={`p-4 ${
              txStatus === 'success' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
            } border rounded-md`}>
              <div className="flex items-center space-x-2">
                {txStatus !== 'success' && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                )}
                <div className="flex-1">
                  <p className={`text-sm ${
                    txStatus === 'success' ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {txStatus === 'preparing' && 'Preparing upload...'}
                    {txStatus === 'uploading' && (
                      <>
                        Uploading to Arweave...
                        <span className="ml-1 font-mono">{uploadProgress}%</span>
                      </>
                    )}
                    {txStatus === 'confirming' && 'Confirming Arweave upload...'}
                    {txStatus === 'pending' && 'Submitting proposal to blockchain...'}
                    {txStatus === 'mining' && 'Waiting for transaction to be mined...'}
                    {txStatus === 'success' && 'Proposal successfully submitted! 🎉'}
                  </p>
                  {(txStatus === 'uploading' || txStatus === 'confirming') && (
                    <div className="w-full h-2 bg-blue-100 rounded-full mt-2">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Links */}
              <div className="mt-2 space-y-1">
                {arweaveTxId && (
                  <a 
                    href={getArweaveExplorerUrl(arweaveTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline block"
                  >
                    View content on Arweave Explorer
                  </a>
                )}
                {txHash && (
                  <a 
                    href={getEtherscanUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline block"
                  >
                    View transaction on Etherscan
                  </a>
                )}
              </div>
            </div>
          )}

          <button
              type="submit"
              disabled={isSubmitting || isResolvingENS || txStatus !== 'idle'}
              className="w-full py-2 px-4 bg-black hover:bg-gray-800 text-white font-semibold rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                  disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
              {txStatus === 'pending' ? 'Submitting...' : 
              txStatus === 'mining' ? 'Mining...' : 
              txStatus === 'success' ? 'Submitted!' : 
              'Submit Proposal'}
          </button>
        </form>
      </div>
    </div>
  );
}