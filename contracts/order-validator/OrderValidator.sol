// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "../interfaces/ERC1271.sol";
import "../lib/LibOrder.sol";
import "../cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/SignatureCheckerUpgradeable.sol";

abstract contract OrderValidator is Initializable, ContextUpgradeable, EIP712 {
    using AddressUpgradeable for address;
    function validate(LibOrder.Order memory order, bytes memory signature) internal view {
        if (order.salt == 0) {
            if (order.maker != address(0)) {
                require(_msgSender() == order.maker, "maker is not tx sender");
            } else {
                order.maker = _msgSender();
            }
        } else {
            if (_msgSender() != order.maker) {
                bytes32 hash = LibOrder.hash(order);
                require(SignatureCheckerUpgradeable.isValidSignatureNow(order.maker, _hashTypedDataV4(hash), signature), "order signature verification error");
            }
        }
    }

}
