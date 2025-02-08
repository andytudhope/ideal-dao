export type ENSResolutionResult = {
  address: string | null;
  error: string | null;
};

export async function resolveENSName(nameOrAddress: string): Promise<ENSResolutionResult> {
  try {
      const response = await fetch(
          `/api/resolve-ens?address=${encodeURIComponent(nameOrAddress)}`
      );

      if (!response.ok) {
          const error = await response.json();
          return {
              address: null,
              error: error.error || 'Failed to resolve address'
          };
      }

      const data = await response.json();
      return {
          address: data.address,
          error: null
      };
  } catch (error) {
      console.error('ENS resolution error:', error);
      return {
          address: null,
          error: 'Failed to resolve address'
      };
  }
}