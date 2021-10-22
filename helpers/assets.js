const ethUtil = require("ethereumjs-util");
const { web3 } = require("hardhat");

function id(str) {
  return `0x${ethUtil.keccak256(str).toString("hex").substring(0, 8)}`;
}

function encodeToken(token, tokenId) {
  if (tokenId) {
    return web3.eth.abi.encodeParameters(
      ["address", "uint256"],
      [token, tokenId]
    );
  } else {
    return web3.eth.abi.encodeParameter("address", token);
  }
}

function encodeBundleInfo(tokenAddresses, tokenIds) {
  return web3.eth.abi.encodeParameter("tuple(address,uint256[])[]", [
    [tokenAddresses[0], tokenIds[0]],
    [tokenAddresses[1], tokenIds[1]],
  ]);
}

function encodeOrderData() {
  return web3.eth.abi.encodeParameter("tuple(address,uint256)[]", [
    ["0x67b93852482113375666a310ac292D61dDD4bbb9", 1000],
    ["0x135C2FA0e47Ab3C6b37bEA403845537015f4BBc0", 2000],
  ]);
}

const ETH = id("ETH");
const ERC20 = id("ERC20");
const ERC721 = id("ERC721");
const ERC721_BUNDLE = id("ERC721_BUNDLE");
const ERC1155 = id("ERC1155");
const ORDER_DATA_V1 = id("V1");
const ORDER_DATA = id("ORDER_DATA");
const TO_MAKER = id("TO_MAKER");
const TO_TAKER = id("TO_TAKER");
const PROTOCOL = id("PROTOCOL");
const ROYALTY = id("ROYALTY");
const ORIGIN = id("ORIGIN");
const PAYOUT = id("PAYOUT");

module.exports = {
  id,
  ETH,
  ERC20,
  ERC721,
  ERC721_BUNDLE,
  ERC1155,
  ORDER_DATA_V1,
  ORDER_DATA,
  TO_MAKER,
  TO_TAKER,
  PROTOCOL,
  ROYALTY,
  ORIGIN,
  PAYOUT,
  encodeToken,
  encodeBundleInfo,
  encodeOrderData,
};
