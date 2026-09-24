import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

const ASSET = ethers.keccak256(ethers.toUtf8Bytes("asset-1"));
const REQ = ethers.keccak256(ethers.toUtf8Bytes("did:trustvault:verifier"));

async function deployAccessControl() {
  const [owner, stranger] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("AccessControl");
  const c = await Factory.deploy();
  await c.waitForDeployment();
  return { c, owner, stranger };
}

describe("AccessControl", () => {
  it("anchors an ALLOW decision with purpose, expiry, trust", async () => {
    const { c } = await loadFixture(deployAccessControl);
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await c.anchorDecision(ASSET, REQ, "employment", 0, expires, 78);
    const [reqHash, purpose, decision, expiry, trust, , exists] = await c.getAnchor(ASSET);
    expect(reqHash).to.equal(REQ);
    expect(purpose).to.equal("employment");
    expect(decision).to.equal(0); // ALLOW
    expect(expiry).to.equal(expires);
    expect(trust).to.equal(78);
    expect(exists).to.equal(true);
  });

  it("rejects a bad decision code", async () => {
    const { c } = await loadFixture(deployAccessControl);
    await expect(
      c.anchorDecision(ASSET, REQ, "employment", 3, 0, 78)
    ).to.be.revertedWith("AccessControl: bad decision");
  });

  it("only owner can anchor", async () => {
    const { c, stranger } = await loadFixture(deployAccessControl);
    await expect(
      c.connect(stranger).anchorDecision(ASSET, REQ, "employment", 0, 0, 78)
    ).to.be.revertedWithCustomError(c, "OwnableUnauthorizedAccount");
  });
});