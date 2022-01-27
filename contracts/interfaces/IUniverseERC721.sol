// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IUniverseERC721 is IERC721Upgradeable {
    struct Fee {
        address payable recipient;
        uint96 value;
    }

    function mint(
        address receiver,
        string memory tokenURI,
        Fee[] memory fees
    ) external returns (uint256);
}
