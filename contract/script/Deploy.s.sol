// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/DEAL.sol";
import "../src/Proposals.sol";
import "../test/mocks/MockUSDS.sol";
import "../test/mocks/MockUSDC.sol";
import "../test/mocks/MockUSDT.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy stablecoins
        MockUSDS usds = new MockUSDS();
        MockUSDC usdc = new MockUSDC();
        MockUSDT usdt = new MockUSDT();

        // Deploy DEAL token with all stablecoins
        DEAL deal = new DEAL(address(usds), address(usdc), address(usdt));

        // Initialize DEAL with 1 USDS from deployer
        usds.mint(deployer, 1e18);
        usds.approve(address(deal), 1e18);
        deal.initialise();

        // Deploy Proposals contract
        Proposals proposals = new Proposals(address(deal));

        // Fund test account
        address testAccount = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

        // 1 million of each token
        uint256 usdsAmount = 1_000_000 * 1e18; // 18 decimals
        uint256 usdAmount = 1_000_000 * 1e6; // 6 decimals

        usds.mint(testAccount, usdsAmount);
        usdc.mint(testAccount, usdAmount);
        usdt.mint(testAccount, usdAmount);

        // Create deployment JSON
        string memory deploymentJson = string.concat(
            '{"chainId":',
            vm.toString(block.chainid),
            ',"usds":"',
            vm.toString(address(usds)),
            '","usdc":"',
            vm.toString(address(usdc)),
            '","usdt":"',
            vm.toString(address(usdt)),
            '","deal":"',
            vm.toString(address(deal)),
            '","proposals":"',
            vm.toString(address(proposals)),
            '"}'
        );

        // Write deployment file
        vm.writeFile("../interface/src/deployments/local.json", deploymentJson);

        // Copy ABIs
        vm.copyFile("out/Proposals.sol/Proposals.json", "../interface/src/deployments/Proposals.sol/Proposals.json");
        vm.copyFile("out/DEAL.sol/DEAL.json", "../interface/src/deployments/DEAL.sol/DEAL.json");
        vm.copyFile("out/MockUSDS.sol/MockUSDS.json", "../interface/src/deployments/USDS/USDS.json");
        vm.copyFile("out/MockUSDC.sol/MockUSDC.json", "../interface/src/deployments/USDC/USDC.json");
        vm.copyFile("out/MockUSDT.sol/MockUSDT.json", "../interface/src/deployments/USDT/USDT.json");

        // Log deployments
        console.log("USDS deployed to:", address(usds));
        console.log("USDC deployed to:", address(usdc));
        console.log("USDT deployed to:", address(usdt));
        console.log("DEAL deployed to:", address(deal));
        console.log("Proposals deployed to:", address(proposals));
        console.log("Deployer address:", deployer);
        console.log("Test account:", testAccount);
        console.log("Test account balances:");
        console.log("  USDS:", usds.balanceOf(testAccount));
        console.log("  USDC:", usdc.balanceOf(testAccount));
        console.log("  USDT:", usdt.balanceOf(testAccount));

        vm.stopBroadcast();
    }
}
