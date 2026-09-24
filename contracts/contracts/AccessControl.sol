// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AccessControl
 * @notice Anchors permission outcomes: purpose + expiry + minimum trust
 *         threshold reference. Actual policy evaluation stays off-chain;
 *         this contract only records/anchors the outcome for auditability.
 */
import "@openzeppelin/contracts/access/Ownable.sol";

contract AccessControl is Ownable {
    enum Decision {
        ALLOW,
        STEP_UP,
        BLOCK
    }

    struct GrantAnchor {
        bytes32 requesterDidHash;
        string purpose;
        uint8 decision;
        uint256 expiresAt;
        uint96 trustScore;
        uint256 grantedAt;
        bool exists;
    }

    mapping(bytes32 => GrantAnchor) public grants; // assetId => anchor

    event DecisionAnchored(
        bytes32 indexed assetId,
        bytes32 indexed requesterDidHash,
        string purpose,
        uint8 decision,
        uint256 expiresAt,
        uint96 trustScore
    );

    constructor() Ownable(msg.sender) {}

    /// Anchors the outcome of an access decision (off-chain evaluation result).
    function anchorDecision(
        bytes32 assetId,
        bytes32 requesterDidHash,
        string calldata purpose,
        uint8 decision,
        uint256 expiresAt,
        uint96 trustScore
    ) external onlyOwner {
        require(assetId != bytes32(0), "AccessControl: empty asset id");
        require(decision <= uint8(Decision.BLOCK), "AccessControl: bad decision");
        grants[assetId] = GrantAnchor({
            requesterDidHash: requesterDidHash,
            purpose: purpose,
            decision: decision,
            expiresAt: expiresAt,
            trustScore: trustScore,
            grantedAt: block.timestamp,
            exists: true
        });
        emit DecisionAnchored(assetId, requesterDidHash, purpose, decision, expiresAt, trustScore);
    }

    function getAnchor(bytes32 assetId)
        external
        view
        returns (
            bytes32 requesterDidHash,
            string memory purpose,
            uint8 decision,
            uint256 expiresAt,
            uint96 trustScore,
            uint256 grantedAt,
            bool exists
        )
    {
        GrantAnchor storage g = grants[assetId];
        return (
            g.requesterDidHash,
            g.purpose,
            g.decision,
            g.expiresAt,
            g.trustScore,
            g.grantedAt,
            g.exists
        );
    }
}