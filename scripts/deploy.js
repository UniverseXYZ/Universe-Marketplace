// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

const rinkeby = {
  communityWallet: "0xe627243104a101ca59a2c629adbcd63a782e837f",
  erc20TransferProxy: "0x2fce8435f0455edc702199741411dbcd1b7606ca",
  transferProxy: "0x7d47126a2600e22eab9ed6cf0e515678727779a6",
  royaltiesRegistry: "0xdA8e7D4cF7BA4D5912a68c1e40d3D89828fA6EE8",
};

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const ExchangeV2 = await hre.ethers.getContractFactory("ExchangeV2");
  const exchangeV2 = await hre.upgrades.deployProxy(
    ExchangeV2,
    [
      rinkeby.transferProxy,
      rinkeby.erc20TransferProxy,
      0,
      rinkeby.communityWallet,
      rinkeby.royaltiesRegistry,
    ],
    { initializer: "__ExchangeV2_init" }
  );
  await exchangeV2.deployed();

  const ERC721FloorBidMatcher = await hre.ethers.getContractFactory(
    "ERC721FloorBidMatcher"
  );

  const erc721FloorBidMatcher = await ERC721FloorBidMatcher.deploy(
    "0x0000000000000000000000000000000000000000",
    1000
  );

  await erc721FloorBidMatcher.deployed();

  console.log("Exchange V2 deployed to:", exchangeV2.address);
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
