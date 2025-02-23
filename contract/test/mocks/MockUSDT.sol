//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../src/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT", 6) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
