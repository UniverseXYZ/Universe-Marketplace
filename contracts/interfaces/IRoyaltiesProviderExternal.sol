// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "../lib/LibPart.sol";

interface IRoyaltiesProviderExternal {
    function getRoyalties(address token, uint tokenId) external returns (LibPart.Part[] memory);
}
