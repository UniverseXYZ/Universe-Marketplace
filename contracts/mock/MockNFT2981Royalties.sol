// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../royalties/ERC2981Royalties.sol";

contract MockNFTERC2981Royalties is ERC721URIStorage, ERC2981Royalties {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC721("MockNFT", "NFT") {}

    function mint(string memory tokenURI, uint256 royaltyFeeBps, address royaltyRecipient)
        public
        returns (uint256)
    {
        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();
        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, tokenURI);
        _setTokenRoyalty(newItemId, royaltyRecipient, royaltyFeeBps);

        return newItemId;
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Storage, ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

}