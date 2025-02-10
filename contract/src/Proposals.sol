// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract Proposals {
    struct Proposal {
        uint256 dealRequired;
        uint256 dealReceived;
        address payableAddress;
        string documentURI;
    }

    IERC20 public dealToken;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

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
        uint256 amount,
        uint256 totalFunded
    );

    constructor(address _dealToken) {
        dealToken = IERC20(_dealToken);
    }

    function createProposal(
        uint256 _dealRequired,
        address _payableAddress,
        string memory _documentURI
    ) external returns (uint256) {
        require(_payableAddress != address(0), "Invalid payable address");
        
        uint256 proposalId = proposalCount;
        proposals[proposalId] = Proposal({
            dealRequired: _dealRequired,
            dealReceived: 0,
            payableAddress: _payableAddress,
            documentURI: _documentURI
        });

        emit ProposalCreated(
            proposalId,
            msg.sender,
            _dealRequired,
            _payableAddress,
            _documentURI
        );

        proposalCount++;
        return proposalId;
    }

    function fundProposal(uint256 _proposalId, uint256 _amount) external {
        Proposal storage proposal = proposals[_proposalId];
        require(_amount > 0, "Amount must be greater than 0");

        // Transfer DEAL tokens directly from sender to proposal address
        bool success = dealToken.transferFrom(
            msg.sender,
            proposal.payableAddress,
            _amount
        );
        require(success, "Token transfer failed");

        proposal.dealReceived += _amount;

        emit ProposalFunded(_proposalId, msg.sender, _amount, proposal.dealReceived);
    }

    function getProposal(uint256 _proposalId) external view returns (
        uint256 dealRequired,
        uint256 dealReceived,
        address payableAddress,
        string memory documentURI
    ) {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.dealRequired,
            proposal.dealReceived,
            proposal.payableAddress,
            proposal.documentURI
        );
    }

    function getCurrentFunding(uint256 _proposalId) external view returns (uint256) {
        return proposals[_proposalId].dealReceived;
    }
}