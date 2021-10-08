// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./royalties/HasSecondarySaleFees.sol";
import "./interfaces/INftTransferProxy.sol";
import "./interfaces/IERC20TransferProxy.sol";

contract ERC721FloorBidMatcher is ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint256;

    uint256 public ordersCount;
    uint256 public daoFeeBps;
    address public daoAddress;

    address public erc20TransferProxy;
    address public nftTransferProxy;

    mapping(uint256 => ERC721FloorBidOrder) public orders;

    bytes4 private constant _INTERFACE_ID_FEES = 0xb7799584;

    enum OrderStatus {
        OPENED,
        PARTIALLY_EXECUTED,
        EXECUTED,
        CANCELLED,
        EXPIRED
    }

    struct ERC721FloorBidOrder {
        address erc721TokenAddress;
        uint256 numberOfTokens;
        uint256[] erc721TokenIdsSold;
        uint256 tokenPrice;
        address paymentTokenAddress;
        uint256 amount;
        uint256 endTime;
        address creator;
        ERC721FloorBidMatcher.OrderStatus orderStatus;
    }

    struct SecondaryFee {
        uint256 remainingValue;
        uint256 feeValue;
    }

    event LogCreateBuyOrder(
        address erc721TokenAddress,
        address paymentTokenAddress,
        uint256 amount,
        uint256 endTime,
        uint256 time,
        address creator
    );

    event LogMatchBuyOrder(
        address erc721TokenAddress,
        uint256 tokenId,
        address paymentTokenAddress,
        uint256 amount,
        uint256 time,
        address taker
    );

    event LogCancelOrder(
        address erc721TokenAddress,
        address paymentTokenAddress,
        uint256 amount,
        uint256 endTime,
        uint256 time,
        address creator
    );

    event LogTokenWithdrawal(
        address erc721TokenAddress,
        address paymentTokenAddress,
        uint256 amount,
        uint256 endTime,
        uint256 time,
        address creator
    );

    modifier onlyDAO() {
        require(msg.sender == daoAddress, "Not called from the dao");
        _;
    }

    function __ERC721FloorBidMatcher_init(
        address _daoAddress,
        uint256 _daoFeeBps,
        address _erc20TransferProxy,
        address _nftTransferProxy
    ) external initializer {
        daoAddress = _daoAddress;
        daoFeeBps = _daoFeeBps;
        erc20TransferProxy = _erc20TransferProxy;
        nftTransferProxy = _nftTransferProxy;
    }

    function createBuyOrder(
        address erc721TokenAddress,
        address paymentTokenAddress,
        uint256 numberOfTokens,
        uint256 amount,
        uint256 endTime
    ) external nonReentrant {
        require(block.timestamp < endTime, "End time should be in the future");
        require(
            numberOfTokens > 0 && numberOfTokens <= 20,
            "Wrong number of tokens"
        );
        require(amount > 0, "Wrong amount");

        IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
            IERC20Upgradeable(paymentTokenAddress),
            msg.sender,
            address(this),
            amount
        );

        ordersCount = ordersCount.add(1);
        uint256 orderId = ordersCount;

        orders[orderId].erc721TokenAddress = erc721TokenAddress;
        orders[orderId].paymentTokenAddress = paymentTokenAddress;
        orders[orderId].amount = amount;
        orders[orderId].numberOfTokens = numberOfTokens;
        orders[orderId].tokenPrice = amount.div(numberOfTokens);
        orders[orderId].endTime = endTime;
        orders[orderId].creator = msg.sender;
        orders[orderId].orderStatus = OrderStatus.OPENED;

        emit LogCreateBuyOrder(
            erc721TokenAddress,
            paymentTokenAddress,
            amount,
            endTime,
            block.timestamp,
            msg.sender
        );
    }

    function matchBuyOrder(uint256 orderId, uint256[] calldata tokenIds)
        external
        nonReentrant
    {
        ERC721FloorBidOrder storage order = orders[orderId];

        require(order.endTime > block.timestamp, "Order expired");

        uint256 amountToPay = tokenIds.length.mul(order.tokenPrice);
        uint256 daoFee = daoFeeBps.mul(amountToPay).div(10000);
        uint256 totalSecondaryFees;

        for (uint256 i = 0; i < tokenIds.length; i += 1) {
            uint256 secondarySaleFees = distributeSecondarySaleFees(
                order.erc721TokenAddress,
                order.paymentTokenAddress,
                tokenIds[i],
                order.tokenPrice
            );

            INftTransferProxy(nftTransferProxy).erc721safeTransferFrom(
                IERC721Upgradeable(order.erc721TokenAddress),
                msg.sender,
                order.creator,
                tokenIds[i]
            );

            order.erc721TokenIdsSold.push(tokenIds[i]);
            totalSecondaryFees = totalSecondaryFees.add(secondarySaleFees);

            emit LogMatchBuyOrder(
                order.erc721TokenAddress,
                tokenIds[i],
                order.paymentTokenAddress,
                order.tokenPrice,
                block.timestamp,
                msg.sender
            );
        }

        IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
            IERC20Upgradeable(order.paymentTokenAddress),
            address(this),
            daoAddress,
            daoFee
        );

        IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
            IERC20Upgradeable(order.paymentTokenAddress),
            address(this),
            msg.sender,
            amountToPay.sub(daoFee).sub(totalSecondaryFees)
        );

        order.numberOfTokens = order.numberOfTokens.sub(tokenIds.length);
        order.amount = order.amount.sub(amountToPay);
        order.orderStatus = OrderStatus.EXECUTED;
        (order.numberOfTokens == 0)
            ? order.orderStatus = OrderStatus.EXECUTED
            : order.orderStatus = OrderStatus.PARTIALLY_EXECUTED;
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        ERC721FloorBidOrder storage order = orders[orderId];

        require(order.endTime > block.timestamp, "Order expired");
        require(order.creator == msg.sender, "Only creator can cancel");

        IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
            IERC20Upgradeable(order.paymentTokenAddress),
            address(this),
            msg.sender,
            order.amount
        );

        order.orderStatus = OrderStatus.CANCELLED;

        emit LogCancelOrder(
            order.erc721TokenAddress,
            order.paymentTokenAddress,
            order.amount,
            order.endTime,
            block.timestamp,
            msg.sender
        );
    }

    function withdrawFundsFromExpiredOrder(uint256 orderId)
        external
        nonReentrant
    {
        ERC721FloorBidOrder storage order = orders[orderId];

        require(order.endTime < block.timestamp, "Order not expired");
        require(order.creator == msg.sender, "Only creator can cancel");

        IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
            IERC20Upgradeable(order.paymentTokenAddress),
            address(this),
            msg.sender,
            order.amount
        );

        order.orderStatus = OrderStatus.EXPIRED;

        emit LogTokenWithdrawal(
            order.erc721TokenAddress,
            order.paymentTokenAddress,
            order.amount,
            order.endTime,
            block.timestamp,
            msg.sender
        );
    }

    function setDaoFeeBps(uint256 _daoFeeBps) external onlyDAO {
        daoFeeBps = _daoFeeBps;
    }

    function getSoldTokensFromOrder(uint256 orderId)
        public
        view
        returns (uint256[] memory)
    {
        ERC721FloorBidOrder memory order = orders[orderId];
        return order.erc721TokenIdsSold;
    }

    function distributeSecondarySaleFees(
        address erc721TokenAddress,
        address paymentTokenAddress,
        uint256 tokenId,
        uint256 amount
    ) internal returns (uint256) {
        bool hasFees = IERC721Upgradeable(erc721TokenAddress).supportsInterface(
            _INTERFACE_ID_FEES
        );
        uint256 totalFees = 0;
        if (hasFees) {
            HasSecondarySaleFees withFees = HasSecondarySaleFees(
                erc721TokenAddress
            );
            address payable[] memory recipients = withFees.getFeeRecipients(
                tokenId
            );
            uint256[] memory fees = withFees.getFeeBps(tokenId);
            require(fees.length == recipients.length, "Splits should be equal");
            uint256 value = amount;

            for (uint256 i = 0; i < fees.length && i < 5; i += 1) {
                SecondaryFee memory interimFee = subFee(
                    value,
                    amount.mul(fees[i]).div(10000)
                );
                value = interimFee.remainingValue;

                if (interimFee.feeValue > 0) {
                    IERC20TransferProxy(erc20TransferProxy)
                        .erc20safeTransferFrom(
                            IERC20Upgradeable(paymentTokenAddress),
                            address(this),
                            address(recipients[i]),
                            interimFee.feeValue
                        );
                    totalFees = totalFees.add(interimFee.feeValue);
                }
            }
        }
        return totalFees;
    }

    function subFee(uint256 value, uint256 fee)
        internal
        pure
        returns (SecondaryFee memory interimFee)
    {
        if (value > fee) {
            interimFee.remainingValue = value - fee;
            interimFee.feeValue = fee;
        } else {
            interimFee.remainingValue = 0;
            interimFee.feeValue = value;
        }
    }
}
