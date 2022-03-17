require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
require("@nomiclabs/hardhat-etherscan");

const privateKey = process.env.PRIVATE_KEY;
const maticUrl = process.env.MATIC_APP_ID;
const polyScan = process.env.POLYGONSCAN;
const from = process.env.OWNER_ADDRESS;
const mnemonic = process.env.MNEMONIC;

module.exports = {
  solidity: {
    version: "0.8.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    ganache: {
      from: "0xd94C02d5aeFE85C1878Dc632f5Ee02aaf4341d1c",
      chainId: 1337,
      url: "HTTP://127.0.0.1:7545",
      accounts: {
        mnemonic:
          "excite field online wine obtain vital elegant main text awkward age slide",
      },
    },
    matic: {
      from: from,
      chainId: 137,
      url: `https://rpc-mainnet.maticvigil.com/v1/${maticUrl}`,
      accounts: [privateKey],
    },
    mumbai: {
      from: from,
      chainId: 80001,
      url: `https://rpc-mumbai.maticvigil.com/v1/${maticUrl}`,
      accounts: [privateKey],
    },
    bsctestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: { mnemonic: mnemonic },
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: { mnemonic: mnemonic },
    },
  },
  //* Keep name as 'etherscan' to avoid errors.
  etherscan: {
    url: "https://polygonscan.com/",
    apiKey: polyScan,
  },
};
