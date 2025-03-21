//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20Standard {
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
