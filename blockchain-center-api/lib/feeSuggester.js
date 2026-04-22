import { parseUnits } from "ethers";

/**
 * FeeSuggester provides optimized gas price suggestions.
 * Specifically handles Polygon's 30 Gwei floor and EIP-1559 requirements.
 */
class FeeSuggester {
  /**
   * Suggests fees for a specific network.
   * @param {string} network - bsc or polygon
   * @param {import("ethers").Provider} provider
   */
  async suggest(network, provider) {
    const feeData = await provider.getFeeData();
    
    // Default response
    const suggestion = {
      gasPrice: feeData.gasPrice?.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      network: network
    };

    // Polygon Specific Optimization
    // Polygon validators often reject transactions with < 30 Gwei priority fee
    if (network.toLowerCase() === "polygon" || network.toLowerCase() === "pol") {
      const minPriorityFee = parseUnits("30", "gwei");
      
      let priorityFee = feeData.maxPriorityFeePerGas || 0n;
      if (priorityFee < minPriorityFee) {
          priorityFee = minPriorityFee;
      }

      // Ensure maxFeePerGas is at least baseFee + priorityFee
      // We assume a healthy margin for base fee fluctuation
      const maxFee = (feeData.maxFeePerGas || 0n) > (priorityFee * 2n) 
        ? feeData.maxFeePerGas 
        : (priorityFee * 2n);

      suggestion.maxPriorityFeePerGas = priorityFee.toString();
      suggestion.maxFeePerGas = maxFee.toString();
      suggestion.gasPrice = maxFee.toString(); // Fallback for non-EIP1559 legacy calls
    }

    return suggestion;
  }
}

export const feeSuggester = new FeeSuggester();
