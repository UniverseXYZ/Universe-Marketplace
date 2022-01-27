// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./UniverseMarketplaceCore.sol";
import "./transfer-manager/UniverseTransferManager.sol";
import "./interfaces/IRoyaltiesProvider.sol";

contract UniverseMarketplace is UniverseMarketplaceCore, UniverseTransferManager {
    function __UniverseMarketplace_init(
        INftTransferProxy _transferProxy,
        IERC20TransferProxy _erc20TransferProxy,
        uint newProtocolFee,
        address newDefaultFeeReceiver,
        IRoyaltiesProvider newRoyaltiesProvider,
        uint256 maxBundleSize
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __TransferExecutor_init_unchained(_transferProxy, _erc20TransferProxy, maxBundleSize);
        __UniverseTransferManager_init_unchained(newProtocolFee, newDefaultFeeReceiver, newRoyaltiesProvider);
        __OrderValidator_init_unchained();
    }
}
