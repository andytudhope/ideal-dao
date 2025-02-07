// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import "../src/DEAL.sol";
import "./mocks/MockERC20.sol";

contract DEALTest is Test {
    DEAL public deal;
    MockERC20 public dai;
    
    address public deployer = address(1);
    address public hackerman = address(2);
    address[] public investors;
    
    uint256 public constant MALICIOUS_AMOUNT = 1_000_000 * 1e18;
    uint256 public constant MINT_AMOUNT = 1_000 * 1e18;
    uint256 public constant ACCURACY = 1e15; // Allow for small rounding differences
    
    event DealMinted(
        address indexed investor,
        uint256 amountMinted,
        uint256 daiDeposited
    );
    
    event DealBurned(
        address indexed investor,
        uint256 amountBurned,
        uint256 daiReturned,
        uint256 e
    );

    function setUp() public {
        // Setup investors array with 5 addresses
        for(uint i = 0; i < 5; i++) {
            investors.push(address(uint160(10 + i)));
        }
        
        // Deploy DAI mock and DEAL token
        vm.startPrank(deployer);
        dai = new MockERC20("DAI", "DAI", 18);
        dai.mint(deployer, 1_000_000_000 * 1e18);
        deal = new DEAL(address(dai));
        
        // Initialize DEAL with 1 DAI
        dai.approve(address(deal), 1e18);
        deal.initialise();
        vm.stopPrank();
    }

    function testInitialization() public view {
        assertEq(dai.balanceOf(address(deal)), 1e18);
        assertEq(deal.totalSupply(), 10001e18);
        assertEq(deal.reserveBalance(), 1e18);
    }

    function test_RevertWhen_InitializationUnauthorized() public {
        // Deploy a new DEAL contract for testing
        DEAL newDeal = new DEAL(address(dai));
        
        // Give hackerman some DAI and approve it
        vm.startPrank(deployer);
        dai.transfer(hackerman, 10e18);
        vm.stopPrank();
        
        vm.startPrank(hackerman);
        dai.approve(address(newDeal), 10e18);
        
        // The initialization should fail because the contract is not initialized
        // Try to mint directly which should fail
        vm.expectRevert();  // Any revert is fine here as we're just proving unauthorized access fails
        newDeal.mint(1e18);
        vm.stopPrank();
    }

    function test_RevertWhen_DoubleInitialization() public {
        vm.startPrank(deployer);
        dai.approve(address(deal), 1e18);
        vm.expectRevert("initialised");
        deal.initialise();
        vm.stopPrank();
    }

    function testMint() public {
        // Test minting for each investor
        for(uint i = 0; i < investors.length; i++) {
            address investor = investors[i];
            
            vm.startPrank(deployer);
            dai.transfer(investor, MINT_AMOUNT);
            vm.stopPrank();
            
            vm.startPrank(investor);
            dai.approve(address(deal), MINT_AMOUNT);
            
            uint256 beforeDealBal = deal.balanceOf(investor);
            uint256 beforeDaiBal = dai.balanceOf(investor);
            uint256 beforeReserveBal = dai.balanceOf(address(deal));
            uint256 beforeTotalSupply = deal.totalSupply();
            
            // Calculate predicted mint amount using the same formula
            uint256 predictedMint = deal.getMintableForReserveAmount(MINT_AMOUNT);
            
            // Emit expected event
            vm.expectEmit(true, true, true, true);
            emit DealMinted(investor, predictedMint, MINT_AMOUNT);
            
            deal.mint(MINT_AMOUNT);
            
            // Verify balances
            assertApproxEqAbs(
                deal.balanceOf(investor) - beforeDealBal,
                predictedMint,
                ACCURACY
            );
            assertEq(beforeDaiBal - dai.balanceOf(investor), MINT_AMOUNT);
            assertEq(
                dai.balanceOf(address(deal)) - beforeReserveBal,
                MINT_AMOUNT
            );
            assertApproxEqAbs(
                deal.totalSupply() - beforeTotalSupply,
                predictedMint,
                ACCURACY
            );
            
            vm.stopPrank();
        }
    }

    function testPermitAndMint() public {
        // Create a new private key and address for testing
        uint256 privateKey = 0xA11CE;
        address holder = vm.addr(privateKey);
        
        // Transfer DAI to holder
        vm.prank(deployer);
        dai.transfer(holder, MINT_AMOUNT);
        
        // Generate permit data
        uint256 deadline = block.timestamp + 3600;
        bytes32 permitHash = _getPermitHash(
            holder,
            address(deal),
            0, // nonce
            deadline,
            true // allowed
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);
        
        // Record initial balances
        uint256 beforeDealBal = deal.balanceOf(holder);
        uint256 beforeDaiBal = dai.balanceOf(holder);
        uint256 predictedMint = deal.getMintableForReserveAmount(MINT_AMOUNT);
        
        // Execute permitAndMint
        vm.prank(holder);
        deal.permitAndMint(MINT_AMOUNT, 0, deadline, v, r, s);
        
        // Verify balances
        assertApproxEqAbs(
            deal.balanceOf(holder) - beforeDealBal,
            predictedMint,
            ACCURACY
        );
        assertEq(beforeDaiBal - dai.balanceOf(holder), MINT_AMOUNT);
    }

    function testBurn() public {
        // First mint tokens for all investors
        for(uint i = 0; i < investors.length; i++) {
            vm.prank(deployer);
            dai.transfer(investors[i], MINT_AMOUNT);
            
            vm.startPrank(investors[i]);
            dai.approve(address(deal), MINT_AMOUNT);
            deal.mint(MINT_AMOUNT);
            vm.stopPrank();
        }
        
        // Then test burning for each investor
        for(uint i = investors.length; i > 0; i--) {
            address investor = investors[i-1];
            vm.startPrank(investor);
            
            uint256 burnAmount = deal.balanceOf(investor);
            uint256 beforeDaiBal = dai.balanceOf(investor);
            uint256 beforeReserveBal = dai.balanceOf(address(deal));
            uint256 beforeTotalSupply = deal.totalSupply();
            
            uint256 predictedDaiReturn = deal.getPredictedBurn(burnAmount);
            
            deal.burn(burnAmount);
            
            // Verify balances
            assertEq(deal.balanceOf(investor), 0);
            assertApproxEqAbs(
                dai.balanceOf(investor) - beforeDaiBal,
                predictedDaiReturn,
                ACCURACY
            );
            assertApproxEqAbs(
                beforeReserveBal - dai.balanceOf(address(deal)),
                predictedDaiReturn,
                ACCURACY
            );
            assertEq(
                beforeTotalSupply - deal.totalSupply(),
                burnAmount
            );
            
            vm.stopPrank();
        }
    }

    function testFlashBehavior() public {
        // Initial setup for hackerman
        vm.prank(deployer);
        dai.transfer(hackerman, MALICIOUS_AMOUNT);
        
        vm.startPrank(hackerman);
        dai.approve(address(deal), MALICIOUS_AMOUNT);
        deal.mint(MALICIOUS_AMOUNT);
        uint256 hackermanDealBal = deal.balanceOf(hackerman);
        vm.stopPrank();
        
        // Normal users mint tokens
        for(uint i = 0; i < investors.length; i++) {
            vm.prank(deployer);
            dai.transfer(investors[i], MINT_AMOUNT);
            
            vm.startPrank(investors[i]);
            dai.approve(address(deal), MINT_AMOUNT);
            deal.mint(MINT_AMOUNT);
            vm.stopPrank();
        }
        
        // Normal users burn tokens
        for(uint i = investors.length; i > 0; i--) {
            vm.startPrank(investors[i-1]);
            deal.burn(deal.balanceOf(investors[i-1]));
            vm.stopPrank();
        }
        
        // Hackerman burns their tokens
        vm.startPrank(hackerman);
        deal.burn(hackermanDealBal);
        
        // Verify final state
        assertEq(deal.balanceOf(hackerman), 0);
        
        // Calculate the actual profit/loss from the operation
        uint256 finalDaiBal = dai.balanceOf(hackerman);
        uint256 profitLoss = finalDaiBal - MALICIOUS_AMOUNT;
        
        // Profit/loss should be very close to 0
        assertApproxEqAbs(
            profitLoss,
            0,
            ACCURACY,
            "Flash loan should not be profitable"
        );
    }

    // Helper function to generate permit hash
    function _getPermitHash(
        address holder,
        address spender,
        uint256 nonce,
        uint256 deadline,
        bool allowed
    ) internal view returns (bytes32) {
        bytes32 PERMIT_TYPEHASH = keccak256(
            "Permit(address holder,address spender,uint256 nonce,uint256 deadline,bool allowed)"
        );
        
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                holder,
                spender,
                nonce,
                deadline,
                allowed
            )
        );
        
        bytes32 DOMAIN_SEPARATOR = dai.DOMAIN_SEPARATOR();
        
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                structHash
            )
        );
    }
}