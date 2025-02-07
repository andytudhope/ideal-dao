// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Proposals.sol";

// Mock DEAL token for testing
contract MockDEAL is IERC20 {
    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowances;

    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        require(balances[sender] >= amount, "Insufficient balance");
        require(allowances[sender][msg.sender] >= amount, "Insufficient allowance");
        
        balances[sender] -= amount;
        balances[recipient] += amount;
        allowances[sender][msg.sender] -= amount;
        
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }
}

contract ProposalsTest is Test {
    Proposals public proposals;
    MockDEAL public dealToken;
    
    address public proposer = address(1);
    address public investor = address(2);
    address public beneficiary = address(3);
    
    uint256 public constant INITIAL_BALANCE = 1000 ether;
    uint256 public constant PROPOSAL_AMOUNT = 100 ether;
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        uint256 dealRequired,
        address payableAddress,
        string documentURI
    );
    
    event ProposalFunded(
        uint256 indexed proposalId,
        address indexed funder,
        uint256 amount
    );

    function setUp() public {
        // Deploy mock DEAL token and DAO
        dealToken = new MockDEAL();
        proposals = new Proposals(address(dealToken));
        
        // Setup initial balances and allowances
        dealToken.mint(investor, INITIAL_BALANCE);
        vm.prank(investor);
        dealToken.approve(address(proposals), INITIAL_BALANCE);
    }

    function testCreateProposal() public {
        vm.prank(proposer);
    
        vm.expectEmit(true, true, false, true, address(proposals));
        emit ProposalCreated(
            0, 
            proposer, 
            PROPOSAL_AMOUNT,
            beneficiary,
            "test"
        );

        uint256 proposalId = proposals.createProposal(
            PROPOSAL_AMOUNT,
            beneficiary,
            "test"
        );

        (
            uint256 dealRequired,
            address payableAddress,
            string memory documentURI
        ) = proposals.getProposal(proposalId);
        
        
        assertEq(dealRequired, PROPOSAL_AMOUNT, "Deal required amount mismatch");
        assertEq(payableAddress, beneficiary, "Payable address mismatch");
        assertEq(documentURI, "test", "Document URI mismatch");
        assertEq(proposals.proposalCount(), 1, "Proposal count should be 1");
    }

    function testCreateProposalWithZeroAddress() public {
        vm.prank(proposer);
        vm.expectRevert("Invalid payable address");
        proposals.createProposal(PROPOSAL_AMOUNT, address(0), "ipfs://proposal1");
    }

    function testFundProposal() public {
        // First create a proposal
        vm.prank(proposer);
        uint256 proposalId = proposals.createProposal(
            PROPOSAL_AMOUNT,
            beneficiary,
            "ipfs://QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx"
        );
        
        // Record initial balances
        uint256 initialInvestorBalance = dealToken.balances(investor);
        uint256 initialBeneficiaryBalance = dealToken.balances(beneficiary);
        
        // Fund the proposal
        vm.prank(investor);
        vm.expectEmit(true, true, false, true);
        emit ProposalFunded(proposalId, investor, PROPOSAL_AMOUNT);
        
        proposals.fundProposal(proposalId, PROPOSAL_AMOUNT);
        
        // Verify balances after funding
        assertEq(
            dealToken.balances(investor),
            initialInvestorBalance - PROPOSAL_AMOUNT
        );
        assertEq(
            dealToken.balances(beneficiary),
            initialBeneficiaryBalance + PROPOSAL_AMOUNT
        );
    }

    function testFundProposalWithZeroAmount() public {
        vm.prank(proposer);
        uint256 proposalId = proposals.createProposal(
            PROPOSAL_AMOUNT,
            beneficiary,
            "ipfs://QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx"
        );
        
        vm.prank(investor);
        vm.expectRevert("Amount must be greater than 0");
        proposals.fundProposal(proposalId, 0);
    }

    function testFundProposalWithInsufficientBalance() public {
        vm.prank(proposer);
        uint256 proposalId = proposals.createProposal(
            PROPOSAL_AMOUNT,
            beneficiary,
            "ipfs://QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx"
        );
        
        // Create new investor with insufficient balance
        address poorInvestor = address(4);
        dealToken.mint(poorInvestor, PROPOSAL_AMOUNT / 2);
        
        vm.prank(poorInvestor);
        dealToken.approve(address(proposals), PROPOSAL_AMOUNT);
        
        vm.prank(poorInvestor);
        vm.expectRevert("Insufficient balance");
        proposals.fundProposal(proposalId, PROPOSAL_AMOUNT);
    }

    function testFundProposalWithInsufficientAllowance() public {
        vm.prank(proposer);
        uint256 proposalId = proposals.createProposal(
            PROPOSAL_AMOUNT,
            beneficiary,
            "ipfs://QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx"
        );
        
        // Create new investor with sufficient balance but insufficient allowance
        address restrictedInvestor = address(5);
        dealToken.mint(restrictedInvestor, PROPOSAL_AMOUNT * 2);
        
        vm.prank(restrictedInvestor);
        dealToken.approve(address(proposals), PROPOSAL_AMOUNT / 2);
        
        vm.prank(restrictedInvestor);
        vm.expectRevert("Insufficient allowance");
        proposals.fundProposal(proposalId, PROPOSAL_AMOUNT);
    }

    function testMultipleProposalsAndFunding() public {
        // Create multiple proposals
        vm.prank(proposer);
        uint256 proposalId1 = proposals.createProposal(
            PROPOSAL_AMOUNT,
            beneficiary,
            "ipfs://QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx"
        );
        
        vm.prank(proposer);
        uint256 proposalId2 = proposals.createProposal(
            PROPOSAL_AMOUNT * 2,
            address(6),
            "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
        );
        
        // Fund both proposals
        vm.prank(investor);
        proposals.fundProposal(proposalId1, PROPOSAL_AMOUNT);
        
        vm.prank(investor);
        proposals.fundProposal(proposalId2, PROPOSAL_AMOUNT);
        
        // Verify proposal count and details
        assertEq(proposals.proposalCount(), 2);
        
        (uint256 dealRequired1,,) = proposals.getProposal(proposalId1);
        (uint256 dealRequired2,,) = proposals.getProposal(proposalId2);
        
        assertEq(dealRequired1, PROPOSAL_AMOUNT);
        assertEq(dealRequired2, PROPOSAL_AMOUNT * 2);
    }
}