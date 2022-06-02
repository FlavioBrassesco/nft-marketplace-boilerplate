const CoreContractsService = require("../services/database/CoreContractsService");
const { expect } = require("chai");

const coreContract = new CoreContractsService();

it("should retrieve core contracts", async () => {
  const { data } = await coreContract.get();
  expect(data).to.have.length(9);
});
