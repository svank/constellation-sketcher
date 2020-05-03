const merge = require('webpack-merge');
const common = require('./webpack.prod.js');
const EsmWebpackPlugin = require("@purtuga/esm-webpack-plugin");

module.exports = merge(common, {
    output: {
        filename: 'constellation_sketcher.module.js',
        library: "LIB",
        libraryTarget: "var"
    },
  plugins: [
        new EsmWebpackPlugin()
    ]
});