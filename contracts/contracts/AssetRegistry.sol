// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AssetRegistry
 * @notice Asset ID + owner-DID hash + file hash + (future) content identifier.
 *         Raw content never touches chain — only integrity hashes.
 */
import "@openzeppelin/contracts/access/Ownable.sol";

contract AssetRegistry is Ownable {
    struct Asset {
        bytes32 ownerDidHash;
        bytes32 fileHash;
        string cid; // empty for now; IPFS/S3 is future scope
        bool exists;
    }

    mapping(bytes32 => Asset) public assets;
    mapping(bytes32 => bytes32) public ownerOf;

    event AssetRegistered(bytes32 indexed assetId, bytes32 indexed ownerDidHash, bytes32 fileHash);
    event AssetCidUpdated(bytes32 indexed assetId, string cid);

    constructor() Ownable(msg.sender) {}

    function registerAsset(
        bytes32 assetId,
        bytes32 ownerDidHash,
        bytes32 fileHash
    ) external onlyOwner returns (bool) {
        require(ownerDidHash != bytes32(0), "AssetRegistry: empty owner hash");
        require(fileHash != bytes32(0), "AssetRegistry: empty file hash");
        require(!assets[assetId].exists, "AssetRegistry: asset already registered");
        assets[assetId] = Asset(ownerDidHash, fileHash, "", true);
        ownerOf[assetId] = ownerDidHash;
        emit AssetRegistered(assetId, ownerDidHash, fileHash);
        return true;
    }

    function updateCid(bytes32 assetId, string calldata cid) external onlyOwner {
        require(assets[assetId].exists, "AssetRegistry: asset not found");
        assets[assetId].cid = cid;
        emit AssetCidUpdated(assetId, cid);
    }

    function getAsset(bytes32 assetId)
        external
        view
        returns (bytes32 ownerDidHash, bytes32 fileHash, string memory cid)
    {
        Asset storage a = assets[assetId];
        return (a.ownerDidHash, a.fileHash, a.cid);
    }

    function assetExists(bytes32 assetId) external view returns (bool) {
        return assets[assetId].exists;
    }
}
