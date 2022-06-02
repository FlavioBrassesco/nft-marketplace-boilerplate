const { ethers } = require("ethers");
const { abi } = require("@services/blockchain/abi/NFTCollectionManager.json");
const erc721 = require("@services/blockchain/abi/erc721.json");
const CoreContractsService = require("@services/database/CoreContractsService");

function CollectionsService() {
  this._collections = [];

  this.getCollectionManager = async (provider) => {
    return new ethers.Contract(
      "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      abi,
      provider
    );
  };

  this.getCollection = async (address, provider) => {
    return new ethers.Contract(address, erc721.abi, provider);
  };

  this.get = async (address, provider) => {
    const collectionManager = await this.getCollectionManager(provider);
    const collectionContract = await this.getCollection(address, provider);
    const collection = {
      name: await collectionContract.name(),
      symbol: await collectionContract.symbol(),
      address,
      metadataURL: await collectionContract.contractURI(),
      supply: (await collectionContract.totalSupply()).toString(),
      volume: "",
      sales: 0,
      items: 0,
      fee: (await collectionManager.getFee(address)).toString(),
      floorPrice: (await collectionManager.getFloorPrice(address)).toString(),
      isWhitelisted: await collectionManager.isWhitelistedCollection(address),
    };
    return collection;
  };

  this.getAll = async (provider) => {
    const collectionManager = await this.getCollectionManager(provider);
    const count = await collectionManager.getCollectionsCount();

    if (count.gt(0)) {
      const collections = await Promise.all(
        [...Array(count.toNumber())].map(async (a, i) => {
          const address = await collectionManager.collectionByIndex(i);
          return this.get(address, provider);
        })
      );

      return collections;
    }
  };

  this.addWhitelistedCollection = async (provider, address) => {
    const collectionManager = await this.getCollectionManager(
      provider.getSigner()
    );
    await collectionManager.addWhitelistedCollection(address, true);
  };

  this.setFee = async (provider, address, fee) => {
    const collectionManager = await this.getCollectionManager(provider);
    await collectionManager.setFee(address, fee);
  };

  this.setFloorPrice = async (provider, address, floorPrice) => {
    const collectionManager = await this.getCollectionManager(provider);
    await collectionManager.setFloorPrice(address, floorPrice);
  };
}

module.exports = CollectionsService;

const schemas = `
o2m (collection to items)
collection {
  id
  address
  fee
  floorPrice
  whitelistStatus
  !cmetadataId
}

o2m (item to offers) 
o2o (item to user)
o2o (item to metadata)
item {
  id
  tokenId
  !address
  !owner
  price
  status
  ?currentBidder
  ?currentBid
  ?endsAt
  offers[id]
  !metadataId
}

user {
  id
  address
  items[id]
  offers[id]
}

offer {
  id
  !itemId
  !userId
  price
}

metadata {
  id
  !itemId
  img
  traits[{}]
}

cmetadata {
  id
  !collectionId
  img
  banner
  description
  etc
}
`;
