# **The Universe Marketplace contracts consist of several building blocks:**

- **TransferManager** - Responsible for transferring all assets. The manager supports different types of fees, also it supports different beneficiaries.
- **TransferExecutor** - Responsible for executing the transfers from one side of the order to the other side of the order. The transfer executor calls the respective TransferProxy, depending on the asset type - ERC721, ERC721_BUNDLE, ERC20, ERC1155.
- **TransferProxies** - Rhe actual contracts which are approved by the users to transfer their assets - currently there is ERC20TransferProxy and NFTTransferProxy
- **MarketplaceCore** - Responsible for matching orders through the matchOrders function. Extends TransferManager and TransferExecutor
- **ERC721FloorBidMatcher** - This contract uses the same transfer proxies, but works with onchain transactions and escrow of the user’s funds, which are placed with a buy order.

# Build the project

```shell
yarn
yarn compile
```

# Run tests

```shell
yarn test
```

# Deploy to live network

```shell
yarn deploy rinkeby
```

# Etherscan verification

```shell
yarn etherscan-verify rinkeby --address
```
