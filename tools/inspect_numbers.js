const fs = require('fs');
const path = require('path');
const { GRFSet } = require('./grf');

const grf = new GRFSet('./THE BOX WORLD', ['_sprites.grf', '_textures.grf', 'data.grf', '_prontera_box.grf', '_en.grf']);

const files = fs.readdirSync('./ro-survivors/assets/effects/numbers');
console.log('Numbers directory has:', files);
