import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

const EVENT = ethers.keccak256(ethers.toUtf8Bytes("event-1"));
const ASSET = ethers.keccak256(ethers.toUtf8Bytes("asset-1"));
const ACTOR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

async function deployAuditRegistry() {
  const [owner, stranger] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("AuditRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  return { registry, owner, stranger };
}

describe("AuditRegistry", () => {
  it("anchors an event with actor, type, trust, timestamp", async () => {
    const { registry } = await loadFixture(deployAuditRegistry);
    await registry.logEvent(EVENT, ASSET, ACTOR, "access_blocked", 12);
    const [assetId, actor, eventType, trust, timestamp, exists] = await registry.getEventRecord(EVENT);
    expect(assetId).to.equal(ASSET);
    expect(actor).to.equal(ACTOR);
    expect(eventType).to.equal("access_blocked");
    expect(trust).to.equal(12);
    expect(exists).to.equal(true);
    expect(timestamp).to.be.gt(0);
    expect(await registry.eventCount()).to.equal(1);
  });

  it("prevents duplicate anchor ids", async () => {
    const { registry } = await loadFixture(deployAuditRegistry);
    await registry.logEvent(EVENT, ASSET, ACTOR, "access_allowed", 90);
    await expect(
      registry.logEvent(EVENT, ASSET, ACTOR, "access_allowed", 90)
    ).to.be.revertedWith("AuditRegistry: event already anchored");
  });

  it("only owner can anchor", async () => {
    const { registry, stranger } = await loadFixture(deployAuditRegistry);
    await expect(
      registry.connect(stranger).logEvent(EVENT, ASSET, ACTOR, "x", 1)
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });
});