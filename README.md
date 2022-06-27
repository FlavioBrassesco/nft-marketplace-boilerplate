# NFT Marketplace boilerplate

Core technologies: hardhat, nextjs, tailwindcss

added scripts for hardhat deploying and minting on mumbai
remember to verify providing arguments for the contract if needed. (-- "argument1" "argument2")

API and services:

Blockchain Read operations could be implemented as API endpoints
Database CRUD operations should be implemented as API endpoints

There will be mixed operations for writing in blockchain and database
database should write only after successful blockchain operation

Reading operations should check database cached results with blockchain and write in response if needed

Therefore Services should perform both mixed operations if the values they provide are both on-database and on-chain

 
# UPDATE
We're going to implement first the blockchain functionality and then plug a cache mechanism
We need to implement a good workflow for testing the Service-Context-Consumer Loop:

MockupDeploy ready. Marketplace filling with on-chain mockup data.
** May need to address issue with high gas costs
** Need to return tokenId in enumeration methods for market contracts
** Need to make market item variable public, so fetching with address and tokenID will return an item

** Rename contract functions to improve readability

** Implement a proxy pattern to have, for example, a single panic switch, and in a future the functionality to allow owners to create collections and mint automatically

** what happens when someone buys in erc20... window opens to send eth? is there a way to fix it?

----

Proxy pattern para implementar el cacheo de los servicios.