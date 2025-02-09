interface DeploymentInfo {
    usds: string;
    usdc: string;
    usdt: string;
    deal: string;
    proposals: string;
    chainId: number;
  }
  
  export function getDeployments(): DeploymentInfo {
    try {
      if (process.env.NEXT_PUBLIC_NETWORK === 'local') {
        const deployments = require('../deployments/local.json');
        return deployments;
      }
      
      // Add other networks here when needed
      throw new Error('Network not configured');
    } catch (error) {
      console.error('Error reading deployments:', error);
      throw error;
    }
  }