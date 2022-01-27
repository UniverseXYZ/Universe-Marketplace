// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../royalties/HasSecondarySaleFees.sol";

contract MockNFTSecondaryFees is ERC721URIStorage, HasSecondarySaleFees {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC721("MockNFT", "NFT") {}

    function mint(string memory tokenURI, Fee[] memory fees)
        public
        returns (uint256)
    {
        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();
        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, tokenURI);
        _registerFees(newItemId, fees);

        return newItemId;
    }

    function _registerFees(uint256 _tokenId, Fee[] memory _fees) internal {
        require(_fees.length <= 5, "No more than 5 recipients");
        address[] memory recipients = new address[](_fees.length);
        uint256[] memory bps = new uint256[](_fees.length);
        uint256 sum = 0;
        for (uint256 i = 0; i < _fees.length; i++) {
            require(_fees[i].recipient != address(0x0), "Recipient should be present");
            require(_fees[i].value != 0, "Fee value should be positive");
            sum += _fees[i].value;
            fees[_tokenId].push(_fees[i]);
            recipients[i] = _fees[i].recipient;
            bps[i] = _fees[i].value;
        }
        require(sum <= 3000, "Fee should be less than 30%");
        if (_fees.length > 0) {
            emit SecondarySaleFees(_tokenId, recipients, bps);
        }
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Storage, ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}