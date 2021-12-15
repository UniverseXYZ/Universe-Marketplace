const { expect } = require("chai");

const { waffle, ethers, upgrades } = require("hardhat");
const { loadFixture } = waffle;

const DAO_FEE = 2500;
const DAO_ADDRESS = "0x67b93852482113375666a310ac292D61dDD4bbb9";
const { Order, Asset, sign } = require("../helpers/order");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_BUNDLE_SIZE = 10;
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
    const accounts = await ethers.getSigners();

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
        MAX_BUNDLE_SIZE,
      ],
      { initializer: "__UniverseMarketplace_init" }
    );

    const MockNFT = await ethers.getContractFactory("MockNFT");
    const MockNFTSecondaryFees = await ethers.getContractFactory(
      "MockNFTSecondaryFees"
    );
    const MockNFTERC2981Royalties = await ethers.getContractFactory(
      "MockNFTERC2981Royalties"
    );
    const MockToken = await ethers.getContractFactory("MockToken");

    const mockNFT = await MockNFT.deploy();
    const mockNFT2 = await MockNFT.deploy();
    const mockNFT3 = await MockNFTSecondaryFees.deploy();
    const mockNFT4 = await MockNFTERC2981Royalties.deploy();
    const mockToken = await MockToken.deploy(1000);

    await erc20TransferProxy.addOperator(universeMarketplace.address);
    await transferProxy.addOperator(universeMarketplace.address);
    await royaltiesRegistry.setRoyaltiesByToken(mockNFT.address, [
      [accounts[5].address, 1000],
      [accounts[6].address, 1000],
    ]);

    return {
      universeMarketplace,
      mockNFT,
      mockNFT2,
      mockNFT3,
      mockNFT4,
      mockToken,
      erc20TransferProxy,
      transferProxy,
      royaltiesRegistry,
    };
  };

  it("should initialize successfully with correct protocolFee and defaultFeeReceiver", async () => {
    const { universeMarketplace } = await loadFixture(deployedContracts);

    const protocolFee = await universeMarketplace.daoFee();
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
    expect(balance).to.equal(327);

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
    expect(balance).to.equal(275);

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
          value: 200,
        })
    ).to.be.emit(universeMarketplace, "Match");

    const balanceAfter = await ethers.provider.getBalance(accounts[1].address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(110);

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

    const encodedPaymentSplitsData = await universeMarketplace.encodeOrderData([
      [
        [accounts[2].address, 1000],
        [accounts[3].address, 2000],
        [accounts[4].address, 2000],
      ],
    ]);

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
      "0x0b35c423",
      encodedPaymentSplitsData
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
          value: 200,
        })
    ).to.be.emit(universeMarketplace, "Match");

    const balanceAfter = await ethers.provider.getBalance(accounts[1].address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(32);

    const mockNFTBalance = await mockNFT.balanceOf(accounts[0].address);
    expect(mockNFTBalance).to.equal(3);

    const mockNFTBalance2 = await mockNFT2.balanceOf(accounts[0].address);
    expect(mockNFTBalance2).to.equal(3);

    const tokenOwner = await mockNFT.ownerOf(1);
    expect(tokenOwner).to.equal(accounts[0].address);
  });

  it("should create successfully match single ERC721 with ETH - Fee Side Make", async () => {
    const { universeMarketplace, mockNFT, transferProxy } = await loadFixture(
      deployedContracts
    );

    const accounts = await ethers.getSigners();

    await mockNFT.connect(accounts[0]).mint("https://universe.xyz");
    await mockNFT.connect(accounts[0]).approve(transferProxy.address, 1);

    const encodedPaymentSplitsData = await universeMarketplace.encodeOrderData([
      [
        [accounts[2].address, 1000],
        [accounts[3].address, 2000],
        [accounts[4].address, 2000],
      ],
    ]);

    const erc721Qunatity = 1;

    const left = Order(
      accounts[1].address,
      Asset(ETH, "0x", 200),
      ZERO_ADDRESS,
      Asset(ERC721, encodeToken(mockNFT.address, 1), erc721Qunatity),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const right = Order(
      accounts[0].address,
      Asset(ERC721, encodeToken(mockNFT.address, 1), erc721Qunatity),
      ZERO_ADDRESS,
      Asset(ETH, "0x", 200),
      1,
      0,
      0,
      "0x0b35c423",
      encodedPaymentSplitsData
    );

    const signatureLeft = await sign(
      left,
      accounts[1],
      universeMarketplace.address
    );

    const signatureRight = await sign(
      right,
      accounts[0],
      universeMarketplace.address
    );

    const balanceBefore = await ethers.provider.getBalance(accounts[0].address);

    await expect(
      universeMarketplace
        .connect(accounts[1])
        .matchOrders(left, "0x", right, signatureRight, {
          value: 200,
        })
    ).to.be.emit(universeMarketplace, "Match");

    const balanceAfter = await ethers.provider.getBalance(accounts[0].address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(10);

    const mockNFTBalance = await mockNFT.balanceOf(accounts[1].address);
    expect(mockNFTBalance).to.equal(1);

    const tokenOwner = await mockNFT.ownerOf(1);
    expect(tokenOwner).to.equal(accounts[1].address);
  });

  it("should fail if ERC721 BUNDLE has more than 10 NFTs", async () => {
    const { universeMarketplace, mockNFT, mockNFT2, transferProxy } =
      await loadFixture(deployedContracts);

    const accounts = await ethers.getSigners();

    for (let i = 0; i < 6; i++) {
      await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[1]).approve(transferProxy.address, i + 1);
      await mockNFT2.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT2.connect(accounts[1]).approve(transferProxy.address, i + 1);
    }

    const erc721Qunatity = 12;

    const encodedPaymentSplitsData = await universeMarketplace.encodeOrderData([
      [
        [accounts[2].address, 1000],
        [accounts[3].address, 2000],
        [accounts[4].address, 2000],
      ],
    ]);

    const left = Order(
      accounts[1].address,
      Asset(
        ERC721_BUNDLE,
        encodeBundleInfo(
          [mockNFT.address, mockNFT2.address],
          [
            [1, 2, 3, 4, 5, 6],
            [1, 2, 3, 4, 5, 6],
          ]
        ),
        erc721Qunatity
      ),
      ZERO_ADDRESS,
      Asset(ETH, "0x", 200),
      1,
      0,
      0,
      "0x0b35c423",
      encodedPaymentSplitsData
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
            [1, 2, 3, 4, 5, 6],
            [1, 2, 3, 4, 5, 6],
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

    await expect(
      universeMarketplace
        .connect(accounts[0])
        .matchOrders(left, signatureLeft, right, "0x", {
          value: 200,
        })
    ).revertedWith("erc721 value error");
  });

  it("should recognize HasSecondarySaleFees interface through the Royalties registry", async () => {
    const { universeMarketplace, mockNFT3, transferProxy } = await loadFixture(
      deployedContracts
    );

    const accounts = await ethers.getSigners();

    await mockNFT3
      .connect(accounts[0])
      .mint("https://universe.xyz", [[accounts[10].address, 2000]]);
    await mockNFT3.connect(accounts[0]).approve(transferProxy.address, 1);

    const encodedPaymentSplitsData = await universeMarketplace.encodeOrderData([
      [
        [accounts[2].address, 1000],
        [accounts[3].address, 2000],
        [accounts[4].address, 2000],
      ],
    ]);

    const erc721Qunatity = 1;

    const left = Order(
      accounts[1].address,
      Asset(ETH, "0x", 200),
      ZERO_ADDRESS,
      Asset(ERC721, encodeToken(mockNFT3.address, 1), erc721Qunatity),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const right = Order(
      accounts[0].address,
      Asset(ERC721, encodeToken(mockNFT3.address, 1), erc721Qunatity),
      ZERO_ADDRESS,
      Asset(ETH, "0x", 200),
      1,
      0,
      0,
      "0x0b35c423",
      encodedPaymentSplitsData
    );

    const signatureLeft = await sign(
      left,
      accounts[1],
      universeMarketplace.address
    );

    const signatureRight = await sign(
      right,
      accounts[0],
      universeMarketplace.address
    );

    const balanceBefore = await ethers.provider.getBalance(accounts[0].address);

    await expect(
      universeMarketplace
        .connect(accounts[1])
        .matchOrders(left, "0x", right, signatureRight, {
          value: 200,
        })
    ).to.be.emit(universeMarketplace, "Match");

    const balanceAfter = await ethers.provider.getBalance(accounts[0].address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(10);

    const mockNFTBalance = await mockNFT3.balanceOf(accounts[1].address);
    expect(mockNFTBalance).to.equal(1);

    const tokenOwner = await mockNFT3.ownerOf(1);
    expect(tokenOwner).to.equal(accounts[1].address);
  });

  it("should recognize ERC2981Royalties interface through the Royalties registry", async () => {
    const { universeMarketplace, mockNFT4, transferProxy } = await loadFixture(
      deployedContracts
    );

    const accounts = await ethers.getSigners();

    await mockNFT4
      .connect(accounts[0])
      .mint("https://universe.xyz", 2000, accounts[20].address);
    await mockNFT4.connect(accounts[0]).approve(transferProxy.address, 1);

    const encodedPaymentSplitsData = await universeMarketplace.encodeOrderData([
      [
        [accounts[2].address, 1000],
        [accounts[3].address, 2000],
        [accounts[4].address, 2000],
      ],
    ]);

    const erc721Qunatity = 1;

    const left = Order(
      accounts[1].address,
      Asset(ETH, "0x", 200),
      ZERO_ADDRESS,
      Asset(ERC721, encodeToken(mockNFT4.address, 1), erc721Qunatity),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const right = Order(
      accounts[0].address,
      Asset(ERC721, encodeToken(mockNFT4.address, 1), erc721Qunatity),
      ZERO_ADDRESS,
      Asset(ETH, "0x", 200),
      1,
      0,
      0,
      "0x0b35c423",
      encodedPaymentSplitsData
    );

    const signatureLeft = await sign(
      left,
      accounts[1],
      universeMarketplace.address
    );

    const signatureRight = await sign(
      right,
      accounts[0],
      universeMarketplace.address
    );

    const balanceBefore = await ethers.provider.getBalance(accounts[0].address);
    const balanceRoyaltyReceiverBefore = await ethers.provider.getBalance(
      accounts[20].address
    );

    await expect(
      universeMarketplace
        .connect(accounts[1])
        .matchOrders(left, "0x", right, signatureRight, {
          value: 200,
        })
    ).to.be.emit(universeMarketplace, "Match");

    const balanceAfter = await ethers.provider.getBalance(accounts[0].address);
    const balanceRoyaltyReceiverAfter = await ethers.provider.getBalance(
      accounts[20].address
    );
    expect(balanceAfter.sub(balanceBefore)).to.equal(10);
    expect(
      balanceRoyaltyReceiverAfter.sub(balanceRoyaltyReceiverBefore)
    ).to.equal(40);

    const mockNFTBalance = await mockNFT4.balanceOf(accounts[1].address);
    expect(mockNFTBalance).to.equal(1);

    const tokenOwner = await mockNFT4.ownerOf(1);
    expect(tokenOwner).to.equal(accounts[1].address);
  });
});
