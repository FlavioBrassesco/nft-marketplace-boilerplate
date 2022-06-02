const SiteOptionsService = require("../services/database/SiteOptionsService");
const { expect } = require("chai");

const siteOptions = new SiteOptionsService();

it("should retrieve core contracts", async () => {
  const { data } = await siteOptions.get();
  console.log(data);
  expect(data.options.title).to.equal("NFT Marketplace");
});
