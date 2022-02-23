const { expect } = require("chai");

const { waffle, ethers, upgrades } = require("hardhat");
const { loadFixture } = waffle;

const DAO_FEE = 2500;
const DAO_ADDRESS = "0x67b93852482113375666a310ac292D61dDD4bbb9";
const MAX_BUNDLE_SIZE = 10;
const MAX_BATCH_TRANSFER_SIZE = 50;

describe("ERC721 Batch Transfer Tests", () => {
  const deployedContracts = async () => {
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
        DAO_FEE,
        DAO_ADDRESS,
        royaltiesRegistry.address,
        MAX_BUNDLE_SIZE,
        MAX_BATCH_TRANSFER_SIZE
      ],
      { initializer: "__UniverseMarketplace_init" }
    );

    const MockNFT = await ethers.getContractFactory("MockNFT");
    const MockNFT2 = await ethers.getContractFactory("MockNFT");
    const MockToken = await ethers.getContractFactory("MockToken");

    const mockNFT = await MockNFT.deploy();
    const mockNFT2 = await MockNFT2.deploy();
    const mockToken = await MockToken.deploy(1000);

    return { universeMarketplace, mockNFT, mockNFT2, mockToken };
  };

  it("should successfully transfer multiple NFTs, from different collections", async () => {
    const { universeMarketplace, mockNFT, mockNFT2 } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();

    const nftsToTransfer = [];

    for (let i = 0; i < 25; i++) {
      await mockNFT.connect(accounts[0]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[0]).approve(universeMarketplace.address, i + 1);
      nftsToTransfer.push([mockNFT.address, i + 1]);
    }

    for (let i = 0; i < 25; i++) {
      await mockNFT2.connect(accounts[0]).mint("https://universe.xyz");
      await mockNFT2.connect(accounts[0]).approve(universeMarketplace.address, i + 1);
      nftsToTransfer.push([mockNFT2.address, i + 1]);
    }

    await universeMarketplace.erc721BatchTransfer(
      nftsToTransfer,
      accounts[1].address
    );

    for (let i = 0; i < 25; i++) {
      const tokenOwner = await mockNFT.ownerOf(i + 1);
      expect(tokenOwner).to.equal(accounts[1].address);
    }

    for (let i = 0; i < 25; i++) {
      const tokenOwner = await mockNFT2.ownerOf(i + 1);
      expect(tokenOwner).to.equal(accounts[1].address);
    }
  });

  it("should not transfer more than 50 in one call", async () => {
    const { universeMarketplace, mockNFT, mockNFT2 } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();

    const nftsToTransfer = [];

    for (let i = 0; i < 25; i++) {
      await mockNFT.connect(accounts[0]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[0]).approve(universeMarketplace.address, i + 1);
      nftsToTransfer.push([mockNFT.address, i + 1]);
    }

    for (let i = 0; i < 30; i++) {
      await mockNFT2.connect(accounts[0]).mint("https://universe.xyz");
      await mockNFT2.connect(accounts[0]).approve(universeMarketplace.address, i + 1);
      nftsToTransfer.push([mockNFT2.address, i + 1]);
    }

    await expect(
      universeMarketplace.erc721BatchTransfer(nftsToTransfer, accounts[1].address)
    ).to.be.revertedWith("Cannot transfer more than configured");
  });

  it("should not transfer NFTs is caller is not owner", async () => {
    const { universeMarketplace, mockNFT, mockNFT2 } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();

    const nftsToTransfer = [];

    for (let i = 0; i < 5; i++) {
      await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[1]).approve(universeMarketplace.address, i + 1);
      nftsToTransfer.push([mockNFT.address, i + 1]);
    }

    for (let i = 0; i < 5; i++) {
      await mockNFT2.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT2.connect(accounts[1]).approve(universeMarketplace.address, i + 1);
      nftsToTransfer.push([mockNFT2.address, i + 1]);
    }

    await expect(
      universeMarketplace.erc721BatchTransfer(nftsToTransfer, accounts[2].address)
    ).to.be.revertedWith("ERC721: transfer of token that is not own");
  });
});
