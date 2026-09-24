// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AuditRegistry
 * @notice Anchors important security/access events on-chain so the audit trail
 *         is tamper-evident. Only hashes/metadata, never raw telemetry.
 */
import "@openzeppelin/contracts/access/Ownable.sol";

contract AuditRegistry is Ownable {
    struct AuditEvent {
        bytes32 eventId;
        bytes32 assetId;
        address actor;
        string eventType;
        uint96 trustScore;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => AuditEvent) public events;
    uint256 public eventCount;

    event EventAnchored(
        bytes32 indexed eventId,
        bytes32 indexed assetId,
        address indexed actor,
        string eventType,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    function logEvent(
        bytes32 eventId,
        bytes32 assetId,
        address actor,
        string calldata eventType,
        uint96 trustScore
    ) external onlyOwner returns (bool) {
        require(eventId != bytes32(0), "AuditRegistry: empty event id");
        require(!events[eventId].exists, "AuditRegistry: event already anchored");
        events[eventId] = AuditEvent({
            eventId: eventId,
            assetId: assetId,
            actor: actor,
            eventType: eventType,
            trustScore: trustScore,
            timestamp: block.timestamp,
            exists: true
        });
        eventCount += 1;
        emit EventAnchored(eventId, assetId, actor, eventType, block.timestamp);
        return true;
    }

    function getEventRecord(bytes32 eventId)
        external
        view
        returns (
            bytes32 assetId,
            address actor,
            string memory eventType,
            uint96 trustScore,
            uint256 timestamp,
            bool exists
        )
    {
        AuditEvent storage e = events[eventId];
        return (e.assetId, e.actor, e.eventType, e.trustScore, e.timestamp, e.exists);
    }
}