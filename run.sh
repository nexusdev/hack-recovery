#!/bin/sh

# build maker-otc and dappsys in order to have access to its classes
cd dapple_packages/maker-otc/
dapple build
cd dapple_packages/dappsys/
dapple build -e morden
cd ../../../..

# link classes and interfaces into the working dir
ln -s dapple_packages/maker-otc/frontend/packages/dapple/build/classes.json maker-otc.json
ln -s dapple_packages/maker-otc/dapple_packages/dappsys/build/classes.json dappsys.json

# generate js documentation
node_modules/docco/bin/docco index.js -l plain-markdown -o .
mv index.html index.md
