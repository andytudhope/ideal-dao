import { ethers } from 'ethers';

export type WalletConnectionResult = {
  address: string | null;
  error: string | null;
  isConnecting: boolean;
};

export async function connectWallet(): Promise<WalletConnectionResult> {
  if (!window.ethereum) {
    return {
      address: null,
      error: 'No wallet found. Please install MetaMask.',
      isConnecting: false
    };
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    // Request account access
    const accounts = await provider.send("eth_requestAccounts", []);
    const address = accounts[0];
    
    // Get the signer for future use
    const signer = await provider.getSigner();
    
    return {
      address,
      error: null,
      isConnecting: false
    };
  } catch (error) {
    console.error('Wallet connection error:', error);
    return {
      address: null,
      error: 'Failed to connect wallet. Please try again.',
      isConnecting: false
    };
  }
}