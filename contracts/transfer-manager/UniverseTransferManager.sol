// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "../lib/LibAsset.sol";
import "../interfaces/IRoyaltiesProvider.sol";
import "../lib/LibFill.sol";
import "../lib/LibFeeSide.sol";
import "../interfaces/ITransferManager.sol";
import "../transfer-executor/TransferExecutor.sol";
import "../lib/LibOrderData.sol";
import "../lib/BpLibrary.sol";

abstract contract UniverseTransferManager is OwnableUpgradeable, ITransferManager {
    using BpLibrary for uint;
    using SafeMathUpgradeable for uint;

    uint public daoFee;
    IRoyaltiesProvider public royaltiesRegistry;

    address public defaultFeeReceiver;
    mapping(address => address) public feeReceivers;

    struct FeeCalculateInfo {
        LibAsset.AssetType matchCalculate;
        uint amount;
        address from;
        bytes4 transferDirection;
        LibPart.Part[] revenueSplits;
        LibAsset.AssetType matchNft;
    }

    function __UniverseTransferManager_init_unchained(
        uint _daoFee,
        address _defaultFeeReceiver,
        IRoyaltiesProvider _royaltiesRegistry
    ) internal initializer {
        daoFee = _daoFee;
        defaultFeeReceiver = _defaultFeeReceiver;
        royaltiesRegistry = _royaltiesRegistry;
    }

    function setRoyaltiesRegistry(IRoyaltiesProvider _royaltiesRegistry) external onlyOwner {
        royaltiesRegistry = _royaltiesRegistry;
    }

    function setDaoFee(uint daoFee) external onlyOwner {
        daoFee = daoFee;
    }

    function setDefaultFeeReceiver(address payable newDefaultFeeReceiver) external onlyOwner {
        defaultFeeReceiver = newDefaultFeeReceiver;
    }

    function setFeeReceiver(address token, address wallet) external onlyOwner {
        feeReceivers[token] = wallet;
    }

    function getFeeReceiver(address token) internal view returns (address) {
        address wallet = feeReceivers[token];
        if (wallet != address(0)) {
            return wallet;
        }
        return defaultFeeReceiver;
    }

    function doTransfers(
        LibAsset.AssetType memory makeMatch,
        LibAsset.AssetType memory takeMatch,
        LibFill.FillResult memory fill,
        LibOrder.Order memory leftOrder,
        LibOrder.Order memory rightOrder
    ) override internal returns (uint totalMakeValue, uint totalTakeValue) {
        LibFeeSide.FeeSide feeSide = LibFeeSide.getFeeSide(makeMatch.assetClass, takeMatch.assetClass);

        totalMakeValue = fill.makeValue;
        totalTakeValue = fill.takeValue;

        LibOrderData.Data memory leftOrderData = LibOrderData.parse(leftOrder);
        LibOrderData.Data memory rightOrderData = LibOrderData.parse(rightOrder);

        if (feeSide == LibFeeSide.FeeSide.MAKE) {
            FeeCalculateInfo memory feeCalculateInfo = FeeCalculateInfo(makeMatch, totalMakeValue, leftOrder.maker, TO_TAKER, rightOrderData.revenueSplits, takeMatch);
            uint totalFees = transferAllFees(feeCalculateInfo);

            transfer(LibAsset.Asset(makeMatch, totalMakeValue.sub(totalFees)), leftOrder.maker, rightOrder.maker, PAYOUT, TO_TAKER);
            transfer(LibAsset.Asset(takeMatch, totalTakeValue), rightOrder.maker, leftOrder.maker, PAYOUT, TO_MAKER);

        } else if (feeSide == LibFeeSide.FeeSide.TAKE) {
            FeeCalculateInfo memory feeCalculateInfo = FeeCalculateInfo(takeMatch, totalTakeValue, rightOrder.maker, TO_MAKER, leftOrderData.revenueSplits, makeMatch);
            uint totalFees = transferAllFees(feeCalculateInfo);

            transfer(LibAsset.Asset(takeMatch, totalTakeValue.sub(totalFees)), rightOrder.maker, leftOrder.maker, PAYOUT, TO_MAKER);
            transfer(LibAsset.Asset(makeMatch, totalMakeValue), leftOrder.maker, rightOrder.maker, PAYOUT, TO_TAKER);

        } else {
            transfer(LibAsset.Asset(takeMatch, fill.takeValue), rightOrder.maker, leftOrder.maker, PAYOUT, TO_MAKER);
            transfer(LibAsset.Asset(makeMatch, fill.makeValue), leftOrder.maker, rightOrder.maker, PAYOUT, TO_TAKER);
        }
    }

    function transferAllFees(FeeCalculateInfo memory feeCalculateInfo) internal returns (uint allFeesValue) {
        uint daoFeeValue = transferDaoFee(feeCalculateInfo.matchCalculate, feeCalculateInfo.amount, feeCalculateInfo.from, feeCalculateInfo.transferDirection);
        uint revenueSplitsValue = transferRevenueSplits(feeCalculateInfo.matchCalculate, feeCalculateInfo.amount, feeCalculateInfo.from, feeCalculateInfo.revenueSplits, feeCalculateInfo.transferDirection);
        uint royaltiesValue = transferRoyalties(feeCalculateInfo.matchCalculate, feeCalculateInfo.matchNft, feeCalculateInfo.amount, feeCalculateInfo.from, feeCalculateInfo.transferDirection);
    
        return daoFeeValue.add(revenueSplitsValue).add(royaltiesValue);
    }

    function transferDaoFee(
        LibAsset.AssetType memory matchCalculate,
        uint amount,
        address from,
        bytes4 transferDirection
    ) internal returns (uint) {
        uint daoFeeValue = amount.bp(daoFee);
        transfer(LibAsset.Asset(matchCalculate, daoFeeValue), from, defaultFeeReceiver, transferDirection, DAO);
        return daoFeeValue;
    }

    function transferRevenueSplits(
        LibAsset.AssetType memory matchCalculate,
        uint amount,
        address from,
        LibPart.Part[] memory revenueSplits,
        bytes4 transferDirection
    ) internal returns (uint) {
        uint sumBps = 0;
        uint restValue = amount;
        for (uint256 i = 0; i < revenueSplits.length; i++) {
            uint currentAmount = amount.bp(revenueSplits[i].value);
            sumBps = sumBps.add(revenueSplits[i].value);
            if (currentAmount > 0) {
                restValue = restValue.sub(currentAmount);
                transfer(LibAsset.Asset(matchCalculate, currentAmount), from, revenueSplits[i].account, transferDirection, REVENUE_SPLIT);
            }
        }

        return amount.sub(restValue);
    }

    function getRoyaltiesByAssetType(LibAsset.AssetType memory matchNft) internal returns (LibPart.Part[] memory) {
        if (matchNft.assetClass == LibAsset.ERC1155_ASSET_CLASS || matchNft.assetClass == LibAsset.ERC721_ASSET_CLASS) {
            (address token, uint tokenId) = abi.decode(matchNft.data, (address, uint));
            return royaltiesRegistry.getRoyalties(token, tokenId);
        } else if (matchNft.assetClass == LibAsset.ERC721_BUNDLE_ASSET_CLASS) {
            
        }
        LibPart.Part[] memory empty;
        return empty;
    }

    function transferRoyalties(
        LibAsset.AssetType memory matchCalculate,
        LibAsset.AssetType memory matchNft,
        uint amount,
        address from,
        bytes4 transferDirection
    ) internal returns (uint) {
        LibPart.Part[] memory fees = getRoyaltiesByAssetType(matchNft);
        uint totalFees = 0;
        uint restValue = amount;
        for (uint256 i = 0; i < fees.length; i++) {
            totalFees = totalFees.add(fees[i].value);
            (uint newRestValue, uint feeValue) = subFeeInBp(restValue, amount,  fees[i].value);
            restValue = newRestValue;
            if (feeValue > 0) {
                transfer(LibAsset.Asset(matchCalculate, feeValue), from,  fees[i].account, transferDirection, ROYALTY);
            }
        }
        require(totalFees <= 5000, "Royalties are too high (>50%)");
        return amount.sub(restValue);
    }

    function encodeOrderData(LibOrderData.Data memory data) external pure returns (bytes memory encodedOrderData) {
        encodedOrderData = abi.encode(data);
    }

    function subFeeInBp(uint value, uint total, uint feeInBp) internal pure returns (uint newValue, uint realFee) {
        return subFee(value, total.bp(feeInBp));
    }

    function subFee(uint value, uint fee) internal pure returns (uint newValue, uint realFee) {
        if (value > fee) {
            newValue = value.sub(fee);
            realFee = fee;
        } else {
            newValue = 0;
            realFee = value;
        }
    }

    uint256[50] private __gap;
}
