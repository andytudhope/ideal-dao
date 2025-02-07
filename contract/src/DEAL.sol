//SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./ERC20.sol";
import "./PRBMath.sol";
import "./PRBMathUD60x18.sol";
import "./SafeTransferLib.sol";
import "./interfaces/IERC20Permit.sol";

/**
 * @title  DEAL
 * @notice A simple constant product curve that mints DEAL tokens whenever
 *         anyone sends it DAI, or burns DEAL tokens and returns DAI.
 */
contract DEAL is ERC20 {

    // the constant product used in the curve
    uint256 public constant k = 10000;
    ERC20 public reserve;
    uint256 public reserveBalance;
    bool initialised;

    event DealMinted(
        address indexed learner,
        uint256 amountMinted,
        uint256 daiDeposited
    );
    event DealBurned(
        address indexed learner,
        uint256 amountBurned,
        uint256 daiReturned,
        uint256 e
    );

    constructor(address _reserve) ERC20("DEAL", "DEAL", 18) {
        reserve = ERC20(_reserve);
    }

    /**
     * @notice initialise the contract, mainly for maths purposes, requires the transfer of 1 DAI.
     * @dev    only callable once
     */
    function initialise() external {
        require(!initialised, "initialised");
        initialised = true;
        SafeTransferLib.safeTransferFrom(reserve, msg.sender, address(this), 1e18);
        reserveBalance += 1e18;
        _mint(address(this), 10001e18);
    }

    /**
     * @notice handles DEAL mint with an approval for DAI
     */
    function permitAndMint(uint256 _amount, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external {
        IERC20Permit(address(reserve)).permit(msg.sender, address(this), nonce, expiry, true, v, r, s);
        mint(_amount);
    }
    /**
     * @notice This method allows anyone to mint DEAL tokens dependent on the
     *         amount of DAI they send.
     *
     *         The amount minted depends on the amount of collateral already locked in
     *         the curve. The more DAI is locked, the less DEAL gets minted, ensuring
     *         that the price of DEAL increases linearly.
     *
     *         Please see: https://docs.google.com/spreadsheets/d/1hjWFGPC_B9D7b6iI00DTVVLrqRFv3G5zFNiCBS7y_V8/edit?usp=sharing
     * @param  _wad amount of Dai to send to the contract
     */
    function mint(uint256 _wad) public {
        require(initialised, "!initialised");
        SafeTransferLib.safeTransferFrom(reserve, msg.sender, address(this), _wad);
        uint256 ln = doLn((((reserveBalance + _wad) * 1e18)) / reserveBalance);
        uint256 learnMagic = k * ln;
        reserveBalance += _wad;
        _mint(msg.sender, learnMagic);
        emit DealMinted(msg.sender, learnMagic, _wad);
    }

    /**
     * @notice used to burn DEAL and return DAI to the sender.
     * @param  _burnAmount amount of DEAL to burn
     */
    function burn(uint256 _burnAmount) public {
        require(initialised, "!initialised");
        uint256 e = e_calc(_burnAmount);
        uint256 learnMagic = reserveBalance - (reserveBalance * 1e18) / e;
        _burn(msg.sender, _burnAmount);
        reserveBalance -= learnMagic;
        SafeTransferLib.safeTransfer(reserve, msg.sender, learnMagic);
        emit DealBurned(msg.sender, _burnAmount, learnMagic, e);
    }

    /**
     * @notice Calculates the natural exponent of the inputted value
     * @param  x the number to be used in the natural log calc
     */
    function e_calc(uint256 x) internal pure returns (uint256 result) {
        PRBMath.UD60x18 memory xud = PRBMath.UD60x18({value: x / k});
        result = PRBMathUD60x18.exp(xud).value;
    }

    /**
     * @notice Calculates the natural logarithm of x.
     * @param  x      the number to be used in the natural log calc
     * @return result the natural log of the inputted value
     */
    function doLn(uint256 x) internal pure returns (uint256 result) {
        PRBMath.UD60x18 memory xud = PRBMath.UD60x18({value: x});
        result = PRBMathUD60x18.ln(xud).value;
    }

    /**
     * @notice calculates the amount of reserve received for a burn amount
     * @param  _burnAmount   the amount of DEAL to burn
     * @return learnMagic    the dai receivable for a certain amount of burnt DEAL
     */
    function getPredictedBurn(uint256 _burnAmount)
        external
        view
        returns (uint256 learnMagic)
    {
        uint256 e = e_calc(_burnAmount);
        learnMagic = reserveBalance - (reserveBalance * 1e18) / e;
    }

    /**
     * @notice calculates the amount of DEAL to mint given the amount of DAI requested.
     * @param  reserveAmount the amount of DAI to lock
     * @return learnMagic    the DEAL mintable for a certain amount of dai
     */
    function getMintableForReserveAmount(uint256 reserveAmount)
        external
        view
        returns (uint256 learnMagic)
    {
        uint256 ln = doLn(
            (((reserveBalance + reserveAmount) * 1e18)) / reserveBalance
        );
        learnMagic = k * ln;
    }
}
