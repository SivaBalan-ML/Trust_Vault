import * as dotenv from "dotenv";
dotenv.config();

/**
 * Deploy script for the four TrustVault contracts.
 *
 *   npx hardhat run scripts/deploy.ts --network sepolia
 *
 * Requires contracts/.env with:
 *   RPC_URL=... (free Alchemy/Infura/public endpoint)
 *   PRIVATE_KEY=... (Sepolia EOA funded via a free faucet)
 *
 * Prints contract addresses — copy them into backend/.env
 * (IDENTITY_REGISTRY_ADDRESS, ASSET_REGISTRY_ADDRESS,
 *  ACCESS_CONTROL_ADDRESS, AUDIT_REGISTRY_ADDRESS).
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address, "balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const IdentityRegistry = await ethers.deployContract("IdentityRegistry");
  await IdentityRegistry.waitForDeployment();
  console.log("IdentityRegistry :", await IdentityRegistry.getAddress());

  const AssetRegistry = await ethers.deployContract("AssetRegistry");
  await AssetRegistry.waitForDeployment();
  console.log("AssetRegistry    :", await AssetRegistry.getAddress());

  const AccessControl = await ethers.deployContract("AccessControl");
  await AccessControl.waitForDeployment();
  console.log("AccessControl    :", await AccessControl.getAddress());

  const AuditRegistry = await ethers.deployContract("AuditRegistry");
  await AuditRegistry.waitForDeployment();
  console.log("AuditRegistry    :", await AuditRegistry.getAddress());

  // Approve the deployer wallet as the trusted issuer so credential
  // registration works out of the box.
  await (await IdentityRegistry.addIssuer(deployer.address)).wait();
  console.log("Deployer approved as issuer on IdentityRegistry.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});