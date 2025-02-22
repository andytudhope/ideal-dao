//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// For USDS and USDC (EIP-2612)
interface IERC20Permit {
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;

    function nonces(address owner) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// For USDT (standard ERC20)
