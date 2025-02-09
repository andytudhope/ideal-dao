import { ethers } from 'ethers';
import { getContractAddresses } from './contracts';

type TokenType = 'usds' | 'usdc' | 'usdt';

const TOKEN_DECIMALS: Record<TokenType, number> = {
    usds: 18,
    usdc: 6,
    usdt: 6
};

export async function getDealContract(signer: ethers.Signer) {
    const { abi } = await import('../deployments/DEAL.sol/DEAL.json');
    const { deal: dealAddress } = getContractAddresses();
    return new ethers.Contract(dealAddress, abi, signer);
}

export async function getTokenContract(tokenType: TokenType, signer: ethers.Signer) {
    let abi;
    switch (tokenType) {
        case 'usds':
            abi = (await import('../deployments/USDS/USDS.json')).abi;
            break;
        case 'usdc':
            abi = (await import('../deployments/USDC/USDC.json')).abi;
            break;
        case 'usdt':
            abi = (await import('../deployments/USDT/USDT.json')).abi;
            break;
    }
    const addresses = getContractAddresses();
    return new ethers.Contract(addresses[tokenType], abi, signer);
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

export async function checkContractReserves(tokenType: TokenType): Promise<{
    available: string;
    error: string | null;
}> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const dealContract = await getDealContract(signer);
        const tokenContract = await getTokenContract(tokenType, signer);
        
        const balance = await dealContract.getTokenBalance(tokenContract.target);
        
        return {
            available: ethers.formatUnits(balance, TOKEN_DECIMALS[tokenType]),
            error: null
        };
    } catch (error) {
        console.error('Error checking contract reserves:', error);
        return {
            available: '0',
            error: 'Failed to check contract reserves'
        };
    }
}

export async function checkBalance(
    tokenType: TokenType | 'deal',
    address: string
): Promise<BalanceCheck> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        let contract;
        let decimals;

        if (tokenType === 'deal') {
            contract = await getDealContract(signer);
            decimals = 18;
        } else {
            const tokenContract = await getTokenContract(tokenType as TokenType, signer);
            // Check if contract is properly initialized
            if (!tokenContract?.target) {
                throw new Error('Failed to initialize token contract');
            }
            contract = tokenContract;
            decimals = TOKEN_DECIMALS[tokenType as TokenType];
        }
        
        const balance = await contract.balanceOf(address);
        
        return {
            hasBalance: balance > BigInt(0),
            balance: ethers.formatUnits(balance, decimals),
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

export async function calculateMintAmount(
    amount: string,
    tokenType: TokenType
): Promise<AmountCalculation> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = await getDealContract(signer);
        const tokenContract = await getTokenContract(tokenType, signer);
        
        const amountInTokenDecimals = ethers.parseUnits(amount, TOKEN_DECIMALS[tokenType]);
        const dealAmount = await contract.getMintableForReserveAmount(
            tokenContract.target,
            amountInTokenDecimals
        );
        
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

export async function calculateBurnAmount(
    dealAmount: string,
    tokenType: TokenType
): Promise<AmountCalculation> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = await getDealContract(signer);
        const tokenContract = await getTokenContract(tokenType, signer);
        
        const amountInWei = ethers.parseUnits(dealAmount, 18);
        const tokenAmount = await contract.getPredictedBurn(tokenContract.target, amountInWei);
        
        return {
            amount: ethers.formatUnits(tokenAmount, TOKEN_DECIMALS[tokenType]),
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

export async function mintDeal(
    amount: string,
    tokenType: TokenType
): Promise<TransactionResult> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const dealContract = await getDealContract(signer);
        const tokenContract = await getTokenContract(tokenType, signer);
        const signerAddress = await signer.getAddress();

        const amountInTokenDecimals = ethers.parseUnits(amount, TOKEN_DECIMALS[tokenType]);

        if (tokenType === 'usdt') {
            // USDT doesn't support permit, use regular approve + mint
            const approveTx = await tokenContract.approve(
                dealContract.target,
                amountInTokenDecimals
            );
            await approveTx.wait();
            
            const mintTx = await dealContract.mint(
                tokenContract.target,
                amountInTokenDecimals
            );
            const receipt = await mintTx.wait();
            
            return {
                success: true,
                hash: mintTx.hash,
                error: null
            };
        } else {
            // USDS and USDC support EIP-2612
            const nonce = await tokenContract.nonces(signerAddress);
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const chainId = Number((await provider.getNetwork()).chainId);

            const domain = {
                name: await tokenContract.name(),
                version: '1',
                chainId,
                verifyingContract: tokenContract.target.toString()
            };
            
            const types = {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' }
                ]
            };
            
            const message = {
                owner: signerAddress,
                spender: dealContract.target.toString(),
                value: amountInTokenDecimals,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await signer.signTypedData(domain, types, message);
            const { v, r, s } = ethers.Signature.from(signature);

            const tx = await dealContract.permitAndMint(
                tokenContract.target,
                amountInTokenDecimals,
                deadline,
                v,
                r,
                s
            );
            
            const receipt = await tx.wait();
            return {
                success: true,
                hash: tx.hash,
                error: null
            };
        }
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

export async function burnDeal(
    amount: string,
    tokenType: TokenType
): Promise<TransactionResult> {
    try {
        if (!window.ethereum) throw new Error('No wallet found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const dealContract = await getDealContract(signer);
        const tokenContract = await getTokenContract(tokenType, signer);
        
        const amountInWei = ethers.parseUnits(amount, 18);
        const tx = await dealContract.burn(tokenContract.target, amountInWei);
        const receipt = await tx.wait();

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