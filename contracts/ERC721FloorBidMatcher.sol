// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "./interfaces/INftTransferProxy.sol";
import "./interfaces/IERC20TransferProxy.sol";
import "./interfaces/IRoyaltiesProvider.sol";
import "./lib/LibPart.sol";

contract ERC721FloorBidMatcher is
    ReentrancyGuardUpgradeable,
    ContextUpgradeable
{
    using SafeMathUpgradeable for uint256;

    uint256 public ordersCount;
    uint256 public daoFeeBps;
    uint256 public maxTokensInOrder;
    address public daoAddress;

    address public erc20TransferProxy;
    address public nftTransferProxy;
    address public royaltiesRegistry;

    mapping(uint256 => ERC721FloorBidOrder) public orders;
    mapping(address => bool) public supportedERC20Tokens;

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
        address creator,
        uint256 orderId
    );

    event LogMatchBuyOrder(
        address erc721TokenAddress,
        uint256[] tokenIds,
        address paymentTokenAddress,
        uint256 amount,
        address taker,
        uint256 orderId
    );

    event LogCancelOrder(
        address erc721TokenAddress,
        address paymentTokenAddress,
        uint256 amount,
        uint256 endTime,
        address creator,
        uint256 orderId
    );

    event LogTokenWithdrawal(
        address erc721TokenAddress,
        address paymentTokenAddress,
        uint256 amount,
        uint256 endTime,
        address creator,
        uint256 orderId
    );

    modifier onlyDAO() {
        require(_msgSender() == daoAddress, "Not called from the dao");
        _;
    }

    function __ERC721FloorBidMatcher_init(
        address _daoAddress,
        uint256 _daoFeeBps,
        address _erc20TransferProxy,
        address _nftTransferProxy,
        address _royaltiesRegistry,
        uint256 _maxTokensInOrder,
        address[] memory _supportedERC20Tokens
    ) external initializer {
        daoAddress = _daoAddress;
        daoFeeBps = _daoFeeBps;
        erc20TransferProxy = _erc20TransferProxy;
        nftTransferProxy = _nftTransferProxy;
        royaltiesRegistry = _royaltiesRegistry;
        maxTokensInOrder = _maxTokensInOrder;
        _initSupportedERC20Tokens(_supportedERC20Tokens);
    }

    function _initSupportedERC20Tokens(address[] memory _supportedERC20Tokens)
        internal
    {
        for (uint256 i = 0; i < _supportedERC20Tokens.length; i += 1) {
            supportedERC20Tokens[_supportedERC20Tokens[i]] = true;
        }
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
            numberOfTokens > 0 && numberOfTokens <= maxTokensInOrder,
            "Wrong number of tokens"
        );
        require(amount > 0, "Wrong amount");
        require(supportedERC20Tokens[paymentTokenAddress], "ERC20 token not supported");

        IERC20Upgradeable(paymentTokenAddress).approve(
            erc20TransferProxy,
            amount
        );

        IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
            IERC20Upgradeable(paymentTokenAddress),
            _msgSender(),
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
        orders[orderId].creator = _msgSender();
        orders[orderId].orderStatus = OrderStatus.OPENED;

        emit LogCreateBuyOrder(
            erc721TokenAddress,
            paymentTokenAddress,
            amount,
            endTime,
            _msgSender(),
            orderId
        );
    }

    function createBuyOrderETH(
        address erc721TokenAddress,
        uint256 numberOfTokens,
        uint256 endTime
    ) external payable nonReentrant {
        uint256 amount = msg.value;
        address paymentTokenAddress = address(0);

        require(block.timestamp < endTime, "End time should be in the future");
        require(
            numberOfTokens > 0 && numberOfTokens <= maxTokensInOrder,
            "Wrong number of tokens"
        );
        require(amount > 0, "Wrong amount");

        ordersCount = ordersCount.add(1);
        uint256 orderId = ordersCount;

        orders[orderId].erc721TokenAddress = erc721TokenAddress;
        orders[orderId].paymentTokenAddress = paymentTokenAddress;
        orders[orderId].amount = amount;
        orders[orderId].numberOfTokens = numberOfTokens;
        orders[orderId].tokenPrice = amount.div(numberOfTokens);
        orders[orderId].endTime = endTime;
        orders[orderId].creator = _msgSender();
        orders[orderId].orderStatus = OrderStatus.OPENED;

        emit LogCreateBuyOrder(
            erc721TokenAddress,
            paymentTokenAddress,
            amount,
            endTime,
            _msgSender(),
            orderId
        );
    }

    function matchBuyOrder(uint256 orderId, uint256[] calldata tokenIds)
        external
        nonReentrant
    {
        ERC721FloorBidOrder storage order = orders[orderId];

        require(order.endTime > block.timestamp, "Order expired");
        require(order.numberOfTokens > 0, "No tokens remaining to buy");
        require(
            order.orderStatus == OrderStatus.OPENED ||
                order.orderStatus == OrderStatus.PARTIALLY_EXECUTED,
            "Order expired"
        );

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
                _msgSender(),
                order.creator,
                tokenIds[i]
            );

            order.erc721TokenIdsSold.push(tokenIds[i]);
            totalSecondaryFees = totalSecondaryFees.add(secondarySaleFees);
        }

        if (order.paymentTokenAddress == address(0)) {
            (bool daoTransferSuccess, ) = payable(daoAddress).call{
                value: daoFee
            }("");
            require(daoTransferSuccess, "Failed");

            (bool buyerTransferSuccess, ) = payable(_msgSender()).call{
                value: amountToPay.sub(daoFee).sub(totalSecondaryFees)
            }("");
            require(buyerTransferSuccess, "Failed");
        } else {
            IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
                IERC20Upgradeable(order.paymentTokenAddress),
                address(this),
                daoAddress,
                daoFee
            );
            IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
                IERC20Upgradeable(order.paymentTokenAddress),
                address(this),
                _msgSender(),
                amountToPay.sub(daoFee).sub(totalSecondaryFees)
            );
        }

        order.numberOfTokens = order.numberOfTokens.sub(tokenIds.length);
        order.amount = order.amount.sub(amountToPay);
        (order.numberOfTokens == 0)
            ? order.orderStatus = OrderStatus.EXECUTED
            : order.orderStatus = OrderStatus.PARTIALLY_EXECUTED;

        emit LogMatchBuyOrder(
            order.erc721TokenAddress,
            tokenIds,
            order.paymentTokenAddress,
            amountToPay,
            _msgSender(),
            orderId
        );
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        ERC721FloorBidOrder storage order = orders[orderId];

        require(order.endTime > block.timestamp, "Order expired");
        require(order.creator == _msgSender(), "Only creator can cancel");
        require(order.numberOfTokens > 0, "No tokens remaining to buy");
        require(
            order.orderStatus == OrderStatus.OPENED ||
                order.orderStatus == OrderStatus.PARTIALLY_EXECUTED,
            "Order expired"
        );

        if (order.paymentTokenAddress == address(0)) {
            (bool success, ) = payable(_msgSender()).call{value: order.amount}(
                ""
            );
            require(success, "Failed");
        } else {
            IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
                IERC20Upgradeable(order.paymentTokenAddress),
                address(this),
                _msgSender(),
                order.amount
            );
        }

        order.orderStatus = OrderStatus.CANCELLED;

        emit LogCancelOrder(
            order.erc721TokenAddress,
            order.paymentTokenAddress,
            order.amount,
            order.endTime,
            _msgSender(),
            orderId
        );
    }

    function withdrawFundsFromExpiredOrder(uint256 orderId)
        external
        nonReentrant
    {
        ERC721FloorBidOrder storage order = orders[orderId];

        require(order.endTime < block.timestamp, "Order not expired");
        require(order.creator == _msgSender(), "Only creator can cancel");
        require(order.numberOfTokens > 0, "No tokens remaining to buy");
        require(
            order.orderStatus == OrderStatus.OPENED ||
                order.orderStatus == OrderStatus.PARTIALLY_EXECUTED,
            "Order expired"
        );

        if (order.paymentTokenAddress == address(0)) {
            (bool success, ) = payable(_msgSender()).call{value: order.amount}(
                ""
            );
            require(success, "Failed");
        } else {
            IERC20TransferProxy(erc20TransferProxy).erc20safeTransferFrom(
                IERC20Upgradeable(order.paymentTokenAddress),
                address(this),
                _msgSender(),
                order.amount
            );
        }

        order.orderStatus = OrderStatus.EXPIRED;

        emit LogTokenWithdrawal(
            order.erc721TokenAddress,
            order.paymentTokenAddress,
            order.amount,
            order.endTime,
            _msgSender(),
            orderId
        );
    }

    function setDaoFeeBps(uint256 _daoFeeBps) external onlyDAO {
        daoFeeBps = _daoFeeBps;
    }

    function setMaxTokensInOrder(uint256 _maxTokensInOrder) external onlyDAO {
        maxTokensInOrder = _maxTokensInOrder;
    }

    function setERC20TransferProxy(address _erc20TransferProxy)
        external
        onlyDAO
    {
        erc20TransferProxy = _erc20TransferProxy;
    }

    function setNFTTransferProxy(address _nftTransferProxy) external onlyDAO {
        nftTransferProxy = _nftTransferProxy;
    }

    function setRoylatiesRegistry(address _royaltiesRegistry) external onlyDAO {
        royaltiesRegistry = _royaltiesRegistry;
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
        LibPart.Part[] memory fees = IRoyaltiesProvider(royaltiesRegistry)
            .getRoyalties(erc721TokenAddress, tokenId);

        uint256 totalFees = 0;
        if (fees.length > 0) {
            uint256 value = amount;

            for (uint256 i = 0; i < fees.length && i < 5; i += 1) {
                SecondaryFee memory interimFee = subFee(
                    value,
                    amount.mul(fees[i].value).div(10000)
                );
                value = interimFee.remainingValue;

                if (interimFee.feeValue > 0) {
                    if (paymentTokenAddress == address(0)) {
                        (bool success, ) = payable(fees[i].account).call{
                            value: interimFee.feeValue
                        }("");
                        require(success, "Failed");
                    } else {
                        IERC20TransferProxy(erc20TransferProxy)
                            .erc20safeTransferFrom(
                                IERC20Upgradeable(paymentTokenAddress),
                                address(this),
                                address(fees[i].account),
                                interimFee.feeValue
                            );
                    }
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
