
// SPDX-License-Identifier: MIT

pragma solidity >=0.6.9 <0.8.0;
pragma abicoder v2;

import "./OperatorRole.sol";
import "./interfaces/INftTransferProxy.sol";

contract TransferProxy is INftTransferProxy, Initializable, OperatorRole {

    function __TransferProxy_init() external initializer {
        __Ownable_init();
    }

    function erc721safeTransferFrom(IERC721Upgradeable token, address from, address to, uint256 tokenId) override external onlyOperator {
        token.safeTransferFrom(from, to, tokenId);
    }

    function erc1155safeTransferFrom(IERC1155Upgradeable token, address from, address to, uint256 id, uint256 value, bytes calldata data) override external onlyOperator {
        token.safeTransferFrom(from, to, id, value, data);
    }
    
    function erc721BundleSafeTransferFrom(ERC721BundleItem[] calldata erc721BundleItems, address from, address to) override external onlyOperator {
        for (uint256 i = 0; i < erc721BundleItems.length; i++) {
            for (uint256 j = 0; j < erc721BundleItems[i].tokenIds.length; j++){
                IERC721Upgradeable(erc721BundleItems[i].tokenAddress).safeTransferFrom(from, to, erc721BundleItems[i].tokenIds[j]);
            } 
        }
    }
}