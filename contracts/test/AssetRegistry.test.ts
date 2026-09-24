import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

const ASSET = ethers.keccak256(ethers.toUtf8Bytes("asset-1"));
const OWNER = ethers.keccak256(ethers.toUtf8Bytes("did:trustvault:holder"));
const FILEHASH = ethers.keccak256(ethers.toUtf8Bytes("plaintext-bytes"));

async function deployAssetRegistry() {
  const [owner, stranger] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("AssetRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  return { registry, owner, stranger };
}

describe("AssetRegistry", () => {
  it("registers an asset with owner DID hash and file hash", async () => {
    const { registry, owner } = await loadFixture(deployAssetRegistry);
    await registry.registerAsset(ASSET, OWNER, FILEHASH);
    const [ownerHash, fileHash, cid] = await registry.getAsset(ASSET);
    expect(ownerHash).to.equal(OWNER);
    expect(fileHash).to.equal(FILEHASH);
    expect(cid).to.equal("");
    expect(await registry.assetExists(ASSET)).to.equal(true);
  });

  it("prevents duplicate registration", async () => {
    const { registry } = await loadFixture(deployAssetRegistry);
    await registry.registerAsset(ASSET, OWNER, FILEHASH);
    await expect(registry.registerAsset(ASSET, OWNER, FILEHASH)).to.be.revertedWith(
      "AssetRegistry: asset already registered"
    );
  });

  it("rejects empty owner hash and empty file hash", async () => {
    const { registry } = await loadFixture(deployAssetRegistry);
    await expect(
      registry.registerAsset(ASSET, ethers.ZeroHash, FILEHASH)
    ).to.be.revertedWith("AssetRegistry: empty owner hash");
    await expect(
      registry.registerAsset(ASSET, OWNER, ethers.ZeroHash)
    ).to.be.revertedWith("AssetRegistry: empty file hash");
  });
});