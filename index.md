





  

```
"use strict";

```







The block height before the attack is **1679390** so we will retreive
the needed information from this block.


  

```
const blockHeight = 1679390;

```







### Overview
1. DSEthToken
    1. find all addresses which could hold tokens
    2. find balances for each address
    3. generate and save as object
2. SimpleMarket
    1. find numbere of offers
    2. find all offers
    3. filter for valide offers
    4. sort and group offers by address and token
    5. generate and save as object

first we set up our environment


  

```
var Web3 = require('web3');
var _ = require('lodash');
var async = require('async');
var BigNumber = require('bignumber.js');
var fs = require('fs');

var web3 = new Web3(new Web3.providers.HttpProvider("http://107.170.127.70:8545"));

```







#### DSEthToken
The first contract we want to rescue is the DSEthToken contract.
The known vulnerability was discovered in
`dappsys@92a4fd915b69ccb2553994af3bded429a9467417`
Here we load its interface after we build it previously


  

```
var dappsys = require('./dappsys.json');
var DSEthToken = web3.eth.contract(JSON.parse(dappsys.DSEthToken.interface));
var dsEthToken = DSEthToken.at('0xd654bdd32fc99471455e86c2e7f7d7b6437e9179');

```







We are interested in the balances of each address.
Unfortunatelly we are dealing here with a mapping:
`mapping( address => uint ) _balances;`
therefore its not possible to query all addresses which hold tokens.
However, we can filter all the Deposit and Transfer events to learn
about all possible addresses, which could hold any tokens


  

```
var deposits = dsEthToken.Deposit({},{fromBlock: 0, toBlock: blockHeight});
var transfears = dsEthToken.Transfer({},{fromBlock: 0, toBlock: blockHeight});

var getAllEvents = async.parallel.bind(async, [
  deposits.get.bind(deposits),
  transfears.get.bind(transfears)
]);

```







after we retreive those events, we have to filter them for addresses,
which could possibly hold ether:
In case of a Deposit, the sender(who) could have ether
In case of a Transfer, the receiver(to) could have ether


  

```
var filterDeposits = function (event) {
  return event.args.who;
}
var filterTransfear = function (event) {
  return event.args.to;
}

```







apply the filter and concatenate the addresses to one array
also we are just interested in unique addresses


  

```
var filterAddresses = function (res, cb) {
  let deposits = res[0];
  let transfears = res[1];

  let addresses =
    deposits.map(filterDeposits)
    .concat(transfears.map(filterTransfear))

  cb(null, _.uniq(addresses));
}

```







now we have just to lookup and output the balances of each address


  

```
var getAllBalances = (addresses, cb) => {
  async.parallel(
    addresses.map(address => dsEthToken.balanceOf.bind(dsEthToken, address, blockHeight)),
      (err, balances) => {cb(err, addresses, balances)})
};

```







generate a balances object, which is a mapping (address => balance) and
save it as dsEthToken.json


  

```
var saveBalances = function (addresses, balances, cb) {
  let totalSum = new BigNumber(0);
  let savedBalances = {};
  
  console.log('\nResults for DSEthToken:');
  balances.forEach((balance, index) => {
    totalSum = totalSum.plus(balance);
    savedBalances[addresses[index]] = balance.toString(10);
    console.log(addresses[index], balance.toString(10) );
  });

  fs.writeFileSync('dsEthToken.json', JSON.stringify(savedBalances, false, 2));

  console.log("Total Sum:", web3.fromWei(totalSum,'ether').toString(10)+"eth");
  console.log("balances saved to ./dsEthToken.json");
  cb(null, savedBalances);
}

```







now we created all our tasks to to retreive all importent information for dsEthToken


  

```
var getDsEthTokenBalances = async.waterfall.bind(this, [
  getAllEvents,
  filterAddresses,
  getAllBalances,
  saveBalances
]);

```







Next we will rescue the funds from **Maker-OTC**, in particular all acive
orders from SimpleMarket@0xf51bc4633f5924465c8c6317169faf3e4312e82f


  

