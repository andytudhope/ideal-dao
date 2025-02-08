import { NextResponse } from 'next/server';
import Arweave from 'arweave';

const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});

let key: any = null;

async function getKey() {
    if (!key) {
        const walletData = process.env.ARWEAVE_WALLET;
        if (!walletData) throw new Error('Arweave wallet not configured');
        key = JSON.parse(Buffer.from(walletData, 'base64').toString());
    }
    return key;
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const key = await getKey();
        
        // Create transaction
        const transaction = await arweave.createTransaction({
            data: JSON.stringify(data)
        }, key);

        // Add tags
        transaction.addTag('Content-Type', 'application/json');
        transaction.addTag('App', 'IdealDAO-Proposals');
        
        // Sign the transaction
        await arweave.transactions.sign(transaction, key);
        
        // Post the transaction
        await arweave.transactions.post(transaction);

        return NextResponse.json({
            success: true,
            arweaveUrl: `ar://${transaction.id}`,
            txId: transaction.id
        });
    } catch (error) {
        console.error('Error uploading to Arweave:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error during upload' },
            { status: 500 }
        );
    }
}