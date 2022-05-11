import { ethers } from "ethers";

const connectMetamask = async () => {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  return provider;
};

export default connectMetamask;
