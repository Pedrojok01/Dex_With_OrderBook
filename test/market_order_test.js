const Dex = artifacts.require("Dex");
const Link = artifacts.require("Link");
const truffleAssert = require('truffle-assertions');

contract("Dex", accounts => {

    it("should be possible to submit a market order even if the order book is empty", async () => {
        let dex = await Dex.deployed()
        
        await dex.depositEth({value: 50000});

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 0); //Get buy side orderbook
        assert(orderbook.length == 0, "Buy side Orderbook length is not 0");
        
        await truffleAssert.passes(
            dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 10)
        )
    })

    it("shouldn't fill more limit order than the market order amount", async () => {
        let dex = await Dex.deployed();
        let link = await Link.deployed();
        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1);
        assert(orderbook.length == 0, "The SELL order book should be empty at start of test");

        await dex.addToken(web3.utils.fromUtf8("LINK"), link.address);
        
        //Send LINK tokens to accounts 1, 2, 3 from account 0
        await link.transfer(accounts[1], 200);
        await link.transfer(accounts[2], 200);
        await link.transfer(accounts[3], 200);

        //Approve LINK for accounts 1, 2, 3
        await link.approve(dex.address, 50, {from: accounts[1]});
        await link.approve(dex.address, 50, {from: accounts[2]});
        await link.approve(dex.address, 50, {from: accounts[3]});

        //Deposit LINK for accounts 1, 2, 3
        await dex.deposit(50, web3.utils.fromUtf8("LINK"), {from: accounts[1]});
        await dex.deposit(50, web3.utils.fromUtf8("LINK"), {from: accounts[2]});
        await dex.deposit(50, web3.utils.fromUtf8("LINK"), {from: accounts[3]});
        
        //Create limit order in the order book
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 100, {from: accounts[1]});
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 200, {from: accounts[2]});
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 300, {from: accounts[3]});
        
        //Create market order that should fill 2/3 of the order book
        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 10);

        orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1);
        assert(orderbook.length == 1, "The SELL order book should have only 1 entry left");
        assert(orderbook[0].filled == 0, "The SELL side order should have 0 amount filled");
    })

    it("should fill the market order until the order book is empty or the market order is 100% filled", async () => {
        let dex = await Dex.deployed();
        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1);
        assert(orderbook.length == 1, "The SELL order book should have only 1 entry left");

        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 400, {from: accounts[1]})
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 500, {from: accounts[2]})

        let balanceBefore = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"))
        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 50);
        let balanceAfter = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"))
        assert.equal(balanceBefore.toNumber() + 15, balanceAfter.toNumber());
    })

    it("should reduce the buyer's ETH balance accordingly to the filled amount", async () => {
        let dex = await Dex.deployed();
        let link = await Link.deployed();

        await link.approve(dex.address, 500, {from: accounts[1]});
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 300, {from: accounts[1]});

        let balanceBefore = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"));
        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 1)
        let balanceAfter = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"));
        assert.equal(balanceBefore -300, balanceAfter);
    })

    it("should reduce the seller's LINK balance accordingly to the filled amount", async () => {
        let dex = await Dex.deployed();
        let link = await Link.deployed();
        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1);
        assert(orderbook.length == 0, "The SELL order book should be empty at start of test");

        await link.approve(dex.address, 500, {from: accounts[2]});
        await dex.deposit(50, web3.utils.fromUtf8("LINK"), {from: accounts[2]});

        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 300, {from: accounts[1]});
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 400, {from: accounts[2]});

        let account1BalanceBefore = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"));
        let account2BalanceBefore = await dex.balances(accounts[2], web3.utils.fromUtf8("LINK"));

        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 2)

        let account1BalanceAfter = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"));
        let account2BalanceAfter = await dex.balances(accounts[2], web3.utils.fromUtf8("LINK"));

        assert.equal(account1BalanceBefore -1, account1BalanceAfter);
        assert.equal(account2BalanceBefore -1, account2BalanceAfter);
    })

    it("should remove orders from the order book once there are filled", async () => {
        let dex = await Dex.deployed();
        let link = await Link.deployed();
        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1);
        assert(orderbook.length == 0, "The SELL order book should be empty at start of test");

        await link.approve(dex.address, 500);
        await dex.deposit(100, web3.utils.fromUtf8("LINK"));

        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 300);
        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 1);

        orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1);
        assert(orderbook.length == 0, "The SELL order book should be empty after the trade");
    })

    it("should set the filled property of limit orders correctly after a trade", async () => {
        let dex = await Dex.deployed();
        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1);
        assert(orderbook.length == 0, "The SELL order book should be empty at start of test");

        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 300, {from: accounts[1]});
        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 2);

        orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1);
        assert.equal(orderbook[0].filled, 2);
        assert.equal(orderbook[0].amount, 5);
    })

    it("should have enough tokens to trade when creating a SELL market order", async () => {
        let dex = await Dex.deployed();
        let balance = await dex.balances(accounts[5], web3.utils.fromUtf8("LINK"));
        assert.equal(balance.toNumber(), 0, "Initial LINK balance isn't 0");
        await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 5, 300)
        await truffleAssert.reverts(
            dex.createMarketOrder(1, web3.utils.fromUtf8("LINK"), 5, {from: accounts[5]})
        )
        await truffleAssert.passes(
            dex.createMarketOrder(1, web3.utils.fromUtf8("LINK"), 5)
        )
    })

    it("should have enough ETH to trade when creating a BUY market order", async () => {
        let dex = await Dex.deployed();
        let balance = await dex.balances(accounts[5], web3.utils.fromUtf8("ETH"));
        assert.equal(balance.toNumber(), 0, "Initial ETH balance isn't 0");
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 300)
        await truffleAssert.reverts(
            dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 10, {from: accounts[5]})
        )
        await truffleAssert.passes(
            dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 5)
        )
    })
    
})