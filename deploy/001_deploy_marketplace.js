module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy, execute } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  const nftTransferProxy = await deploy("TransferProxy", {
    from: deployer,
    log: true,
    proxy: {
      owner: proxyAdmin,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "__TransferProxy_init",
        args: [],
      },
    },
  });
  console.log(`NFT TransferProxy initialized at: ${nftTransferProxy.address}`);

  const erc20TransferProxy = await deploy("ERC20TransferProxy", {
    from: deployer,
    log: true,
    proxy: {
      owner: proxyAdmin,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "__ERC20TransferProxy_init",
        args: [],
      },
    },
  });
  console.log(
    `ERC20 TransferProxy initialized at: ${erc20TransferProxy.address}`
  );

  const royaltiesRegistry = await deploy("RoyaltiesRegistry", {
    from: deployer,
    log: true,
    proxy: {
      owner: proxyAdmin,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "__RoyaltiesRegistry_init",
        args: [],
      },
    },
  });
  console.log(
    `Royalties Registry initialized at: ${royaltiesRegistry.address}`
  );

  const universeMarketplace = await deploy("UniverseMarketplace", {
    from: deployer,
    log: true,
    proxy: {
      owner: proxyAdmin,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "__UniverseMarketplace_init",
        args: [
          nftTransferProxy.address,
          erc20TransferProxy.address,
          process.env.DAO_FEE,
          process.env.DAO_ADDRESS,
          royaltiesRegistry.address,
          process.env.MAX_BUNDLE_SIZE,
        ],
      },
    },
  });
  console.log(
    `Universe Marketplace initialized at: ${universeMarketplace.address}`
  );

  const erc721FloorBidMatcher = await deploy("ERC721FloorBidMatcher", {
    from: deployer,
    log: true,
    proxy: {
      owner: proxyAdmin,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "__ERC721FloorBidMatcher_init",
        args: [
          process.env.DAO_ADDRESS,
          process.env.DAO_FEE,
          erc20TransferProxy.address,
          nftTransferProxy.address,
          royaltiesRegistry.address,
          process.env.MAX_TOKENS_IN_ORDER,
          process.env.SUPPORTED_ERC20_TOKENS.split(","),
        ],
      },
    },
  });
  console.log(
    `ERC721 Floor Bid Matcher initialized at: ${erc721FloorBidMatcher.address}`
  );

  await execute(
    "ERC20TransferProxy",
    {
      from: deployer,
      log: true,
    },
    "addOperator",
    universeMarketplace.address
  );

  await execute(
    "TransferProxy",
    {
      from: deployer,
      log: true,
    },
    "addOperator",
    universeMarketplace.address
  );

  await execute(
    "ERC20TransferProxy",
    {
      from: deployer,
      log: true,
    },
    "addOperator",
    erc721FloorBidMatcher.address
  );

  await execute(
    "TransferProxy",
    {
      from: deployer,
      log: true,
    },
    "addOperator",
    erc721FloorBidMatcher.address
  );
};

module.exports.tags = ["UniverseMarketplace"];
