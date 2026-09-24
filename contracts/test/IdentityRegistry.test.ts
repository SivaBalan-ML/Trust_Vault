import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

const HASH0 = ethers.keccak256(ethers.toUtf8Bytes("cred-hash-zero"));
const HASH1 = ethers.keccak256(ethers.toUtf8Bytes("cred-hash-one"));

async function deployIdentityRegistry() {
  const [owner, issuer, stranger] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("IdentityRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  await registry.addIssuer(issuer.address);
  return { registry, owner, issuer, stranger };
}

describe("IdentityRegistry", () => {
  it("registers and validates a credential issued by an approved issuer", async () => {
    const { registry, issuer } = await loadFixture(deployIdentityRegistry);
    await expect(registry.connect(issuer).registerCredential(HASH1)).to.emit(
      registry,
      "CredentialRegistered"
    );
    expect(await registry.isCredentialValid(HASH1)).to.equal(true);
  });

  it("rejects a credential issued by a non-approved actor", async () => {
    const { registry, stranger } = await loadFixture(deployIdentityRegistry);
    await expect(registry.connect(stranger).registerCredential(HASH1)).to.be.revertedWith(
      "IdentityRegistry: caller is not an approved issuer"
    );
  });

  it("revocation immediately invalidates the credential", async () => {
    const { registry, issuer } = await loadFixture(deployIdentityRegistry);
    await registry.connect(issuer).registerCredential(HASH1);
    expect(await registry.isCredentialValid(HASH1)).to.equal(true);
    await registry.connect(issuer).revokeCredential(HASH1);
    expect(await registry.isCredentialValid(HASH1)).to.equal(false);
  });

  it("only owner can add issuers", async () => {
    const { registry, stranger } = await loadFixture(deployIdentityRegistry);
    await expect(registry.connect(stranger).addIssuer(stranger.address)).to.be.revertedWithCustomError(
      registry,
      "OwnableUnauthorizedAccount"
    );
  });
});