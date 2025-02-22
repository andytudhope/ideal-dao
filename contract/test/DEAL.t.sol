// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import "../src/DEAL.sol";
import "./mocks/MockUSDS.sol";
import "./mocks/MockUSDC.sol";
import "./mocks/MockUSDT.sol";

contract DEALTest is Test {
    DEAL public deal;
    MockUSDS public usds;
    MockUSDC public usdc;
    MockUSDT public usdt;

    address public deployer = address(1);
    address public hackerman = address(2);
    address[] public investors;

    uint256 public constant MALICIOUS_AMOUNT_18 = 1_000_000 * 1e18;
    uint256 public constant MALICIOUS_AMOUNT_6 = 1_000_000 * 1e6;
    uint256 public constant MINT_AMOUNT_18 = 1_000 * 1e18;
    uint256 public constant MINT_AMOUNT_6 = 1_000 * 1e6;
    uint256 public constant ACCURACY = 1e15; // Allow for small rounding differences

    event DealMinted(address indexed investor, uint256 amountMinted, uint256 amountDeposited, address tokenDeposited);

    event DealBurned(
        address indexed investor, uint256 amountBurned, uint256 amountReturned, address tokenReturned, uint256 e
    );

    function setUp() public {
        // Setup investors array with 5 addresses
        for (uint256 i = 0; i < 5; i++) {
            investors.push(address(uint160(10 + i)));
        }

        // Deploy stablecoin mocks and DEAL token
        vm.startPrank(deployer);
        usds = new MockUSDS();
        usdc = new MockUSDC();
        usdt = new MockUSDT();

        usds.mint(deployer, 1_000_000_000 * 1e18);
        usdc.mint(deployer, 1_000_000_000 * 1e6);
        usdt.mint(deployer, 1_000_000_000 * 1e6);

        deal = new DEAL(address(usds), address(usdc), address(usdt));

        // Initialize DEAL with 1 USDS
        usds.approve(address(deal), 1e18);
        deal.initialise();
        vm.stopPrank();
    }

    function testInitialization() public {
        assertEq(usds.balanceOf(address(deal)), 1e18);
        assertEq(deal.totalSupply(), 10001e18);
        assertEq(deal.totalReserveBalance(), 1e18);
        assertTrue(deal.supportsPermit(address(usds)));
        assertTrue(deal.supportsPermit(address(usdc)));
        assertFalse(deal.supportsPermit(address(usdt)));
    }

    function testSupportedTokens() public {
        address[] memory tokens = deal.getSupportedTokens();
        assertEq(tokens.length, 3);
        assertEq(tokens[0], address(usds));
        assertEq(tokens[1], address(usdc));
        assertEq(tokens[2], address(usdt));
    }

    function test_RevertWhen_InitializationUnauthorized() public {
        // Deploy a new DEAL contract for testing
        DEAL newDeal = new DEAL(address(usds), address(usdc), address(usdt));

        vm.startPrank(deployer);
        usds.transfer(hackerman, 10e18);
        vm.stopPrank();

        vm.startPrank(hackerman);
        usds.approve(address(newDeal), 10e18);

        vm.expectRevert("!initialised");
        newDeal.mint(address(usds), 1e18);
        vm.stopPrank();
    }

    function test_RevertWhen_DoubleInitialization() public {
        vm.startPrank(deployer);
        usds.approve(address(deal), 1e18);
        vm.expectRevert("initialised");
        deal.initialise();
        vm.stopPrank();
    }

    function testMintWithAllTokens() public {
        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];

            // Test USDS (18 decimals)
            _testMintWithToken(investor, usds, MINT_AMOUNT_18);

            // Test USDC (6 decimals)
            _testMintWithToken(investor, usdc, MINT_AMOUNT_6);

            // Test USDT (6 decimals)
            _testMintWithToken(investor, usdt, MINT_AMOUNT_6);
        }
    }

    function _testMintWithToken(address investor, ERC20 token, uint256 mintAmount) internal {
        vm.startPrank(deployer);
        token.transfer(investor, mintAmount);
        vm.stopPrank();

        vm.startPrank(investor);
        token.approve(address(deal), mintAmount);

        uint256 beforeDealBal = deal.balanceOf(investor);
        uint256 beforeTokenBal = token.balanceOf(investor);
        uint256 beforeReserveBal = token.balanceOf(address(deal));
        uint256 beforeTotalSupply = deal.totalSupply();

        uint256 predictedMint = deal.getMintableForReserveAmount(address(token), mintAmount);

        vm.expectEmit(true, true, true, true);
        emit DealMinted(investor, predictedMint, mintAmount, address(token));

        deal.mint(address(token), mintAmount);

        assertApproxEqAbs(deal.balanceOf(investor) - beforeDealBal, predictedMint, ACCURACY);
        assertEq(beforeTokenBal - token.balanceOf(investor), mintAmount);
        assertEq(token.balanceOf(address(deal)) - beforeReserveBal, mintAmount);
        assertApproxEqAbs(deal.totalSupply() - beforeTotalSupply, predictedMint, ACCURACY);

        vm.stopPrank();
    }

    function testPermitAndMintWithPermitTokens() public {
        // Test with USDS
        _testPermitAndMint(usds, MINT_AMOUNT_18);

        // Test with USDC
        _testPermitAndMint(usdc, MINT_AMOUNT_6);
    }

    function _testPermitAndMint(ERC20 token, uint256 amount) internal {
        uint256 privateKey = 0xA11CE;
        address holder = vm.addr(privateKey);

        vm.prank(deployer);
        token.transfer(holder, amount);

        uint256 deadline = block.timestamp + 3600;

        bytes32 permitHash =
            _getEIP2612PermitHash(address(token), holder, address(deal), amount, token.nonces(holder), deadline);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);

        uint256 beforeDealBal = deal.balanceOf(holder);
        uint256 beforeTokenBal = token.balanceOf(holder);
        uint256 predictedMint = deal.getMintableForReserveAmount(address(token), amount);

        vm.prank(holder);
        deal.permitAndMint(address(token), amount, deadline, v, r, s);

        assertApproxEqAbs(deal.balanceOf(holder) - beforeDealBal, predictedMint, ACCURACY);
        assertEq(beforeTokenBal - token.balanceOf(holder), amount);
    }

    function testBurnUSDS() public {
        // First mint tokens
        vm.startPrank(deployer);
        usds.transfer(hackerman, MINT_AMOUNT_18);
        vm.stopPrank();

        vm.startPrank(hackerman);
        usds.approve(address(deal), MINT_AMOUNT_18);
        deal.mint(address(usds), MINT_AMOUNT_18);

        // Then test burning
        uint256 burnAmount = deal.balanceOf(hackerman);
        uint256 beforeUsdsBal = usds.balanceOf(hackerman);
        uint256 beforeReserveBal = usds.balanceOf(address(deal));
        uint256 beforeTotalSupply = deal.totalSupply();

        uint256 predictedReturn = deal.getPredictedBurn(address(usds), burnAmount);

        deal.burn(address(usds), burnAmount);

        // Verify balances
        assertEq(deal.balanceOf(hackerman), 0);
        assertApproxEqAbs(usds.balanceOf(hackerman) - beforeUsdsBal, predictedReturn, ACCURACY);
        assertApproxEqAbs(beforeReserveBal - usds.balanceOf(address(deal)), predictedReturn, ACCURACY);
        assertEq(beforeTotalSupply - deal.totalSupply(), burnAmount);
        vm.stopPrank();
    }

    function testBurnUSDC() public {
        // First mint tokens
        vm.startPrank(deployer);
        usdc.transfer(hackerman, MINT_AMOUNT_6);
        vm.stopPrank();

        vm.startPrank(hackerman);
        usdc.approve(address(deal), MINT_AMOUNT_6);
        deal.mint(address(usdc), MINT_AMOUNT_6);

        // Then test burning
        uint256 burnAmount = deal.balanceOf(hackerman);
        uint256 beforeUsdcBal = usdc.balanceOf(hackerman);
        uint256 beforeReserveBal = usdc.balanceOf(address(deal));
        uint256 beforeTotalSupply = deal.totalSupply();

        uint256 predictedReturn = deal.getPredictedBurn(address(usdc), burnAmount);

        deal.burn(address(usdc), burnAmount);

        // Verify balances
        assertEq(deal.balanceOf(hackerman), 0);
        assertApproxEqAbs(
            usdc.balanceOf(hackerman) - beforeUsdcBal,
            predictedReturn,
            ACCURACY / 1e12 // Adjust accuracy for 6 decimals
        );
        assertApproxEqAbs(
            beforeReserveBal - usdc.balanceOf(address(deal)),
            predictedReturn,
            ACCURACY / 1e12 // Adjust accuracy for 6 decimals
        );
        assertEq(beforeTotalSupply - deal.totalSupply(), burnAmount);
        vm.stopPrank();
    }

    function testBurnUSDT() public {
        // First mint tokens
        vm.startPrank(deployer);
        usdt.transfer(hackerman, MINT_AMOUNT_6);
        vm.stopPrank();

        vm.startPrank(hackerman);
        usdt.approve(address(deal), MINT_AMOUNT_6);
        deal.mint(address(usdt), MINT_AMOUNT_6);

        // Then test burning
        uint256 burnAmount = deal.balanceOf(hackerman);
        uint256 beforeUsdtBal = usdt.balanceOf(hackerman);
        uint256 beforeReserveBal = usdt.balanceOf(address(deal));
        uint256 beforeTotalSupply = deal.totalSupply();

        uint256 predictedReturn = deal.getPredictedBurn(address(usdt), burnAmount);

        deal.burn(address(usdt), burnAmount);

        // Verify balances
        assertEq(deal.balanceOf(hackerman), 0);
        assertApproxEqAbs(
            usdt.balanceOf(hackerman) - beforeUsdtBal,
            predictedReturn,
            ACCURACY / 1e12 // Adjust accuracy for 6 decimals
        );
        assertApproxEqAbs(
            beforeReserveBal - usdt.balanceOf(address(deal)),
            predictedReturn,
            ACCURACY / 1e12 // Adjust accuracy for 6 decimals
        );
        assertEq(beforeTotalSupply - deal.totalSupply(), burnAmount);
        vm.stopPrank();
    }

    function _mintWithAllTokens(address investor) internal {
        vm.startPrank(deployer);
        usds.transfer(investor, MINT_AMOUNT_18);
        usdc.transfer(investor, MINT_AMOUNT_6);
        usdt.transfer(investor, MINT_AMOUNT_6);
        vm.stopPrank();

        vm.startPrank(investor);
        usds.approve(address(deal), MINT_AMOUNT_18);
        usdc.approve(address(deal), MINT_AMOUNT_6);
        usdt.approve(address(deal), MINT_AMOUNT_6);

        deal.mint(address(usds), MINT_AMOUNT_18);
        deal.mint(address(usdc), MINT_AMOUNT_6);
        deal.mint(address(usdt), MINT_AMOUNT_6);
        vm.stopPrank();
    }

    function testInsufficientLiquidityRevert() public {
        // First mint some DEAL tokens
        vm.startPrank(deployer);
        usds.transfer(hackerman, MINT_AMOUNT_18);
        vm.stopPrank();

        vm.startPrank(hackerman);
        usds.approve(address(deal), MINT_AMOUNT_18);
        deal.mint(address(usds), MINT_AMOUNT_18);

        // Try to burn more than available in USDC
        uint256 burnAmount = deal.balanceOf(hackerman);
        vm.expectRevert("insufficient liquidity");
        deal.burn(address(usdc), burnAmount);
        vm.stopPrank();
    }

    function testFlashBehaviorUSDS() public {
        // Initial setup for hackerman
        vm.prank(deployer);
        usds.transfer(hackerman, MALICIOUS_AMOUNT_18);

        vm.startPrank(hackerman);
        usds.approve(address(deal), MALICIOUS_AMOUNT_18);
        deal.mint(address(usds), MALICIOUS_AMOUNT_18);
        uint256 hackermanDealBal = deal.balanceOf(hackerman);
        vm.stopPrank();

        // Normal users mint tokens
        for (uint256 i = 0; i < investors.length; i++) {
            vm.prank(deployer);
            usds.transfer(investors[i], MINT_AMOUNT_18);

            vm.startPrank(investors[i]);
            usds.approve(address(deal), MINT_AMOUNT_18);
            deal.mint(address(usds), MINT_AMOUNT_18);
            vm.stopPrank();
        }

        // Normal users burn tokens
        for (uint256 i = investors.length; i > 0; i--) {
            vm.startPrank(investors[i - 1]);
            deal.burn(address(usds), deal.balanceOf(investors[i - 1]));
            vm.stopPrank();
        }

        // Hackerman burns their tokens
        vm.startPrank(hackerman);
        deal.burn(address(usds), hackermanDealBal);

        // Verify final state
        assertEq(deal.balanceOf(hackerman), 0);

        // Calculate the actual profit/loss from the operation
        uint256 finalUSDSBal = usds.balanceOf(hackerman);
        uint256 profitLoss = finalUSDSBal - MALICIOUS_AMOUNT_18;

        // Profit/loss should be very close to 0
        assertApproxEqAbs(profitLoss, 0, ACCURACY, "Flash loan should not be profitable");
    }

    // this also serves as a test for USDT
    function testFlashBehaviorUSDC() public {
        // Initial setup for hackerman
        vm.prank(deployer);
        usdc.transfer(hackerman, MALICIOUS_AMOUNT_6);

        vm.startPrank(hackerman);
        usdc.approve(address(deal), MALICIOUS_AMOUNT_6);
        deal.mint(address(usdc), MALICIOUS_AMOUNT_6);
        uint256 hackermanDealBal = deal.balanceOf(hackerman);
        vm.stopPrank();

        // Normal users mint tokens
        for (uint256 i = 0; i < investors.length; i++) {
            vm.prank(deployer);
            usdc.transfer(investors[i], MINT_AMOUNT_6);

            vm.startPrank(investors[i]);
            usdc.approve(address(deal), MINT_AMOUNT_6);
            deal.mint(address(usdc), MINT_AMOUNT_6);
            vm.stopPrank();
        }

        // Normal users burn tokens
        for (uint256 i = investors.length; i > 0; i--) {
            vm.startPrank(investors[i - 1]);
            deal.burn(address(usdc), deal.balanceOf(investors[i - 1]));
            vm.stopPrank();
        }

        // Hackerman burns their tokens
        vm.startPrank(hackerman);
        deal.burn(address(usdc), hackermanDealBal);

        // Verify final state
        assertEq(deal.balanceOf(hackerman), 0);

        // Calculate the actual profit/loss from the operation
        uint256 finalUSDCBal = usdc.balanceOf(hackerman);
        uint256 profitLoss = finalUSDCBal - MALICIOUS_AMOUNT_6;

        // Profit/loss should be very close to 0
        assertApproxEqAbs(profitLoss, 0, ACCURACY, "Flash loan should not be profitable");
    }

    // Helper function for EIP-2612 permit hash
    function _getEIP2612PermitHash(
        address token,
        address owner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 PERMIT_TYPEHASH =
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonce, deadline));

        bytes32 DOMAIN_SEPARATOR = ERC20(token).DOMAIN_SEPARATOR();

        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
}
