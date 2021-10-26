# **Universe Marketplace contracts:**

- **TransferManager** - Responsible for transferring all assets. The manager supports different types of fees, also it supports different beneficiaries.
- **TransferExecutor** - Responsible for executing the transfers from one side of the order to the other side of the order. The transfer executor calls the respective TransferProxy, depending on the asset type - ERC721, ERC721_BUNDLE, ERC20, ERC1155.
- **TransferProxies** - The actual contracts which are approved by the users to transfer their assets - currently there is ERC20TransferProxy and NFTTransferProxy
- **MarketplaceCore** - Responsible for matching orders through the matchOrders function. Extends TransferManager and TransferExecutor
- **ERC721FloorBidMatcher** - This contract uses the same transfer proxies, but works with onchain transactions and escrow of the user’s funds, which are placed with a buy order.

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
