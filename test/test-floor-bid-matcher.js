const { expect } = require("chai");

const { waffle, ethers, upgrades } = require("hardhat");
const { loadFixture } = waffle;

const DAO_FEE = 2500;
const DAO_ADDRESS = "0x67b93852482113375666a310ac292D61dDD4bbb9";
const MAX_TOKENS_IN_ORDER = 20;

describe("ERC721 Floor Bid Matcher Tests", () => {
  const deployedContracts = async () => {
    const TransferProxy = await ethers.getContractFactory("TransferProxy");
    const transferProxy = await upgrades.deployProxy(TransferProxy, [], {
      initializer: "__TransferProxy_init",
    });

    const ERC20TransferProxy = await ethers.getContractFactory(
      "ERC20TransferProxy"
    );
    const erc20TransferProxy = await upgrades.deployProxy(
      ERC20TransferProxy,
      [],
      {
        initializer: "__ERC20TransferProxy_init",
      }
    );

    const RoyaltiesRegistry = await ethers.getContractFactory(
      "RoyaltiesRegistry"
    );
    const royaltiesRegistry = await upgrades.deployProxy(
      RoyaltiesRegistry,
      [],
      {
        initializer: "__RoyaltiesRegistry_init",
      }
    );

    const MockNFT = await ethers.getContractFactory("MockNFT");
    const MockToken = await ethers.getContractFactory("MockToken");

    const mockNFT = await MockNFT.deploy();
    const mockToken = await MockToken.deploy(1000);

    const ERC721FloorBidMatcher = await ethers.getContractFactory(
      "ERC721FloorBidMatcher"
    );

    const erc721FloorBidMatcher = await upgrades.deployProxy(
      ERC721FloorBidMatcher,
      [
        DAO_ADDRESS,
        DAO_FEE,
        erc20TransferProxy.address,
        transferProxy.address,
        royaltiesRegistry.address,
        MAX_TOKENS_IN_ORDER,
        [mockToken.address],
      ],
      { initializer: "__ERC721FloorBidMatcher_init" }
    );

    await erc20TransferProxy.addOperator(erc721FloorBidMatcher.address);
    await transferProxy.addOperator(erc721FloorBidMatcher.address);

    return { erc721FloorBidMatcher, mockNFT, mockToken, royaltiesRegistry };
  };

  it("should initialize successfully with correct daoFee and daoAddress", async () => {
    const { erc721FloorBidMatcher } = await loadFixture(deployedContracts);

    const daoFee = await erc721FloorBidMatcher.daoFeeBps();
    const daoAddress = await erc721FloorBidMatcher.daoAddress();

    expect(daoFee).to.equal(DAO_FEE);
    expect(daoAddress).to.equal(DAO_ADDRESS);
  });

  it("should create successfully a buy order", async () => {
    const { erc721FloorBidMatcher, mockNFT, mockToken } = await loadFixture(
      deployedContracts
    );
    const erc20TransferProxy = await erc721FloorBidMatcher.erc20TransferProxy();
    const accounts = await ethers.getSigners();
    const currentTime = Math.round(new Date().getTime() / 1000);
    const endTime = currentTime + 1000;

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy, ethers.constants.MaxUint256);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .createBuyOrder(mockNFT.address, mockToken.address, 1, 500, endTime)
    ).to.be.emit(erc721FloorBidMatcher, "LogCreateBuyOrder");

    const balance = await mockToken.balanceOf(erc721FloorBidMatcher.address);
    expect(balance).to.equal(500);
  });

  it("should create successfully a buy order with ETH", async () => {
    const { erc721FloorBidMatcher, mockNFT, mockToken } = await loadFixture(
      deployedContracts
    );
    const erc20TransferProxy = await erc721FloorBidMatcher.erc20TransferProxy();
    const accounts = await ethers.getSigners();
    const currentTime = Math.round(new Date().getTime() / 1000);
    const endTime = currentTime + 1000;

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy, ethers.constants.MaxUint256);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .createBuyOrderETH(mockNFT.address, 1, endTime, { value: 500 })
    ).to.be.emit(erc721FloorBidMatcher, "LogCreateBuyOrder");

    const balance = await ethers.provider.getBalance(
      erc721FloorBidMatcher.address
    );
    expect(balance).to.equal(500);
  });

  it("should cancel successfully a buy order", async () => {
    const { erc721FloorBidMatcher, mockNFT, mockToken } = await loadFixture(
      deployedContracts
    );
    const erc20TransferProxy = await erc721FloorBidMatcher.erc20TransferProxy();
    const accounts = await ethers.getSigners();
    const currentTime = Math.round(new Date().getTime() / 1000);
    const endTime = currentTime + 100;

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy, ethers.constants.MaxUint256);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .createBuyOrder(mockNFT.address, mockToken.address, 1, 500, endTime)
    ).to.be.emit(erc721FloorBidMatcher, "LogCreateBuyOrder");

    const orderId = await erc721FloorBidMatcher.ordersCount();

    const balance = await mockToken.balanceOf(erc721FloorBidMatcher.address);
    expect(balance).to.equal(500);

    await expect(
      erc721FloorBidMatcher.connect(accounts[0]).cancelOrder(orderId)
    ).to.be.emit(erc721FloorBidMatcher, "LogCancelOrder");

    const escrowBalanceAfterCancel = await mockToken.balanceOf(
      erc721FloorBidMatcher.address
    );
    expect(escrowBalanceAfterCancel).to.equal(0);

    const balanceAfterCancel = await mockToken.balanceOf(accounts[0].address);
    expect(balanceAfterCancel).to.equal(1000);
  });

  it("should cancel successfully a buy order with ETH", async () => {
    const { erc721FloorBidMatcher, mockNFT, mockToken } = await loadFixture(
      deployedContracts
    );
    const erc20TransferProxy = await erc721FloorBidMatcher.erc20TransferProxy();
    const accounts = await ethers.getSigners();
    const currentTime = Math.round(new Date().getTime() / 1000);
    const endTime = currentTime + 100;

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy, ethers.constants.MaxUint256);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .createBuyOrderETH(mockNFT.address, 1, endTime, { value: 500 })
    ).to.be.emit(erc721FloorBidMatcher, "LogCreateBuyOrder");

    const orderId = await erc721FloorBidMatcher.ordersCount();

    const balance = await ethers.provider.getBalance(
      erc721FloorBidMatcher.address
    );
    expect(balance).to.equal(500);

    await expect(
      erc721FloorBidMatcher.connect(accounts[0]).cancelOrder(orderId)
    ).to.be.emit(erc721FloorBidMatcher, "LogCancelOrder");

    const escrowBalanceAfterCancel = await ethers.provider.getBalance(
      erc721FloorBidMatcher.address
    );
    expect(escrowBalanceAfterCancel).to.equal(0);
  });

  it("should successfully withdraw funds from expired order", async () => {
    const { erc721FloorBidMatcher, mockNFT, mockToken } = await loadFixture(
      deployedContracts
    );
    const erc20TransferProxy = await erc721FloorBidMatcher.erc20TransferProxy();
    const accounts = await ethers.getSigners();
    const currentTime = Math.round(new Date().getTime() / 1000);
    const endTime = currentTime + 100;

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy, ethers.constants.MaxUint256);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .createBuyOrder(mockNFT.address, mockToken.address, 1, 500, endTime)
    ).to.be.emit(erc721FloorBidMatcher, "LogCreateBuyOrder");

    const orderId = await erc721FloorBidMatcher.ordersCount();

    const balance = await mockToken.balanceOf(erc721FloorBidMatcher.address);
    expect(balance).to.equal(500);

    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 10]);
    await ethers.provider.send("evm_mine");

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .withdrawFundsFromExpiredOrder(orderId)
    ).to.be.emit(erc721FloorBidMatcher, "LogTokenWithdrawal");

    const escrowBalanceAfterCancel = await mockToken.balanceOf(
      erc721FloorBidMatcher.address
    );
    expect(escrowBalanceAfterCancel).to.equal(0);

    const balanceAfterCancel = await mockToken.balanceOf(accounts[0].address);
    expect(balanceAfterCancel).to.equal(1000);
  });

  it("should successfully withdraw funds from expired order with ETH", async () => {
    const { erc721FloorBidMatcher, mockNFT, mockToken } = await loadFixture(
      deployedContracts
    );
    const erc20TransferProxy = await erc721FloorBidMatcher.erc20TransferProxy();
    const accounts = await ethers.getSigners();
    const currentTime = Math.round(new Date().getTime() / 1000);
    const endTime = currentTime + 100;

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy, ethers.constants.MaxUint256);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .createBuyOrderETH(mockNFT.address, 1, endTime, { value: 500 })
    ).to.be.emit(erc721FloorBidMatcher, "LogCreateBuyOrder");

    const orderId = await erc721FloorBidMatcher.ordersCount();

    const balance = await ethers.provider.getBalance(
      erc721FloorBidMatcher.address
    );
    expect(balance).to.equal(500);

    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 10]);
    await ethers.provider.send("evm_mine");

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .withdrawFundsFromExpiredOrder(orderId)
    ).to.be.emit(erc721FloorBidMatcher, "LogTokenWithdrawal");

    const escrowBalanceAfterCancel = await ethers.provider.getBalance(
      erc721FloorBidMatcher.address
    );
    expect(escrowBalanceAfterCancel).to.equal(0);
  });

  it("should successfully match a buy order", async () => {
    const { erc721FloorBidMatcher, mockNFT, mockToken } = await loadFixture(
      deployedContracts
    );
    const erc20TransferProxy = await erc721FloorBidMatcher.erc20TransferProxy();
    const nftTransferProxy = await erc721FloorBidMatcher.nftTransferProxy();
    const accounts = await ethers.getSigners();
    const currentTime = Math.round(new Date().getTime() / 1000);
    const endTime = currentTime + 100;

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy, ethers.constants.MaxUint256);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .createBuyOrder(mockNFT.address, mockToken.address, 20, 500, endTime)
    ).to.be.emit(erc721FloorBidMatcher, "LogCreateBuyOrder");

    const orderId = await erc721FloorBidMatcher.ordersCount();

    const balance = await mockToken.balanceOf(erc721FloorBidMatcher.address);
    expect(balance).to.equal(500);

    for (let i = 0; i < 20; i++) {
      await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[1]).approve(nftTransferProxy, i + 1);
    }

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[1])
        .matchBuyOrder(orderId, [5, 10, 15, 20])
    ).to.be.emit(erc721FloorBidMatcher, "LogMatchBuyOrder");

    const escrowBalanceAfterCancel = await mockToken.balanceOf(
      erc721FloorBidMatcher.address
    );
    expect(escrowBalanceAfterCancel).to.equal(400);

    const sellerBalance = await mockToken.balanceOf(accounts[1].address);
    expect(sellerBalance).to.equal(75);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[1])
        .matchBuyOrder(orderId, [4, 9, 14, 19])
    ).to.be.emit(erc721FloorBidMatcher, "LogMatchBuyOrder");

    const nftBalanceBuyer = await mockNFT.balanceOf(accounts[0].address);
    expect(nftBalanceBuyer).to.equal(8);

    const nftBalanceSeller = await mockNFT.balanceOf(accounts[1].address);
    expect(nftBalanceSeller).to.equal(12);
  });

  it("should successfully match a buy order with ETH", async () => {
    const { erc721FloorBidMatcher, mockNFT, mockToken } = await loadFixture(
      deployedContracts
    );
    const erc20TransferProxy = await erc721FloorBidMatcher.erc20TransferProxy();
    const nftTransferProxy = await erc721FloorBidMatcher.nftTransferProxy();
    const accounts = await ethers.getSigners();
    const currentTime = Math.round(new Date().getTime() / 1000);
    const endTime = currentTime + 100;

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy, ethers.constants.MaxUint256);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .createBuyOrderETH(mockNFT.address, 20, endTime, { value: 500 })
    ).to.be.emit(erc721FloorBidMatcher, "LogCreateBuyOrder");

    const orderId = await erc721FloorBidMatcher.ordersCount();

    const balance = await ethers.provider.getBalance(
      erc721FloorBidMatcher.address
    );
    expect(balance).to.equal(500);

    for (let i = 0; i < 20; i++) {
      await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[1]).approve(nftTransferProxy, i + 1);
    }

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[1])
        .matchBuyOrder(orderId, [5, 10, 15, 20])
    ).to.be.emit(erc721FloorBidMatcher, "LogMatchBuyOrder");

    const escrowBalanceAfterCancel = await ethers.provider.getBalance(
      erc721FloorBidMatcher.address
    );
    expect(escrowBalanceAfterCancel).to.equal(400);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[1])
        .matchBuyOrder(orderId, [4, 9, 14, 19])
    ).to.be.emit(erc721FloorBidMatcher, "LogMatchBuyOrder");

    const nftBalanceBuyer = await mockNFT.balanceOf(accounts[0].address);
    expect(nftBalanceBuyer).to.equal(8);

    const nftBalanceSeller = await mockNFT.balanceOf(accounts[1].address);
    expect(nftBalanceSeller).to.equal(12);
  });

  it("should successfully Deduct Royalties from the Seller Revenue", async () => {
    const { erc721FloorBidMatcher, mockNFT, mockToken, royaltiesRegistry } = await loadFixture(
      deployedContracts
    );

    const erc20TransferProxy = await erc721FloorBidMatcher.erc20TransferProxy();
    const nftTransferProxy = await erc721FloorBidMatcher.nftTransferProxy();
    const accounts = await ethers.getSigners();
    const currentTime = Math.round(new Date().getTime() / 1000);
    const endTime = currentTime + 100;

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy, ethers.constants.MaxUint256);

    await expect(
      erc721FloorBidMatcher
        .connect(accounts[0])
        .createBuyOrder(mockNFT.address, mockToken.address, 10, 500, endTime)
    ).to.be.emit(erc721FloorBidMatcher, "LogCreateBuyOrder");

    const orderId = await erc721FloorBidMatcher.ordersCount();

    const balance = await mockToken.balanceOf(erc721FloorBidMatcher.address);
    expect(balance).to.equal(500);

    // Assign Collection Royalties to the collection
    await royaltiesRegistry.setRoyaltiesByToken(mockNFT.address, [
      [accounts[5].address, 1000],
    ]);

    // Token price is Sum Amount / number of tokens = 500 / 10 = 50;
    // The collection royalty address should receive 10% from the sale which is equal to (50 * 1000 BPS) / 10000 = 5

    for (let i = 0; i < 20; i++) {
      await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[1]).approve(nftTransferProxy, i + 1);
    }

    // Match and sell one token
    await expect(
      erc721FloorBidMatcher
        .connect(accounts[1])
        .matchBuyOrder(orderId, [5])
    ).to.be.emit(erc721FloorBidMatcher, "LogMatchBuyOrder");

    const escrowBalanceAfterCancel = await mockToken.balanceOf(erc721FloorBidMatcher.address);

    // After the match we should have 500 - 50 (NFT price) = 450
    expect(escrowBalanceAfterCancel).to.equal(450);

    const sellerBalance = await mockToken.balanceOf(accounts[1].address);
    // Seller Balance is formed after the Royalties have been paid to the collection and After the Dao fee has been paid
    // As we know the amount to pay per NFT is 50
    // As we know the royalties so far are 5
    // The Dao fee is fomed by daoFeeBps.mul(amountToPay).div(10000); === (2500 * 50) / 10000 = 12.5
    // So when we sum those fees 5 + 12.5 = 17
    // From the sell price 50 - 17 = 33
    expect(sellerBalance).to.equal(33);
  });
});
