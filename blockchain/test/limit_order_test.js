const Dex = artifacts.require("Dex")
const Link = artifacts.require("Link")
const truffleAssert = require('truffle-assertions');

contract("Dex", accounts => {
    it("should revert if not enough ETH to open a BUY order", async () => {
        let dex = await Dex.deployed();
        await truffleAssert.reverts(
            dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 1, 10)
        )
        dex.depositEth({value: 10})
        await truffleAssert.passes(
            dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 1, 10)
        )
    })

    it("should revert if not enough tokens to open a SELL order", async () => {
        let dex = await Dex.deployed();
        let link = await Link.deployed();
        await truffleAssert.reverts(
            dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 10)
        );
        await link.approve(dex.address, 500);
        await dex.addToken(web3.utils.fromUtf8("LINK"), link.address, {from: accounts[0]});
        await dex.deposit(10, web3.utils.fromUtf8("LINK"));
        await truffleAssert.passes(
            dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 10)
        );
    })

    it("should be sorted correctly in the order book when BUY", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()
        await link.approve(dex.address, 500);
        await dex.depositEth({value: 3000});
        await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 1, 100)
        await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 1, 250)
        await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 1, 50)
        await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 1, 200)

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 0);
        assert(orderbook.length > 0, "The order book is empty");
        console.log(orderbook);
        for (let i = 0; i < orderbook.length-1; i++) {
            assert(orderbook[i].price >= orderbook[i+1].price, "The BUY order book isn't sorted correctly")
        }
    })

    it("should be sorted correctly in the order book when SELL", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()
        await link.approve(dex.address, 500);
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 100)
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 250)
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 50)
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 200)

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1);
        assert(orderbook.length > 0, "The order book is empty");
        console.log(orderbook);
        for (let i = 0; i < orderbook.length-1; i++) {
            assert(orderbook[i].price <= orderbook[i+1].price, "The SELL order book isn't sorted correctly")
        }
    })
})