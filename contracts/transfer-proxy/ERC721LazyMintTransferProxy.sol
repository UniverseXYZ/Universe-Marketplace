// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "../interfaces/ITransferProxy.sol";
import "../interfaces/IERC721LazyMint.sol";
import "../lib/LibERC721LazyMint.sol";
import "../operator/OperatorRole.sol";

contract ERC721LazyMintTransferProxy is ITransferProxy, Initializable, OperatorRole {

    function __ERC721LazyMintTransferProxy_init() external initializer {
        __Ownable_init();
    }

    function transfer(LibAsset.Asset memory asset, address from, address to) external override onlyOperator {
        require(asset.value == 1, "erc721 value error");
        (address token, LibERC721LazyMint.Mint721Data memory data) = abi.decode(asset.assetType.data, (address, LibERC721LazyMint.Mint721Data));
        IERC721LazyMint(token).transferFromOrMint(data, from, to);
    }
}