```
var makerotc = require('./maker-otc.json');
var SimpleMarket = web3.eth.contract(JSON.parse(makerotc.SimpleMarket.interface));
var simpleMarket = SimpleMarket.at('0xf51bc4633f5924465c8c6317169faf3e4312e82f');

```







first we need to know how many orders there are:


  

```
var getOrderNumber = simpleMarket.last_offer_id.bind(simpleMarket);

```







with that info we can get all orders with


  

```
var getOffer = simpleMarket.offers.bind(simpleMarket);

```







we can get all offers provided we know how many there are


  

```
var getAllOffers = (number, cb) => async.mapSeries.bind(async, _.range(number), getOffer, cb)()

```







also we are just interested in **active** orders and in particular in
who sells how much of what


  

```
var filterOffers = (offers, cb) => {

```







get only active offers


  

```
  let interestingOffers = offers.filter(offer => offer[5]);

```







and return interesting properties


  

```
  let interestingProperties = interestingOffers.map(offer => ({
    owner: offer[4],
    token: web3.toAscii(offer[1]).replace(/\u0000/g,''),
    ammount: offer[0]
  }));
  cb(null, interestingProperties);
}

```







After we got all the interesting stuff, we can summ over each user and toke
to get the total offered ammount


  

```
var constructInterestingObject = (offers, cb) => {
  var balances = {}; // mapping (address => token => balance)
  offers.forEach(offer => {

```







ensure we are aware of the owner


  

```
    if (!(offer.owner in balances)) balances[offer.owner] = {};

```







in case we are (ower => token) aware
=> we add the token to the known balance
in case we are not token aware
=> we simply add it


  

```
    if (offer.token in balances[offer.owner]) {
      balances[offer.owner][offer.token] =
        balances[offer.owner][offer.token].plus(offer.ammount);
    } else {
      balances[offer.owner][offer.token] =
        offer.ammount;
    }
  });

```







after this we also format the balance to decimals and save it 
as simpleMarket.json


  

```
  console.log('\nResults for SimpleMarket:');
  _.each(balances, (tokens, owner) => {
    _.each(tokens, (balance, token) => {
      balances[owner][token] = balance.toString(10);
      console.log(owner, token, balance.toString(10));
    });
  });

  fs.writeFileSync('simpleMarket.json', JSON.stringify(balances, false, 2));

  cb(null, balances);
}

```







now we combine all our tasks to retreive the balances for SimpleMarket


  

```
var getSimpleMarketBalances = async.waterfall.bind(this, [
  getOrderNumber,
  getAllOffers,
  filterOffers,
  constructInterestingObject
])

```







after ths we generate a human readabele document with all relevant information:


  

```
var genDoc = function (err, docs) {
  let dsEthToken = docs[0];
  let simpleMarket = docs[1];
  var readmeTemplate = fs.readFileSync('README.md.tmp', {encoding: 'utf8'});
  var indexMd = fs.readFileSync('index.md', {encoding: 'utf8'});


```







 generate dsEthToken table
 generate simpleMarket table


  

```
  var dsEthTokenTable = `| Address | Ammount |\n| ------------- | ------------- |\n`
  + _.map(dsEthToken, (balance, address) => `| ${address} | ${balance} |`).join('\n');

  var simpleMarketTable = `| Address | Token | Ammount |\n| ------------- | ------------- | ------------- |\n`
  + _.flatten(_.map(simpleMarket, (tokens, address) =>
          _.map(tokens, (balance, token) =>
                `| ${address} | ${token} | ${balance} |`))
               ).join('\n');

  var scope = {
    how: indexMd,
    dsEthToken: dsEthTokenTable,
    simpleMarket: simpleMarketTable
  };


```







generate and save the readme


  

```
  var template = _.template(readmeTemplate);
  var readme = template(scope);
  fs.writeFileSync('README.md', readme);

}

```







Run the tasks


  

```
async.parallel([
  getDsEthTokenBalances,
  getSimpleMarketBalances
], genDoc);
console.log('running the tasks, this may take several minutes...');


```




