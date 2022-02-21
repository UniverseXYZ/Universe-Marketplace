// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "../interfaces/ERC1271.sol";
import "../lib/LibOrder.sol";
import "../lib/LibSignature.sol";
import "../cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

abstract contract OrderValidator is Initializable, ContextUpgradeable, EIP712 {
    using LibSignature for bytes32;
    using AddressUpgradeable for address;
    
    bytes4 constant internal MAGICVALUE = 0x1626ba7e;

    function __OrderValidator_init_unchained() internal initializer {}

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
                if (_hashTypedDataV4(hash).recover(signature) != order.maker) {
                    if (order.maker.isContract()) {
                        require(
                            ERC1271(order.maker).isValidSignature(_hashTypedDataV4(hash), signature) == MAGICVALUE,
                            "contract order signature verification error"
                        );
                    } else {
                        revert("order signature verification error");
                    }
                }
            }
        }
    }

}
