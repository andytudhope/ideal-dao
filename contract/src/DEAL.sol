//SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./ERC20.sol";
import "./PRBMath.sol";
import "./PRBMathUD60x18.sol";
import "./SafeTransferLib.sol";
import "./interfaces/IERC20Permit.sol";
import "./interfaces/IERC20Standard.sol";

/**
 * @title  DEAL
 * @notice A simple constant product curve that mints DEAL tokens whenever
 *         anyone sends it stablecoins (USDS, USDC, or USDT), or burns DEAL tokens
 *         and returns the chosen stablecoin.
 */
contract DEAL is ERC20 {
    // the constant product used in the curve
    uint256 public constant k = 10000;

    struct ReserveToken {
        address token;
        uint256 balance;
        uint8 decimals;
        bool supportsPermit; // true for USDS/USDC, false for USDT
    }

    mapping(address => ReserveToken) public reserves;
    address[] public supportedTokens;
    uint256 public totalReserveBalance; // Combined balance in 18 decimals
    bool initialised;

    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    event DealMinted(address indexed learner, uint256 amountMinted, uint256 amountDeposited, address tokenDeposited);

    event DealBurned(
        address indexed learner, uint256 amountBurned, uint256 amountReturned, address tokenReturned, uint256 e
    );

    constructor(address _usds, address _usdc, address _usdt) ERC20("DEAL", "DEAL", 18) {
        _addReserveToken(_usds, 18, true);
        _addReserveToken(_usdc, 6, true);
        _addReserveToken(_usdt, 6, false);
    }

    function _addReserveToken(address token, uint8 decimals, bool hasPermit) internal {
        reserves[token] = ReserveToken({token: token, balance: 0, decimals: decimals, supportsPermit: hasPermit});
        supportedTokens.push(token);
    }

    /**
     * @notice Convert amount to 18 decimals
     */
    function _toE18(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals == 18) return amount;
        return amount * 10 ** (18 - decimals);
    }

    /**
     * @notice Convert amount from 18 decimals to token decimals
     */
    function _fromE18(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals == 18) return amount;
        return amount / 10 ** (18 - decimals);
    }

    /**
     * @notice initialise the contract with 1 USDS equivalent
     * @dev    only callable once
     */
    function initialise() external {
        require(!initialised, "initialised");
        address usdsAddress = supportedTokens[0]; // USDS is first token
        SafeTransferLib.safeTransferFrom(ERC20(usdsAddress), msg.sender, address(this), 1e18);
        reserves[usdsAddress].balance += 1e18;
        totalReserveBalance += 1e18;
        initialised = true;
        _mint(address(this), 10001e18);
    }

    /**
     * @notice handles DEAL mint with an EIP-2612 permit for USDS/USDC
     */
    function permitAndMint(address token, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(reserves[token].supportsPermit, "no permit support");
        IERC20Permit(token).permit(msg.sender, address(this), amount, deadline, v, r, s);
        mint(token, amount);
    }

    /**
     * @notice This method allows anyone to mint DEAL tokens by depositing supported stablecoins
     * @param  token  Address of the stablecoin to deposit
     * @param  amount Amount of stablecoin to deposit (in token's native decimals)
     */
    function mint(address token, uint256 amount) public {
        require(initialised, "!initialised");
        require(reserves[token].token != address(0), "unsupported token");

        SafeTransferLib.safeTransferFrom(ERC20(token), msg.sender, address(this), amount);

        uint256 amountE18 = _toE18(amount, reserves[token].decimals);
        PRBMath.UD60x18 memory natural_log = doLn((((totalReserveBalance + amount) * 1e18)) / totalReserveBalance);
        PRBMath.UD60x18 memory amountToMintUD = doMul(natural_log, k);
        uint256 amountToMint = PRBMathUD60x18.toUint(amountToMintUD);

        reserves[token].balance += amount;
        totalReserveBalance += amountE18;

        _mint(msg.sender, amountToMint);
        emit DealMinted(msg.sender, amountToMint, amount, token);
    }

    /**
     * @notice Burns DEAL tokens and returns the specified stablecoin
     * @param  burnAmount Amount of DEAL to burn
     * @param  token      Address of the stablecoin to receive
     */
    function burn(address token, uint256 burnAmount) public {
        require(initialised, "!initialised");
        require(reserves[token].token != address(0), "unsupported token");

        PRBMath.UD60x18 memory eUD = doExp(burnAmount);
        uint256 e = PRBMathUD60x18.toUint(eUD);
        uint256 amountToBurnE18 = totalReserveBalance - (totalReserveBalance * 1e18) / e;

        // Convert to token decimals and check if we have enough
        uint256 tokenAmount = _fromE18(amountToBurnE18, reserves[token].decimals);
        require(reserves[token].balance >= tokenAmount, "insufficient liquidity");

        _burn(msg.sender, burnAmount);
        totalReserveBalance -= amountToBurnE18;
        reserves[token].balance -= tokenAmount;

        SafeTransferLib.safeTransfer(ERC20(token), msg.sender, tokenAmount);
        emit DealBurned(msg.sender, burnAmount, tokenAmount, token, e);
    }

    // Original helper functions remain unchanged
    function doExp(uint256 x) internal pure returns (PRBMath.UD60x18 memory result) {
        PRBMath.UD60x18 memory xUD = PRBMathUD60x18.fromUint(x);
        PRBMath.UD60x18 memory kUD = PRBMathUD60x18.fromUint(k);
        PRBMath.UD60x18 memory divInUD = PRBMathUD60x18.div(xUD, kUD);
        result = PRBMathUD60x18.exp(divInUD);
    }

    function doLn(uint256 x) internal pure returns (PRBMath.UD60x18 memory result) {
        PRBMath.UD60x18 memory xUD = PRBMathUD60x18.fromUint(x);
        result = PRBMathUD60x18.ln(xUD);
    }

    function doMul(PRBMath.UD60x18 memory x, uint256 y) internal pure returns (PRBMath.UD60x18 memory result) {
        PRBMath.UD60x18 memory yUD = PRBMathUD60x18.fromUint(y);
        result = PRBMathUD60x18.mul(x, yUD);
    }  

    /**
     * @notice Get all supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @notice Get balance of specific token in contract
     * @param  token Address of the stablecoin
     * @return Amount of tokens (in token's native decimals)
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return reserves[token].balance;
    }

    /**
     * @notice Check if a token supports permit
     */
    function supportsPermit(address token) external view returns (bool) {
        return reserves[token].supportsPermit;
    }

    /**
     * @notice Calculates the amount of specific token received for a burn amount
     * @param  burnAmount   Amount of DEAL to burn
     * @param  token        Address of the stablecoin to receive
     * @return tokenAmount  Amount of tokens that would be received (in token's native decimals)
     */
    function getPredictedBurn(address token, uint256 burnAmount) external view returns (uint256 tokenAmount) {
        PRBMath.UD60x18 memory eUD = doExp(burnAmount);
        uint256 e = PRBMathUD60x18.toUint(eUD);
        uint256 amountToBurnE18 = totalReserveBalance - (totalReserveBalance * 1e18) / e;
        tokenAmount = _fromE18(amountToBurnE18, reserves[token].decimals);
    }

    /**
     * @notice Calculates the amount of DEAL to mint given the amount of stablecoin
     * @param  token        Address of the stablecoin
     * @param  amount       Amount of tokens to deposit (in token's native decimals)
     * @return amountToMint   Amount of DEAL that would be minted
     */
    function getMintableForReserveAmount(address token, uint256 amount) external view returns (uint256 amountToMint) {
        uint256 amountE18 = _toE18(amount, reserves[token].decimals);
        PRBMath.UD60x18 memory natural_log = doLn((((totalReserveBalance + amountE18) * 1e18)) / totalReserveBalance);
        PRBMath.UD60x18 memory amountToMintUD = doMul(natural_log, k);
        amountToMint = PRBMathUD60x18.toUint(amountToMintUD);
    }
}
