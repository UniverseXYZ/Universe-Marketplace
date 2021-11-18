# Universe Marketplace

## Overview

The Universe Marketplace is an NFT marketplace that is completely decentralized and rigged with multiple open-source tools and features. Universe's Marketplace contracts are a fork of Rarible's contracts (using off-chain order book), with extended features added on top - support for ERC721 bundles, floor price bids, reward splits, batch transfers, and support for the latest Royalties standard - EIP2981. The xyzDAO will take a 2% fee on every resale on the Universe platform to support continued innovation.

## Royalties and Fees

There are several levels of fees/royalties collected when two orders are matched:
 - Protocol/DAO fee, sent to the xyzDAO
 - Revenue splits - The order creator can choose multiple addresses which will collect % of the ERC20/ETH revenue from the sale of the ERC721/ERC721 bundle
 - Royalty fees for creators - These fees are obtained from the RoyaltiesRegistry contract and are paid to the original creators of the sold NFTs

## ERC721 Floor Bids

The ERC721 Floor Bid matching is one of the flagship functionalities of the Universe Marketplace. This feature provides the possibility for anyone who wants to buy any ERC721 from a specific collection, to submit an order for up to 20 NFTs by depositing the amount he/she is willing to pay (ERC20). Anybody, who owns an NFT from a submitted collection, can choose to partially/fully match the respective order. The difference with the core marketplace contracts is that the floor bid matching requires the buy order submitter to lock his funds into the contract.

## EIP-2981 Royalties standard support

The Universe Marketplace honors the newly introduced royalties standard, meaning that the owner of any NFT resold on our platform which supports EIP-2981, will receive a royalty payment.

## Upgradeability

All of the Universe Marketplace contracts are using the OpenZeppelinTransparentProxy pattern, meaning that in the future there is a possibility for constant addition of new features and upgrades.

# Contracts

## TransferProxy

Responsible for executing all asset transfers - Supports ERC721, ERC1155, ERC721 Bundles. It is also used for batch transfers of multiple ERC721 NFTs from different collections. The TransferProxy contract can be called externally from the main marketplace contract, which should be added as an Operator.

## ERC20TransferProxy

Responsible for executing all ERC20 transfers. The ERC20TransferProxy contract can be called externally from the main marketplace contract, which should be added as an Operator.

## TransferManager

The TransferManager contract is responsible for managing the distribution of all assets, royalty fees, rewards splits, protocol fees. It is extended by the UniverseMarketplace contract.

## TransferExecutor

The TransferExecutor contract is responsible for the execution of all asset transfers, calling the TransferProxy/ERC20TransferProxy contracts.

## RoyaltiesRegistry

The RoyaltiesRegistry contract is responsible for preserving information regarding royalties on tokenId level and collection-wide level. It also supports reading royalties information from collections that support the SecondarySaleFees standard (From Rarible) and the EIP2981 Official Royalties standard.

## AssetMatcher

The contract is responsible for the matching of assets and calculates if asset types match with each other.

## OrderValidator

The OrderValidator contract is responsible for the signature validation of the submitted order to the UniverseMarketplace contract. If the one who sends the transaction (msg.sender) is the order maker, validation is not needed. Otherwise, EIP-1271 signature validation is used.

## UniverMaretplaceCore

The UniverseMarketplaceCore is the contract that extends the AssetMatcher, TransferExecutor, OrderValidator, and ITransferManager contracts. It also exposes the main function for matching orders, called by the involved parties.

## UniverseMarketplace

The UniverMarketplace is the main contract used for interaction and initialization, extending UniverseMarketplace and UniverseTransferManager contracts.

## ERC721FloorBidMatcher

The ERC721FloorBidMatcher is a separate escrow contract, which purpose is to collect floor bids for ERC721 collections. Anyone, who owns an NFT from a listed collection, can partially/fully match the order and sell his NFTs from this collection. The ERC721FloorBidMatcher uses the TransferProxy and ERC20TransferProxy contracts, for the transfer of assets.

# Build the project

```
$ yarn
$ yarn compile
```

# Run tests

```
$ yarn test
```

# Deploy to live network

```
$ yarn deploy rinkeby
```

# Etherscan verification

```
$ yarn etherscan-verify rinkeby --address
```

# Ropsten deployments

- **ERC20 Transfer Proxy** - https://ropsten.etherscan.io/address/0xfD5f9263bCAf0d3AF20f2Cb08e76d7D7c0533FDa
- **NFT Transfer Proxy** - https://ropsten.etherscan.io/address/0x8fBF9Aa748f2091CFcAcd894ddA22f2673321a37
- **ERC721 Floor Bid Matcher** - https://ropsten.etherscan.io/address/0xC849826BAF2247B4d12a1dE21a12d2325EF010B0
- **Royalties Registry** - https://ropsten.etherscan.io/address/0x74FB2eDC713145830057f4c6fC4eaB0024bC9c33
- **Universe Marketplace** - https://ropsten.etherscan.io/address/0xCB11366370C68cb1795B94fF8588Ad6Db590e15E
