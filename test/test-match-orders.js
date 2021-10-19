const { expect } = require("chai");

const { waffle, ethers, upgrades } = require("hardhat");
const { loadFixture } = waffle;

const DAO_FEE = 2500;
const DAO_ADDRESS = "0x67b93852482113375666a310ac292D61dDD4bbb9";
const { Order, Asset, sign } = require("../helpers/order");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const {
  ETH,
  ERC20,
  ERC721_BUNDLE,
  ERC721,
  encodeToken,
  encodeBundleInfo,
} = require("../helpers/assets");

describe("Match Orders Tests", () => {
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

    const UniverseMarketplace = await ethers.getContractFactory(
      "UniverseMarketplace"
    );

    const universeMarketplace = await upgrades.deployProxy(
      UniverseMarketplace,
      [
        transferProxy.address,
        erc20TransferProxy.address,
        DAO_FEE,
        DAO_ADDRESS,
        royaltiesRegistry.address,
      ],
      { initializer: "__UniverseMarketplace_init" }
    );

    const MockNFT = await ethers.getContractFactory("MockNFT");
    const MockToken = await ethers.getContractFactory("MockToken");

    const mockNFT = await MockNFT.deploy();
    const mockNFT2 = await MockNFT.deploy();
    const mockToken = await MockToken.deploy(1000);

    await erc20TransferProxy.addOperator(universeMarketplace.address);
    await transferProxy.addOperator(universeMarketplace.address);

    return {
      universeMarketplace,
      mockNFT,
      mockNFT2,
      mockToken,
      erc20TransferProxy,
      transferProxy,
    };
  };

  it("should initialize successfully with correct protocolFee and defaultFeeReceiver", async () => {
    const { universeMarketplace } = await loadFixture(deployedContracts);

    const protocolFee = await universeMarketplace.protocolFee();
    const defaultFeeReceiver = await universeMarketplace.defaultFeeReceiver();

    expect(protocolFee).to.equal(DAO_FEE);
    expect(defaultFeeReceiver).to.equal(DAO_ADDRESS);
  });

  it("should create successfully match ERC721 BUNDLE with ERC20", async () => {
    const {
      universeMarketplace,
      mockNFT,
      mockNFT2,
      mockToken,
      transferProxy,
      erc20TransferProxy,
    } = await loadFixture(deployedContracts);

    const accounts = await ethers.getSigners();

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy.address, ethers.constants.MaxUint256);

    for (let i = 0; i < 3; i++) {
      await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[1]).approve(transferProxy.address, i + 1);
      await mockNFT2.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT2.connect(accounts[1]).approve(transferProxy.address, i + 1);
    }

    const bundleERC721Qunatity = 6;

    const left = Order(
      accounts[1].address,
      Asset(
        ERC721_BUNDLE,
        encodeBundleInfo(
          [mockNFT.address, mockNFT2.address],
          [
            [1, 2, 3],
            [1, 2, 3],
          ]
        ),
        bundleERC721Qunatity
      ),
      ZERO_ADDRESS,
      Asset(ERC20, encodeToken(mockToken.address), 500),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );
    const right = Order(
      accounts[0].address,
      Asset(ERC20, encodeToken(mockToken.address), 500),
      ZERO_ADDRESS,
      Asset(
        ERC721_BUNDLE,
        encodeBundleInfo(
          [mockNFT.address, mockNFT2.address],
          [
            [1, 2, 3],
            [1, 2, 3],
          ]
        ),
        bundleERC721Qunatity
      ),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const signatureRight = await sign(
      right,
      accounts[0],
      universeMarketplace.address
    );

    await expect(
      universeMarketplace
        .connect(accounts[1])
        .matchOrders(left, "0x", right, signatureRight)
    ).to.be.emit(universeMarketplace, "Match");

    const balance = await mockToken.balanceOf(accounts[1].address);
    expect(balance).to.equal(375);

    const mockNFTBalance = await mockNFT.balanceOf(accounts[0].address);
    expect(mockNFTBalance).to.equal(3);

    const mockNFTBalance2 = await mockNFT2.balanceOf(accounts[0].address);
    expect(mockNFTBalance2).to.equal(3);

    const tokenOwner = await mockNFT.ownerOf(3);
    expect(tokenOwner).to.equal(accounts[0].address);
  });

  it("should create successfully match single ERC721 with ERC20", async () => {
    const {
      universeMarketplace,
      mockNFT,
      mockToken,
      transferProxy,
      erc20TransferProxy,
    } = await loadFixture(deployedContracts);

    const accounts = await ethers.getSigners();

    await mockToken
      .connect(accounts[0])
      .approve(erc20TransferProxy.address, ethers.constants.MaxUint256);

    await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
    await mockNFT.connect(accounts[1]).approve(transferProxy.address, 1);

    const erc721Qunatity = 1;

    const left = Order(
      accounts[1].address,
      Asset(ERC721, encodeToken(mockNFT.address, 1), erc721Qunatity),
      ZERO_ADDRESS,
      Asset(ERC20, encodeToken(mockToken.address), 500),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );
    const right = Order(
      accounts[0].address,
      Asset(ERC20, encodeToken(mockToken.address), 500),
      ZERO_ADDRESS,
      Asset(ERC721, encodeToken(mockNFT.address, 1), erc721Qunatity),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const signatureRight = await sign(
      right,
      accounts[0],
      universeMarketplace.address
    );

    await expect(
      universeMarketplace
        .connect(accounts[1])
        .matchOrders(left, "0x", right, signatureRight)
    ).to.be.emit(universeMarketplace, "Match");

    const balance = await mockToken.balanceOf(accounts[1].address);
    expect(balance).to.equal(375);

    const mockNFTBalance = await mockNFT.balanceOf(accounts[0].address);
    expect(mockNFTBalance).to.equal(1);

    const tokenOwner = await mockNFT.ownerOf(1);
    expect(tokenOwner).to.equal(accounts[0].address);
  });

  it("should create successfully match single ERC721 with ETH", async () => {
    const { universeMarketplace, mockNFT, transferProxy } = await loadFixture(
      deployedContracts
    );

    const accounts = await ethers.getSigners();

    await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
    await mockNFT.connect(accounts[1]).approve(transferProxy.address, 1);

    const erc721Qunatity = 1;

    const left = Order(
      accounts[1].address,
      Asset(ERC721, encodeToken(mockNFT.address, 1), erc721Qunatity),
      ZERO_ADDRESS,
      Asset(ETH, "0x", 200),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const right = Order(
      accounts[0].address,
      Asset(ETH, "0x", 200),
      ZERO_ADDRESS,
      Asset(ERC721, encodeToken(mockNFT.address, 1), erc721Qunatity),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const signatureLeft = await sign(
      left,
      accounts[1],
      universeMarketplace.address
    );

    const balanceBefore = await ethers.provider.getBalance(accounts[1].address);

    await expect(
      universeMarketplace
        .connect(accounts[0])
        .matchOrders(left, signatureLeft, right, "0x", {
          value: 250,
        })
    ).to.be.emit(universeMarketplace, "Match");

    const balanceAfter = await ethers.provider.getBalance(accounts[1].address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(150);

    const mockNFTBalance = await mockNFT.balanceOf(accounts[0].address);
    expect(mockNFTBalance).to.equal(1);

    const tokenOwner = await mockNFT.ownerOf(1);
    expect(tokenOwner).to.equal(accounts[0].address);
  });

  it("should create successfully match ERC721 BUNDLE with ETH", async () => {
    const { universeMarketplace, mockNFT, mockNFT2, transferProxy } =
      await loadFixture(deployedContracts);

    const accounts = await ethers.getSigners();

    for (let i = 0; i < 3; i++) {
      await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[1]).approve(transferProxy.address, i + 1);
      await mockNFT2.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT2.connect(accounts[1]).approve(transferProxy.address, i + 1);
    }

    const erc721Qunatity = 6;

    const left = Order(
      accounts[1].address,
      Asset(
        ERC721_BUNDLE,
        encodeBundleInfo(
          [mockNFT.address, mockNFT2.address],
          [
            [1, 2, 3],
            [1, 2, 3],
          ]
        ),
        erc721Qunatity
      ),
      ZERO_ADDRESS,
      Asset(ETH, "0x", 200),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const right = Order(
      accounts[0].address,
      Asset(ETH, "0x", 200),
      ZERO_ADDRESS,
      Asset(
        ERC721_BUNDLE,
        encodeBundleInfo(
          [mockNFT.address, mockNFT2.address],
          [
            [1, 2, 3],
            [1, 2, 3],
          ]
        ),
        erc721Qunatity
      ),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const signatureLeft = await sign(
      left,
      accounts[1],
      universeMarketplace.address
    );

    const balanceBefore = await ethers.provider.getBalance(accounts[1].address);

    await expect(
      universeMarketplace
        .connect(accounts[0])
        .matchOrders(left, signatureLeft, right, "0x", {
          value: 250,
        })
    ).to.be.emit(universeMarketplace, "Match");

    const balanceAfter = await ethers.provider.getBalance(accounts[1].address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(150);

    const mockNFTBalance = await mockNFT.balanceOf(accounts[0].address);
    expect(mockNFTBalance).to.equal(3);

    const mockNFTBalance2 = await mockNFT2.balanceOf(accounts[0].address);
    expect(mockNFTBalance2).to.equal(3);

    const tokenOwner = await mockNFT.ownerOf(1);
    expect(tokenOwner).to.equal(accounts[0].address);
  });
});
