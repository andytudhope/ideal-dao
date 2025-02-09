import { ethers } from 'ethers';
import { getContractAddresses } from './contracts';

export async function getDealContract(signer: ethers.Signer) {
    const { abi } = await import('../deployments/DEAL.sol/DEAL.json');
    const { deal: dealAddress } = getContractAddresses();
    return new ethers.Contract(dealAddress, abi, signer);
}

export async function getDaiContract(signer: ethers.Signer) {
    const { abi } = await import('../deployments/Dai.sol/DAI.json');
    const { dai: daiAddress } = getContractAddresses();
    return new ethers.Contract(daiAddress, abi, signer);
}

export type AmountCalculation = {
    amount: string;
    error: string | null;
};

export type BalanceCheck = {
    hasBalance: boolean;
    balance: string;
    error: string | null;
};

export async function checkBalance(tokenType: 'dai' | 'deal', address: string): Promise<BalanceCheck> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = tokenType === 'dai' 
            ? await getDaiContract(signer)
            : await getDealContract(signer);
        
        const balance = await contract.balanceOf(address);
        return {
            hasBalance: balance > 0,
            balance: ethers.formatUnits(balance, 18),
            error: null
        };
    } catch (error) {
        console.error('Error checking balance:', error);
        return {
            hasBalance: false,
            balance: '0',
            error: 'Failed to check balance'
        };
    }
}

export async function calculateMintAmount(daiAmount: string): Promise<AmountCalculation> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = await getDealContract(signer);
        
        const amountInWei = ethers.parseUnits(daiAmount, 18);
        const dealAmount = await contract.getMintableForReserveAmount(amountInWei);
        
        return {
            amount: ethers.formatUnits(dealAmount, 18),
            error: null
        };
    } catch (error) {
        console.error('Error calculating mint amount:', error);
        return {
            amount: '',
            error: 'Failed to calculate mint amount'
        };
    }
}

export async function calculateBurnAmount(dealAmount: string): Promise<AmountCalculation> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = await getDealContract(signer);
        
        const amountInWei = ethers.parseUnits(dealAmount, 18);
        const daiAmount = await contract.getPredictedBurn(amountInWei);
        
        return {
            amount: ethers.formatUnits(daiAmount, 18),
            error: null
        };
    } catch (error) {
        console.error('Error calculating burn amount:', error);
        return {
            amount: '',
            error: 'Failed to calculate burn amount'
        };
    }
}

export type TransactionResult = {
    success: boolean;
    hash: string | null;
    error: string | null;
};

export async function mintDeal(amount: string): Promise<TransactionResult> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const dealContract = await getDealContract(signer);
        const daiContract = await getDaiContract(signer);
        const signerAddress = await signer.getAddress();

        const nonce = await daiContract.nonces(signerAddress);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const chainId = Number((await provider.getNetwork()).chainId);

        const domain = {
            name: 'Dai Stablecoin', 
            version: '1',
            chainId,
            verifyingContract: daiContract.target.toString()
        };
        
        const types = {
            Permit: [
                { name: 'holder', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'nonce', type: 'uint256' },
                { name: 'expiry', type: 'uint256' },
                { name: 'allowed', type: 'bool' }
            ]
        };
        
        const message = {
            holder: signerAddress,
            spender: dealContract.target.toString(),
            nonce: ethers.toBigInt(nonce), 
            expiry: ethers.toBigInt(deadline), 
            allowed: true 
        };

        console.log(message)

        const signature = await signer.signTypedData(
            domain,
            types,
            message
        );
        
        const signatureArray = ethers.Signature.from(signature);
        const v = signatureArray.v;
        const r = signatureArray.r;
        const s = signatureArray.s;

        const amountInWei = ethers.parseUnits(amount, 18);

        const populatedTx = await dealContract.permitAndMint.populateTransaction(
            amountInWei,
            nonce,
            deadline,
            v,
            r,
            s
        );

        const tx = await signer.sendTransaction({
            to: populatedTx.to,
            data: populatedTx.data,
            gasLimit: ethers.parseUnits("3000000", "wei"),
        })

        const receipt = await tx.wait();
        console.log('Transaction receipt:', receipt);

        return {
            success: true,
            hash: tx.hash,
            error: null
        };
    } catch (err) {
        console.error('Error minting DEAL:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to mint DEAL';
        return {
            success: false,
            hash: null,
            error: errorMessage
        };
    }
}

export async function burnDeal(amount: string): Promise<TransactionResult> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = await getDealContract(signer);
        
        const amountInWei = ethers.parseUnits(amount, 18);
        const tx = await contract.burn(amountInWei);
        await tx.wait();

        return {
            success: true,
            hash: tx.hash,
            error: null
        };
    } catch (error) {
        console.error('Error burning DEAL:', error);
        return {
            success: false,
            hash: null,
            error: error instanceof Error ? error.message : 'Failed to burn DEAL'
        };
    }
}