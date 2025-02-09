// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/DEAL.sol";
import "../src/Proposals.sol";
import "../src/Dai.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy DAI
        Dai dai = new Dai(block.chainid);

        // Deploy DEAL token
        DEAL deal = new DEAL(address(dai));

        // Initialize DEAL with 1 DAI from deployer
        dai.mint(deployer, 1e18);
        dai.approve(address(deal), 1e18);
        deal.initialise();

        // Deploy Proposals contract
        Proposals proposals = new Proposals(address(deal));

        // Fund a test account with DAI
        address testAccount = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        uint256 testAmount = 1_000_000 * 1e18; // 1 million DAI
        dai.mint(testAccount, testAmount);

        // Create deployment JSON
        string memory deploymentJson = string.concat(
            '{"chainId":', vm.toString(block.chainid),
            ',"dai":"', vm.toString(address(dai)),
            '","deal":"', vm.toString(address(deal)),
            '","proposals":"', vm.toString(address(proposals)), '"}'
        );

        // Write deployment file
        vm.writeFile("../interface/src/deployments/local.json", deploymentJson);

        // Copy ABIs
        vm.copyFile("out/Proposals.sol/Proposals.json", "../interface/src/deployments/Proposals.sol/Proposals.json");
        vm.copyFile("out/DEAL.sol/DEAL.json", "../interface/src/deployments/DEAL.sol/DEAL.json");
        vm.copyFile("out/Dai.sol/Dai.json", "../interface/src/deployments/Dai.sol/DAI.json");

        console.log("DAI deployed to:", address(dai));
        console.log("DEAL deployed to:", address(deal));
        console.log("Proposals deployed to:", address(proposals));
        console.log("Deployer address:", deployer);
        console.log("Test account funded with DAI:", testAccount);
        console.log("Test account DAI balance:", dai.balanceOf(testAccount));

        vm.stopBroadcast();
    }
}
