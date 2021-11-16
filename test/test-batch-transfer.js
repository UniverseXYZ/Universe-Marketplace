const { expect } = require("chai");

const { waffle, ethers, upgrades } = require("hardhat");
const { loadFixture } = waffle;

describe("ERC721 Batch Transfer Tests", () => {
  const deployedContracts = async () => {
    const TransferProxy = await ethers.getContractFactory("TransferProxy");
    const transferProxy = await upgrades.deployProxy(TransferProxy, [], {
      initializer: "__TransferProxy_init",
    });

    const MockNFT = await ethers.getContractFactory("MockNFT");
    const MockNFT2 = await ethers.getContractFactory("MockNFT");
    const MockToken = await ethers.getContractFactory("MockToken");

    const mockNFT = await MockNFT.deploy();
    const mockNFT2 = await MockNFT2.deploy();
    const mockToken = await MockToken.deploy(1000);

    return { transferProxy, mockNFT, mockNFT2, mockToken };
  };

  it("should successfully transfer multiple NFTs, from different collections", async () => {
    const { transferProxy, mockNFT, mockNFT2 } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();

    const nftsToTransfer = [];

    for (let i = 0; i < 25; i++) {
      await mockNFT.connect(accounts[0]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[0]).approve(transferProxy.address, i + 1);
      nftsToTransfer.push([mockNFT.address, i + 1]);
    }

    for (let i = 0; i < 25; i++) {
      await mockNFT2.connect(accounts[0]).mint("https://universe.xyz");
      await mockNFT2.connect(accounts[0]).approve(transferProxy.address, i + 1);
      nftsToTransfer.push([mockNFT2.address, i + 1]);
    }

    await transferProxy.erc721BatchTransfer(
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
    const { transferProxy, mockNFT, mockNFT2 } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();

    const nftsToTransfer = [];

    for (let i = 0; i < 25; i++) {
      await mockNFT.connect(accounts[0]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[0]).approve(transferProxy.address, i + 1);
      nftsToTransfer.push([mockNFT.address, i + 1]);
    }

    for (let i = 0; i < 30; i++) {
      await mockNFT2.connect(accounts[0]).mint("https://universe.xyz");
      await mockNFT2.connect(accounts[0]).approve(transferProxy.address, i + 1);
      nftsToTransfer.push([mockNFT2.address, i + 1]);
    }

    await expect(
      transferProxy.erc721BatchTransfer(nftsToTransfer, accounts[1].address)
    ).to.be.revertedWith("Cannot transfer more than 50");
  });

  it("should not transfer NFTs is caller is not owner", async () => {
    const { transferProxy, mockNFT, mockNFT2 } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();

    const nftsToTransfer = [];

    for (let i = 0; i < 5; i++) {
      await mockNFT.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT.connect(accounts[1]).approve(transferProxy.address, i + 1);
      nftsToTransfer.push([mockNFT.address, i + 1]);
    }

    for (let i = 0; i < 5; i++) {
      await mockNFT2.connect(accounts[1]).mint("https://universe.xyz");
      await mockNFT2.connect(accounts[1]).approve(transferProxy.address, i + 1);
      nftsToTransfer.push([mockNFT2.address, i + 1]);
    }

    await expect(
      transferProxy.erc721BatchTransfer(nftsToTransfer, accounts[2].address)
    ).to.be.revertedWith("Not owner");
  });
});
