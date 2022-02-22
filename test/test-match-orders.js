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
    await universeMarketplace.activate()

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

  it("should create successfully match ERC721 BUNDLE with ERC20 with Collection & NFT & Royalty Splits & Dao Fees", async () => {
    const {
      universeMarketplace,
      mockNFT,
      mockNFT2,
      mockToken,
      transferProxy,
      erc20TransferProxy,
      royaltiesRegistry,
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

      // Assign 10 % Royalties to a specific NFT
      await royaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockNFT.address, i + 1, [
        [accounts[16].address, 1000],
      ]);
    }

  const encodedPaymentSplitsData = await universeMarketplace.encodeOrderData([
      [
        [accounts[12].address, 1000],
      ],
    ]);
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
      "0x0b35c423",
      encodedPaymentSplitsData
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
    // Collection Royalty Fees calculations
    // We have a total of 6 NFTs, 3 NFTs has 2 addresses with 10% Collection royalties each, the total sell price is 500, individual sell price is = 500 / 6 = 83 ETH. Collection Royalties for 1 NFT is 10 % from 83 = 8 * 2(addresses) = 16. Total Collection Royalties for Bundle = 3 * 16 = 48.

    // NFT Royalty Fees calculations
    // We have a total of 6 NFTs, 3 NFTs has 1 address with 10% NFT Royalties each, the total sell price is 500, individual sell price is 500 / 6 = 83 ETH - 16 Eth (Collection Royalty Fee) = 67 ETH. NFT Royalties for 1 NFT is 10 % from 67 = 6. Total NFT Royalties for the Bundle is 3 * 6 = 18

    // DAO Fee calculations
    // Total Amount passed to DAO calculations is 500 - (48 + 18) = 434 ETH
    // 25% from 434 = 108 ETH

    // Revenue Splits Fees Calculations
    // Total amount passed to Revenue splits Calculations is 500 - (66 + 108) = 326 ETH. 10% from 326 = 32 ETH

    // Total Fees = 48 + 18 + 108 + 32 = 206
    // 500 - 206 = 294
    expect(balance).to.equal(294);

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
    // Collection Royalty Fees calculations
    // We have a total of 1 NFT, the NFTs has 2 addresses with 10% Collection royalties, individual sell price is = 500 ETH. Collection Royalties for 1 NFT is 10 % from 500 = 50 * 2(addresses) = 100.

    // DAO Fee calculations
    // Total Amount passed to DAO calculations is 500 - 100 = 400 ETH
    // 25% from 484 = 100 ETH

    // Total Fees = 100 + 100 = 200
    // 500 - 200 = 300
    expect(balance).to.equal(300);

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
    // Collection Royalty Fees calculations
    // We have a total of 1 NFT, the NFTs has 2 addresses with 10% Collection royalties, individual sell price is = 200 ETH. Collection Royalties for 1 NFT is 10 % from 200 = 20 * 2(addresses) = 40.

    // DAO Fee calculations
    // Total Amount passed to DAO calculations is 200 - 40 = 160 ETH
    // 25% from 160 = 40 ETH

    // Total Fees = 40 + 40 = 80
    // 200 - 80 = 120
    expect(balanceAfter.sub(balanceBefore)).to.equal(120);

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
    // Collection Royalty Fees calculations
    // We have a total of 6 NFTs, 3 NFTs has 2 addresses with 10% Collection royalties each, the total sell price is 200, individual sell price is = 200 / 6 = 33 ETH. Collection Royalties for 1 NFT is 10 % from 33 = 3 * 2(addresses) = 6. Total Collection Royalties for Bundle = 3 * 6 = 18.

    // DAO Fee calculations
    // Total Amount passed to DAO calculations is 200 - 18 = 182 ETH
    // 25% from 182 = 45 ETH

    // Revenue Splits Fees Calculations
    // Total amount passed to Revenue splits Calculations is 200 - (18 + 45) = 137 ETH.
    // 10% from 137 = 13 ETH
    // 20% from 137 = 27 ETH
    // 20% from 137 = 27 ETH
    // Total Revenue splits = 13 + 27 + 27 = 67

    // Total Fees = 18 + 45 + 67 = 130
    // 200 - 130 = 70
    expect(balanceAfter.sub(balanceBefore)).to.equal(70);

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
    // Collection Royalty Fees calculations
    // We have a total of 1 NFTs, the NFTs has 2 addresses with 10% Collection royalties each, individual sell price is = 200 ETH. Collection Royalties for 1 NFT is 10 % from 200 = 20 * 2(addresses) = 40.

    // DAO Fee calculations
    // Total Amount passed to DAO calculations is 200 - 40 = 160 ETH
    // 25% from 160 = 40 ETH

    // Revenue Splits Fees Calculations
    // Total amount passed to Revenue splits Calculations is 200 - (40 + 40) = 120 ETH.
    // 10% from 120 = 12 ETH
    // 20% from 120 = 24 ETH
    // 20% from 120 = 24 ETH
    // Total Revenue splits = 12 + 24 + 24 = 60

    // Total Fees = 40 + 40 + 60 = 140
    // 200 - 140 = 60
    expect(balanceAfter.sub(balanceBefore)).to.equal(60);

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
    // NFT Royalty Fees calculations
    // We have a total of 1 NFT, the NFT has 1 address with 20% NFT Royalties, individual sell price is 200 ETH. NFT Royalties for 1 NFT is 20 % from 200 = 40.

    // DAO Fee calculations
    // Total Amount passed to DAO calculations is 200 - 40 = 160 ETH
    // 25% from 160 = 40 ETH

    // Revenue Splits Fees Calculations
    // Total amount passed to Revenue splits Calculations is 200 - (40 + 40) = 120 ETH.
    // 10% from 120 = 12 ETH
    // 20% from 120 = 24 ETH
    // 20% from 120 = 24 ETH
    // Total Revenue splits = 12 + 24 + 24 = 60

    // Total Fees = 40 + 40 + 60 = 140
    // 200 - 140 = 60
    expect(balanceAfter.sub(balanceBefore)).to.equal(60);

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

    // NFT Royalty Fees calculations
    // We have a total of 1 NFT, the NFT has 1 address with 20% NFT Royalties, individual sell price is 200 ETH. NFT Royalties for 1 NFT is 20 % from 200 = 40.

    // DAO Fee calculations
    // Total Amount passed to DAO calculations is 200 - 40 = 160 ETH
    // 25% from 160 = 40 ETH

    // Revenue Splits Fees Calculations
    // Total amount passed to Revenue splits Calculations is 200 - (40 + 40) = 120 ETH.
    // 10% from 120 = 12 ETH
    // 20% from 120 = 24 ETH
    // 20% from 120 = 24 ETH
    // Total Revenue splits = 12 + 24 + 24 = 60

    // Total Fees = 40 + 40 + 60 = 140
    // 200 - 140 = 60
    expect(balanceAfter.sub(balanceBefore)).to.equal(60);
    expect(
      balanceRoyaltyReceiverAfter.sub(balanceRoyaltyReceiverBefore)
    ).to.equal(40);

    const mockNFTBalance = await mockNFT4.balanceOf(accounts[1].address);
    expect(mockNFTBalance).to.equal(1);

    const tokenOwner = await mockNFT4.ownerOf(1);
    expect(tokenOwner).to.equal(accounts[1].address);
  });

  it("should successfully Deduct Multiple NFT && Collection Level Royalties from the Seller Revenue", async () => {
    const { universeMarketplace, mockNFT2, transferProxy, royaltiesRegistry } = await loadFixture(
      deployedContracts
    );

    const accounts = await ethers.getSigners();

    await mockNFT2.connect(accounts[0]).mint("https://universe.xyz");
    await mockNFT2.connect(accounts[0]).approve(transferProxy.address, 1);

    const encodedPaymentSplitsData = await universeMarketplace.encodeOrderData([
      [
        [accounts[2].address, 1000],
      ],
    ]);

    // Assign 10% Collection Royalties
    await royaltiesRegistry.setRoyaltiesByToken(mockNFT2.address, [
      [accounts[10].address, 1000],
    ]);

    // Assign 10 % Royalties to a specific NFT
    await royaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockNFT2.address, 1, [
      [accounts[16].address, 1000],
    ]);

    const erc721Qunatity = 1;

    const left = Order(
      accounts[1].address,
      Asset(ETH, "0x", 200),
      ZERO_ADDRESS,
      Asset(ERC721, encodeToken(mockNFT2.address, 1), erc721Qunatity),
      1,
      0,
      0,
      "0xffffffff",
      "0x"
    );

    const right = Order(
      accounts[0].address,
      Asset(ERC721, encodeToken(mockNFT2.address, 1), erc721Qunatity),
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
    // Collection Royalty Fees calculations
    // We have a total of 1 NFT, the NFT has 1 addresses with 10% Collection royalties, individual sell price is 200 ETH. Collection Royalties for 1 NFT is 10 % from 200 = 20.

    // NFT Royalty Fees calculations
    // We have a total of 1 NFT, the NFT has 1 address with 10% NFT Royalties, the total sell price is 200, individual sell price is 200 ETH - 20 Eth (Collection Royalty Fee) = 180 ETH. NFT Royalties for 1 NFT is 10 % from 180 = 18.

    // DAO Fee calculations
    // Total Amount passed to DAO calculations is 200 - (20 + 18) = 162 ETH
    // 25% from 162 = 40 ETH

    // Revenue Splits Fees Calculations
    // Total amount passed to Revenue splits Calculations is 200 - (38 + 40) = 122 ETH. 10% from 122 = 12 ETH

    // Total Fees = 20 + 18 + 40 + 12 = 90
    // 200 - 90 = 110
    expect(balanceAfter.sub(balanceBefore)).to.equal(110);

    const mockNFTBalance = await mockNFT2.balanceOf(accounts[1].address);
    expect(mockNFTBalance).to.equal(1);

    const tokenOwner = await mockNFT2.ownerOf(1);
    expect(tokenOwner).to.equal(accounts[1].address);
  });
});
