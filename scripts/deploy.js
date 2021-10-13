// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
require("dotenv").config();
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy

  const TransferProxy = await hre.ethers.getContractFactory("TransferProxy");
  const transferProxy = await hre.upgrades.deployProxy(TransferProxy, [], {
    initializer: "__TransferProxy_init",
  });
  await transferProxy.deployed();

  const ERC20TransferProxy = await hre.ethers.getContractFactory(
    "ERC20TransferProxy"
  );
  const erc20TransferProxy = await hre.upgrades.deployProxy(
    ERC20TransferProxy,
    [],
    {
      initializer: "__ERC20TransferProxy_init",
    }
  );
  await erc20TransferProxy.deployed();

  const RoyaltiesRegistry = await hre.ethers.getContractFactory(
    "RoyaltiesRegistry"
  );
  const royaltiesRegistry = await hre.upgrades.deployProxy(
    RoyaltiesRegistry,
    [],
    {
      initializer: "__RoyaltiesRegistry_init",
    }
  );
  await royaltiesRegistry.deployed();

  const UniverseMarketplace = await hre.ethers.getContractFactory(
    "UniverseMarketplace"
  );
  const universeMarketplace = await hre.upgrades.deployProxy(
    UniverseMarketplace,
    [
      transferProxy.address,
      erc20TransferProxy.address,
      process.env.DAO_FEE,
      process.env.DAO_ADDRESS,
      royaltiesRegistry.address,
    ],
    { initializer: "__UniverseMarketplace_init" }
  );
  await universeMarketplace.deployed();

  const ERC721FloorBidMatcher = await hre.ethers.getContractFactory(
    "ERC721FloorBidMatcher"
  );

  const erc721FloorBidMatcher = await hre.upgrades.deployProxy(
    ERC721FloorBidMatcher,
    [
      process.env.DAO_ADDRESS,
      process.env.DAO_FEE,
      erc20TransferProxy.address,
      transferProxy.address,
      royaltiesRegistry.address,
    ],
    { initializer: "__ERC721FloorBidMatcher_init" }
  );

  await erc721FloorBidMatcher.deployed();

  console.log("ERC20 Transfer Proxy deployed to:", erc20TransferProxy.address);
  console.log("NFT Transfer Proxy deployed to:", transferProxy.address);
  console.log("Royalties Registry deployed to:", royaltiesRegistry.address);
  console.log("Universe Marketplace deployed to:", universeMarketplace.address);
  console.log("ERC721 Floor Bid Matcher:", erc721FloorBidMatcher.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
