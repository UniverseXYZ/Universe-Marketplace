// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "../interfaces/ITransferProxy.sol";
import "../interfaces/IUniverseERC721.sol";
import "../operator/OperatorRole.sol";
import "../lib/LibERC721LazyMint.sol";

contract ERC721LazyMintTransferProxy is
    ITransferProxy,
    Initializable,
    OperatorRole
{
    function __ERC721LazyMintTransferProxy_init() external initializer {
        __Ownable_init();
    }

    function convertToFeeStruct(LibPart.Part[] memory parts)
        internal
        pure
        returns (IUniverseERC721.Fee[] memory)
    {
        IUniverseERC721.Fee[] memory fees = new IUniverseERC721.Fee[](
            parts.length
        );

        for (uint256 i = 0; i < parts.length; i++) {
            IUniverseERC721.Fee memory fee = IUniverseERC721.Fee({
                recipient: parts[i].account,
                value: parts[i].value
            });
            fees[i] = fee;
        }
        return fees;
    }

    function transfer(
        LibAsset.Asset memory asset,
        address from,
        address to
    ) external override onlyOperator {
        require(asset.value == 1, "erc721 value error");
        (address token, LibERC721LazyMint.Mint721Data memory data) = abi.decode(
            asset.assetType.data,
            (address, LibERC721LazyMint.Mint721Data)
        );
        IUniverseERC721(token).mint(
            to,
            data.tokenURI,
            convertToFeeStruct(data.royalties)
        );
    }
}
