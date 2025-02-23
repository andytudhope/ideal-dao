//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../src/ERC20.sol";

contract MockUSDS is ERC20 {
    constructor() ERC20("USDS Stablecoin", "USDS", 18) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
