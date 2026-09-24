// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IdentityRegistry
 * @notice Approved-issuer registry + credential status (active/revoked).
 *         Only SHA-256 hashes of credentials live here — never raw documents,
 *         personal profiles or secrets.
 */
import "@openzeppelin/contracts/access/Ownable.sol";

contract IdentityRegistry is Ownable {
    mapping(address => bool) public approvedIssuers;
    // credentialId/hash => revoked flag (absence => not yet seen / active)
    mapping(bytes32 => bool) public revokedCredentials;

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event CredentialRegistered(bytes32 indexed credentialHash, address indexed issuer);
    event CredentialRevoked(bytes32 indexed credentialHash, address indexed revoker);

    constructor() Ownable(msg.sender) {}

    modifier onlyApprovedIssuer() {
        require(approvedIssuers[msg.sender], "IdentityRegistry: caller is not an approved issuer");
        _;
    }

    function addIssuer(address issuer) external onlyOwner {
        approvedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    function removeIssuer(address issuer) external onlyOwner {
        approvedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /// Approved issuers record the existence of a credential by its hash.
    function registerCredential(bytes32 credentialHash) external onlyApprovedIssuer {
        require(credentialHash != bytes32(0), "IdentityRegistry: empty hash");
        emit CredentialRegistered(credentialHash, msg.sender);
    }

    /// The issuing institution (or owner/admin) revokes a credential hash.
    function revokeCredential(bytes32 credentialHash) external {
        require(
            approvedIssuers[msg.sender] || msg.sender == owner(),
            "IdentityRegistry: not authorized to revoke"
        );
        revokedCredentials[credentialHash] = true;
        emit CredentialRevoked(credentialHash, msg.sender);
    }

    function isCredentialValid(bytes32 credentialHash) external view returns (bool) {
        return credentialHash != bytes32(0) && !revokedCredentials[credentialHash];
    }
}