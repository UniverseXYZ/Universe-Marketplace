pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../royalties/ERC2981Royalties.sol";

contract MockNFTERC2981Royalties is ERC721, ERC2981Royalties {
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

}