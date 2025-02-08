interface UploadProgress {
    status: 'preparing' | 'uploading' | 'confirming';
    progress: number;
}

interface UploadResult {
    arweaveUrl: string;
    txId: string;
}

export async function uploadToArweave(
    data: any,
    onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
    try {
        // Start with preparing status
        onProgress?.({ status: 'preparing', progress: 0 });
        
        // Simulate upload progress
        const progressInterval = setInterval(() => {
            onProgress?.({ status: 'uploading', progress: Math.min(95, Math.random() * 90 + 5) });
        }, 1000);

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        // Clear the progress interval
        clearInterval(progressInterval);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        // Show confirming status
        onProgress?.({ status: 'confirming', progress: 100 });
        
        const result = await response.json();
        return {
            arweaveUrl: result.arweaveUrl,
            txId: result.txId
        };
    } catch (error) {
        console.error('Error uploading to Arweave:', error);
        throw error;
    }
}