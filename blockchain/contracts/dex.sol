// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./wallet.sol";


contract Dex is Wallet {

    using SafeMath for uint256;


/* *** Storage ***
===================*/

    enum Side {
        BUY,
        SELL
    }
    
    struct Order {
        uint orderId;
        address trader;
        Side side;
        bytes32 ticker;
        uint amount;
        uint price;
        uint filled;
    }

    uint public nextOrderId = 1;
    mapping(bytes32 => mapping(uint => Order[])) public orderBook; //Map by ticker and side
    

/* *** Events ***
==================*/

    event limitOrderCreated(Side side, bytes32 _ticker, uint _amount, uint _price);
    event marketOrderFilled(Side side, bytes32 _ticker, uint _amount);
    event filledOrderRemoved(uint _Id, Side side, bytes32 _ticker);
    event ethSwapped(bytes32 _ticker, address _to, uint _amount, uint price);
    event tokenSwapped(bytes32 _ticker, address _to, uint _amount, uint price);


/* *** Functions ***
=====================*/

    function getOrderBook(bytes32 _ticker, Side side) view public returns(Order[] memory) {
        return orderBook[_ticker][uint(side)];
    }


    function getOrderBookSide(Side side) pure internal returns(uint) {
        if(side == Side.BUY){
            return 1;
        }
        else{
            return 0;
        }
    }


    function swapEth(bytes32 _ticker, address _to, uint _amount, uint price) internal {
        require(balances[msg.sender]["ETH"] >= _amount.mul(price), "Not enough ETH");

        balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].sub(_amount.mul(price));
        balances[_to][_ticker] = balances[_to][_ticker].sub(_amount);
        balances[msg.sender][_ticker] = balances[msg.sender][_ticker].add(_amount);
        balances[_to]["ETH"] = balances[_to]["ETH"].add(_amount.mul(price));

        emit ethSwapped(_ticker, _to, _amount, price);
    }


    function swapToken(bytes32 _ticker, address _to, uint _amount, uint price) internal {
        require(balances[msg.sender][_ticker] >= _amount, "Not enough tokens");

        balances[msg.sender][_ticker] = balances[msg.sender][_ticker].sub(_amount);
        balances[_to]["ETH"] = balances[_to]["ETH"].sub(_amount.mul(price));
        balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].add(_amount.mul(price));
        balances[_to][_ticker] = balances[_to][_ticker].add(_amount);

        emit tokenSwapped(_ticker, _to, _amount, price);
    }


    function createLimitOrder(Side side, bytes32 _ticker, uint _amount, uint _price) public returns(bool success) {
        if(side == Side.BUY){
            require(balances[msg.sender]["ETH"] >= _amount.mul(_price), "Not enough ETH");
        }
        else if(side == Side.SELL) {
            require(balances[msg.sender][_ticker] >= _amount, "Not enough tokens");
        }

        Order[] storage orders = orderBook[_ticker][uint(side)];
        orders.push(
            Order(nextOrderId, msg.sender, side, _ticker, _amount, _price, 0)
        );

        //Order book sorting (bubble):
        uint i = orders.length > 0 ? orders.length -1 : 0;

        if(side == Side.BUY) {
            for(i; i > 0; i--)
                if(orders[i].price < orders[i-1].price){
                    break;
                }
                else{
                    Order memory tempValue = orders[i];
                    orders[i] = orders[i-1];
                    orders[i-1] = tempValue;
                }
        }
        else if(side == Side.SELL) {
            for(i; i > 0; i--)
                if(orders[i].price > orders[i-1].price){
                    break;
                }
                else{
                    Order memory tempValue = orders[i];
                    orders[i] = orders[i-1];
                    orders[i-1] = tempValue;
                }
        }

        nextOrderId++;
        emit limitOrderCreated(side, _ticker, _amount, _price);
        return true;
    }


    function createMarketOrder(Side side, bytes32 _ticker, uint _amount) public {
        uint orderBookSide = getOrderBookSide(side);
        Order[] storage orders = orderBook[_ticker][orderBookSide];

        //Loop through order book til order filled or order book emptied
        uint totalFilled = 0;
        uint leftToFill = _amount;

        for (uint i = 0; orders.length != 0; i) {
            totalFilled = totalFilled.add(orders[i].amount);

            //Single limit order needed:
            if(totalFilled == _amount){
                if(orderBookSide == 1){
                    swapEth(_ticker, orders[i].trader, leftToFill, orders[i].price);
                    orders[i].filled = orders[i].amount;
                    removeFilledOrder(orders[i].orderId, side, _ticker);
                    break;
                }
                else{
                    swapToken(_ticker, orders[i].trader, leftToFill, orders[i].price);
                    orders[i].filled = orders[i].amount;
                    removeFilledOrder(orders[i].orderId, side, _ticker);
                    break;
                }
            }
            
            else if(totalFilled > _amount){   
                if(orderBookSide == 1){
                    swapEth(_ticker, orders[i].trader, leftToFill, orders[i].price);
                    orders[i].filled = orders[i].filled.add(_amount);
                    break;
                }
                else{
                    swapToken(_ticker, orders[i].trader, leftToFill, orders[i].price);
                    orders[i].filled = orders[i].filled.add(_amount);
                    break;
                }
            }

            //More than 1 limit order needed:
            else if (totalFilled < _amount){
                leftToFill -= orders[i].amount;

                //For market BUY
                if(orderBookSide == 1){
                    swapEth(_ticker, orders[i].trader, orders[i].amount, orders[i].price);
                    orders[i].filled = orders[i].amount;
                    removeFilledOrder(orders[i].orderId, side, _ticker);
                }
                //For market SELL
                else {
                    swapToken(_ticker, orders[i].trader, orders[i].amount, orders[i].price);
                    orders[i].filled = orders[i].amount;
                    removeFilledOrder(orders[i].orderId, side, _ticker);
                }
            }
        }
        emit marketOrderFilled(side, _ticker, _amount);
    }


    function removeFilledOrder(uint _Id, Side side, bytes32 _ticker) internal {
        Order[] storage orders = orderBook[_ticker][getOrderBookSide(side)];
        require(orders[0].amount == orders[0].filled, "the order isn't fully filled");

        for (uint i = 0; i < orders.length-1; i++){
            orders[i] = orders[i+1];
        }
        orders.pop();

        emit filledOrderRemoved(_Id, side, _ticker);
    }

}