// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";


contract Wallet is Ownable {

    using SafeMath for uint256;

/* *** Storage ***
===================*/

    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    bytes32[] public tokenList;
    mapping(bytes32 => Token) public tokenMapping;
    mapping(address => mapping(bytes32 => uint)) public balances;


/* *** Events ***
==================*/

    event TokenAdded(bytes32 ticker, address tokenAddress);
    event TokenDeposited(uint amount, bytes32 ticker);
    event TokenWithdrawed(uint amount, bytes32 ticker);
    event EthDeposited(uint amount);
    event EthWithdrawed(uint amount);


/* *** Modifiers ***
==================*/

    modifier tokenExist(bytes32 ticker) {
        require(tokenMapping[ticker].tokenAddress != address(0), "The token doesn't exist!");
        _;
    }


/* *** Functions ***
=====================*/

    function addToken(bytes32 ticker, address tokenAddress) onlyOwner external {
        tokenMapping[ticker] = Token(ticker, tokenAddress);
        tokenList.push(ticker);
        emit TokenAdded(ticker, tokenAddress);       
    }

    function deposit(uint amount, bytes32 ticker) tokenExist(ticker) external {
        IERC20(tokenMapping[ticker].tokenAddress).transferFrom(msg.sender, address(this), amount);
        balances[msg.sender][ticker] = balances[msg.sender][ticker].add(amount);
        emit TokenDeposited(amount, ticker);
    }

    function withdraw(uint amount, bytes32 ticker) tokenExist(ticker) external {
        require(balances[msg.sender][ticker] >= amount, "Balance insufficient");

        balances[msg.sender][ticker] = balances[msg.sender][ticker].sub(amount);
        IERC20(tokenMapping[ticker].tokenAddress).transfer(msg.sender, amount);
        emit TokenWithdrawed(amount, ticker);
    }

    function depositEth() payable external {
        balances[msg.sender][bytes32("ETH")] = balances[msg.sender][bytes32("ETH")].add(msg.value);
        emit EthDeposited(msg.value);
    }

    function withdrawEth(uint amount) external {
        require(balances[msg.sender][bytes32("ETH")] >= amount, "Balance insufficient");
        uint oldBal = balances[msg.sender][bytes32("ETH")];
        balances[msg.sender][bytes32("ETH")] = balances[msg.sender][bytes32("ETH")].sub(amount);
        assert(oldBal == balances[msg.sender][bytes32("ETH")] + (amount));
        (bool success, ) = msg.sender.call{value:amount}("");
        require(success, "Transfer failed.");
        emit EthWithdrawed(amount);
    }
}