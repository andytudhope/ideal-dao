import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const nameOrAddress = searchParams.get('address');

        if (!nameOrAddress) {
            return NextResponse.json(
                { error: 'No address provided' },
                { status: 400 }
            );
        }

        const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);

        // Check if it's already a valid Ethereum address
        if (ethers.isAddress(nameOrAddress)) {
            return NextResponse.json({ address: nameOrAddress });
        }

        // Check if it's an ENS name
        const ensName = nameOrAddress as string;
        if (ensName.endsWith('.eth')) {
            const resolvedAddress = await provider.resolveName(nameOrAddress);
            if (resolvedAddress) {
                return NextResponse.json({ address: resolvedAddress });
            } else {
                return NextResponse.json(
                    { error: 'Could not resolve ENS name' },
                    { status: 400 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Invalid address or ENS name' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Error resolving ENS:', error);
        return NextResponse.json(
            { error: 'Failed to resolve address' },
            { status: 500 }
        );
    }
}