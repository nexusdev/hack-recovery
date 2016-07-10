var _ = require('lodash');
var BigNumber = require('bignumber.js');
var fs = require('fs');

var dsEthToken = require('./dsEthToken.json');
var simpleMarket = require('./simpleMarket.json');

var addresses = Object.keys(dsEthToken).concat(Object.keys(simpleMarket));

addresses = _.uniq(addresses);

var restored = {};

addresses.forEach(address => {
  restored[address] = new BigNumber(0);

  if(address in dsEthToken) {
    var ethBalance = new BigNumber(dsEthToken[address]);
    restored[address] = restored[address].add(ethBalance);
  }
  if(address in simpleMarket && "ETH" in simpleMarket[address]) {
    restored[address] = restored[address].add(new BigNumber(simpleMarket[address].ETH));
  }
});

// remove zero balances
restored = _.omitBy(restored, bal => bal.toString() === '0');

var formated = _.map(restored, (bal, addr) => `${addr}: ${bal.toString(10)}`).join('\n');
fs.writeFileSync("balances.txt", formated, {encoding: "utf8"});
console.log(formated);
